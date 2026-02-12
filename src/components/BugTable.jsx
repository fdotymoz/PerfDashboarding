import { useState } from 'react'
import './BugTable.css'

function BugTable({ bugs }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  if (!bugs || bugs.length === 0) {
    return (
      <div className="bug-table-empty">
        <p>No bugs found matching the criteria.</p>
      </div>
    )
  }

  // Calculate pagination
  const totalPages = Math.ceil(bugs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentBugs = bugs.slice(startIndex, endIndex)

  // Reset to page 1 if current page is out of bounds
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1)
  }

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value))
    setCurrentPage(1)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getSeverityClass = (severity) => {
    const severityMap = {
      'S1': 'severity-critical',
      'S2': 'severity-high',
      'S3': 'severity-medium',
      'S4': 'severity-low'
    }
    return severityMap[severity] || 'severity-default'
  }

  const getStatusClass = (status) => {
    if (status === 'RESOLVED' || status === 'VERIFIED' || status === 'CLOSED') {
      return 'status-closed'
    }
    if (status === 'NEW' || status === 'UNCONFIRMED') {
      return 'status-new'
    }
    return 'status-open'
  }

  return (
    <div className="bug-table-container">
      <div className="table-controls">
        <div className="bug-count">
          Showing {startIndex + 1}-{Math.min(endIndex, bugs.length)} of {bugs.length} bug{bugs.length !== 1 ? 's' : ''}
        </div>
        <div className="items-per-page">
          <label htmlFor="items-per-page">Per page:</label>
          <select
            id="items-per-page"
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>
      <div className="bug-table-wrapper">
        <table className="bug-table">
          <thead>
            <tr>
              <th>Bug ID</th>
              <th>Summary</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Component</th>
              <th>Assigned To</th>
              <th>Last Changed</th>
            </tr>
          </thead>
          <tbody>
            {currentBugs.map((bug) => (
              <tr key={bug.id}>
                <td className="bug-id">
                  <a
                    href={`https://bugzilla.mozilla.org/show_bug.cgi?id=${bug.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {bug.id}
                  </a>
                </td>
                <td className="bug-summary">{bug.summary}</td>
                <td className={`bug-severity ${getSeverityClass(bug.severity)}`}>
                  {bug.severity}
                </td>
                <td className={`bug-status ${getStatusClass(bug.status)}`}>
                  {bug.status}
                </td>
                <td className="bug-component">{bug.component}</td>
                <td className="bug-assignee">
                  {bug.assigned_to_detail?.real_name || bug.assigned_to || 'Unassigned'}
                </td>
                <td className="bug-date">{formatDate(bug.last_change_time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-button"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            ⟪ First
          </button>
          <button
            className="pagination-button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            ‹ Prev
          </button>

          <div className="pagination-info">
            Page {currentPage} of {totalPages}
          </div>

          <button
            className="pagination-button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next ›
          </button>
          <button
            className="pagination-button"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last ⟫
          </button>
        </div>
      )}
    </div>
  )
}

export default BugTable
