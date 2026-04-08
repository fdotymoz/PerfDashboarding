# Performance Dashboard - Project Guide

## Project Overview

A modern, interactive dashboard for tracking Mozilla Firefox performance metrics, including:
- Bug tracking by performance impact
- Benchmark scores and trends
- Component ownership analysis
- Performance priority tracking (Speedometer 3, Android Applink)

**Live Development**: http://localhost:3000/

## Tech Stack

- **Frontend**: React 18 + Vite
- **Charts**: Chart.js with react-chartjs-2
- **Data Source**: Mozilla Bugzilla REST API
- **Styling**: CSS with light/dark mode toggle (JS-controlled `html.light-mode` class)
- **State Management**: React hooks (useState, useEffect)

## Current Features

### 1. Overview Tab
- **Quick Stats** banner (full-width, top of page): Total Bugs, Open Bugs, Closed Bugs, Priority SP3 (→ Perf Priorities tab SP3 Prio), My Tracking (→ My Tracking tab), Applink Delta YTD % (→ Benchmarks tab, green/red color-coded)
  - **Priority SP3** tile shows the count of bugs from meta bug #2026188; fetched via `fetchComponentPriorityBugs('sp3')` on Overview load
- **Overview tile layout** (3-column CSS grid `overview-grid--3col`):
  - Row 1: [E Speedometer 3 KPI] [F Android Applink KPI] [H JetStream 3 KPI]
  - Row 2: [C Priority Tracking chart] [B SP3 Top Bugs] [G All-Comp Top Bugs]
  - Row 3: [D All-Component Area Hotspot — full width]
- **Tile descriptions**:
  - **B — SP3 Top Bugs**: top 5 highest-scoring SP3 bugs; shows score, bug ID link, summary, and flag chips
  - **C — Priority Tracking**: line chart with daily snapshots of SP3 and My Tracking counts; up to 30 days; persisted to `localStorage` under `priority_tracking_history`
  - **D — All-Component Area Hotspot**: horizontal bar chart (Chart.js `indexAxis: 'y'`) of area tag distribution across all non-SP3 components; fetched via `Promise.all` on Overview load; deduplicates by bug ID
  - **E — Speedometer 3 KPI**: shows Fx vs Chrome Start % (positive=green/good), links to Benchmarks tab; `▲/▼ Xpp` change indicator vs. previous fetch (persisted to `localStorage` under `perf_kpi_prev`)
  - **F — Android Applink KPI**: shows BLENDED TOTAL Fx Delta YTD % (negative=green/good), links to Benchmarks tab; same `perf_kpi_prev` key
  - **G — All-Comp Top Bugs**: top 5 highest-scoring bugs across all non-SP3 components; same row format as B
  - **H — JetStream 3 KPI**: shows Mac OSX Fx vs Competitor Start % (positive=green/good), links to Benchmarks tab; loads after first Benchmarks tab visit

### 2. Performance Impact Tab ⭐
- **Query by impact level**: High, Medium, Low
- **Custom field**: `cf_performance_impact` from Bugzilla
- **Component filtering**: Dropdown with bug counts per component
- **Table view**: Sortable, paginated bug list with:
  - Bug ID (linked to Bugzilla)
  - Summary
  - Severity (color-coded)
  - Status (color-coded)
  - Component
  - Assigned To
  - Last Changed Date
- **Pagination**: 10/25/50/100 items per page
- **Manual refresh**: Button to clear cache and fetch fresh data
- **Limit**: Up to 1,000 bugs per query
- Green `+` button adds bug to My Tracking with auto-tags (Perf High/Med/Low)

### 3. Benchmarks Tab
Two tables stacked vertically:

**Android Applink Startup** (STMO query #114368):
- Spreadsheet-style table: Platform, Weight, Fx Start, Fx Current, Fx Delta YTD (%), Chrome Start, Chrome Current, Fx vs Chrome Start (%), Fx vs Chrome Current (%)
- Delta columns color-coded: green = negative (improvement), red = positive (regression)
- BLENDED TOTAL row bolded/highlighted (detected via `platform_label` containing "BLENDED")
- POST-then-poll pattern via Vite proxy (`/stmo` → `https://sql.telemetry.mozilla.org`)
- Refresh button uses `benchmarkRefreshTick` state to re-trigger the fetch useEffect
- YTD start date: 2026-01-01

**Speedometer 3 — Desktop & Android** (STMO query #96742):
- Daily time-series fetched, summarized to Jan 1 vs latest date
- Two rows: Desktop, Android
- Columns: Platform, Fx Start, Fx Current, Fx Delta YTD, Chrome Start, Chrome Current, Fx vs Chrome Start, Fx vs Chrome Current
- **Inverted color coding**: positive = green (higher score = better), negative = red
- Shows "Latest data: YYYY-MM-DD" footer
- Refresh button uses `speedometerRefreshTick` state

### 4. Components Tab
- **Top 10 components** with any performance impact
- Aggregates bugs from high/medium/low impact levels
- Bar chart showing bug counts by component

### 5. Perf Priorities Tab ⭐
**Second in nav order** (Overview → Perf Priorities → ...)

- **10 components tracked**: SP3 Prio, CSS Parsing & Transitions, DOM, Graphics, JavaScript Engine, Layout, Memory Allocator, Necko / Networking, Web Painting, Storage
- **SP3 Prio** component: loads bugs from meta bug #2026188 via `metaBugId` def type; full scoring fields fetched (cf_performance_impact, comment_count)
- **Dual signal query** (non-SP3 components): union of `status_whiteboard` contains `[perf-prio]` OR `cf_performance_impact` = high/medium
- **Necko** additionally queries `product=Firefox for Android` (no component filter) and merges + deduplicates
- **CSS** queries both CSS Parsing and CSS Transitions and Animations components
- **Memory** merges Memory Allocator + Cycle Collector results (deduplicated)
- **Composite scoring** per bug: perf signal (high=3, med=2, perf-prio only=1) + severity (S2=3, S3=2, S4=1) + priority (P2=3, P3=2, P4=1) + comment depth (≥30=3, ≥15=2, ≥8=1) + active in last 6 months (+1)
- **Sub-component grouping**: `SUB_LABEL_FNS` map supports Graphics (Core / Canvas2D / CanvasWebGL / ImageLib / Text / WebRender) and JavaScript Engine (Engine / JIT / GC); secondary tab row with bug count badges; "All" view renders grouped table sections
- **11 area-of-improvement tags** auto-detected from summary/component/product keywords:
  - SP3, Page Load, Scrolling, Video, Startup, Animation, Input, Memory, Battery, Network, Android
- **Area filter pills**: click one or more area tags to cross-filter the table
- **Flag chips** per row: ⚠ Underappreciated (high/medium impact but sev+pri unset), Needs Triage (no impact field + no sev/pri/assignee), Stale (>6 months inactive)
- **`+` button** per bug row: adds bug to My Tracking tab with auto-tag derived from `cf_performance_impact` (high→'Perf High', medium→'Perf Med', low→'Perf Low'); rendered only when `onAddToPriority` prop is passed
- **Key Observations** panel per component — hardcoded analysis from initial investigation, shown above the table
- **Export**: ↓ CSV (full table with Areas + Flags columns) and ↓ Report (Markdown with observations, bug table, scoring methodology, area definitions)
- Shows top 20 by default; "Show all N bugs" toggle
- Refresh button clears cache for the selected component only; 5-min TTL otherwise
- Default selected component: `initialKey` prop (defaults to `'sp3'`)

### 6. My Tracking Tab
**Last in nav order** (formerly "Performance Priority")

- **Priority Bugs** subsection only (Android Applink subsection removed):
  - Manually enter bug numbers (comma/space separated, Enter key support)
  - Fetches from Bugzilla API by ID via `fetchBugsByIds()`
  - Per-bug tags (alphanumeric, 15 char max) stored in localStorage
  - Tag-based multi-select filter dropdown
  - Remove bug via X button in table
  - Green `+` button on Performance Impact tab adds bugs here with auto-tags (Perf High/Med/Low)
  - Green `+` button on Perf Priorities tab adds bugs here with auto-tags (Perf High/Med/Low)
  - Toast notifications on add; state persisted to `priority_bug_ids` / `priority_bug_tags` in localStorage

## Performance Optimizations

### Caching (5-minute TTL)
- In-memory cache for API responses
- Cache keys generated from query parameters
- Console logs: "Cache HIT" or "Cache MISS"
- Manual refresh clears cache

### API Payload Reduction (60-80% smaller)
- Only fetch displayed fields: `id,summary,severity,status,component,assigned_to,assigned_to_detail,last_change_time,priority,product`
- Reduces bandwidth and response time

### Pagination
- Fetch up to 1,000 bugs
- Display 25 per page (configurable)
- Only renders visible rows (fast DOM)

## Project Structure

```
src/
├── components/
│   ├── Dashboard.jsx              # Main dashboard with all views
│   ├── Dashboard.css              # Dashboard styles
│   ├── BugTable.jsx               # Reusable bug table with pagination
│   ├── BugTable.css               # Table styles
│   ├── ComponentPriorities.jsx    # Perf Priorities tab (scoring, grouping, area tags, export)
│   └── ComponentPriorities.css   # Perf Priorities styles
├── services/
│   ├── bugzillaService.js         # Bugzilla API integration
│   ├── bugzillaService.test.js    # Unit tests for pure service functions
│   └── redashService.js           # STMO Redash API (query #114368, POST-then-poll)
├── utils/
│   ├── bugAnalysis.js             # Shared scoring/flag/area-tag utilities (used by ComponentPriorities + Dashboard)
│   ├── bugAnalysis.test.js        # Unit tests for bugAnalysis utilities
│   ├── cache.js                   # Caching utilities (TTL, cache keys)
│   └── cache.test.js              # Unit tests for cache utilities
├── App.jsx                        # Root component
├── App.css                        # App-level styles
├── main.jsx                       # Entry point
└── index.css                      # Global styles
```

## Bugzilla API Integration

### Base URL
`https://bugzilla.mozilla.org/rest`

### Key Query Parameters

**Performance Impact**:
```javascript
{
  f1: 'cf_performance_impact',    // Custom field
  o1: 'equals',                   // Operator
  v1: 'high|medium|low',          // Value
  resolution: '---',              // Open bugs only
  bug_type: 'defect',             // Defects only
  limit: 1000,                    // Max results
  include_fields: '...'           // Only needed fields
}
```

**All Performance Impact**:
```javascript
{
  f1: 'cf_performance_impact',
  o1: 'anyexact',
  v1: 'high,medium,low',
  resolution: '---',
  bug_type: 'defect',
  limit: 1000
}
```

## Service Functions

### `bugzillaService.js`

- `fetchBugs(params)` - Generic bug fetcher with field optimization
- `fetchBugsByPerformanceImpact(impactLevel, params, useCache)` - Performance impact query
- `fetchAllPerformanceImpactBugs(params, useCache)` - All impact levels
- `fetchBugsByIds(bugIds, useCache)` - Fetch specific bugs by ID array
- `fetchDependsOnIds(bugId)` - Fetch the `depends_on` list from a meta bug
- `groupBugsBySeverity(bugs)` - Group bugs by S1/S2/S3/S4
- `groupBugsByComponent(bugs)` - Count bugs per component
- `getBugStats(bugs)` - Calculate open/closed/total stats
- `clearPerformanceImpactCache(impactLevel)` - Clear specific cache
- `fetchComponentPriorityBugs(componentKey, useCache)` - Union query ([perf-prio] OR cf_performance_impact high/medium) for a named component group; keys: `css`, `dom`, `graphics`, `javascript`, `layout`, `memory`, `necko`, `painting`, `sp3`, `storage`; SP3 uses `metaBugId` def type; Necko merges Core/Networking + Firefox for Android; cache key `component-priority-{key}`
- `clearComponentPriorityCache(componentKey)` - Clear cache for one or all 10 component priority keys

### `redashService.js`

- `fetchBenchmarkRows(snapshotDate)` - POST to STMO query #114368 with date param, polls until result ready
- `fetchSpeedometerRows()` - POST to STMO query #96742 (no date param), returns full daily time-series
- Both proxied via Vite: `/stmo` → `https://sql.telemetry.mozilla.org`
- Applink rows: `platform_label, platform_weight, start_value, current_value, delta_ytd, start_value_chrome, delta_ytd_chrome, current_value_chrome, delta_to_chrome_ytd`
- Speedometer rows: `push_date, firefox_value_ma_desktop, chrome_value_ma_desktop, pct_delta_ma_desktop, firefox_value_ma_android, chrome_value_ma_android, pct_delta_ma_android` (plus raw daily columns)

### `cache.js`

- `getCached(key)` - Get cached data if not expired
- `setCache(key, data, ttl)` - Store data with TTL
- `clearCache(key)` - Remove specific cache entry
- `clearAllCache()` - Clear all cached data
- `cachedFetch(cacheKey, fetchFunction, ttl)` - Wrapper for cached API calls
- `getCacheStats()` - Returns `{ size, keys }` for debugging
- `generateCacheKey(prefix, params)` - Builds cache key string; keys follow the form `prefix:param1=val1&param2=val2` (sorted)

### `utils/bugAnalysis.js`

Shared utilities used by both `ComponentPriorities.jsx` and `Dashboard.jsx` (Overview tiles):
- `AREA_DEFS` - Array of 11 area objects `{ tag, label, title }`
- `ALL_AREA_TAGS` - Array of 11 tag strings
- `AREA_COLORS` - Array of 11 rgba color strings, index-aligned with AREA_DEFS
- `getAreaTags(bug)` - Regex-based area tag detection from summary/component/product
- `scoreBug(bug)` - Composite score: perf signal + severity + priority + comment depth + recency
- `getBugFlags(bug)` - Returns array of flag strings: `underappreciated`, `needs-triage`, `stale`
- `flagText(flag)` - Human-readable label for a flag string
- `SCORING_NOTE` - String description of scoring methodology (used in exports)

## Testing

### Running Tests
```bash
npm test           # single run
npm run test:watch # interactive watch mode
```

### Test Files
- `src/utils/cache.test.js` — 22 tests covering all cache utility functions including TTL expiry, eviction, `cachedFetch` hit/miss/error behavior
- `src/services/bugzillaService.test.js` — 24 tests covering `groupBugsBySeverity`, `groupBugsByComponent`, `getBugStats`, `clearPerformanceImpactCache`, and `clearComponentPriorityCache`
- `src/utils/bugAnalysis.test.js` — 37 tests covering `scoreBug`, `getBugFlags`, `getAreaTags`, `flagText`, and constant shape checks
- **Total: 88 tests, 3 test files**

### What's Tested
- **cache.js**: TTL expiry, eviction from map, overwrite, `cachedFetch` hit/miss/error/no-cache-on-failure
- **bugzillaService.js**: all S1–S4 severity mappings, unknown/missing severity → Unassigned, component counting, open/closed status classification, byStatus/byPriority breakdowns, `clearPerformanceImpactCache` key correctness, `clearComponentPriorityCache` specific/all/sp3 keys
- **bugAnalysis.js**: each scoring dimension in isolation, all three flag conditions (positive and negative), per-area tag detection, multi-tag and deduplication, flagText mapping

### Testing Notes
- Uses **Vitest** (built into Vite ecosystem, zero config)
- Environment: `node` (no DOM needed for current tests)
- `console.log` Cache HIT/MISS output leaks into test stdout — expected, harmless
- Next additions: React Testing Library for component tests (requires `jsdom` environment)

## Development Workflow

### Start Development Server
```bash
npm run dev
```
Server runs on http://localhost:3000/ with hot module replacement

### Git Workflow
```bash
git add .
git commit -m "Descriptive message

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
```

### Check Dev Server Output
```bash
tail -f /tmp/claude-1000/-mnt-d-Projects-PerfDashboarding/tasks/*.output
```

## Next Steps / TODOs

### Performance Priority Queries (Immediate)
- [x] Speedometer 3 bugs — meta bug #2026188 (`depends_on` list), now under Perf Priorities as SP3 Prio
- [x] Component priority bug lists — Perf Priorities tab (CSS, DOM, Graphics, Layout, Necko, JavaScript Engine, Memory Allocator, Web Painting, Storage)
- [ ] Define Bugzilla query for **Android Applink** bugs (My Tracking tab placeholder)
- [x] Add filtering and sorting options to SP3 Prio subsection — area filter pills + composite score sort

### Data Sources
- [x] Connect real benchmark data — STMO Redash query #114368 (Android Applink)
- [x] Add Speedometer 3 data — STMO Redash query #96742 (Desktop & Android)
- [x] Priority Tracking chart — daily localStorage snapshots of SP3 and My Tracking counts
- [x] Add JetStream 3 data — Treeherder Performance API (framework 13); Windows, Mac, Linux, Android (A55); 90-day time-series via `jetstreamService.js`

### Perf Priorities Tab — Next Steps
- [x] Add more components — JavaScript Engine (Engine/JIT/GC), Storage, Web Painting, Memory Allocator + Cycle Collector, CSS Transitions, SP3 Prio
- [ ] Add more components (DOM: HTML Parser, JavaScript: GC standalone tuning, etc.)
- [ ] Make Key Observations editable / storable per-component
- [ ] Add a chart view (score distribution, area tag breakdown per component)
- [ ] Persist area filter selection across tab switches
- [ ] Link "Needs Triage" bugs directly to a Bugzilla triage view

### Features to Add
- [ ] Date range filters (last week/month/quarter)
- [ ] Status filters (open/closed/resolved)
- [ ] Priority filters (P1/P2/P3/P4/P5)
- [ ] Assignee filters
- [ ] Save custom queries/views
- [ ] Email/Slack notifications for new bugs
- [ ] Real-time updates (WebSocket or polling)

### UI Improvements
- [x] Light/dark mode toggle (persists to localStorage, falls back to system preference)
- [x] Export to CSV and Markdown report (Perf Priorities tab)
- [x] Overview actionable tiles (SP3 Top Bugs, All-Comp Top Bugs, All-Component Area Hotspot, JetStream 3 KPI)
- [x] Populate JetStream 3 tile with real data — Treeherder live KPI (Mac Fx vs Competitor Start %); full 4-platform table in Benchmarks tab
- [ ] Add charts to Performance Priority subsections
- [ ] Click on chart sections to see detailed bugs
- [ ] Drill-down navigation (component → bugs)
- [ ] Dashboard customization (drag/drop widgets)
- [ ] Keyboard shortcuts

### Performance
- [ ] Virtual scrolling for very large tables (1000+ rows)
- [ ] Lazy load chart libraries (reduce initial bundle)
- [ ] Service worker for offline caching
- [ ] Progressive Web App (PWA) support

## Important Notes

### Bugzilla Custom Fields
- `cf_performance_impact`: high, medium, low
- Other custom fields available: Check Bugzilla field list

### Query Limits
- Default: 1,000 bugs per query
- Bugzilla max: 10,000 (but slower)
- Current balance: 1,000 for good performance

### Cache Strategy
- TTL: 5 minutes (300,000ms)
- Storage: In-memory (cleared on page refresh)
- **localStorage persistence** (survives refresh):
  - `perf_kpi_prev` — previous KPI values for Overview change indicators (`speedometerDesktop.value`, `androidApplink.value`)
    - Speedometer: only saved when `latestRow.push_date` advances (guards against overwriting on same-day reloads)
    - Applink: only saved once per calendar day (guarded by `savedDate: 'YYYY-MM-DD'` field)
  - `priority_tracking_history` — daily snapshots `{ 'YYYY-MM-DD': { sp3: N, priority: N } }` for Priority Tracking chart; clear with `localStorage.removeItem('priority_tracking_history')`
  - `priority_bug_ids` / `priority_bug_tags` — My Tracking tab bug state
  - `darkMode` — theme toggle state

### Theme System
- Default: dark mode
- `html.light-mode` class on `<html>` element activates light overrides across all CSS files
- Do NOT use `@media (prefers-color-scheme: light)` — all light mode rules use `html.light-mode` selectors
- Toggle state lives in `App.jsx`; persisted to `localStorage.darkMode`

### CSS Layout Notes
- Overview uses `overview-grid--3col` (`repeat(3, 1fr)`) for rows 1 and 2; row 3 is a plain full-width `chart-card`
- `.overview-top-bug-summary` must NOT have `white-space: nowrap` — it causes horizontal overflow in 1fr grid cells

### Commented Out Code
- Product/Component search boxes at top (Dashboard.jsx lines 240-259)
- Can be re-enabled if needed for overview/bug tracking tabs

## Troubleshooting

### Cache Not Working
Check console logs for "Cache HIT" or "Cache MISS". Click refresh button to clear cache.

### No Data Showing
1. Check browser console for errors
2. Verify Bugzilla API is accessible
3. Check network tab for failed requests
4. Try clearing cache with refresh button

### Charts Not Rendering
1. Ensure Chart.js is loaded (check bundle)
2. Verify data format matches chart requirements
3. Check browser console for Chart.js errors

## Contact & Resources

- **GitHub Repo**: https://github.com/fdotymoz/PerfDashboarding
- **Bugzilla API Docs**: https://bugzilla.readthedocs.io/en/latest/api/
- **Chart.js Docs**: https://www.chartjs.org/docs/

---

**Last Updated**: 2026-04-02
**Version**: 0.3.0
**Status**: Active Development
