/**
 * Bugzilla REST API Service
 * Documentation: https://bugzilla.readthedocs.io/en/latest/api/
 */

import { cachedFetch, generateCacheKey, clearCache } from '../utils/cache';

const BUGZILLA_API_BASE = 'https://bugzilla.mozilla.org/rest';

/**
 * Get Bugzilla API key from localStorage (set via browser console:
 *   localStorage.setItem('bugzilla_api_key', 'YOUR_KEY')
 */
function getApiKey() {
  return localStorage.getItem('bugzilla_api_key') || '';
}

/**
 * Fetch bugs with specified query parameters
 * @param {Object} params - Query parameters for Bugzilla API
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchBugs(params = {}) {
  // Only fetch fields we actually display to reduce payload size
  const defaultFields = 'id,summary,severity,status,component,assigned_to,assigned_to_detail,last_change_time,priority,product';

  const apiKey = getApiKey();
  const queryParams = new URLSearchParams({
    include_fields: defaultFields,
    ...(apiKey ? { api_key: apiKey } : {}),
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
    const apiKey = getApiKey();
    const idParams = bugIds.map(id => `id=${encodeURIComponent(id)}`).join('&');
    const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
    const url = `${BUGZILLA_API_BASE}/bug?${idParams}&include_fields=${encodeURIComponent(defaultFields)}${keyParam}`;
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
 * Fetch the depends_on bug IDs from a meta bug.
 * @param {number|string} bugId - The meta bug ID
 * @returns {Promise<Array<number>>} Array of bug IDs this bug depends on
 */
export async function fetchDependsOnIds(bugId) {
  const apiKey = getApiKey();
  const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
  const url = `${BUGZILLA_API_BASE}/bug/${bugId}?include_fields=id,depends_on${keyParam}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Bugzilla API error: ${response.status}`);
  const data = await response.json();
  return data.bugs?.[0]?.depends_on || [];
}

/**
 * Fetch all bugs tracked under the Speedometer 3 meta bug (bug 2026188).
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<Array>} Array of bug objects
 */
export async function fetchSpeedometer3Bugs(useCache = true) {
  const META_BUG_ID = 2026188;
  const doFetch = async () => {
    const depIds = await fetchDependsOnIds(META_BUG_ID);
    if (depIds.length === 0) return [];
    return fetchBugsByIds(depIds, false);
  };
  if (!useCache) return doFetch();
  const cacheKey = `speedometer3-meta-${META_BUG_ID}`;
  return cachedFetch(cacheKey, doFetch);
}

/**
 * Fetch bugs for a named component group using a union of two signals:
 *   1. status_whiteboard contains [perf-prio]
 *   2. cf_performance_impact is high or medium
 *
 * Supported componentKey values: 'css', 'dom', 'graphics', 'layout', 'necko'
 * 'necko' additionally queries Firefox for Android (no component filter).
 *
 * @param {string} componentKey
 * @param {boolean} useCache
 * @returns {Promise<Array>}
 */
export async function fetchComponentPriorityBugs(componentKey, useCache = true) {
  const COMPONENT_DEFS = {
    css:      [{ componentSubstring: 'CSS Parsing' }],
    dom:      [{ componentSubstring: 'DOM' }],
    graphics: [{ componentSubstring: 'Graphics' }],
    layout:   [{ componentSubstring: 'Layout' }],
    necko:    [
      { componentSubstring: 'Networking' },
      { androidProduct: 'Firefox for Android' },
    ],
  }

  const defs = COMPONENT_DEFS[componentKey]
  if (!defs) throw new Error(`Unknown component key: ${componentKey}`)

  const cacheKey = `component-priority-${componentKey}`

  const doFetch = async () => {
    const apiKey = getApiKey()
    const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : ''
    const statuses = 'bug_status=UNCONFIRMED&bug_status=NEW&bug_status=ASSIGNED&bug_status=REOPENED'
    const fields = 'include_fields=id%2Csummary%2Cseverity%2Cpriority%2Cstatus%2Ccomponent%2Cproduct%2Cassigned_to%2Cassigned_to_detail%2Clast_change_time%2Ccf_performance_impact%2Ccomment_count'

    const fetchDef = async (def) => {
      let url
      if (def.componentSubstring) {
        url = `${BUGZILLA_API_BASE}/bug?${statuses}`
          + `&f1=classification&o1=notequals&v1=Graveyard`
          + `&f2=component&o2=substring&v2=${encodeURIComponent(def.componentSubstring)}`
          + `&f3=OP`
          + `&f4=status_whiteboard&o4=substring&v4=perf-prio%5D`
          + `&f5=cf_performance_impact&o5=anyexact&v5=high%2Cmedium`
          + `&f6=CP&j3=OR`
          + `&${fields}&limit=200${keyParam}`
      } else {
        url = `${BUGZILLA_API_BASE}/bug?${statuses}`
          + `&product=${encodeURIComponent(def.androidProduct)}`
          + `&f1=OP`
          + `&f2=status_whiteboard&o2=substring&v2=perf-prio%5D`
          + `&f3=cf_performance_impact&o3=anyexact&v3=high%2Cmedium`
          + `&f4=CP&j1=OR`
          + `&${fields}&limit=200${keyParam}`
      }
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Bugzilla API error: ${response.status}`)
      const data = await response.json()
      return data.bugs || []
    }

    const results = await Promise.all(defs.map(fetchDef))
    const seen = new Set()
    return results.flat().filter(bug => {
      if (seen.has(bug.id)) return false
      seen.add(bug.id)
      return true
    })
  }

  if (!useCache) return doFetch()
  return cachedFetch(cacheKey, doFetch)
}

/**
 * Clear cached bugs for a specific component priority key (or all if omitted).
 * @param {string|null} componentKey
 */
export function clearComponentPriorityCache(componentKey = null) {
  const keys = componentKey
    ? [`component-priority-${componentKey}`]
    : ['css', 'dom', 'graphics', 'layout', 'necko'].map(k => `component-priority-${k}`)
  keys.forEach(k => clearCache(k))
}

/**
 * Clear cache for performance impact bugs
 * @param {string} impactLevel - Optional specific impact level to clear
 */
export function clearPerformanceImpactCache(impactLevel = null) {
  if (impactLevel) {
    clearCache(generateCacheKey('perf-impact', { impactLevel }));
  } else {
    clearCache(generateCacheKey('perf-impact', { impactLevel: 'high' }));
    clearCache(generateCacheKey('perf-impact', { impactLevel: 'medium' }));
    clearCache(generateCacheKey('perf-impact', { impactLevel: 'low' }));
  }
}
