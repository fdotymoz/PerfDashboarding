import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCached, setCache, clearCache, clearAllCache, cachedFetch, getCacheStats } from './cache'

// The cache module uses a module-level Map, so we reset between tests via clearAllCache()
beforeEach(() => {
  clearAllCache()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// getCached / setCache
// ---------------------------------------------------------------------------
describe('setCache / getCached', () => {
  it('returns null for a key that was never set', () => {
    expect(getCached('missing')).toBeNull()
  })

  it('returns stored data immediately after setting', () => {
    setCache('key1', { value: 42 })
    expect(getCached('key1')).toEqual({ value: 42 })
  })

  it('returns null after TTL has elapsed', () => {
    vi.useFakeTimers()
    setCache('expiring', 'hello', 1000) // 1 second TTL
    vi.advanceTimersByTime(1001)
    expect(getCached('expiring')).toBeNull()
    vi.useRealTimers()
  })

  it('returns data before TTL has elapsed', () => {
    vi.useFakeTimers()
    setCache('fresh', 'world', 5000)
    vi.advanceTimersByTime(4999)
    expect(getCached('fresh')).toBe('world')
    vi.useRealTimers()
  })

  it('evicts the expired entry from the cache map on access', () => {
    vi.useFakeTimers()
    setCache('evict-me', 'data', 500)
    vi.advanceTimersByTime(501)
    getCached('evict-me') // triggers eviction
    expect(getCacheStats().keys).not.toContain('evict-me')
    vi.useRealTimers()
  })

  it('overwrites an existing entry when set again', () => {
    setCache('overwrite', 'first')
    setCache('overwrite', 'second')
    expect(getCached('overwrite')).toBe('second')
  })

  it('stores different values under different keys independently', () => {
    setCache('a', 1)
    setCache('b', 2)
    expect(getCached('a')).toBe(1)
    expect(getCached('b')).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// clearCache
// ---------------------------------------------------------------------------
describe('clearCache', () => {
  it('removes a specific key', () => {
    setCache('remove-me', 'data')
    clearCache('remove-me')
    expect(getCached('remove-me')).toBeNull()
  })

  it('does not affect other keys', () => {
    setCache('keep', 'safe')
    setCache('gone', 'bye')
    clearCache('gone')
    expect(getCached('keep')).toBe('safe')
  })

  it('is a no-op for a key that does not exist', () => {
    expect(() => clearCache('nonexistent')).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// clearAllCache
// ---------------------------------------------------------------------------
describe('clearAllCache', () => {
  it('removes all entries', () => {
    setCache('x', 1)
    setCache('y', 2)
    clearAllCache()
    expect(getCacheStats().size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getCacheStats
// ---------------------------------------------------------------------------
describe('getCacheStats', () => {
  it('reports size 0 when empty', () => {
    expect(getCacheStats().size).toBe(0)
  })

  it('reports correct size and keys after inserts', () => {
    setCache('alpha', 1)
    setCache('beta', 2)
    const stats = getCacheStats()
    expect(stats.size).toBe(2)
    expect(stats.keys).toContain('alpha')
    expect(stats.keys).toContain('beta')
  })
})

// ---------------------------------------------------------------------------
// cachedFetch
// ---------------------------------------------------------------------------
describe('cachedFetch', () => {
  it('calls fetchFunction on cache miss and returns its result', async () => {
    const fetchFn = vi.fn().mockResolvedValue([1, 2, 3])
    const result = await cachedFetch('miss-key', fetchFn)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(result).toEqual([1, 2, 3])
  })

  it('does NOT call fetchFunction on cache hit', async () => {
    const fetchFn = vi.fn().mockResolvedValue('fresh')
    await cachedFetch('hit-key', fetchFn)      // first call — miss, populates cache
    const second = await cachedFetch('hit-key', fetchFn) // second call — hit
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(second).toBe('fresh')
  })

  it('calls fetchFunction again after TTL expires', async () => {
    vi.useFakeTimers()
    const fetchFn = vi.fn().mockResolvedValue('value')
    await cachedFetch('ttl-key', fetchFn, 1000)
    vi.advanceTimersByTime(1001)
    await cachedFetch('ttl-key', fetchFn, 1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('propagates errors thrown by fetchFunction', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network failure'))
    await expect(cachedFetch('err-key', fetchFn)).rejects.toThrow('network failure')
  })

  it('does not cache a result when fetchFunction throws', async () => {
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('recovered')
    await cachedFetch('retry-key', fetchFn).catch(() => {})
    const result = await cachedFetch('retry-key', fetchFn)
    expect(result).toBe('recovered')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
