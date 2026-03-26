import { describe, it, expect, beforeEach } from 'vitest'
import { groupBugsBySeverity, groupBugsByComponent, getBugStats, clearPerformanceImpactCache } from './bugzillaService'
import { setCache, getCached, clearAllCache } from '../utils/cache'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeBug(overrides = {}) {
  return {
    id: 1,
    summary: 'Test bug',
    severity: 'S3',
    status: 'NEW',
    component: 'Performance',
    priority: 'P2',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// groupBugsBySeverity
// ---------------------------------------------------------------------------
describe('groupBugsBySeverity', () => {
  it('returns all-zero counts for an empty array', () => {
    const result = groupBugsBySeverity([])
    expect(result).toEqual({ Critical: 0, High: 0, Medium: 0, Low: 0, Unassigned: 0 })
  })

  it('maps S1→Critical, S2→High, S3→Medium, S4→Low', () => {
    const bugs = [
      makeBug({ severity: 'S1' }),
      makeBug({ severity: 'S2' }),
      makeBug({ severity: 'S3' }),
      makeBug({ severity: 'S4' }),
    ]
    const result = groupBugsBySeverity(bugs)
    expect(result.Critical).toBe(1)
    expect(result.High).toBe(1)
    expect(result.Medium).toBe(1)
    expect(result.Low).toBe(1)
  })

  it('maps "--" severity to Unassigned', () => {
    const result = groupBugsBySeverity([makeBug({ severity: '--' })])
    expect(result.Unassigned).toBe(1)
  })

  it('maps missing severity to Unassigned', () => {
    const result = groupBugsBySeverity([makeBug({ severity: undefined })])
    expect(result.Unassigned).toBe(1)
  })

  it('maps unknown severity string to Unassigned', () => {
    const result = groupBugsBySeverity([makeBug({ severity: 'blocker' })])
    expect(result.Unassigned).toBe(1)
  })

  it('accumulates counts correctly for multiple bugs with the same severity', () => {
    const bugs = [
      makeBug({ severity: 'S1' }),
      makeBug({ severity: 'S1' }),
      makeBug({ severity: 'S2' }),
    ]
    const result = groupBugsBySeverity(bugs)
    expect(result.Critical).toBe(2)
    expect(result.High).toBe(1)
  })

  it('does not mutate the input array', () => {
    const bugs = [makeBug({ severity: 'S1' })]
    const copy = [...bugs]
    groupBugsBySeverity(bugs)
    expect(bugs).toEqual(copy)
  })
})

// ---------------------------------------------------------------------------
// groupBugsByComponent
// ---------------------------------------------------------------------------
describe('groupBugsByComponent', () => {
  it('returns an empty object for an empty array', () => {
    expect(groupBugsByComponent([])).toEqual({})
  })

  it('counts bugs per component', () => {
    const bugs = [
      makeBug({ component: 'JavaScript Engine' }),
      makeBug({ component: 'JavaScript Engine' }),
      makeBug({ component: 'Layout' }),
    ]
    const result = groupBugsByComponent(bugs)
    expect(result['JavaScript Engine']).toBe(2)
    expect(result['Layout']).toBe(1)
  })

  it('uses "Unknown" for bugs missing a component', () => {
    const result = groupBugsByComponent([makeBug({ component: undefined })])
    expect(result['Unknown']).toBe(1)
  })

  it('treats component names as case-sensitive', () => {
    const bugs = [
      makeBug({ component: 'Performance' }),
      makeBug({ component: 'performance' }),
    ]
    const result = groupBugsByComponent(bugs)
    expect(result['Performance']).toBe(1)
    expect(result['performance']).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// getBugStats
// ---------------------------------------------------------------------------
describe('getBugStats', () => {
  it('returns zero totals for an empty array', () => {
    const result = getBugStats([])
    expect(result.total).toBe(0)
    expect(result.open).toBe(0)
    expect(result.closed).toBe(0)
  })

  it('classifies RESOLVED as closed', () => {
    const result = getBugStats([makeBug({ status: 'RESOLVED' })])
    expect(result.closed).toBe(1)
    expect(result.open).toBe(0)
  })

  it('classifies VERIFIED as closed', () => {
    const result = getBugStats([makeBug({ status: 'VERIFIED' })])
    expect(result.closed).toBe(1)
  })

  it('classifies CLOSED as closed', () => {
    const result = getBugStats([makeBug({ status: 'CLOSED' })])
    expect(result.closed).toBe(1)
  })

  it('classifies NEW, ASSIGNED, REOPENED as open', () => {
    const bugs = [
      makeBug({ status: 'NEW' }),
      makeBug({ status: 'ASSIGNED' }),
      makeBug({ status: 'REOPENED' }),
    ]
    const result = getBugStats(bugs)
    expect(result.open).toBe(3)
    expect(result.closed).toBe(0)
  })

  it('total equals open + closed', () => {
    const bugs = [
      makeBug({ status: 'NEW' }),
      makeBug({ status: 'RESOLVED' }),
      makeBug({ status: 'ASSIGNED' }),
    ]
    const result = getBugStats(bugs)
    expect(result.total).toBe(result.open + result.closed)
  })

  it('builds byStatus counts correctly', () => {
    const bugs = [
      makeBug({ status: 'NEW' }),
      makeBug({ status: 'NEW' }),
      makeBug({ status: 'RESOLVED' }),
    ]
    const result = getBugStats(bugs)
    expect(result.byStatus['NEW']).toBe(2)
    expect(result.byStatus['RESOLVED']).toBe(1)
  })

  it('builds byPriority counts correctly', () => {
    const bugs = [
      makeBug({ priority: 'P1' }),
      makeBug({ priority: 'P1' }),
      makeBug({ priority: 'P3' }),
    ]
    const result = getBugStats(bugs)
    expect(result.byPriority['P1']).toBe(2)
    expect(result.byPriority['P3']).toBe(1)
  })

  it('assigns "Unknown" priority for bugs with missing priority', () => {
    const result = getBugStats([makeBug({ priority: undefined })])
    expect(result.byPriority['Unknown']).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// clearPerformanceImpactCache
// The actual cache keys produced by fetchBugsByPerformanceImpact are of the
// form "perf-impact:impactLevel=high" (via generateCacheKey). The no-argument
// path used to clear hardcoded strings like "perf-impact:high" which never
// matched, silently leaving stale data in the cache.
// ---------------------------------------------------------------------------
describe('clearPerformanceImpactCache', () => {
  // The exact keys that fetchBugsByPerformanceImpact writes
  const HIGH_KEY   = 'perf-impact:impactLevel=high'
  const MEDIUM_KEY = 'perf-impact:impactLevel=medium'
  const LOW_KEY    = 'perf-impact:impactLevel=low'

  beforeEach(() => clearAllCache())

  it('clears the correct key when called with a specific impact level', () => {
    setCache(HIGH_KEY, ['bug1'])
    clearPerformanceImpactCache('high')
    expect(getCached(HIGH_KEY)).toBeNull()
  })

  it('leaves other levels untouched when clearing a specific level', () => {
    setCache(HIGH_KEY, ['bug1'])
    setCache(MEDIUM_KEY, ['bug2'])
    clearPerformanceImpactCache('high')
    expect(getCached(MEDIUM_KEY)).toEqual(['bug2'])
  })

  it('clears all three impact levels when called with no argument', () => {
    setCache(HIGH_KEY,   ['bug1'])
    setCache(MEDIUM_KEY, ['bug2'])
    setCache(LOW_KEY,    ['bug3'])
    clearPerformanceImpactCache()
    expect(getCached(HIGH_KEY)).toBeNull()
    expect(getCached(MEDIUM_KEY)).toBeNull()
    expect(getCached(LOW_KEY)).toBeNull()
  })
})
