/**
 * Simple in-memory cache with TTL (time-to-live)
 */

const cache = new Map();

/**
 * Cache configuration
 */
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Generate a cache key from parameters
 */
function generateCacheKey(prefix, params) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return `${prefix}:${sortedParams}`;
}

/**
 * Get cached data if it exists and is not expired
 */
export function getCached(key) {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  const now = Date.now();
  if (now > cached.expiry) {
    // Cache expired, remove it
    cache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Set data in cache with TTL
 */
export function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, {
    data,
    expiry: Date.now() + ttl,
    cachedAt: Date.now()
  });
}

/**
 * Clear specific cache entry
 */
export function clearCache(key) {
  cache.delete(key);
}

/**
 * Clear all cache entries
 */
export function clearAllCache() {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

/**
 * Cached fetch wrapper
 */
export async function cachedFetch(cacheKey, fetchFunction, ttl = CACHE_TTL) {
  // Check cache first
  const cached = getCached(cacheKey);
  if (cached !== null) {
    console.log(`Cache HIT for ${cacheKey}`);
    return cached;
  }

  // Cache miss, fetch data
  console.log(`Cache MISS for ${cacheKey}`);
  const data = await fetchFunction();

  // Store in cache
  setCache(cacheKey, data, ttl);

  return data;
}

export { generateCacheKey };
