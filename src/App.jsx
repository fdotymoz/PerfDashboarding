import { useState } from 'react'
import './App.css'
import Dashboard from './components/Dashboard'

function App() {
  return (
    <div className="App">
      <header className="app-header">
        <h1>Performance Dashboard</h1>
        <p>Track bugs, benchmarks, and team metrics</p>
      </header>
      <Dashboard />
    </div>
  )
}

export default App
