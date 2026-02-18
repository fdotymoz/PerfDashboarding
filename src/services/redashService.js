const STMO_API_BASE = '/stmo'
const QUERY_ID = 114368
const API_KEY = 'cKVMGjZL9aDvrrBoHoqZNt9U0A9FEoE3lf4QYNa1'
const MAX_POLL_ATTEMPTS = 12
const POLL_INTERVAL_MS = 5000

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch benchmark rows from STMO Redash query.
 * Uses a POST-then-poll pattern: if the server returns a job,
 * we re-POST with max_age=0 until results are ready.
 *
 * @param {string} snapshotDate - YYYY-MM-DD date for the Snapshot Date parameter
 * @returns {Promise<Array>} - array of row objects
 */
export async function fetchBenchmarkRows(snapshotDate = getTodayDate()) {
  const url = `${STMO_API_BASE}/api/queries/${QUERY_ID}/results?api_key=${API_KEY}`
  const body = JSON.stringify({
    parameters: { 'Snapshot Date': snapshotDate },
    max_age: 86400
  })

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    })

    if (!response.ok) {
      throw new Error(`STMO API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // If we got query_result directly, return the rows
    if (data.query_result) {
      return data.query_result.data.rows || []
    }

    // If a job was returned, wait and retry
    if (data.job) {
      if (attempt < MAX_POLL_ATTEMPTS - 1) {
        await sleep(POLL_INTERVAL_MS)
        continue
      }
      throw new Error('STMO query timed out waiting for results')
    }

    throw new Error('Unexpected STMO API response format')
  }

  throw new Error('STMO query exceeded max poll attempts')
}
