/**
 * Simple in-memory cache with TTL for API responses.
 * Prevents redundant fetches during single-page navigation.
 * Deduplicates in-flight requests to the same key.
 */
const _cache = {};
const _inflight = {};

export async function cachedFetch(key, fetchFn, ttlSeconds = 300) {
  const entry = _cache[key];
  if (entry && Date.now() - entry.timestamp < ttlSeconds * 1000) {
    return entry.data;
  }
  // Deduplicate concurrent requests for the same key
  if (_inflight[key]) {
    return _inflight[key];
  }
  _inflight[key] = fetchFn().then((data) => {
    _cache[key] = { data, timestamp: Date.now() };
    delete _inflight[key];
    return data;
  }).catch((err) => {
    delete _inflight[key];
    throw err;
  });
  return _inflight[key];
}

export function invalidateCache(key) {
  delete _cache[key];
}

export function clearCache() {
  Object.keys(_cache).forEach((k) => delete _cache[k]);
}
