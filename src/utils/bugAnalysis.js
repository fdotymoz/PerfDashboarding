/**
 * Shared bug analysis utilities — scoring, flag detection, area tagging.
 * Used by both ComponentPriorities and the Overview page tiles.
 */

export const AREA_DEFS = [
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

export const ALL_AREA_TAGS = AREA_DEFS.map(d => d.tag)

// Per-area colours used in charts and chips (index-aligned with AREA_DEFS)
export const AREA_COLORS = [
  'rgba(99,  102, 241, 0.8)', // SP3       — indigo
  'rgba(59,  130, 246, 0.8)', // Pageload  — blue
  'rgba(14,  165, 233, 0.8)', // Scrolling — sky
  'rgba(220, 38,  38,  0.8)', // Video     — red
  'rgba(234, 88,  12,  0.8)', // Startup   — orange
  'rgba(202, 138, 4,   0.8)', // Animation — amber
  'rgba(147, 51,  234, 0.8)', // Input     — purple
  'rgba(219, 39,  119, 0.8)', // Memory    — pink
  'rgba(101, 163, 13,  0.8)', // Battery   — lime
  'rgba(20,  184, 166, 0.8)', // Network   — teal
  'rgba(22,  163, 74,  0.8)', // Android   — green
]

export function getAreaTags(bug) {
  const s = (bug.summary || '').toLowerCase()
  const c = (bug.component || '').toLowerCase()
  const p = (bug.product || '').toLowerCase()
  const tags = []

  if (/speedometer|sp3|\btodo.?mvc\b|newssite-|react-stock|stylebench|jetstream|editor-tiptap|editor-codemirror|perf-dashboard|codemirror subtest|tiptap subtest/i.test(s)) tags.push('SP3')
  if (/page.?load|site.?load|resource.?load|slow.*load|loading.*slow|hung.*load|long.*load|first.*paint|domparser|parseFromString|set innerHTML|table.*slow.*append|append.*table|slow.*append/i.test(s)) tags.push('Pageload')
  if (/scroll|jank|panning|pan\b|low.?fps|60.?fps|choppy.*scroll|scroll.*choppy|smooth.*pan/i.test(s)) tags.push('Scrolling')
  if (/\bvideo\b|youtube|media.*playback|\bplayback\b|stream.*perf|ambient.?mode|audio.*stutter|\bcodec\b/i.test(s)) tags.push('Video')
  if (/\bstartup\b|start.?up|cold.?start|\blaunch\b|gfxplatform.*init|gfxmacplatform|initother|macsystemfont|deprecatedfamilyisavailable|times\.ttf/i.test(s)
    || /dns.*resolution.*start|long dns/i.test(s)) tags.push('Startup')
  if (/\banimation\b|css.*transition|transition.*css|\btransition\b.*slow|\banimated\b|blend.?mode|invert\(\)|hue.?rotate|svg.*anim|slideshow|carousel|canvas.*anim|low.*frame.?rate|frame.*rate.*low/i.test(s)) tags.push('Animation')
  if (/\bclick\b|button\.click|checkbox\.click|\bkeypress\b|\bkeyboard\b|input.*event|addeventlistener|removeEventListener|\btyping\b|\btouch\b|unresponsive|hang\b|frozen|freeze|janks.*ui|ui.*jank/i.test(s)) tags.push('Input')
  if (/\bmemory\b|\bheap\b|\bgc\b|garbage.?collect|memory.*leak|mem.*grows|high.*mem|grow.*bigger|memory.*jump|memory.*usage/i.test(s)) tags.push('Memory')
  if (/battery|cpu.?load|cpu.?usage|\bpower\b|drain|wake.?up|background.*cpu|background.*tab|energy|excessive.*cpu|persistent.*cpu|permanent.*cpu/i.test(s)) tags.push('Battery')
  if (/\bdownload\b|\bdns\b|http\/[23]|\bconnection\b|network.*speed|bandwidth|\blatency\b|asyncopen|onstartrequest|socket|gigabit|mdns/i.test(s)
    || /networking/i.test(c)) tags.push('Network')
  if (/\bandroid\b|fenix|moto\s|\bpixel\s.*phone|a55s|lambda.*test|fenix.*hang/i.test(s)
    || p.includes('android')) tags.push('Android')

  return [...new Set(tags)]
}

export const SCORING_NOTE =
  'Composite score = perf signal (high=3, medium=2, perf-prio only=1) + ' +
  'severity (S2=3, S3=2, S4=1) + priority (P2=3, P3=2, P4=1) + ' +
  'comment depth (≥30=3, ≥15=2, ≥8=1) + active in last 6 months (+1).'

export function scoreBug(bug) {
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

export function getBugFlags(bug) {
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

export function flagText(flag) {
  return {
    underappreciated: '⚠ Underappreciated',
    'needs-triage': 'Needs Triage',
    stale: 'Stale',
  }[flag] || flag
}
