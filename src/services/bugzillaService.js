/**
 * Bugzilla REST API Service
 * Documentation: https://bugzilla.readthedocs.io/en/latest/api/
 */

import { cachedFetch, generateCacheKey, clearCache } from '../utils/cache';

const BUGZILLA_API_BASE = 'https://bugzilla.mozilla.org/rest';

/**
 * Fetch bugs with specified query parameters
 * @param {Object} params - Query parameters for Bugzilla API
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchBugs(params = {}) {
  // Only fetch fields we actually display to reduce payload size
  const defaultFields = 'id,summary,severity,status,component,assigned_to,assigned_to_detail,last_change_time,priority,product';

  const queryParams = new URLSearchParams({
    include_fields: defaultFields,
    ...params
  });

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
    limit: 1000 // Fetch up to 1000 results - pagination handles display
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
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchBugsByPerformanceImpact(impactLevel, additionalParams = {}, useCache = true) {
  const params = {
    f1: 'cf_performance_impact',
    o1: 'equals',
    v1: impactLevel,
    resolution: '---', // Only open bugs
    bug_type: 'defect',
    limit: 1000, // Fetch up to 1000 results - pagination handles display
    ...additionalParams
  };

  if (!useCache) {
    return fetchBugs(params);
  }

  const cacheKey = generateCacheKey('perf-impact', { impactLevel, ...additionalParams });
  return cachedFetch(cacheKey, () => fetchBugs(params));
}

/**
 * Fetch all bugs with any performance impact (high, medium, or low)
 * @param {Object} additionalParams - Additional query parameters
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchAllPerformanceImpactBugs(additionalParams = {}, useCache = true) {
  const params = {
    f1: 'cf_performance_impact',
    o1: 'anyexact',
    v1: 'high,medium,low',
    resolution: '---', // Only open bugs
    bug_type: 'defect',
    limit: 1000,
    ...additionalParams
  };

  if (!useCache) {
    return fetchBugs(params);
  }

  const cacheKey = generateCacheKey('perf-impact', { all: true, ...additionalParams });
  return cachedFetch(cacheKey, () => fetchBugs(params));
}

/**
 * Fetch specific bugs by their IDs
 * @param {Array<string|number>} bugIds - Array of bug IDs to fetch
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchBugsByIds(bugIds, useCache = true) {
  if (!bugIds || bugIds.length === 0) return [];

  const defaultFields = 'id,summary,severity,status,component,assigned_to,assigned_to_detail,last_change_time,priority,product';

  const doFetch = async () => {
    const idParams = bugIds.map(id => `id=${encodeURIComponent(id)}`).join('&');
    const url = `${BUGZILLA_API_BASE}/bug?${idParams}&include_fields=${encodeURIComponent(defaultFields)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Bugzilla API error: ${response.status}`);
    const data = await response.json();
    return data.bugs || [];
  };

  if (!useCache) return doFetch();

  const cacheKey = generateCacheKey('priority-bugs', { ids: [...bugIds].sort().join(',') });
  return cachedFetch(cacheKey, doFetch);
}

/**
 * Clear cache for performance impact bugs
 * @param {string} impactLevel - Optional specific impact level to clear
 */
export function clearPerformanceImpactCache(impactLevel = null) {
  if (impactLevel) {
    const cacheKey = generateCacheKey('perf-impact', { impactLevel });
    clearCache(cacheKey);
  } else {
    // Clear all perf-impact caches
    clearCache('perf-impact:high');
    clearCache('perf-impact:medium');
    clearCache('perf-impact:low');
  }
}
