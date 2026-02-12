import { useState, useEffect } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title } from 'chart.js'
import { Pie, Bar, Line } from 'react-chartjs-2'
import './Dashboard.css'
import { fetchBugs, groupBugsBySeverity, groupBugsByComponent, getBugStats, fetchBugsByPerformanceImpact, clearPerformanceImpactCache, fetchAllPerformanceImpactBugs } from '../services/bugzillaService'
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

  // Performance Priority subsection state
  const [perfPrioritySubsection, setPerfPrioritySubsection] = useState('speedometer3')

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

  // Filter performance impact bugs by selected component
  const filteredPerfImpactBugs = selectedComponent === 'all'
    ? perfImpactBugs
    : perfImpactBugs.filter(bug => bug.component === selectedComponent)

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
              <h3>Bug Severity Distribution</h3>
              <div className="chart-container">
                <Pie data={bugData} options={chartOptions} />
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
                <BugTable bugs={filteredPerfImpactBugs} />
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
