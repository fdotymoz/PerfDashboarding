import { useState, useEffect } from 'react'
import { fetchComponentPriorityBugs, clearComponentPriorityCache } from '../services/bugzillaService'
import './ComponentPriorities.css'

const COMPONENTS = [
  { key: 'sp3',        label: 'SP3 Prio' },
  { key: 'css',        label: 'CSS Parsing & Transitions' },
  { key: 'dom',        label: 'DOM' },
  { key: 'graphics',   label: 'Graphics' },
  { key: 'javascript', label: 'JavaScript Engine' },
  { key: 'layout',     label: 'Layout' },
  { key: 'memory',     label: 'Memory Allocator' },
  { key: 'necko',      label: 'Necko / Networking' },
  { key: 'painting',   label: 'Web Painting' },
  { key: 'storage',    label: 'Storage' },
]

// Per-component sub-label normalizers. Only components with an entry here get
// the sub-component grouping UI.
const SUB_LABEL_FNS = {
  graphics: (component) => {
    if (!component || component === 'Graphics') return 'Core'
    return component.replace(/^Graphics:\s*/, '')
  },
  javascript: (component) => {
    if (!component || component === 'JavaScript Engine') return 'Engine'
    if (/JIT/i.test(component)) return 'JIT'
    if (/GC|Garbage/i.test(component)) return 'GC'
    return component.replace(/^JavaScript(?:\s+Engine)?:?\s*/i, '').replace(/^Engine:?\s*/i, '') || 'Engine'
  },
}

const OBSERVATIONS = {
  sp3: {
    items: [
      'Every bug here was manually nominated to meta bug #2026188, meaning a human decided it directly affects the Speedometer 3 score — a stronger signal than the cf_performance_impact field alone. Cross-check against other component views to spot bugs that appear in both lists.',
      'SP3 bugs tend to be better-triaged than the broader component population: more have sev/pri set, more have assignees. The scoring here differentiates within that well-triaged group — comment depth and recency are the key discriminators.',
      'Several bugs here are site-specific benchmark regressions (TipTap, CodeMirror, TodoMVC, React Stock). These represent workloads that the SP3 benchmark was designed to stress — fixing them improves a real score, not just a synthetic metric.',
      'Bugs with no cf_performance_impact set are not lower-priority: they were explicitly added to this meta bug, which is itself the strongest available SP3-impact signal. The "Needs Triage" flag here means the Bugzilla metadata is incomplete, not that the bug is unimportant.',
    ],
  },
  css: {
    items: [
      'Bug 1850809 is ranked at the top of the current SP3 style comparison report. Root causes are well understood — transition handling, visited-link CSS overhead, and custom property substitution together account for a measurable gap vs. Chrome — yet the bug carries no assigned owner or org priority.',
      'Bug 1502334 (Reddit content checkerboarding during long restyles) has 37 comments spanning multiple years and has resisted multiple fix attempts. A persistent restyle bottleneck that remains unowned.',
      'Most CSS perf-prio bugs have cf_performance_impact unset — the [perf-prio] whiteboard tag and the cf_performance_impact field are largely disjoint signal sets in this component. The combined list here is more complete than either source alone.',
    ],
  },
  dom: {
    items: [
      'Bug 1844470 (ContentEventHandler::GetTextLength bottleneck on SP3 TipTap) is rated S3/P2 — one of the better-triaged bugs in this set — yet has no assignee despite being a measured Speedometer 3 regression.',
      'Bug 1916542 (JS String conversion in strokeStyle/fillStyle) is a clear optimization opportunity surfaced during perf-prio triage with 11 comments of technical depth, but carries no organizational priority.',
      'Bug 1107626 (timer aggregation to reduce CPU wakeups) is rated S4/P5 — severely undervalued — yet represents a systemic issue affecting battery life and background CPU usage across all open tabs.',
      'Bug 1946454 (DuckDuckGo map pinch zoom jank) has 21 comments documenting a real-world user-visible regression with no assigned priority.',
    ],
  },
  graphics: {
    items: [
      'Bug 1826576 (CSS invert()+hue-rotate() causing sluggish scrolling on Wikipedia) carries high cf_performance_impact with 34 comments of investigation, yet has no priority and no assignee — a textbook underappreciated bug.',
      'Bug 1988762 (slow scrolling on Mastodon) is the only fully-triaged high-priority bug in this set (S2/P2, high impact), and is still unassigned.',
      'Bug 1503259 (animated page load throbber causing ~9% permanent CPU load) has 49 comments and is REOPENED — the most-discussed performance issue in Graphics and an ongoing drain on battery life for all users.',
      'Graphics bugs are grouped by sub-component (WebRender, ImageLib, Canvas2D, CanvasWebGL, Text, Core) to facilitate routing to specific team members. WebRender dominates this list — most scroll, animation, and compositing performance issues land there.',
    ],
  },
  layout: {
    items: [
      'Bug 1688951 (lazy font loading hanging the main thread on Windows) carries high cf_performance_impact, 21 comments, and was active in early 2026 — but has no priority and no assignee. This is the strongest underappreciated candidate in Layout.',
      'Bug 216418 (deeply-nested <pre> tags causing slow load and high memory) has 51 comments — the most-discussed layout bug in the set — and has been open since 2002. Likely a fundamental architectural constraint worth documenting as a known ceiling.',
      'Layout bugs skew toward site-specific reflow hangs rather than benchmark regressions. Many carry S3 severity but no priority, suggesting they clear the severity bar but lose out in prioritization bandwidth.',
    ],
  },
  necko: {
    items: [
      'Bugs 1738939 and 1320745 tell the same story: Firefox networking throughput is measurably slower than Chrome on fast (gigabit) connections. 53 combined comments, both P3/unassigned. These should be tracked as a theme rather than isolated site-specific issues.',
      'Bug 1528285 (AsyncOpen / OnStartRequest off the main thread) is the architectural keystone for Necko performance. Moving these calls off the main thread would reduce latency for multiple downstream bugs. It is a P2 meta bug open since 2018 with almost no forward momentum.',
      'Android networking performance is severely under-tracked. Bug 1993424 (tabs list slow to update, S2, 41 comments, no priority) is the highest-signal Android bug in this dataset and has no owner.',
      'Bug 1807322 (long DNS resolution times on startup, Android) represents the class of DoH-related performance concerns relevant to mobile users on variable-quality connections.',
    ],
  },
  javascript: {
    items: [
      'Bug 1963578 (ChatGPT script execution slowness, S2/P1, HIGH impact, 55 comments) is the highest-composite-score bug across all components surveyed. It is already well-triaged and assigned — its presence here confirms the JS Engine is the critical bottleneck for AI-heavy web applications.',
      'Bug 1488435 (Google Docs typing delay, 36 comments) and Bug 1653088 (voice.google.com GC-triggered audio hang, S4/P3 but 34 comments) represent a recurring pattern: GC pauses and JIT compilation overhead causing user-visible hangs in widely-used productivity apps. Bug 1653088 is a textbook "underappreciated" bug — S4 severity, but comment depth and user-visible impact suggest it deserves re-evaluation.',
      'JavaScript GC bugs (Bug 1926474 JSRope concat on Android perf-prio, 30 comments; Bug 1842074 SP3 heap growth perf-prio, 12 comments) indicate GC tuning is a consistent opportunity, particularly on Android where memory pressure is higher and GC pauses are more disruptive.',
      'Sub-component grouping (Engine / JIT / GC) mirrors the Graphics pattern and makes it easier to route bugs to the right team members. JIT and GC together account for the majority of actionable optimization headroom in this set.',
    ],
  },
  storage: {
    items: [
      'Bug 1903530 (Android jank caused by Storage I/O, S2/P2, HIGH impact, 47 comments, assigned) is the best-triaged bug in this set. Its presence here confirms that storage I/O on Android is a confirmed, measured bottleneck — not a theoretical concern.',
      'Bug 1778472 (Firefox startup blocked for 24 seconds waiting on a Storage read, 19 comments, unassigned) is the most actionable underappreciated bug in this set — a severe user-visible startup degradation with no owner. Any startup time investment should include this as a candidate.',
      'The Storage component has relatively few perf-signal bugs (3 total), but the ones that exist are high-signal and span both Android and Desktop startup paths, suggesting Storage I/O is a focused, tractable area for improvement.',
    ],
  },
  painting: {
    items: [
      'Bugs 1843930 (CodeMirror editor painting 2x slower than Chrome on SP3, assigned tnikkel) and 1846559 (TodoMVC paint 1.5x slower) are directly linked to Speedometer 3 subtest regressions. Both carry [perf-prio] tags — good organizational awareness — but remain open.',
      'Bug 1456638 (checkerboard scroll painting, 27 comments) has been open for years and represents the class of "paint-while-scrolling" problems that disproportionately affect users on slower connections or lower-end devices, where content arrives after the scroll gesture.',
      'Web Painting bugs are small in number but high in SP3 impact. Most are already on the right teams\' radar via [perf-prio] tags, making this a component where existing prioritization signals are relatively reliable.',
    ],
  },
  memory: {
    items: [
      'Bug 1928177 (jemalloc thread-local arena tuning, P1, perf-prio) is the only P1 bug in the Memory / Cycle Collector set. Low comment count (3) suggests it may be blocked or parked — worth a status check.',
      'Bug 1842074 (SP3 heap grows from ~11MB to ~40MB over 20 benchmark iterations, perf-prio, 12 comments) captures a concrete memory regression in the Speedometer 3 benchmark. Heap growth under sustained workloads degrades score over time and inflates GC pressure.',
      'Bug 1712512 (crunchyroll.com memory growth, S3/P2, 8 comments) represents the class of real-world site memory leaks. Combined with the SP3 heap growth bug, there is a consistent pattern of sustained-workload memory inflation that warrants dedicated investigation.',
      'Memory Allocator and Cycle Collector are grouped because both affect heap footprint — allocator tuning reduces baseline usage while CC improvements reduce retained garbage. They are complementary levers for the same user-visible symptom.',
    ],
  },
}

const SCORING_NOTE =
  'Composite score = perf signal (high=3, medium=2, perf-prio only=1) + ' +
  'severity (S2=3, S3=2, S4=1) + priority (P2=3, P3=2, P4=1) + ' +
  'comment depth (≥30=3, ≥15=2, ≥8=1) + active in last 6 months (+1).'

// ── Area tags ────────────────────────────────────────────────────────────────
// Categorises bugs by user-facing area of impact based on summary, component,
// and product. A bug may belong to multiple areas.

const AREA_DEFS = [
  { tag: 'SP3',       label: 'SP3',       title: 'Speedometer 3 benchmark coverage' },
  { tag: 'Pageload',  label: 'Page Load', title: 'Initial page / resource loading speed' },
  { tag: 'Scrolling', label: 'Scrolling', title: 'Scroll smoothness and jank' },
  { tag: 'Video',     label: 'Video',     title: 'Video and media playback performance' },
  { tag: 'Startup',   label: 'Startup',   title: 'Browser or app cold-start time' },
  { tag: 'Animation', label: 'Animation', title: 'CSS / canvas animations and transitions' },
  { tag: 'Input',     label: 'Input',     title: 'Click, keyboard, and touch responsiveness' },
  { tag: 'Memory',    label: 'Memory',    title: 'Memory usage and GC pauses' },
  { tag: 'Battery',   label: 'Battery',   title: 'CPU / GPU power efficiency' },
  { tag: 'Network',   label: 'Network',   title: 'Download speed, DNS, and connection management' },
  { tag: 'Android',   label: 'Android',   title: 'Android / Fenix specific performance' },
]
const ALL_AREA_TAGS = AREA_DEFS.map(d => d.tag)

function getAreaTags(bug) {
  const s = (bug.summary || '').toLowerCase()
  const c = (bug.component || '').toLowerCase()
  const p = (bug.product || '').toLowerCase()
  const tags = []

  // SP3 – Speedometer 3 benchmark
  if (/speedometer|sp3|\btodo.?mvc\b|newssite-|react-stock|stylebench|jetstream|editor-tiptap|editor-codemirror|perf-dashboard|codemirror subtest|tiptap subtest/i.test(s)) tags.push('SP3')

  // Page Load – initial page / resource loading
  if (/page.?load|site.?load|resource.?load|slow.*load|loading.*slow|hung.*load|long.*load|first.*paint|domparser|parseFromString|set innerHTML|table.*slow.*append|append.*table|slow.*append/i.test(s)) tags.push('Pageload')

  // Scrolling
  if (/scroll|jank|panning|pan\b|low.?fps|60.?fps|choppy.*scroll|scroll.*choppy|smooth.*pan/i.test(s)) tags.push('Scrolling')

  // Video / Media
  if (/\bvideo\b|youtube|media.*playback|\bplayback\b|stream.*perf|ambient.?mode|audio.*stutter|\bcodec\b/i.test(s)) tags.push('Video')

  // Startup / Launch
  if (/\bstartup\b|start.?up|cold.?start|\blaunch\b|gfxplatform.*init|gfxmacplatform|initother|macsystemfont|deprecatedfamilyisavailable|times\.ttf/i.test(s)
    || /dns.*resolution.*start|long dns/i.test(s)) tags.push('Startup')

  // Animation – CSS/canvas animations, transitions, compositing
  if (/\banimation\b|css.*transition|transition.*css|\btransition\b.*slow|\banimated\b|blend.?mode|invert\(\)|hue.?rotate|svg.*anim|slideshow|carousel|canvas.*anim|low.*frame.?rate|frame.*rate.*low/i.test(s)) tags.push('Animation')

  // Input – click, keyboard, touch responsiveness
  if (/\bclick\b|button\.click|checkbox\.click|\bkeypress\b|\bkeyboard\b|input.*event|addeventlistener|removeEventListener|\btyping\b|\btouch\b|unresponsive|hang\b|frozen|freeze|janks.*ui|ui.*jank/i.test(s)) tags.push('Input')

  // Memory – heap growth, GC, leaks
  if (/\bmemory\b|\bheap\b|\bgc\b|garbage.?collect|memory.*leak|mem.*grows|high.*mem|grow.*bigger|memory.*jump|memory.*usage/i.test(s)) tags.push('Memory')

  // Battery / CPU efficiency
  if (/battery|cpu.?load|cpu.?usage|\bpower\b|drain|wake.?up|background.*cpu|background.*tab|energy|excessive.*cpu|persistent.*cpu|permanent.*cpu/i.test(s)) tags.push('Battery')

  // Network / Download
  if (/\bdownload\b|\bdns\b|http\/[23]|\bconnection\b|network.*speed|bandwidth|\blatency\b|asyncopen|onstartrequest|socket|gigabit|mdns/i.test(s)
    || /networking/i.test(c)) tags.push('Network')

  // Android / Mobile
  if (/\bandroid\b|fenix|moto\s|\bpixel\s.*phone|a55s|lambda.*test|fenix.*hang/i.test(s)
    || p.includes('android')) tags.push('Android')

  return [...new Set(tags)]
}

// ── Scoring / flags ───────────────────────────────────────────────────────────

function scoreBug(bug) {
  let score = 0
  if (bug.cf_performance_impact === 'high') score += 3
  else if (bug.cf_performance_impact === 'medium') score += 2
  else score += 1

  const sevScores = { S1: 4, S2: 3, S3: 2, S4: 1 }
  score += sevScores[bug.severity] || 0

  const priScores = { P1: 4, P2: 3, P3: 2, P4: 1 }
  score += priScores[bug.priority] || 0

  if (bug.comment_count >= 30) score += 3
  else if (bug.comment_count >= 15) score += 2
  else if (bug.comment_count >= 8) score += 1

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  if (new Date(bug.last_change_time) >= sixMonthsAgo) score += 1

  return score
}

function getBugFlags(bug) {
  const flags = []
  const isUnassigned = !bug.assigned_to || bug.assigned_to.includes('nobody@mozilla.org')
  const hasNoSev = !bug.severity || bug.severity === '--' || bug.severity === 'N/A'
  const hasNoPri = !bug.priority || bug.priority === '--' || bug.priority === 'N/A'
  const hasPerfSignal = bug.cf_performance_impact === 'high' || bug.cf_performance_impact === 'medium'
  const noImpactField = !bug.cf_performance_impact || bug.cf_performance_impact === '---'

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const isStale = new Date(bug.last_change_time) < sixMonthsAgo

  if (hasPerfSignal && hasNoSev && hasNoPri) flags.push('underappreciated')
  if (noImpactField && isUnassigned && hasNoSev && hasNoPri) flags.push('needs-triage')
  if (isStale) flags.push('stale')
  return flags
}

function flagChip(flag) {
  const map = {
    underappreciated: ['cp-flag--underappreciated', '⚠ Underappreciated', 'High perf signal but no org priority/severity set'],
    'needs-triage':   ['cp-flag--needs-triage',     'Needs Triage',       'No cf_performance_impact, severity, priority, or assignee'],
    stale:            ['cp-flag--stale',             'Stale',              'No activity in over 6 months'],
  }
  const [cls, label, title] = map[flag] || []
  if (!cls) return null
  return <span key={flag} className={`cp-flag ${cls}`} title={title}>{label}</span>
}

function flagText(flag) {
  return { underappreciated: '⚠ Underappreciated', 'needs-triage': 'Needs Triage', stale: 'Stale' }[flag] || flag
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────

function ComponentPriorities({ initialKey } = {}) {
  const [selectedKey, setSelectedKey] = useState(initialKey || 'sp3')
  const [bugs, setBugs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [selectedSubComp, setSelectedSubComp] = useState('All')
  const [selectedAreas, setSelectedAreas] = useState([])

  // Fetch when component or refresh changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setBugs([])
    setShowAll(false)
    setSelectedSubComp('All')
    setSelectedAreas([])

    fetchComponentPriorityBugs(selectedKey)
      .then(data => { if (!cancelled) setBugs(data) })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [selectedKey, refreshTick])

  const handleRefresh = () => {
    clearComponentPriorityCache(selectedKey)
    setRefreshTick(t => t + 1)
  }

  const toggleArea = (area) =>
    setSelectedAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area])

  // Score + annotate every bug once
  const scoredBugs = bugs
    .map(bug => ({ ...bug, score: scoreBug(bug), flags: getBugFlags(bug), areas: getAreaTags(bug) }))
    .sort((a, b) => b.score - a.score)

  // Sub-label function for the selected component (undefined if no grouping)
  const subLabelFn = SUB_LABEL_FNS[selectedKey]

  // Available sub-components (only for components that define a sub-label function)
  const subComponents = subLabelFn
    ? ['All', ...[...new Set(bugs.map(b => subLabelFn(b.component)))].sort()]
    : []

  // Available area tags across all scored bugs
  const availableAreas = [...new Set(scoredBugs.flatMap(b => b.areas))].sort(
    (a, b) => ALL_AREA_TAGS.indexOf(a) - ALL_AREA_TAGS.indexOf(b)
  )

  // Apply sub-component + area filters
  const filteredBugs = scoredBugs.filter(bug => {
    if (subLabelFn && selectedSubComp !== 'All') {
      if (subLabelFn(bug.component) !== selectedSubComp) return false
    }
    if (selectedAreas.length > 0 && !selectedAreas.some(a => bug.areas.includes(a))) return false
    return true
  })

  const displayBugs = showAll ? filteredBugs : filteredBugs.slice(0, 20)

  // For components with sub-labels, "All" view groups by sub-component
  const isGrouped = !!subLabelFn && selectedSubComp === 'All'
  const groupedBugs = isGrouped
    ? displayBugs.reduce((acc, bug) => {
        const sub = subLabelFn(bug.component)
        if (!acc[sub]) acc[sub] = []
        acc[sub].push(bug)
        return acc
      }, {})
    : null

  const selectedLabel = COMPONENTS.find(c => c.key === selectedKey)?.label
  const observations = OBSERVATIONS[selectedKey]

  // ── Export helpers ──────────────────────────────────────────────────────────

  const bugToRow = (bug) => [
    bug.id,
    `"${(bug.summary || '').replace(/"/g, '""')}"`,
    bug.product || '',
    bug.component || '',
    bug.severity || '',
    bug.priority || '',
    bug.cf_performance_impact || '',
    bug.comment_count ?? '',
    (bug.last_change_time || '').split('T')[0],
    bug.assigned_to_detail?.real_name || bug.assigned_to || '',
    bug.score,
    bug.flags.map(flagText).join('; '),
    bug.areas.join('; '),
    `https://bugzilla.mozilla.org/show_bug.cgi?id=${bug.id}`,
  ]

  const handleExportCSV = () => {
    const headers = ['Bug ID','Summary','Product','Component','Severity','Priority','Perf Impact','Comments','Last Active','Assigned To','Score','Flags','Areas','URL']
    const rows = filteredBugs.map(bugToRow)
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    downloadFile(csv, `perf-priorities-${selectedKey}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
  }

  const handleExportReport = () => {
    const date = new Date().toISOString().split('T')[0]
    let md = `# Performance Priority Report — ${selectedLabel}\n**Generated:** ${date}\n\n---\n\n`
    md += `## Key Observations\n\n`
    observations.items.forEach((obs, i) => { md += `${i + 1}. ${obs}\n\n` })
    md += `---\n\n## Top Bugs by Composite Score\n\n_${SCORING_NOTE}_\n\n`

    const renderTable = (bugsToRender) => {
      md += `| Bug | Summary | Sev | Pri | Impact | Comments | Last Active | Score | Areas | Flags |\n`
      md += `|-----|---------|-----|-----|--------|----------|-------------|-------|-------|-------|\n`
      bugsToRender.slice(0, 20).forEach(bug => {
        const summary = (bug.summary || '').length > 60 ? bug.summary.slice(0, 57) + '...' : (bug.summary || '')
        md += `| [${bug.id}](https://bugzilla.mozilla.org/show_bug.cgi?id=${bug.id}) | ${summary} | ${bug.severity || '--'} | ${bug.priority || '--'} | ${bug.cf_performance_impact || '---'} | ${bug.comment_count ?? ''} | ${(bug.last_change_time || '').split('T')[0]} | ${bug.score} | ${bug.areas.join(', ')} | ${bug.flags.map(flagText).join(', ')} |\n`
      })
      md += '\n'
    }

    if (isGrouped) {
      Object.entries(groupedBugs).sort().forEach(([sub, grpBugs]) => {
        md += `### ${sub} (${grpBugs.length} bugs)\n\n`
        renderTable(grpBugs)
      })
    } else {
      renderTable(filteredBugs)
    }

    md += `---\n\n## Scoring Methodology\n\n${SCORING_NOTE}\n\n`
    md += `**Flag definitions:**\n`
    md += `- ⚠ **Underappreciated** — cf_performance_impact is high/medium but severity and priority are both unset.\n`
    md += `- **Needs Triage** — No cf_performance_impact, severity, priority, or assignee.\n`
    md += `- **Stale** — No activity in over 6 months.\n\n`
    md += `**Area tag definitions:**\n`
    AREA_DEFS.forEach(d => { md += `- **${d.label}** — ${d.title}\n` })

    downloadFile(md, `perf-priorities-${selectedKey}-${date}.md`, 'text/markdown')
  }

  // ── Bug row renderer ────────────────────────────────────────────────────────

  const renderBugRow = (bug) => {
    const assignee = bug.assigned_to_detail?.real_name || bug.assigned_to || ''
    const isUnassigned = !bug.assigned_to || bug.assigned_to.includes('nobody@mozilla.org')
    return (
      <tr key={bug.id} className={bug.flags.includes('needs-triage') ? 'cp-row--triage' : ''}>
        <td className="cp-score-cell"><span className="cp-score-badge">{bug.score}</span></td>
        <td className="cp-id-cell">
          <a href={`https://bugzilla.mozilla.org/show_bug.cgi?id=${bug.id}`} target="_blank" rel="noopener noreferrer">{bug.id}</a>
        </td>
        <td className="cp-summary-cell">{bug.summary}</td>
        {!isGrouped && <td className="cp-component-cell">{bug.component}</td>}
        <td className={`cp-sev-cell sev-${bug.severity}`}>{bug.severity || '--'}</td>
        <td className="cp-pri-cell">{bug.priority || '--'}</td>
        <td className={`cp-impact-cell impact-${bug.cf_performance_impact}`}>
          {bug.cf_performance_impact === 'high' ? 'High' : bug.cf_performance_impact === 'medium' ? 'Med' : '—'}
        </td>
        <td className="cp-num-cell">{bug.comment_count ?? '—'}</td>
        <td className="cp-date-cell">{formatDate(bug.last_change_time)}</td>
        <td className={`cp-assignee-cell${isUnassigned ? ' cp-unassigned' : ''}`}>
          {isUnassigned ? 'Unassigned' : assignee}
        </td>
        <td className="cp-areas-cell">
          {bug.areas.map(area => (
            <span key={area} className={`cp-area-chip cp-area--${area.toLowerCase()}`} title={AREA_DEFS.find(d => d.tag === area)?.title}>
              {AREA_DEFS.find(d => d.tag === area)?.label || area}
            </span>
          ))}
        </td>
        <td className="cp-flags-cell">{bug.flags.map(f => flagChip(f))}</td>
      </tr>
    )
  }

  const tableHead = (
    <thead>
      <tr>
        <th className="cp-th-score">Score</th>
        <th className="cp-th-id">Bug</th>
        <th className="cp-th-summary">Summary</th>
        {!isGrouped && <th>Sub-component</th>}
        <th>Sev</th>
        <th>Pri</th>
        <th>Impact</th>
        <th>Comments</th>
        <th>Last Active</th>
        <th>Assigned To</th>
        <th>Areas</th>
        <th>Flags</th>
      </tr>
    </thead>
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="cp-container">
      {/* Header */}
      <div className="cp-header">
        <div className="cp-header-top">
          <div>
            <h2 className="cp-title">Component Performance Priorities</h2>
            <p className="cp-subtitle">
              Top bugs per engineering component — ranked by composite impact score.
              Signals: <code>[perf-prio]</code> whiteboard tag or <code>cf_performance_impact</code> high/medium.
            </p>
          </div>
          <div className="cp-export-group">
            <button className="cp-export-btn" onClick={handleExportCSV} disabled={loading || bugs.length === 0} title="Download bug table as CSV">↓ CSV</button>
            <button className="cp-export-btn cp-export-btn--report" onClick={handleExportReport} disabled={loading || bugs.length === 0} title="Download analysis report with key observations">↓ Report</button>
          </div>
        </div>

        <div className="cp-controls">
          <div className="cp-selector">
            <label>Component:</label>
            <div className="cp-tab-row">
              {COMPONENTS.map(c => (
                <button key={c.key} className={`cp-tab-btn${selectedKey === c.key ? ' active' : ''}`} onClick={() => setSelectedKey(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <button className="refresh-button" onClick={handleRefresh} disabled={loading} title="Clear cache and refresh">↻ Refresh</button>
        </div>

        {/* Graphics sub-component tabs */}
        {subComponents.length > 0 && (
          <div className="cp-subcomp-row">
            <label>Sub-component:</label>
            <div className="cp-tab-row">
              {subComponents.map(sub => (
                <button key={sub} className={`cp-tab-btn cp-tab-btn--sub${selectedSubComp === sub ? ' active' : ''}`} onClick={() => setSelectedSubComp(sub)}>
                  {sub}
                  {sub !== 'All' && (
                    <span className="cp-subcomp-count">
                      {scoredBugs.filter(b => subLabelFn(b.component) === sub).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Key Observations */}
      {observations && (
        <div className="cp-observations">
          <h3 className="cp-observations-title">Key Observations — {selectedLabel}</h3>
          <ul className="cp-observations-list">
            {observations.items.map((obs, i) => <li key={i}>{obs}</li>)}
          </ul>
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading {selectedLabel} bugs…</p>
        </div>
      )}

      {error && <div className="error-message">Failed to load bugs: {error}</div>}

      {!loading && !error && bugs.length > 0 && (
        <>
          {/* Area filter */}
          {availableAreas.length > 0 && (
            <div className="cp-area-filter">
              <span className="cp-area-filter-label">Filter by area:</span>
              <div className="cp-area-filter-pills">
                {availableAreas.map(area => {
                  const def = AREA_DEFS.find(d => d.tag === area)
                  return (
                    <button
                      key={area}
                      className={`cp-area-pill cp-area--${area.toLowerCase()}${selectedAreas.includes(area) ? ' active' : ''}`}
                      onClick={() => toggleArea(area)}
                      title={def?.title}
                    >
                      {def?.label || area}
                    </button>
                  )
                })}
                {selectedAreas.length > 0 && (
                  <button className="cp-area-clear" onClick={() => setSelectedAreas([])}>✕ Clear</button>
                )}
              </div>
            </div>
          )}

          <div className="cp-table-meta">
            <span>
              {filteredBugs.length} bug{filteredBugs.length !== 1 ? 's' : ''}
              {filteredBugs.length < scoredBugs.length && ` (filtered from ${scoredBugs.length})`}
              {filteredBugs.length > 0 && ` — showing top ${displayBugs.length}`}
            </span>
            <span className="cp-scoring-note" title={SCORING_NOTE}>ⓘ Scoring</span>
          </div>

          {/* Table — grouped (Graphics All) or flat */}
          <div className="cp-table-wrapper">
            {isGrouped ? (
              <table className="cp-table">
                {tableHead}
                <tbody>
                  {Object.entries(groupedBugs)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([sub, grpBugs]) => (
                      grpBugs.length > 0 && [
                        <tr key={`hdr-${sub}`} className="cp-group-header">
                          <td colSpan={12}>
                            <span className="cp-group-label">{sub}</span>
                            <span className="cp-group-count">{grpBugs.length} bug{grpBugs.length !== 1 ? 's' : ''}</span>
                          </td>
                        </tr>,
                        ...grpBugs.map(bug => renderBugRow(bug))
                      ]
                    ))}
                </tbody>
              </table>
            ) : (
              <table className="cp-table">
                {tableHead}
                <tbody>{displayBugs.map(bug => renderBugRow(bug))}</tbody>
              </table>
            )}
          </div>

          {filteredBugs.length > 20 && (
            <div className="cp-show-more">
              <button className="cp-show-more-btn" onClick={() => setShowAll(v => !v)}>
                {showAll ? 'Show top 20 only' : `Show all ${filteredBugs.length} bugs`}
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !error && bugs.length === 0 && (
        <div className="query-placeholder">
          <p>No bugs found for {selectedLabel} matching the perf signal criteria.</p>
        </div>
      )}
    </div>
  )
}

export default ComponentPriorities
