"""Cache key constants — no magic strings. All kv_cache keys defined here."""

# Pre-computed API response caches (refreshed by nightly job, no TTL)
CACHE_UNIVERSE_DATA = "precompute:universe"
CACHE_SMART_BUCKETS = "precompute:smart_buckets"
CACHE_ARCHETYPES = "precompute:archetypes"
CACHE_CATEGORIES_HEATMAP = "precompute:categories"

# Claude AI response caches (7-day TTL)
CACHE_CLAUDE_PREFIX = "claude:"
CLAUDE_TTL_SECONDS = 604_800  # 7 days
