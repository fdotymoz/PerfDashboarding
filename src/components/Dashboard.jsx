import { useState } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title } from 'chart.js'
import { Pie, Bar, Line } from 'react-chartjs-2'
import './Dashboard.css'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title)

function Dashboard() {
  const [activeView, setActiveView] = useState('overview')

  // Sample data for bug tracking
  const bugData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      label: 'Bug Count by Severity',
      data: [5, 12, 23, 8],
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

  // Sample data for team breakdown
  const teamData = {
    labels: ['Frontend', 'Backend', 'DevOps', 'QA', 'Security'],
    datasets: [{
      label: 'Active Components',
      data: [15, 12, 8, 10, 6],
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

  return (
    <div className="dashboard">
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
          className={activeView === 'benchmarks' ? 'active' : ''}
          onClick={() => setActiveView('benchmarks')}
        >
          Benchmarks
        </button>
        <button
          className={activeView === 'teams' ? 'active' : ''}
          onClick={() => setActiveView('teams')}
        >
          Teams
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
              <h3>Team Component Ownership</h3>
              <div className="chart-container">
                <Bar data={teamData} options={chartOptions} />
              </div>
            </div>
            <div className="stats-card">
              <h3>Quick Stats</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-value">48</span>
                  <span className="stat-label">Total Bugs</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">89%</span>
                  <span className="stat-label">Avg Performance</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">5</span>
                  <span className="stat-label">Active Teams</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">51</span>
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
            <div className="chart-card large">
              <h3>Component Ownership by Team</h3>
              <div className="chart-container">
                <Bar data={teamData} options={chartOptions} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
