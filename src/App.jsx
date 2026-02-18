import { useState, useEffect } from 'react'
import './App.css'
import Dashboard from './components/Dashboard'

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode')
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', !darkMode)
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  return (
    <div className="App">
      <header className="app-header">
        <div className="app-header-top">
          <div>
            <h1>Performance Dashboard</h1>
            <p>Track bugs, benchmarks, and team metrics</p>
          </div>
          <button className="theme-toggle" onClick={() => setDarkMode(d => !d)}>
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </header>
      <Dashboard />
    </div>
  )
}

export default App
