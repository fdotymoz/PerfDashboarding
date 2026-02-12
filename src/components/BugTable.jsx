import './BugTable.css'

function BugTable({ bugs }) {
  if (!bugs || bugs.length === 0) {
    return (
      <div className="bug-table-empty">
        <p>No bugs found matching the criteria.</p>
      </div>
    )
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
      <div className="bug-count">
        Showing {bugs.length} bug{bugs.length !== 1 ? 's' : ''}
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
            {bugs.map((bug) => (
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
    </div>
  )
}

export default BugTable
