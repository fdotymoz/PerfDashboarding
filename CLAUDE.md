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
- **Quick Stats** banner (full-width, top of page): Total Bugs, Open Bugs, Closed Bugs, Components, Priority Bugs (→ Priority tab), Applink Delta YTD % (→ Benchmarks tab, green/red color-coded)
- Performance Impact Distribution bar chart (clickable bars → navigate to relevant tab/query)
- Performance Trends (line chart - mock data)
- Component breakdown (bar chart)

### 2. Bug Tracking Tab
- Bug severity visualization
- Pie chart showing Critical/High/Medium/Low distribution

### 3. Performance Impact Tab ⭐
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

### 4. Performance Priority Tab
- **Speedometer 3** subsection (query TBD — placeholder)
- **Android Applink** subsection (query TBD — placeholder)
- **Priority Bugs** subsection:
  - Manually enter bug numbers (comma/space separated, Enter key support)
  - Fetches from Bugzilla API by ID via `fetchBugsByIds()`
  - Per-bug tags (alphanumeric, 15 char max) stored in localStorage
  - Tag-based multi-select filter dropdown
  - Remove bug via X button in table
  - Green `+` button on Performance Impact tab adds bugs here with auto-tags (Perf High/Med/Low)
  - Toast notifications on add; state persisted to `priority_bug_ids` / `priority_bug_tags` in localStorage

### 5. Benchmarks Tab
- Live data from STMO Redash query #114368 (Android Applink startup)
- Spreadsheet-style table: Platform, Weight, Fx Start, Fx Current, Delta YTD (%), Chrome Current, Delta to Chrome YTD (%)
- Delta columns color-coded: green = negative (improvement), red = positive (regression)
- BLENDED TOTAL row bolded/highlighted
- POST-then-poll pattern via Vite proxy (`/stmo` → `https://sql.telemetry.mozilla.org`)
- Refresh button uses `benchmarkRefreshTick` state to re-trigger the fetch useEffect

### 6. Components Tab
- **Top 10 components** with any performance impact
- Aggregates bugs from high/medium/low impact levels
- Bar chart showing bug counts by component

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
│   ├── Dashboard.jsx           # Main dashboard with all views
│   ├── Dashboard.css           # Dashboard styles
│   ├── BugTable.jsx            # Reusable bug table with pagination
│   └── BugTable.css            # Table styles
├── services/
│   ├── bugzillaService.js      # Bugzilla API integration
│   └── redashService.js        # STMO Redash API (query #114368, POST-then-poll)
├── utils/
│   └── cache.js                # Caching utilities (TTL, cache keys)
├── App.jsx                     # Root component
├── App.css                     # App-level styles
├── main.jsx                    # Entry point
└── index.css                   # Global styles
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
- `groupBugsBySeverity(bugs)` - Group bugs by S1/S2/S3/S4
- `groupBugsByComponent(bugs)` - Count bugs per component
- `getBugStats(bugs)` - Calculate open/closed/total stats
- `clearPerformanceImpactCache(impactLevel)` - Clear specific cache

### `redashService.js`

- `fetchBenchmarkRows(snapshotDate)` - POST to STMO query #114368 with date param, polls until result ready
- Proxied via Vite: `/stmo` → `https://sql.telemetry.mozilla.org`
- Returns rows: `platform_label, platform_weight, start_value, current_value, delta_ytd, current_value_chrome, delta_to_chrome_ytd`

### `cache.js`

- `getCached(key)` - Get cached data if not expired
- `setCache(key, data, ttl)` - Store data with TTL
- `clearCache(key)` - Remove specific cache entry
- `clearAllCache()` - Clear all cached data
- `cachedFetch(cacheKey, fetchFunction, ttl)` - Wrapper for cached API calls

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
- [ ] Define Bugzilla query for **Speedometer 3** bugs
- [ ] Define Bugzilla query for **Android Applink** bugs
- [ ] Implement table/chart views for each subsection
- [ ] Add filtering and sorting options

### Data Sources
- [x] Connect real benchmark data — STMO Redash query #114368
- [ ] Add additional STMO queries / metrics
- [ ] Implement time-series data for trends (Benchmarks tab Performance Trends chart is still mock data)

### Features to Add
- [ ] Date range filters (last week/month/quarter)
- [ ] Status filters (open/closed/resolved)
- [ ] Priority filters (P1/P2/P3/P4/P5)
- [ ] Assignee filters
- [ ] Export to CSV/JSON
- [ ] Save custom queries/views
- [ ] Email/Slack notifications for new bugs
- [ ] Real-time updates (WebSocket or polling)

### UI Improvements
- [x] Light/dark mode toggle (persists to localStorage, falls back to system preference)
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
- Alternative: localStorage for persistence

### Theme System
- Default: dark mode
- `html.light-mode` class on `<html>` element activates light overrides across all CSS files
- Do NOT use `@media (prefers-color-scheme: light)` — all light mode rules use `html.light-mode` selectors
- Toggle state lives in `App.jsx`; persisted to `localStorage.darkMode`

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

**Last Updated**: 2026-02-18
**Version**: MVP (0.1.0)
**Status**: Active Development
