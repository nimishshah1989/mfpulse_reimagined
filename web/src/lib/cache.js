/**
 * Simple in-memory cache with TTL for API responses.
 * Prevents redundant fetches during single-page navigation.
 */
const _cache = {};

export async function cachedFetch(key, fetchFn, ttlSeconds = 300) {
  const entry = _cache[key];
  if (entry && Date.now() - entry.timestamp < ttlSeconds * 1000) {
    return entry.data;
  }
  const data = await fetchFn();
  _cache[key] = { data, timestamp: Date.now() };
  return data;
}

export function invalidateCache(key) {
  delete _cache[key];
}

export function clearCache() {
  Object.keys(_cache).forEach((k) => delete _cache[k]);
}
