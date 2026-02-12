/**
 * Bugzilla REST API Service
 * Documentation: https://bugzilla.readthedocs.io/en/latest/api/
 */

const BUGZILLA_API_BASE = 'https://bugzilla.mozilla.org/rest';

/**
 * Fetch bugs with specified query parameters
 * @param {Object} params - Query parameters for Bugzilla API
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchBugs(params = {}) {
  const queryParams = new URLSearchParams(params);
  const url = `${BUGZILLA_API_BASE}/bug?${queryParams.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Bugzilla API error: ${response.status}`);
    }
    const data = await response.json();
    return data.bugs || [];
  } catch (error) {
    console.error('Error fetching bugs:', error);
    throw error;
  }
}

/**
 * Fetch bugs by product and component
 * @param {string} product - Product name
 * @param {string} component - Component name (optional)
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchBugsByProduct(product, component = null) {
  const params = { product };
  if (component) {
    params.component = component;
  }
  return fetchBugs(params);
}

/**
 * Fetch bugs by severity
 * @param {Array<string>} severities - Array of severity levels
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchBugsBySeverity(severities) {
  return fetchBugs({ severity: severities.join(',') });
}

/**
 * Group bugs by severity
 * @param {Array} bugs - Array of bug objects
 * @returns {Object} Object with severity counts
 */
export function groupBugsBySeverity(bugs) {
  const severityMap = {
    'S1': 'Critical',
    'S2': 'High',
    'S3': 'Medium',
    'S4': 'Low',
    '--': 'Unassigned'
  };

  const counts = {
    'Critical': 0,
    'High': 0,
    'Medium': 0,
    'Low': 0,
    'Unassigned': 0
  };

  bugs.forEach(bug => {
    const severity = bug.severity || '--';
    const mappedSeverity = severityMap[severity] || 'Unassigned';
    counts[mappedSeverity]++;
  });

  return counts;
}

/**
 * Group bugs by component/team
 * @param {Array} bugs - Array of bug objects
 * @returns {Object} Object with component counts
 */
export function groupBugsByComponent(bugs) {
  const componentCounts = {};

  bugs.forEach(bug => {
    const component = bug.component || 'Unknown';
    componentCounts[component] = (componentCounts[component] || 0) + 1;
  });

  return componentCounts;
}

/**
 * Get bug statistics
 * @param {Array} bugs - Array of bug objects
 * @returns {Object} Statistics object
 */
export function getBugStats(bugs) {
  const openBugs = bugs.filter(bug => bug.status !== 'RESOLVED' && bug.status !== 'VERIFIED' && bug.status !== 'CLOSED');
  const closedBugs = bugs.filter(bug => bug.status === 'RESOLVED' || bug.status === 'VERIFIED' || bug.status === 'CLOSED');

  return {
    total: bugs.length,
    open: openBugs.length,
    closed: closedBugs.length,
    byStatus: bugs.reduce((acc, bug) => {
      acc[bug.status] = (acc[bug.status] || 0) + 1;
      return acc;
    }, {}),
    byPriority: bugs.reduce((acc, bug) => {
      const priority = bug.priority || 'Unknown';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {})
  };
}

/**
 * Fetch bugs for Firefox Performance (example product)
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchFirefoxPerformanceBugs() {
  return fetchBugs({
    product: 'Core',
    component: 'Performance',
    limit: 100
  });
}

/**
 * Search bugs with custom query
 * @param {string} query - Search query
 * @param {Object} additionalParams - Additional query parameters
 * @returns {Promise<Array>} Array of bug objects
 */
export async function searchBugs(query, additionalParams = {}) {
  return fetchBugs({
    quicksearch: query,
    ...additionalParams
  });
}

/**
 * Fetch bugs by performance impact level
 * @param {string} impactLevel - Performance impact level ('high', 'medium', or 'low')
 * @param {Object} additionalParams - Additional query parameters
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchBugsByPerformanceImpact(impactLevel, additionalParams = {}) {
  // Use the custom field cf_performance_impact to filter bugs
  return fetchBugs({
    f1: 'cf_performance_impact',
    o1: 'equals',
    v1: impactLevel,
    resolution: '---', // Only open bugs
    bug_type: 'defect',
    limit: 100,
    ...additionalParams
  });
}

/**
 * Fetch all bugs with any performance impact
 * @param {Object} additionalParams - Additional query parameters
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchAllPerformanceImpactBugs(additionalParams = {}) {
  return fetchBugs({
    quicksearch: '"Performance Impact"',
    limit: 100,
    ...additionalParams
  });
}
