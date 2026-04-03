import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { scoreBug, getBugFlags, getAreaTags, flagText, AREA_DEFS, ALL_AREA_TAGS, AREA_COLORS } from './bugAnalysis'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeBug(overrides = {}) {
  return {
    id: 1,
    summary: 'Some performance issue',
    component: 'JavaScript Engine',
    product: 'Core',
    severity: 'S3',
    priority: 'P3',
    cf_performance_impact: 'medium',
    comment_count: 5,
    assigned_to: 'dev@mozilla.com',
    last_change_time: new Date().toISOString(), // recent by default
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('AREA_DEFS / ALL_AREA_TAGS / AREA_COLORS', () => {
  it('AREA_DEFS has 11 entries', () => {
    expect(AREA_DEFS).toHaveLength(11)
  })

  it('ALL_AREA_TAGS has the same length as AREA_DEFS', () => {
    expect(ALL_AREA_TAGS).toHaveLength(AREA_DEFS.length)
  })

  it('AREA_COLORS has the same length as AREA_DEFS', () => {
    expect(AREA_COLORS).toHaveLength(AREA_DEFS.length)
  })

  it('ALL_AREA_TAGS contains expected tag names', () => {
    expect(ALL_AREA_TAGS).toContain('SP3')
    expect(ALL_AREA_TAGS).toContain('Pageload')
    expect(ALL_AREA_TAGS).toContain('Scrolling')
    expect(ALL_AREA_TAGS).toContain('Android')
  })
})

// ---------------------------------------------------------------------------
// scoreBug
// ---------------------------------------------------------------------------
describe('scoreBug', () => {
  it('scores high impact as +3', () => {
    const base = makeBug({ cf_performance_impact: 'high', severity: '--', priority: '--', comment_count: 0 })
    const low  = makeBug({ cf_performance_impact: 'low',  severity: '--', priority: '--', comment_count: 0 })
    expect(scoreBug(base) - scoreBug(low)).toBe(2) // high=3, low=1 → diff of 2
  })

  it('scores medium impact as +2', () => {
    const med = makeBug({ cf_performance_impact: 'medium', severity: '--', priority: '--', comment_count: 0 })
    expect(scoreBug(med)).toBeGreaterThanOrEqual(2)
  })

  it('falls back to +1 for unknown impact', () => {
    const bug = makeBug({ cf_performance_impact: '---', severity: '--', priority: '--', comment_count: 0 })
    // only +1 from impact, nothing else should add
    const lastChange = new Date()
    lastChange.setFullYear(lastChange.getFullYear() - 2)
    bug.last_change_time = lastChange.toISOString()
    expect(scoreBug(bug)).toBe(1)
  })

  it('adds S2 severity as +3', () => {
    const s2 = makeBug({ severity: 'S2', priority: '--', comment_count: 0, cf_performance_impact: '---' })
    const noSev = makeBug({ severity: '--', priority: '--', comment_count: 0, cf_performance_impact: '---' })
    const staleDate = new Date(); staleDate.setFullYear(staleDate.getFullYear() - 2)
    s2.last_change_time = staleDate.toISOString()
    noSev.last_change_time = staleDate.toISOString()
    expect(scoreBug(s2) - scoreBug(noSev)).toBe(3)
  })

  it('adds P2 priority as +3', () => {
    const p2 = makeBug({ priority: 'P2', severity: '--', comment_count: 0, cf_performance_impact: '---' })
    const noPri = makeBug({ priority: '--', severity: '--', comment_count: 0, cf_performance_impact: '---' })
    const staleDate = new Date(); staleDate.setFullYear(staleDate.getFullYear() - 2)
    p2.last_change_time = staleDate.toISOString()
    noPri.last_change_time = staleDate.toISOString()
    expect(scoreBug(p2) - scoreBug(noPri)).toBe(3)
  })

  it('adds +3 for comment_count >= 30', () => {
    const many = makeBug({ comment_count: 30, severity: '--', priority: '--', cf_performance_impact: '---' })
    const few  = makeBug({ comment_count: 0,  severity: '--', priority: '--', cf_performance_impact: '---' })
    const staleDate = new Date(); staleDate.setFullYear(staleDate.getFullYear() - 2)
    many.last_change_time = staleDate.toISOString()
    few.last_change_time  = staleDate.toISOString()
    expect(scoreBug(many) - scoreBug(few)).toBe(3)
  })

  it('adds +2 for comment_count >= 15', () => {
    const mid  = makeBug({ comment_count: 15, severity: '--', priority: '--', cf_performance_impact: '---' })
    const few  = makeBug({ comment_count: 0,  severity: '--', priority: '--', cf_performance_impact: '---' })
    const staleDate = new Date(); staleDate.setFullYear(staleDate.getFullYear() - 2)
    mid.last_change_time  = staleDate.toISOString()
    few.last_change_time  = staleDate.toISOString()
    expect(scoreBug(mid) - scoreBug(few)).toBe(2)
  })

  it('adds +1 for comment_count >= 8', () => {
    const some = makeBug({ comment_count: 8, severity: '--', priority: '--', cf_performance_impact: '---' })
    const few  = makeBug({ comment_count: 0, severity: '--', priority: '--', cf_performance_impact: '---' })
    const staleDate = new Date(); staleDate.setFullYear(staleDate.getFullYear() - 2)
    some.last_change_time = staleDate.toISOString()
    few.last_change_time  = staleDate.toISOString()
    expect(scoreBug(some) - scoreBug(few)).toBe(1)
  })

  it('adds +1 for activity within last 6 months', () => {
    const recent = makeBug({ comment_count: 0, severity: '--', priority: '--', cf_performance_impact: '---' })
    const stale  = makeBug({ comment_count: 0, severity: '--', priority: '--', cf_performance_impact: '---' })
    const old = new Date(); old.setFullYear(old.getFullYear() - 2)
    recent.last_change_time = new Date().toISOString()
    stale.last_change_time  = old.toISOString()
    expect(scoreBug(recent) - scoreBug(stale)).toBe(1)
  })

  it('returns a higher score for a well-triaged high-impact bug', () => {
    const wellTriaged = makeBug({
      cf_performance_impact: 'high',
      severity: 'S2',
      priority: 'P2',
      comment_count: 35,
    })
    expect(scoreBug(wellTriaged)).toBeGreaterThan(10)
  })
})

// ---------------------------------------------------------------------------
// getBugFlags
// ---------------------------------------------------------------------------
describe('getBugFlags', () => {
  it('returns no flags for a well-triaged recent bug', () => {
    const bug = makeBug()
    expect(getBugFlags(bug)).toEqual([])
  })

  it('flags "underappreciated" when high impact but no sev/pri', () => {
    const bug = makeBug({ cf_performance_impact: 'high', severity: '--', priority: '--' })
    expect(getBugFlags(bug)).toContain('underappreciated')
  })

  it('flags "underappreciated" for medium impact with no sev/pri', () => {
    const bug = makeBug({ cf_performance_impact: 'medium', severity: 'N/A', priority: 'N/A' })
    expect(getBugFlags(bug)).toContain('underappreciated')
  })

  it('does NOT flag underappreciated when severity is set', () => {
    const bug = makeBug({ cf_performance_impact: 'high', severity: 'S2', priority: '--' })
    expect(getBugFlags(bug)).not.toContain('underappreciated')
  })

  it('flags "needs-triage" when no impact, unassigned, no sev, no pri', () => {
    const bug = makeBug({
      cf_performance_impact: '---',
      assigned_to: 'nobody@mozilla.org',
      severity: '--',
      priority: '--',
    })
    expect(getBugFlags(bug)).toContain('needs-triage')
  })

  it('does NOT flag needs-triage when impact is set', () => {
    const bug = makeBug({
      cf_performance_impact: 'low',
      assigned_to: 'nobody@mozilla.org',
      severity: '--',
      priority: '--',
    })
    expect(getBugFlags(bug)).not.toContain('needs-triage')
  })

  it('flags "stale" when last_change_time is over 6 months ago', () => {
    const old = new Date()
    old.setMonth(old.getMonth() - 7)
    const bug = makeBug({ last_change_time: old.toISOString() })
    expect(getBugFlags(bug)).toContain('stale')
  })

  it('does NOT flag stale when last_change_time is within 6 months', () => {
    const bug = makeBug({ last_change_time: new Date().toISOString() })
    expect(getBugFlags(bug)).not.toContain('stale')
  })

  it('can return multiple flags simultaneously', () => {
    const old = new Date(); old.setFullYear(old.getFullYear() - 2)
    const bug = makeBug({
      cf_performance_impact: '---',
      assigned_to: 'nobody@mozilla.org',
      severity: '--',
      priority: '--',
      last_change_time: old.toISOString(),
    })
    const flags = getBugFlags(bug)
    expect(flags).toContain('needs-triage')
    expect(flags).toContain('stale')
  })
})

// ---------------------------------------------------------------------------
// getAreaTags
// ---------------------------------------------------------------------------
describe('getAreaTags', () => {
  it('returns empty array for a generic bug', () => {
    const bug = makeBug({ summary: 'Something unrelated', component: 'Build Config', product: 'Core' })
    expect(getAreaTags(bug)).toEqual([])
  })

  it('detects SP3 from "speedometer" in summary', () => {
    const bug = makeBug({ summary: 'Speedometer 3 score regression' })
    expect(getAreaTags(bug)).toContain('SP3')
  })

  it('detects SP3 from "sp3" in summary', () => {
    const bug = makeBug({ summary: 'sp3 benchmark slowdown' })
    expect(getAreaTags(bug)).toContain('SP3')
  })

  it('detects Pageload from "page load" in summary', () => {
    const bug = makeBug({ summary: 'Slow page load on cnn.com' })
    expect(getAreaTags(bug)).toContain('Pageload')
  })

  it('detects Scrolling from "jank" in summary', () => {
    const bug = makeBug({ summary: 'Scrolling jank on Twitter feed' })
    expect(getAreaTags(bug)).toContain('Scrolling')
  })

  it('detects Video from "youtube" in summary', () => {
    const bug = makeBug({ summary: 'YouTube playback stutters' })
    expect(getAreaTags(bug)).toContain('Video')
  })

  it('detects Startup from "cold-start" in summary', () => {
    const bug = makeBug({ summary: 'Cold-start time regression on macOS' })
    expect(getAreaTags(bug)).toContain('Startup')
  })

  it('detects Animation from "animation" in summary', () => {
    const bug = makeBug({ summary: 'CSS animation low frame rate' })
    expect(getAreaTags(bug)).toContain('Animation')
  })

  it('detects Input from "unresponsive" in summary', () => {
    const bug = makeBug({ summary: 'Tab becomes unresponsive after typing' })
    expect(getAreaTags(bug)).toContain('Input')
  })

  it('detects Memory from "memory leak" in summary', () => {
    const bug = makeBug({ summary: 'Memory leak in canvas rendering' })
    expect(getAreaTags(bug)).toContain('Memory')
  })

  it('detects Battery from "cpu usage" in summary', () => {
    const bug = makeBug({ summary: 'High cpu usage in background tab' })
    expect(getAreaTags(bug)).toContain('Battery')
  })

  it('detects Network from component "Networking"', () => {
    const bug = makeBug({ summary: 'Slow connection', component: 'Networking' })
    expect(getAreaTags(bug)).toContain('Network')
  })

  it('detects Android from product "android"', () => {
    const bug = makeBug({ summary: 'Startup slow', product: 'Firefox for Android' })
    expect(getAreaTags(bug)).toContain('Android')
  })

  it('detects multiple tags for a multi-area bug', () => {
    const bug = makeBug({ summary: 'Scrolling jank causes high memory usage on Android' })
    const tags = getAreaTags(bug)
    expect(tags).toContain('Scrolling')
    expect(tags).toContain('Memory')
    expect(tags).toContain('Android')
  })

  it('returns no duplicate tags', () => {
    const bug = makeBug({ summary: 'Speedometer sp3 SP3 benchmark' })
    const tags = getAreaTags(bug)
    const sp3Count = tags.filter(t => t === 'SP3').length
    expect(sp3Count).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// flagText
// ---------------------------------------------------------------------------
describe('flagText', () => {
  it('returns human-readable label for "underappreciated"', () => {
    expect(flagText('underappreciated')).toBe('⚠ Underappreciated')
  })

  it('returns human-readable label for "needs-triage"', () => {
    expect(flagText('needs-triage')).toBe('Needs Triage')
  })

  it('returns human-readable label for "stale"', () => {
    expect(flagText('stale')).toBe('Stale')
  })

  it('returns the raw flag string for unknown flags', () => {
    expect(flagText('some-unknown-flag')).toBe('some-unknown-flag')
  })
})
