import { useState } from 'react'
import './BugTable.css'

function BugTable({ bugs, bugTags, onAddTag, onRemoveTag, onRemoveBug, onAddToPriority }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [tagInputs, setTagInputs] = useState({})

  const handleTagInputChange = (bugId, value) => {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)
    setTagInputs(prev => ({ ...prev, [String(bugId)]: cleaned }))
  }

  const handleTagSubmit = (bugId) => {
    const val = (tagInputs[String(bugId)] || '').trim()
    if (!val) return
    onAddTag(bugId, val)
    setTagInputs(prev => ({ ...prev, [String(bugId)]: '' }))
  }

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
              {onAddToPriority && <th></th>}
              {onRemoveBug && <th></th>}
              <th>Bug ID</th>
              <th>Summary</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Component</th>
              <th>Assigned To</th>
              <th>Last Changed</th>
              {bugTags && <th>Tags</th>}
            </tr>
          </thead>
          <tbody>
            {currentBugs.map((bug) => (
              <tr key={bug.id}>
                {onAddToPriority && (
                  <td className="bug-add-cell">
                    <button
                      className="bug-add-btn"
                      onClick={() => onAddToPriority(bug.id)}
                      title="Add to Priority List"
                    >+</button>
                  </td>
                )}
                {onRemoveBug && (
                  <td className="bug-remove-cell">
                    <button
                      className="bug-remove-btn"
                      onClick={() => onRemoveBug(String(bug.id))}
                      title="Remove from list"
                    >×</button>
                  </td>
                )}
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
                {bugTags && (
                  <td className="bug-tags-cell">
                    <div className="bug-tags-list">
                      {(bugTags[String(bug.id)] || []).map(tag => (
                        <span key={tag} className="bug-tag-chip">
                          {tag}
                          <button onClick={() => onRemoveTag(bug.id, tag)} title="Remove tag">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="bug-tag-input-row">
                      <input
                        type="text"
                        className="bug-tag-input"
                        value={tagInputs[String(bug.id)] || ''}
                        onChange={(e) => handleTagInputChange(bug.id, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTagSubmit(bug.id)}
                        placeholder="Add tag…"
                        maxLength={15}
                      />
                      <button
                        className="bug-tag-add-btn"
                        onClick={() => handleTagSubmit(bug.id)}
                        disabled={!(tagInputs[String(bug.id)] || '').trim()}
                        title="Add tag"
                      >+</button>
                    </div>
                  </td>
                )}
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
