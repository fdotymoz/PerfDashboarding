import { useState, useEffect, useRef } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title } from 'chart.js'
import { Pie, Bar, Line } from 'react-chartjs-2'
import './Dashboard.css'
import { fetchBugs, groupBugsBySeverity, groupBugsByComponent, getBugStats, fetchBugsByPerformanceImpact, clearPerformanceImpactCache, fetchAllPerformanceImpactBugs, fetchBugsByIds, fetchComponentPriorityBugs } from '../services/bugzillaService'
import { fetchBenchmarkRows, fetchSpeedometerRows } from '../services/redashService'
import { AREA_DEFS, AREA_COLORS, getAreaTags, scoreBug, getBugFlags, flagText } from '../utils/bugAnalysis'
import BugTable from './BugTable'
import ComponentPriorities from './ComponentPriorities'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title)

function Dashboard() {
  const [activeView, setActiveView] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bugs, setBugs] = useState([])
  const [bugStats, setBugStats] = useState(null)

  // Configuration for Bugzilla queries
  const [config, setConfig] = useState({
    product: 'Core',
    component: 'Performance'
  })

  // Performance impact state
  const [perfImpactBugs, setPerfImpactBugs] = useState([])
  const [perfImpactLevel, setPerfImpactLevel] = useState('high')
  const [perfImpactLoading, setPerfImpactLoading] = useState(false)
  const [perfImpactError, setPerfImpactError] = useState(null)
  const [perfImpactComponents, setPerfImpactComponents] = useState([])
  const [selectedComponent, setSelectedComponent] = useState('all')

  // All performance impact bugs for Components tab
  const [allPerfImpactBugs, setAllPerfImpactBugs] = useState([])
  const [allPerfImpactLoading, setAllPerfImpactLoading] = useState(false)

  // Overview performance impact counts (high/med/low fetched concurrently)
  const [overviewPerfCounts, setOverviewPerfCounts] = useState({ high: 0, medium: 0, low: 0 })

  // Performance Priority subsection state
  const [perfPrioritySubsection, setPerfPrioritySubsection] = useState('prioritybugs')

  // Initial key for Perf Priorities tab (set when navigating from a deep-link, e.g. Overview SP3 tile)
  const [compPrioritiesInitialKey, setCompPrioritiesInitialKey] = useState(null)

  // All non-SP3 component priority bugs (for overview all-component tiles)
  const [allCompBugs, setAllCompBugs] = useState([])
  const [allCompLoading, setAllCompLoading] = useState(false)

  // Speedometer 3 subsection bugs (from meta bug 2026188)
  const [sp3Bugs, setSp3Bugs] = useState([])
  const [sp3BugsLoading, setSp3BugsLoading] = useState(false)
  const [sp3BugsError, setSp3BugsError] = useState(null)
  const [sp3RefreshTick, setSp3RefreshTick] = useState(0)

  // Priority tracking history: { 'YYYY-MM-DD': { sp3: N, priority: N }, ... }
  const [priorityTrackingHistory, setPriorityTrackingHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('priority_tracking_history')) || {} } catch { return {} }
  })

  // Priority Bugs subsection state (persisted to localStorage)
  const [priorityBugInput, setPriorityBugInput] = useState('')
  const [priorityBugIds, setPriorityBugIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('priority_bug_ids')) || [] } catch { return [] }
  })
  const [priorityBugs, setPriorityBugs] = useState([])
  const [priorityBugsLoading, setPriorityBugsLoading] = useState(false)
  const [priorityBugsError, setPriorityBugsError] = useState(null)
  const [priorityBugTags, setPriorityBugTags] = useState(() => {
    try { return JSON.parse(localStorage.getItem('priority_bug_tags')) || {} } catch { return {} }
  })
  const [prioritySelectedTags, setPrioritySelectedTags] = useState([])
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const tagFilterRef = useRef(null)

  // Toast notifications
  const [toasts, setToasts] = useState([])

  // Benchmark data from STMO
  const [benchmarkRows, setBenchmarkRows] = useState([])
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState(null)
  const [benchmarkRefreshTick, setBenchmarkRefreshTick] = useState(0)

  // Speedometer data from STMO query #96742
  const [speedometerRows, setSpeedometerRows] = useState([])
  const [speedometerLoading, setSpeedometerLoading] = useState(false)
  const [speedometerError, setSpeedometerError] = useState(null)
  const [speedometerRefreshTick, setSpeedometerRefreshTick] = useState(0)

  // Previous KPI snapshot from localStorage (captured at mount, before this session's fetch)
  const [prevKpiValues] = useState(() => {
    try { return JSON.parse(localStorage.getItem('perf_kpi_prev')) || {} } catch { return {} }
  })

  // Fetch bugs on component mount or when config changes
  useEffect(() => {
    async function loadBugs() {
      setLoading(true)
      setError(null)

      try {
        const fetchedBugs = await fetchBugs({
          product: config.product,
          component: config.component,
          limit: 1000
        })

        setBugs(fetchedBugs)
        setBugStats(getBugStats(fetchedBugs))
      } catch (err) {
        setError(err.message)
        console.error('Failed to fetch bugs:', err)
      } finally {
        setLoading(false)
      }
    }

    loadBugs()
  }, [config.product, config.component])

  // Fetch performance impact bugs when view is active or impact level changes
  useEffect(() => {
    async function loadPerfImpactBugs() {
      if (activeView !== 'perfimpact') return

      setPerfImpactLoading(true)
      setPerfImpactError(null)

      try {
        const fetchedBugs = await fetchBugsByPerformanceImpact(perfImpactLevel)
        setPerfImpactBugs(fetchedBugs)
        setSelectedComponent('all') // Reset filter when fetching new data
      } catch (err) {
        setPerfImpactError(err.message)
        console.error('Failed to fetch performance impact bugs:', err)
      } finally {
        setPerfImpactLoading(false)
      }
    }

    loadPerfImpactBugs()
  }, [activeView, perfImpactLevel])

  // Extract unique components from performance impact bugs
  useEffect(() => {
    if (perfImpactBugs.length > 0) {
      const uniqueComponents = [...new Set(perfImpactBugs.map(bug => bug.component))].sort()
      setPerfImpactComponents(uniqueComponents)
    } else {
      setPerfImpactComponents([])
    }
  }, [perfImpactBugs])

  // Fetch all performance impact bugs for Components tab
  useEffect(() => {
    async function loadAllPerfImpactBugs() {
      if (activeView !== 'teams') return

      setAllPerfImpactLoading(true)

      try {
        const fetchedBugs = await fetchAllPerformanceImpactBugs()
        setAllPerfImpactBugs(fetchedBugs)
      } catch (err) {
        console.error('Failed to fetch all performance impact bugs:', err)
      } finally {
        setAllPerfImpactLoading(false)
      }
    }

    loadAllPerfImpactBugs()
  }, [activeView])

  // Fetch high/med/low counts concurrently for the Overview chart
  useEffect(() => {
    if (activeView !== 'overview') return

    async function loadOverviewPerfCounts() {
      try {
        const [highBugs, medBugs, lowBugs] = await Promise.all([
          fetchBugsByPerformanceImpact('high'),
          fetchBugsByPerformanceImpact('medium'),
          fetchBugsByPerformanceImpact('low')
        ])
        setOverviewPerfCounts({ high: highBugs.length, medium: medBugs.length, low: lowBugs.length })
      } catch (err) {
        console.error('Failed to load overview perf counts:', err)
      }
    }

    loadOverviewPerfCounts()
  }, [activeView])

  // Fetch priority bugs when IDs change or subsection becomes active
  useEffect(() => {
    if (activeView !== 'perfpriority' || perfPrioritySubsection !== 'prioritybugs') return
    if (priorityBugIds.length === 0) {
      setPriorityBugs([])
      return
    }

    async function loadPriorityBugs() {
      setPriorityBugsLoading(true)
      setPriorityBugsError(null)
      try {
        const fetchedBugs = await fetchBugsByIds(priorityBugIds)
        setPriorityBugs(fetchedBugs)
      } catch (err) {
        setPriorityBugsError(err.message)
        console.error('Failed to fetch priority bugs:', err)
      } finally {
        setPriorityBugsLoading(false)
      }
    }

    loadPriorityBugs()
  }, [priorityBugIds, activeView, perfPrioritySubsection])

  // Persist priority bug IDs to localStorage
  useEffect(() => {
    localStorage.setItem('priority_bug_ids', JSON.stringify(priorityBugIds))
  }, [priorityBugIds])

  // Persist priority bug tags to localStorage
  useEffect(() => {
    localStorage.setItem('priority_bug_tags', JSON.stringify(priorityBugTags))
  }, [priorityBugTags])

  // Fetch benchmark data from STMO when benchmarks view becomes active
  useEffect(() => {
    if (activeView !== 'benchmarks' && activeView !== 'overview') return
    if (benchmarkRows.length > 0) return // already loaded

    async function loadBenchmarks() {
      setBenchmarkLoading(true)
      setBenchmarkError(null)
      try {
        const rows = await fetchBenchmarkRows()
        setBenchmarkRows(rows)
      } catch (err) {
        setBenchmarkError(err.message)
        console.error('Failed to fetch benchmark data:', err)
      } finally {
        setBenchmarkLoading(false)
      }
    }

    loadBenchmarks()
  }, [activeView, benchmarkRefreshTick])

  // Fetch Speedometer data from STMO when benchmarks or overview becomes active
  useEffect(() => {
    if (activeView !== 'benchmarks' && activeView !== 'overview') return
    if (speedometerRows.length > 0) return // already loaded

    async function loadSpeedometer() {
      setSpeedometerLoading(true)
      setSpeedometerError(null)
      try {
        const rows = await fetchSpeedometerRows()
        setSpeedometerRows(rows)
      } catch (err) {
        setSpeedometerError(err.message)
        console.error('Failed to fetch Speedometer data:', err)
      } finally {
        setSpeedometerLoading(false)
      }
    }

    loadSpeedometer()
  }, [activeView, speedometerRefreshTick])

  // Fetch Speedometer 3 priority bugs from meta bug 2026188 (used for Overview quick stats count)
  useEffect(() => {
    if (activeView !== 'overview') return
    if (sp3Bugs.length > 0) return // already loaded
    async function loadSp3Bugs() {
      setSp3BugsLoading(true)
      setSp3BugsError(null)
      try {
        const bugs = await fetchComponentPriorityBugs('sp3')
        setSp3Bugs(bugs)
        const today = new Date().toISOString().split('T')[0]
        setPriorityTrackingHistory(prev => {
          const updated = { ...prev, [today]: { sp3: bugs.length, priority: priorityBugIds.length } }
          localStorage.setItem('priority_tracking_history', JSON.stringify(updated))
          return updated
        })
      } catch (err) {
        setSp3BugsError(err.message)
        console.error('Failed to fetch Speedometer 3 bugs:', err)
      } finally {
        setSp3BugsLoading(false)
      }
    }
    loadSp3Bugs()
  }, [activeView, sp3RefreshTick])

  // Fetch all non-SP3 component priority bugs concurrently for overview tiles.
  // Uses the same 5-min cache as Perf Priorities tab — instant if already warm.
  useEffect(() => {
    if (activeView !== 'overview') return
    if (allCompBugs.length > 0) return
    let cancelled = false
    const COMP_KEYS = ['css', 'dom', 'graphics', 'javascript', 'layout', 'memory', 'necko', 'painting', 'storage']
    async function loadAllComps() {
      setAllCompLoading(true)
      try {
        const results = await Promise.all(COMP_KEYS.map(k => fetchComponentPriorityBugs(k)))
        if (cancelled) return
        const seen = new Set()
        const merged = results.flat().filter(b => {
          if (seen.has(b.id)) return false
          seen.add(b.id)
          return true
        })
        setAllCompBugs(merged)
      } catch (err) {
        console.error('Failed to load all-component overview bugs:', err)
      } finally {
        if (!cancelled) setAllCompLoading(false)
      }
    }
    loadAllComps()
    return () => { cancelled = true }
  }, [activeView])

  // Persist current Speedometer Desktop KPI value to localStorage when data updates.
  // Only save when the underlying data date changes so that prevKpiValues (captured at mount)
  // always reflects the last *different* data point and the change indicator is meaningful.
  useEffect(() => {
    if (speedometerRows.length === 0) return
    const startRow = speedometerRows.find(r => r.push_date === '2026-01-01')
    const latestRow = speedometerRows[speedometerRows.length - 1]
    if (!startRow || !latestRow) return
    const fxCurrent = latestRow.firefox_value_ma_desktop
    const chromeStart = startRow.chrome_value_ma_desktop
    if (!fxCurrent || !chromeStart) return
    const delta = 100 * (fxCurrent / chromeStart - 1)
    const prev = JSON.parse(localStorage.getItem('perf_kpi_prev')) || {}
    // Only overwrite when the data date is newer than what's already stored
    if (prev.speedometerDesktop?.date === latestRow.push_date) return
    localStorage.setItem('perf_kpi_prev', JSON.stringify({
      ...prev,
      speedometerDesktop: { value: delta, date: latestRow.push_date, savedAt: Date.now() }
    }))
  }, [speedometerRows])

  // Persist current Android Applink KPI value to localStorage when data updates.
  // Only save once per calendar day so that the previous value is preserved across reloads.
  useEffect(() => {
    if (benchmarkRows.length === 0) return
    const blendedRow = benchmarkRows.find(r => r.platform_label?.toUpperCase().includes('BLENDED'))
    const delta = blendedRow?.delta_ytd
    if (delta == null) return
    const prev = JSON.parse(localStorage.getItem('perf_kpi_prev')) || {}
    const today = new Date().toISOString().slice(0, 10)
    // Only overwrite when we haven't saved yet today
    if (prev.androidApplink?.savedDate === today) return
    localStorage.setItem('perf_kpi_prev', JSON.stringify({
      ...prev,
      androidApplink: { value: delta, savedDate: today, savedAt: Date.now() }
    }))
  }, [benchmarkRows])

  // Close tag filter dropdown when clicking outside
  useEffect(() => {
    if (!tagFilterOpen) return
    const handleClickOutside = (e) => {
      if (tagFilterRef.current && !tagFilterRef.current.contains(e.target)) {
        setTagFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [tagFilterOpen])

  // Show a toast notification that auto-dismisses after 2.5 seconds
  const showToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500)
  }

  // Handle manual refresh of performance impact data
  const handleRefreshPerfImpact = async () => {
    clearPerformanceImpactCache(perfImpactLevel)
    setPerfImpactLoading(true)
    setPerfImpactError(null)
    setSelectedComponent('all') // Reset filter on refresh

    try {
      const fetchedBugs = await fetchBugsByPerformanceImpact(perfImpactLevel, {}, false) // false = skip cache
      setPerfImpactBugs(fetchedBugs)
    } catch (err) {
      setPerfImpactError(err.message)
      console.error('Failed to refresh performance impact bugs:', err)
    } finally {
      setPerfImpactLoading(false)
    }
  }

  // Handle adding bug IDs from input
  const handleAddPriorityBugs = () => {
    const parsed = priorityBugInput
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(s => /^\d+$/.test(s))
    if (parsed.length === 0) return
    setPriorityBugIds(prev => [...new Set([...prev, ...parsed])])
    setPriorityBugInput('')
  }

  // Handle removing a specific bug ID
  const handleRemovePriorityBugId = (id) => {
    setPriorityBugIds(prev => prev.filter(bid => bid !== id))
  }

  // Handle manual refresh of priority bugs (skip cache)
  const handleRefreshPriorityBugs = async () => {
    if (priorityBugIds.length === 0) return
    setPriorityBugsLoading(true)
    setPriorityBugsError(null)
    try {
      const fetchedBugs = await fetchBugsByIds(priorityBugIds, false)
      setPriorityBugs(fetchedBugs)
    } catch (err) {
      setPriorityBugsError(err.message)
      console.error('Failed to refresh priority bugs:', err)
    } finally {
      setPriorityBugsLoading(false)
    }
  }

  // Add a tag to a specific priority bug
  const handleAddBugTag = (bugId, tag) => {
    const cleaned = tag.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)
    if (!cleaned) return
    setPriorityBugTags(prev => {
      const existing = prev[String(bugId)] || []
      if (existing.includes(cleaned)) return prev
      return { ...prev, [String(bugId)]: [...existing, cleaned] }
    })
  }

  // Remove a tag from a specific priority bug
  const handleRemoveBugTag = (bugId, tag) => {
    setPriorityBugTags(prev => ({
      ...prev,
      [String(bugId)]: (prev[String(bugId)] || []).filter(t => t !== tag)
    }))
  }

  // Toggle a tag in the filter selection
  const togglePriorityTag = (tag) => {
    setPrioritySelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  // Add a bug from Performance Impact to the Priority Bugs list with auto-tag
  const handleAddToPriority = (bugId) => {
    const id = String(bugId)
    const tagMap = { high: 'Perf High', medium: 'Perf Med', low: 'Perf Low' }
    const tag = tagMap[perfImpactLevel]
    const isNew = !priorityBugIds.includes(id)

    setPriorityBugIds(prev => prev.includes(id) ? prev : [...prev, id])

    if (tag) {
      setPriorityBugTags(prev => {
        const existing = prev[id] || []
        if (existing.includes(tag)) return prev
        return { ...prev, [id]: [...existing, tag] }
      })
    }

    if (isNew) {
      showToast(`Bug #${id} added to Priority List`)
    } else {
      showToast(`Bug #${id} is already in Priority List`, 'info')
    }
  }

  // Add a bug from Perf Priorities tab to My Tracking with auto-tag from cf_performance_impact
  const handleAddFromCompPriorities = (bug) => {
    const id = String(bug.id)
    const tagMap = { high: 'Perf High', medium: 'Perf Med', low: 'Perf Low' }
    const tag = tagMap[bug.cf_performance_impact]
    const isNew = !priorityBugIds.includes(id)
    setPriorityBugIds(prev => prev.includes(id) ? prev : [...prev, id])
    if (tag) {
      setPriorityBugTags(prev => {
        const existing = prev[id] || []
        if (existing.includes(tag)) return prev
        return { ...prev, [id]: [...existing, tag] }
      })
    }
    if (isNew) {
      showToast(`Bug #${id} added to My Tracking`)
    } else {
      showToast(`Bug #${id} is already in My Tracking`, 'info')
    }
  }

  // Filter performance impact bugs by selected component
  const filteredPerfImpactBugs = selectedComponent === 'all'
    ? perfImpactBugs
    : perfImpactBugs.filter(bug => bug.component === selectedComponent)

  // All unique tags across all priority bugs
  const allPriorityTags = [...new Set(Object.values(priorityBugTags).flat())].sort()

  // Filter priority bugs by selected tags (show all if none selected)
  const filteredPriorityBugs = prioritySelectedTags.length === 0
    ? priorityBugs
    : priorityBugs.filter(bug => {
        const bugTagList = priorityBugTags[String(bug.id)] || []
        return prioritySelectedTags.some(tag => bugTagList.includes(tag))
      })

  // Process bug data for charts
  const severityCounts = bugs.length > 0 ? groupBugsBySeverity(bugs) : { Critical: 0, High: 0, Medium: 0, Low: 0 }
  const componentCounts = bugs.length > 0 ? groupBugsByComponent(bugs) : {}

  // Prepare chart data from real Bugzilla data
  const bugData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      label: 'Bug Count by Severity',
      data: [
        severityCounts.Critical || 0,
        severityCounts.High || 0,
        severityCounts.Medium || 0,
        severityCounts.Low || 0
      ],
      backgroundColor: [
        'rgba(255, 99, 132, 0.8)',
        'rgba(255, 159, 64, 0.8)',
        'rgba(255, 205, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
      ],
      borderColor: [
        'rgb(255, 99, 132)',
        'rgb(255, 159, 64)',
        'rgb(255, 205, 86)',
        'rgb(75, 192, 192)',
      ],
      borderWidth: 2,
    }],
  }

  // Overview performance impact chart data
  const overviewBugData = {
    labels: ['Priority', 'High', 'Med', 'Low'],
    datasets: [{
      label: 'Bug Count',
      data: [
        priorityBugIds.length,
        overviewPerfCounts.high,
        overviewPerfCounts.medium,
        overviewPerfCounts.low
      ],
      backgroundColor: [
        'rgba(167, 139, 250, 0.8)',
        'rgba(255, 99, 132, 0.8)',
        'rgba(255, 205, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
      ],
      borderColor: [
        'rgb(167, 139, 250)',
        'rgb(255, 99, 132)',
        'rgb(255, 205, 86)',
        'rgb(75, 192, 192)',
      ],
      borderWidth: 2,
    }],
  }

  // Open SP3 bugs with scoring applied (for overview tiles)
  const openSp3Bugs = sp3Bugs
    .filter(b => b.status !== 'RESOLVED' && b.status !== 'VERIFIED' && b.status !== 'CLOSED')
    .map(b => ({ ...b, score: scoreBug(b), flags: getBugFlags(b), areas: getAreaTags(b) }))
    .sort((a, b) => b.score - a.score)

  // Area of Improvement Hotspot — count open SP3 bugs per area, sorted descending
  const areaHotspotRows = AREA_DEFS
    .map((def, i) => ({
      label: def.label,
      count: openSp3Bugs.filter(b => b.areas.includes(def.tag)).length,
      color: AREA_COLORS[i],
    }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)

  const areaHotspotData = {
    labels: areaHotspotRows.map(r => r.label),
    datasets: [{
      data: areaHotspotRows.map(r => r.count),
      backgroundColor: areaHotspotRows.map(r => r.color),
      borderWidth: 0,
    }],
  }

  const areaHotspotOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      label: ctx => ` ${ctx.parsed.x} bug${ctx.parsed.x !== 1 ? 's' : ''}`,
    }}},
    scales: {
      x: { beginAtZero: true, ticks: { color: '#999', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.06)' } },
      y: { ticks: { color: '#ccc', font: { size: 11 } }, grid: { display: false } },
    },
  }

  // Top 5 bugs to act on — highest-scored open SP3 bugs
  const top5Bugs = openSp3Bugs.slice(0, 5)

  // All-component overview tiles
  const openAllCompBugs = allCompBugs
    .filter(b => b.status !== 'RESOLVED' && b.status !== 'VERIFIED' && b.status !== 'CLOSED')
    .map(b => ({ ...b, score: scoreBug(b), flags: getBugFlags(b), areas: getAreaTags(b) }))
    .sort((a, b) => b.score - a.score)

  const top5AllCompBugs = openAllCompBugs.slice(0, 5)

  const areaHotspotAllRows = AREA_DEFS
    .map((def, i) => ({
      label: def.label,
      count: openAllCompBugs.filter(b => b.areas.includes(def.tag)).length,
      color: AREA_COLORS[i],
    }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)

  const areaHotspotAllData = {
    labels: areaHotspotAllRows.map(r => r.label),
    datasets: [{ data: areaHotspotAllRows.map(r => r.count), backgroundColor: areaHotspotAllRows.map(r => r.color), borderWidth: 0 }],
  }

  // Sample data for benchmark scores
  const priorityTrackingEntries = Object.entries(priorityTrackingHistory)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)

  const priorityTrackingData = {
    labels: priorityTrackingEntries.map(([date]) => date),
    datasets: [
      {
        label: 'Priority SP3',
        data: priorityTrackingEntries.map(([, v]) => v.sp3),
        borderColor: 'rgb(251, 191, 36)',
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        tension: 0.3,
        pointRadius: 4,
      },
      {
        label: 'Priority Bugs',
        data: priorityTrackingEntries.map(([, v]) => v.priority),
        borderColor: 'rgb(102, 126, 234)',
        backgroundColor: 'rgba(102, 126, 234, 0.15)',
        tension: 0.3,
        pointRadius: 4,
      },
    ],
  }

  // Prepare team/component data from performance impact bugs
  const perfImpactComponentCounts = allPerfImpactBugs.length > 0 ? groupBugsByComponent(allPerfImpactBugs) : {}

  // Sort components by bug count and get top 10
  const sortedPerfComponents = Object.entries(perfImpactComponentCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  const perfComponentLabels = sortedPerfComponents.map(([component]) => component)
  const perfComponentValues = sortedPerfComponents.map(([, count]) => count)

  const teamData = {
    labels: perfComponentLabels.length > 0 ? perfComponentLabels : ['No Data'],
    datasets: [{
      label: 'Performance Impact Bugs by Component',
      data: perfComponentValues.length > 0 ? perfComponentValues : [0],
      backgroundColor: 'rgba(102, 126, 234, 0.8)',
      borderColor: 'rgb(102, 126, 234)',
      borderWidth: 2,
    }],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  }

  // Click handler for the impact distribution bar chart
  const handleImpactBarClick = (event, elements) => {
    if (!elements || elements.length === 0) return
    const actions = [
      () => { setActiveView('perfpriority'); setPerfPrioritySubsection('prioritybugs') },
      () => { setActiveView('perfimpact'); setPerfImpactLevel('high') },
      () => { setActiveView('perfimpact'); setPerfImpactLevel('medium') },
      () => { setActiveView('perfimpact'); setPerfImpactLevel('low') },
    ]
    actions[elements[0].index]?.()
  }

  const impactBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    onHover: (event, elements) => {
      if (event.native) {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default'
      }
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading Bugzilla data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="error-container">
          <h3>Error loading data</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* <div className="dashboard-header">
        <div className="config-section">
          <label>
            Product:
            <input
              type="text"
              value={config.product}
              onChange={(e) => setConfig({ ...config, product: e.target.value })}
            />
          </label>
          <label>
            Component:
            <input
              type="text"
              value={config.component}
              onChange={(e) => setConfig({ ...config, component: e.target.value })}
            />
          </label>
        </div>
      </div> */}

      <nav className="dashboard-nav">
        <button
          className={activeView === 'overview' ? 'active' : ''}
          onClick={() => setActiveView('overview')}
        >
          Overview
        </button>
        <button
          className={activeView === 'compriorities' ? 'active' : ''}
          onClick={() => setActiveView('compriorities')}
        >
          Perf Priorities
        </button>
        <button
          className={activeView === 'bugs' ? 'active' : ''}
          onClick={() => setActiveView('bugs')}
        >
          Bug Tracking
        </button>
        <button
          className={activeView === 'perfimpact' ? 'active' : ''}
          onClick={() => setActiveView('perfimpact')}
        >
          Performance Impact
        </button>
        <button
          className={activeView === 'benchmarks' ? 'active' : ''}
          onClick={() => setActiveView('benchmarks')}
        >
          Benchmarks
        </button>
        <button
          className={activeView === 'teams' ? 'active' : ''}
          onClick={() => setActiveView('teams')}
        >
          Components
        </button>
        <button
          className={activeView === 'perfpriority' ? 'active' : ''}
          onClick={() => setActiveView('perfpriority')}
        >
          My Tracking
        </button>
      </nav>

      <div className="dashboard-content">
        {activeView === 'overview' && (
          <div className="overview-layout">
            <div className="stats-card stats-card-full">
              <h3>Quick Stats</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-value">{bugStats?.total || 0}</span>
                  <span className="stat-label">Total Bugs</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{bugStats?.open || 0}</span>
                  <span className="stat-label">Open Bugs</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{bugStats?.closed || 0}</span>
                  <span className="stat-label">Closed Bugs</span>
                </div>
                <div
                  className="stat-item stat-item-link"
                  onClick={() => { setCompPrioritiesInitialKey('sp3'); setActiveView('compriorities') }}
                  title="Go to SP3 Priority Bugs in Perf Priorities tab"
                >
                  <span className="stat-value">{sp3Bugs.length}</span>
                  <span className="stat-label">Priority SP3</span>
                </div>
                <div
                  className="stat-item stat-item-link"
                  onClick={() => { setActiveView('perfpriority'); setPerfPrioritySubsection('prioritybugs') }}
                  title="Go to Priority Bugs"
                >
                  <span className="stat-value stat-value-priority">{priorityBugIds.length}</span>
                  <span className="stat-label">My Tracking</span>
                </div>
                {(() => {
                  const blendedRow = benchmarkRows.find(r => r.platform_label?.toUpperCase().includes('BLENDED'))
                  const delta = blendedRow?.delta_ytd
                  if (delta == null) return null
                  const colorClass = delta < 0 ? 'stat-value-delta-good' : delta > 0 ? 'stat-value-delta-bad' : ''
                  const formatted = (delta > 0 ? '+' : '') + delta.toFixed(2) + '%'
                  return (
                    <div
                      className="stat-item stat-item-link"
                      onClick={() => setActiveView('benchmarks')}
                      title="Go to Benchmarks"
                    >
                      <span className={`stat-value ${colorClass}`}>{formatted}</span>
                      <span className="stat-label">Applink</span>
                    </div>
                  )
                })()}
              </div>
            </div>
            {/* Row 1: [E][F][H] — benchmark KPIs */}
            <div className="overview-grid overview-grid--3col">
              {/* E: Speedometer 3 Desktop */}
              <div className="chart-card">
                <h3>Speedometer 3 — Desktop</h3>
                {speedometerLoading && <div className="loading-container"><div className="loading-spinner"></div></div>}
                {!speedometerLoading && (() => {
                  const startRow = speedometerRows.find(r => r.push_date === '2026-01-01')
                  const latestRow = speedometerRows[speedometerRows.length - 1]
                  if (!startRow || !latestRow) return <p className="chart-subtitle">No data available</p>
                  const fxCurrent = latestRow.firefox_value_ma_desktop
                  const chromeStart = startRow.chrome_value_ma_desktop
                  const delta = fxCurrent && chromeStart ? 100 * (fxCurrent / chromeStart - 1) : null
                  const colorClass = delta == null ? '' : delta > 0 ? 'stat-value-delta-good' : 'stat-value-delta-bad'
                  const prevVal = prevKpiValues.speedometerDesktop?.value
                  const change = delta != null && prevVal != null ? delta - prevVal : null
                  return (
                    <div className="overview-kpi-tile" onClick={() => setActiveView('benchmarks')} title="Go to Benchmarks" style={{cursor: 'pointer'}}>
                      <span className={`overview-kpi-value ${colorClass}`}>
                        {delta != null ? (delta > 0 ? '+' : '') + delta.toFixed(2) + '%' : '—'}
                      </span>
                      <span className="overview-kpi-label">Fx vs Chrome Start</span>
                      {change != null && Math.abs(change) >= 0.01 && (
                        <span className={`overview-kpi-change ${change > 0 ? 'kpi-change-good' : 'kpi-change-bad'}`}>
                          {change > 0 ? '▲' : '▼'} {change > 0 ? '+' : ''}{change.toFixed(2)}pp
                        </span>
                      )}
                      <span className="chart-subtitle" style={{marginTop: '4px'}}>{latestRow.push_date}</span>
                    </div>
                  )
                })()}
              </div>
              {/* F: Android Applink */}
              <div className="chart-card">
                <h3>Android Applink</h3>
                {benchmarkLoading && <div className="loading-container"><div className="loading-spinner"></div></div>}
                {!benchmarkLoading && (() => {
                  const blendedRow = benchmarkRows.find(r => r.platform_label?.toUpperCase().includes('BLENDED'))
                  const delta = blendedRow?.delta_ytd
                  const colorClass = delta == null ? '' : delta < 0 ? 'stat-value-delta-good' : 'stat-value-delta-bad'
                  const prevVal = prevKpiValues.androidApplink?.value
                  const change = delta != null && prevVal != null ? delta - prevVal : null
                  return (
                    <div className="overview-kpi-tile" onClick={() => setActiveView('benchmarks')} title="Go to Benchmarks" style={{cursor: 'pointer'}}>
                      <span className={`overview-kpi-value ${colorClass}`}>
                        {delta != null ? (delta > 0 ? '+' : '') + delta.toFixed(2) + '%' : '—'}
                      </span>
                      <span className="overview-kpi-label">Fx Delta YTD</span>
                      {change != null && Math.abs(change) >= 0.01 && (
                        <span className={`overview-kpi-change ${change < 0 ? 'kpi-change-good' : 'kpi-change-bad'}`}>
                          {change < 0 ? '▼' : '▲'} {change > 0 ? '+' : ''}{change.toFixed(2)}pp
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>
              {/* H: JetStream 3 (placeholder) */}
              <div className="chart-card">
                <h3>JetStream 3</h3>
                <p className="chart-subtitle">Benchmark data not yet configured</p>
                <div className="query-placeholder" style={{marginTop: '32px'}}>
                  <p>📊 Query configuration pending…</p>
                </div>
              </div>
            </div>

            {/* Row 2: [A][B][G] — SP3 hotspot, SP3 top bugs, all-comp top bugs */}
            <div className="overview-grid overview-grid--3col">
              {/* A: SP3 Area Hotspot */}
              <div className="chart-card">
                <h3>SP3 Area Hotspot</h3>
                <p className="chart-subtitle">Open SP3 bugs by area of improvement</p>
                {sp3BugsLoading && <div className="loading-container" style={{minHeight:120}}><div className="loading-spinner"></div></div>}
                {!sp3BugsLoading && areaHotspotRows.length > 0 && (
                  <div className="chart-container" style={{minHeight: `${Math.max(160, areaHotspotRows.length * 28)}px`}}>
                    <Bar data={areaHotspotData} options={areaHotspotOptions} />
                  </div>
                )}
                {!sp3BugsLoading && areaHotspotRows.length === 0 && (
                  <p className="chart-subtitle" style={{textAlign:'center', marginTop:'40px'}}>No data — loads with SP3 bugs.</p>
                )}
              </div>
              {/* B: SP3 Top Bugs */}
              <div className="chart-card">
                <h3>Top Bugs to Act On — SP3</h3>
                <p className="chart-subtitle">Highest-scored open SP3 bugs</p>
                {sp3BugsLoading && <div className="loading-container" style={{minHeight:80}}><div className="loading-spinner"></div></div>}
                {!sp3BugsLoading && top5Bugs.length > 0 && (
                  <ol className="overview-top-bugs">
                    {top5Bugs.map(bug => (
                      <li key={bug.id} className="overview-top-bug-row">
                        <span className="overview-top-bug-score">{bug.score}</span>
                        <div className="overview-top-bug-body">
                          <a href={`https://bugzilla.mozilla.org/show_bug.cgi?id=${bug.id}`} target="_blank" rel="noopener noreferrer" className="overview-top-bug-id">#{bug.id}</a>
                          <span className="overview-top-bug-summary">{bug.summary?.length > 72 ? bug.summary.slice(0, 69) + '…' : bug.summary}</span>
                          <span className="overview-top-bug-flags">{bug.flags.map(f => <span key={f} className={`overview-top-bug-flag overview-flag--${f}`}>{flagText(f)}</span>)}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {!sp3BugsLoading && top5Bugs.length === 0 && (
                  <p className="chart-subtitle" style={{textAlign:'center', marginTop:'40px'}}>No data — loads with SP3 bugs.</p>
                )}
              </div>
              {/* G: All-Comp Top Bugs */}
              <div className="chart-card">
                <h3>Top Bugs to Act On — All Components</h3>
                <p className="chart-subtitle">Highest-scored open bugs across all tracked components</p>
                {allCompLoading && <div className="loading-container" style={{minHeight:80}}><div className="loading-spinner"></div></div>}
                {!allCompLoading && top5AllCompBugs.length > 0 && (
                  <ol className="overview-top-bugs">
                    {top5AllCompBugs.map(bug => (
                      <li key={bug.id} className="overview-top-bug-row">
                        <span className="overview-top-bug-score">{bug.score}</span>
                        <div className="overview-top-bug-body">
                          <a href={`https://bugzilla.mozilla.org/show_bug.cgi?id=${bug.id}`} target="_blank" rel="noopener noreferrer" className="overview-top-bug-id">#{bug.id}</a>
                          <span className="overview-top-bug-summary">{bug.summary?.length > 72 ? bug.summary.slice(0, 69) + '…' : bug.summary}</span>
                          <span className="overview-top-bug-flags">{bug.flags.map(f => <span key={f} className={`overview-top-bug-flag overview-flag--${f}`}>{flagText(f)}</span>)}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {!allCompLoading && top5AllCompBugs.length === 0 && (
                  <p className="chart-subtitle" style={{textAlign:'center', marginTop:'40px'}}>No data yet.</p>
                )}
              </div>
            </div>

            {/* Row 3: [D×2][C] — all-comp hotspot spans 2 cols, priority tracking in 1 */}
            <div className="overview-grid overview-grid--3col">
              {/* D: All-Comp Area Hotspot (spans 2 columns) */}
              <div className="chart-card" style={{gridColumn: 'span 2'}}>
                <h3>Area Hotspot — All Components</h3>
                <p className="chart-subtitle">Open bugs by area across all tracked components</p>
                {allCompLoading && <div className="loading-container" style={{minHeight:120}}><div className="loading-spinner"></div><p style={{marginTop:8,fontSize:'0.8rem',color:'#999'}}>Fetching 9 components…</p></div>}
                {!allCompLoading && areaHotspotAllRows.length > 0 && (
                  <div className="chart-container" style={{minHeight: '260px'}}>
                    <Bar data={areaHotspotAllData} options={areaHotspotOptions} />
                  </div>
                )}
                {!allCompLoading && areaHotspotAllRows.length === 0 && (
                  <p className="chart-subtitle" style={{textAlign:'center', marginTop:'40px'}}>No data yet.</p>
                )}
              </div>
              {/* C: Priority Tracking */}
              <div className="chart-card">
                <h3>Priority Tracking</h3>
                <div className="chart-container">
                  {priorityTrackingEntries.length > 0
                    ? <Line data={priorityTrackingData} options={chartOptions} />
                    : <p className="chart-subtitle" style={{textAlign:'center', marginTop:'60px'}}>No history yet — data will appear after today's first load.</p>
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'bugs' && (
          <div className="view-container">
            <div className="chart-card large">
              <h3>Bug Tracking by Severity</h3>
              <div className="chart-container">
                <Pie data={bugData} options={chartOptions} />
              </div>
            </div>
          </div>
        )}

        {activeView === 'benchmarks' && (
          <div className="view-container" style={{flexDirection: 'column', width: '100%'}}>
            <div className="chart-card benchmark-card">
              <div className="perf-impact-header">
                <h3>Android Applink Startup — Platform Benchmarks</h3>
                <button
                  className="refresh-button"
                  onClick={() => { setBenchmarkRows([]); setBenchmarkError(null); setBenchmarkRefreshTick(t => t + 1) }}
                  disabled={benchmarkLoading}
                  title="Reload data from STMO"
                >
                  ↻ Refresh
                </button>
              </div>
              <p className="chart-subtitle">Source: STMO query #114368 — values in milliseconds</p>

              {benchmarkLoading && (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading benchmark data from STMO…</p>
                </div>
              )}

              {benchmarkError && !benchmarkLoading && (
                <div className="error-message">
                  <p>Error loading benchmarks: {benchmarkError}</p>
                </div>
              )}

              {!benchmarkLoading && !benchmarkError && benchmarkRows.length > 0 && (
                <div className="benchmark-table-wrapper">
                  <table className="benchmark-table">
                    <thead>
                      <tr>
                        <th>Platform</th>
                        <th>Weight</th>
                        <th>Fx Start</th>
                        <th>Fx Current</th>
                        <th>Fx Delta YTD</th>
                        <th>Chrome Start</th>
                        <th>Chrome Current</th>
                        <th>Fx vs Chrome Start</th>
                        <th>Fx vs Chrome Current</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarkRows.map((row, i) => {
                        const deltaYtd = row.delta_ytd
                        const deltaYtdChrome = row.delta_ytd_chrome
                        const deltaChromeYtd = row.delta_to_chrome_ytd
                        const deltaYtdClass = deltaYtd == null ? '' : deltaYtd < 0 ? 'delta-negative' : deltaYtd > 0 ? 'delta-positive' : ''
                        const deltaYtdChromeClass = deltaYtdChrome == null ? '' : deltaYtdChrome < 0 ? 'delta-negative' : deltaYtdChrome > 0 ? 'delta-positive' : ''
                        const deltaChromeClass = deltaChromeYtd == null ? '' : deltaChromeYtd < 0 ? 'delta-negative' : deltaChromeYtd > 0 ? 'delta-positive' : ''
                        const isTotal = row.platform_label?.toUpperCase().includes('BLENDED')
                        return (
                          <tr key={i} className={isTotal ? 'benchmark-row-total' : ''}>
                            <td className="benchmark-platform">{row.platform_label}</td>
                            <td className="benchmark-num">{row.platform_weight != null ? row.platform_weight : '—'}</td>
                            <td className="benchmark-num">{row.start_value != null ? row.start_value.toFixed(0) : '—'}</td>
                            <td className="benchmark-num">{row.current_value != null ? row.current_value.toFixed(0) : '—'}</td>
                            <td className={`benchmark-num ${deltaYtdClass}`}>
                              {deltaYtd != null ? (deltaYtd > 0 ? '+' : '') + deltaYtd.toFixed(2) + '%' : '—'}
                            </td>
                            <td className="benchmark-num">{row.start_value_chrome != null ? row.start_value_chrome.toFixed(0) : '—'}</td>
                            <td className="benchmark-num">{row.current_value_chrome != null ? row.current_value_chrome.toFixed(0) : '—'}</td>
                            <td className={`benchmark-num ${deltaYtdChromeClass}`}>
                              {deltaYtdChrome != null ? (deltaYtdChrome > 0 ? '+' : '') + deltaYtdChrome.toFixed(2) + '%' : '—'}
                            </td>
                            <td className={`benchmark-num ${deltaChromeClass}`}>
                              {deltaChromeYtd != null ? (deltaChromeYtd > 0 ? '+' : '') + deltaChromeYtd.toFixed(2) + '%' : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!benchmarkLoading && !benchmarkError && benchmarkRows.length === 0 && !benchmarkLoading && (
                <div className="query-placeholder">
                  <p>No benchmark data available. Click Refresh to load.</p>
                </div>
              )}
            </div>

            {/* Speedometer section */}
            <div className="chart-card benchmark-card">
              <div className="perf-impact-header">
                <h3>Speedometer 3 — Desktop &amp; Android</h3>
                <button
                  className="refresh-button"
                  onClick={() => { setSpeedometerRows([]); setSpeedometerError(null); setSpeedometerRefreshTick(t => t + 1) }}
                  disabled={speedometerLoading}
                  title="Reload data from STMO"
                >
                  ↻ Refresh
                </button>
              </div>
              <p className="chart-subtitle">Source: STMO query #96742 — scores (higher is better); YTD from Jan 1, 2026</p>

              {speedometerLoading && (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading Speedometer data from STMO…</p>
                </div>
              )}

              {speedometerError && !speedometerLoading && (
                <div className="error-message">
                  <p>Error loading Speedometer data: {speedometerError}</p>
                </div>
              )}

              {!speedometerLoading && !speedometerError && speedometerRows.length > 0 && (() => {
                const startRow = speedometerRows.find(r => r.push_date === '2026-01-01')
                const latestRow = speedometerRows[speedometerRows.length - 1]
                if (!startRow || !latestRow) return (
                  <div className="query-placeholder"><p>Insufficient data to display YTD summary.</p></div>
                )
                const platforms = [
                  {
                    label: 'Desktop',
                    fxStart: startRow.firefox_value_ma_desktop,
                    fxCurrent: latestRow.firefox_value_ma_desktop,
                    chromeStart: startRow.chrome_value_ma_desktop,
                    chromeCurrent: latestRow.chrome_value_ma_desktop,
                    deltaVsChromeCurrent: latestRow.pct_delta_ma_desktop,
                  },
                  {
                    label: 'Android',
                    fxStart: startRow.firefox_value_ma_android,
                    fxCurrent: latestRow.firefox_value_ma_android,
                    chromeStart: startRow.chrome_value_ma_android,
                    chromeCurrent: latestRow.chrome_value_ma_android,
                    deltaVsChromeCurrent: latestRow.pct_delta_ma_android,
                  },
                ].map(p => ({
                  ...p,
                  fxDeltaYtd: p.fxStart && p.fxCurrent ? 100 * (p.fxCurrent / p.fxStart - 1) : null,
                  deltaVsChromeStart: p.fxCurrent && p.chromeStart ? 100 * (p.fxCurrent / p.chromeStart - 1) : null,
                }))
                // Speedometer: higher is better — positive delta = green, negative = red
                const spClass = v => v == null ? '' : v > 0 ? 'delta-negative' : v < 0 ? 'delta-positive' : ''
                const fmtDelta = v => v != null ? (v > 0 ? '+' : '') + v.toFixed(2) + '%' : '—'
                const fmtScore = v => v != null ? v.toFixed(2) : '—'
                return (
                  <div className="benchmark-table-wrapper">
                    <table className="benchmark-table">
                      <thead>
                        <tr>
                          <th>Platform</th>
                          <th>Fx Start</th>
                          <th>Fx Current</th>
                          <th>Fx Delta YTD</th>
                          <th>Chrome Start</th>
                          <th>Chrome Current</th>
                          <th>Fx vs Chrome Start</th>
                          <th>Fx vs Chrome Current</th>
                        </tr>
                      </thead>
                      <tbody>
                        {platforms.map((p, i) => (
                          <tr key={i}>
                            <td className="benchmark-platform">{p.label}</td>
                            <td className="benchmark-num">{fmtScore(p.fxStart)}</td>
                            <td className="benchmark-num">{fmtScore(p.fxCurrent)}</td>
                            <td className={`benchmark-num ${spClass(p.fxDeltaYtd)}`}>{fmtDelta(p.fxDeltaYtd)}</td>
                            <td className="benchmark-num">{fmtScore(p.chromeStart)}</td>
                            <td className="benchmark-num">{fmtScore(p.chromeCurrent)}</td>
                            <td className={`benchmark-num ${spClass(p.deltaVsChromeStart)}`}>{fmtDelta(p.deltaVsChromeStart)}</td>
                            <td className={`benchmark-num ${spClass(p.deltaVsChromeCurrent)}`}>{fmtDelta(p.deltaVsChromeCurrent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="chart-subtitle" style={{marginTop: '8px'}}>Latest data: {latestRow.push_date}</p>
                  </div>
                )
              })()}

              {!speedometerLoading && !speedometerError && speedometerRows.length === 0 && (
                <div className="query-placeholder">
                  <p>No Speedometer data available. Click Refresh to load.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === 'teams' && (
          <div className="view-container">
            {allPerfImpactLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading performance impact data...</p>
              </div>
            ) : (
              <div className="chart-card large">
                <h3>Top 10 Components with Performance Impact</h3>
                <p className="chart-subtitle">
                  Components with the most performance impact bugs (High, Medium, or Low)
                </p>
                <div className="chart-container">
                  <Bar data={teamData} options={chartOptions} />
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'perfimpact' && (
          <div className="perf-impact-container">
            <div className="perf-impact-header">
              <h2>Bugs with Performance Impact</h2>
              <div className="perf-impact-controls">
                <div className="perf-impact-filter">
                  <label htmlFor="impact-level">Impact Level:</label>
                  <select
                    id="impact-level"
                    value={perfImpactLevel}
                    onChange={(e) => setPerfImpactLevel(e.target.value)}
                  >
                    <option value="high">Performance Impact: High</option>
                    <option value="medium">Performance Impact: Medium</option>
                    <option value="low">Performance Impact: Low</option>
                  </select>
                </div>
                <button
                  className="refresh-button"
                  onClick={handleRefreshPerfImpact}
                  disabled={perfImpactLoading}
                  title="Refresh data (clears cache)"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            {perfImpactLoading && (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading performance impact bugs...</p>
              </div>
            )}

            {perfImpactError && !perfImpactLoading && (
              <div className="error-message">
                <p>Error: {perfImpactError}</p>
              </div>
            )}

            {!perfImpactLoading && !perfImpactError && (
              <>
                <div className="component-filter-bar">
                  <div className="component-filter">
                    <label htmlFor="component-filter">Filter by Component:</label>
                    <select
                      id="component-filter"
                      value={selectedComponent}
                      onChange={(e) => setSelectedComponent(e.target.value)}
                    >
                      <option value="all">All Components ({perfImpactBugs.length})</option>
                      {perfImpactComponents.map(component => {
                        const count = perfImpactBugs.filter(bug => bug.component === component).length
                        return (
                          <option key={component} value={component}>
                            {component} ({count})
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>
                <BugTable
                  bugs={filteredPerfImpactBugs}
                  onAddToPriority={handleAddToPriority}
                />
              </>
            )}
          </div>
        )}

        {activeView === 'perfpriority' && (
          <div className="perf-priority-container">
            <div className="perf-priority-header">
              <h2>My Tracking</h2>
              <p className="section-description">
                Bugs you are personally tracking
              </p>
            </div>

            <div className="subsection-content">
              <div className="priority-section">
                  <div className="perf-impact-header">
                    <h3>Priority Bugs</h3>
                    <div className="perf-impact-controls">
                      <button
                        className="refresh-button"
                        onClick={handleRefreshPriorityBugs}
                        disabled={priorityBugsLoading || priorityBugIds.length === 0}
                        title="Refresh data (clears cache)"
                      >
                        ↻ Refresh
                      </button>
                    </div>
                  </div>

                  <div className="priority-bug-input-area">
                    <div className="bug-input-row">
                      <input
                        type="text"
                        className="bug-input"
                        value={priorityBugInput}
                        onChange={(e) => setPriorityBugInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddPriorityBugs()}
                        placeholder="Enter bug numbers (e.g. 12345, 67890)"
                      />
                      <button
                        className="add-bug-button"
                        onClick={handleAddPriorityBugs}
                        disabled={!priorityBugInput.trim()}
                      >
                        Add Bugs
                      </button>
                    </div>
                  </div>

                  {priorityBugsLoading && (
                    <div className="loading-container">
                      <div className="loading-spinner"></div>
                      <p>Loading bugs...</p>
                    </div>
                  )}

                  {priorityBugsError && !priorityBugsLoading && (
                    <div className="error-message">
                      <p>Error: {priorityBugsError}</p>
                    </div>
                  )}

                  {!priorityBugsLoading && !priorityBugsError && priorityBugIds.length > 0 && (
                    <>
                      <div className="component-filter-bar">
                        <div className="component-filter">
                          <label>Filter by Tag:</label>
                          <div className="tag-filter-dropdown" ref={tagFilterRef}>
                            <button
                              className="tag-filter-toggle"
                              onClick={() => setTagFilterOpen(prev => !prev)}
                            >
                              {prioritySelectedTags.length === 0
                                ? `All Bugs (${priorityBugs.length})`
                                : `${prioritySelectedTags.length} tag${prioritySelectedTags.length > 1 ? 's' : ''} selected (${filteredPriorityBugs.length})`}
                              <span className="dropdown-arrow">{tagFilterOpen ? '▲' : '▼'}</span>
                            </button>
                            {tagFilterOpen && (
                              <div className="tag-filter-menu">
                                {allPriorityTags.length === 0 ? (
                                  <div className="tag-filter-empty">No tags added yet</div>
                                ) : (
                                  allPriorityTags.map(tag => (
                                    <label key={tag} className="tag-filter-option">
                                      <input
                                        type="checkbox"
                                        checked={prioritySelectedTags.includes(tag)}
                                        onChange={() => togglePriorityTag(tag)}
                                      />
                                      {tag}
                                    </label>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <BugTable
                        bugs={filteredPriorityBugs}
                        bugTags={priorityBugTags}
                        onAddTag={handleAddBugTag}
                        onRemoveTag={handleRemoveBugTag}
                        onRemoveBug={handleRemovePriorityBugId}
                      />
                    </>
                  )}

                  {!priorityBugsLoading && priorityBugIds.length === 0 && (
                    <div className="query-placeholder">
                      <p>Enter bug numbers above to load and track specific bugs</p>
                    </div>
                  )}
                </div>
            </div>
          </div>
        )}

        {activeView === 'compriorities' && <ComponentPriorities initialKey={compPrioritiesInitialKey} onAddToPriority={handleAddFromCompPriorities} />}
      </div>

      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
