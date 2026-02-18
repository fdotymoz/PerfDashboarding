import { useState, useEffect, useRef } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title } from 'chart.js'
import { Pie, Bar, Line } from 'react-chartjs-2'
import './Dashboard.css'
import { fetchBugs, groupBugsBySeverity, groupBugsByComponent, getBugStats, fetchBugsByPerformanceImpact, clearPerformanceImpactCache, fetchAllPerformanceImpactBugs, fetchBugsByIds } from '../services/bugzillaService'
import BugTable from './BugTable'

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
  const [perfPrioritySubsection, setPerfPrioritySubsection] = useState('speedometer3')

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

  // Sample data for benchmark scores
  const benchmarkData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [{
      label: 'Performance Score',
      data: [85, 88, 92, 90],
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.4,
    }],
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
          className={activeView === 'perfpriority' ? 'active' : ''}
          onClick={() => setActiveView('perfpriority')}
        >
          Performance Priority
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
      </nav>

      <div className="dashboard-content">
        {activeView === 'overview' && (
          <div className="overview-grid">
            <div className="chart-card">
              <h3>Performance Impact Distribution</h3>
              <div className="chart-container">
                <Bar data={overviewBugData} options={impactBarOptions} onClick={handleImpactBarClick} />
              </div>
            </div>
            <div className="chart-card">
              <h3>Performance Trends</h3>
              <div className="chart-container">
                <Line data={benchmarkData} options={chartOptions} />
              </div>
            </div>
            <div className="chart-card">
              <h3>Bugs by Component</h3>
              <div className="chart-container">
                <Bar data={teamData} options={chartOptions} />
              </div>
            </div>
            <div className="stats-card">
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
                <div className="stat-item">
                  <span className="stat-value">{Object.keys(componentCounts).length}</span>
                  <span className="stat-label">Components</span>
                </div>
                <div
                  className="stat-item stat-item-link"
                  onClick={() => { setActiveView('perfpriority'); setPerfPrioritySubsection('prioritybugs') }}
                  title="Go to Priority Bugs"
                >
                  <span className="stat-value stat-value-priority">{priorityBugIds.length}</span>
                  <span className="stat-label">Priority Bugs</span>
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
          <div className="view-container">
            <div className="chart-card large">
              <h3>Benchmark Score Trends</h3>
              <div className="chart-container">
                <Line data={benchmarkData} options={chartOptions} />
              </div>
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
              <h2>Performance Priority</h2>
              <p className="section-description">
                Focus areas for performance improvements
              </p>
            </div>

            <nav className="subsection-nav">
              <button
                className={perfPrioritySubsection === 'speedometer3' ? 'active' : ''}
                onClick={() => setPerfPrioritySubsection('speedometer3')}
              >
                Speedometer 3
              </button>
              <button
                className={perfPrioritySubsection === 'androidapplink' ? 'active' : ''}
                onClick={() => setPerfPrioritySubsection('androidapplink')}
              >
                Android Applink
              </button>
              <button
                className={perfPrioritySubsection === 'prioritybugs' ? 'active' : ''}
                onClick={() => setPerfPrioritySubsection('prioritybugs')}
              >
                Priority Bugs
              </button>
            </nav>

            <div className="subsection-content">
              {perfPrioritySubsection === 'speedometer3' && (
                <div className="priority-section">
                  <h3>Speedometer 3</h3>
                  <p className="placeholder-text">
                    Bugzilla query will be defined here for Speedometer 3 performance issues.
                  </p>
                  <div className="query-placeholder">
                    <p>📊 Query configuration pending...</p>
                  </div>
                </div>
              )}

              {perfPrioritySubsection === 'androidapplink' && (
                <div className="priority-section">
                  <h3>Android Applink</h3>
                  <p className="placeholder-text">
                    Bugzilla query will be defined here for Android Applink performance issues.
                  </p>
                  <div className="query-placeholder">
                    <p>📊 Query configuration pending...</p>
                  </div>
                </div>
              )}

              {perfPrioritySubsection === 'prioritybugs' && (
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
              )}
            </div>
          </div>
        )}
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
