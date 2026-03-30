"""MarketPulse client with persistent DB caching.

Architecture:
- Daily sync job fetches from MarketPulse → writes to kv_cache table
- API endpoints read from kv_cache (instant, no external calls)
- In-memory cache sits on top for sub-second reads
- If DB cache is stale (>26h), attempts live fetch as fallback
- If live fetch also fails, serves stale DB data with warning

This means:
- Container restart = no data loss (DB persists)
- MarketPulse down = still serves last-known-good data
- Page load = always instant (reads from local DB, never waits for external)
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# In-memory TTL (serves repeated reads within same request cycle)
MEMORY_TTL = 300  # 5 minutes

# DB staleness threshold — if older than this, try live refresh
DB_STALE_HOURS = 26  # slightly over 1 day to handle timezone shifts

# Cache keys
CK_BREADTH = "mp:breadth"
CK_SENTIMENT = "mp:sentiment"
CK_SECTORS = "mp:sectors"
CK_REGIME = "mp:regime"
CK_INDICES = "mp:indices"
CK_INDICES_LATEST = "mp:indices_latest"


class _MemEntry:
    __slots__ = ("data", "expires_at")

    def __init__(self, data: object, ttl: int) -> None:
        self.data = data
        self.expires_at = time.monotonic() + ttl

    @property
    def is_valid(self) -> bool:
        return time.monotonic() < self.expires_at


class MarketPulseClient:
    """MarketPulse client with DB-backed persistent cache.

    Usage:
        # For sync job (writes to DB):
        client = MarketPulseClient(base_url, timeout, db=session)
        client.sync_all()  # fetches from MP, writes to kv_cache

        # For API reads (reads from DB, never calls MP):
        client = MarketPulseClient(base_url, timeout, db=session)
        data = client.get_breadth_history()  # reads from kv_cache
    """

    def __init__(self, base_url: str, timeout: int = 10, db: Optional[Any] = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = min(timeout, 10)  # never wait more than 10s for MP
        self.db = db
        self._mem: dict[str, _MemEntry] = {}

    # ── Public read methods (used by API endpoints) ──

    def get_breadth_history(self, lookback: str = "1y") -> Optional[dict]:
        return self._read_cached(CK_BREADTH)

    def get_sentiment(self) -> Optional[dict]:
        return self._read_cached(CK_SENTIMENT)

    def get_sector_scores(self, period: str = "3M") -> Optional[list]:
        return self._read_cached(CK_SECTORS)

    def get_market_picks(self) -> Optional[dict]:
        return self._read_cached(CK_REGIME)

    def get_indices(self) -> Optional[dict]:
        return self._read_cached(CK_INDICES)

    def get_indices_latest(self) -> Optional[dict]:
        return self._read_cached(CK_INDICES_LATEST)

    # ── Sync method (used by scheduled job) ──

    def sync_all(self) -> dict[str, bool]:
        """Fetch all data from MarketPulse and persist to DB.

        Returns dict of {cache_key: success_bool}.
        """
        results = {}
        fetches = [
            (CK_BREADTH, "/api/breadth/history", {"lookback": "1y"}),
            (CK_SENTIMENT, "/api/sentiment", None),
            (CK_SECTORS, "/api/compass/sectors", {"period": "3M"}),
            (CK_REGIME, "/api/compass/picks", None),
            (CK_INDICES, "/api/market/indices", None),
            (CK_INDICES_LATEST, "/api/indices/latest", None),
        ]
        for cache_key, path, params in fetches:
            data = self._fetch_live(path, params)
            if data is not None:
                self._write_db(cache_key, data)
                self._mem[cache_key] = _MemEntry(data, MEMORY_TTL)
                results[cache_key] = True
                logger.info("MP sync OK: %s", cache_key)
            else:
                results[cache_key] = False
                logger.warning("MP sync FAILED: %s", cache_key)
        return results

    def health_check(self) -> bool:
        """Returns True if MarketPulse is reachable."""
        try:
            url = f"{self.base_url}/health"
            with httpx.Client(timeout=5) as client:
                response = client.get(url)
                return response.status_code == 200
        except Exception:
            return False

    # ── Internal: read from memory → DB → live fallback ──

    def _read_cached(self, cache_key: str) -> Optional[Any]:
        """Read priority: memory cache → DB cache → live fetch (if DB stale)."""
        # 1. Memory cache
        mem = self._mem.get(cache_key)
        if mem and mem.is_valid:
            return mem.data

        # 2. DB cache
        db_data, db_age_hours = self._read_db(cache_key)
        if db_data is not None:
            self._mem[cache_key] = _MemEntry(db_data, MEMORY_TTL)
            # If DB data is fresh enough, use it
            if db_age_hours is not None and db_age_hours < DB_STALE_HOURS:
                return db_data
            # DB data is stale — try live refresh but don't block
            live = self._fetch_live_for_key(cache_key)
            if live is not None:
                self._write_db(cache_key, live)
                self._mem[cache_key] = _MemEntry(live, MEMORY_TTL)
                return live
            # Live failed — serve stale DB data (better than nothing)
            logger.info("Serving stale DB cache for %s (%.1fh old)", cache_key, db_age_hours or 0)
            return db_data

        # 3. No DB cache — try live fetch
        live = self._fetch_live_for_key(cache_key)
        if live is not None:
            self._write_db(cache_key, live)
            self._mem[cache_key] = _MemEntry(live, MEMORY_TTL)
            return live

        return None

    def _fetch_live_for_key(self, cache_key: str) -> Optional[Any]:
        """Map cache key back to API path and fetch."""
        key_map = {
            CK_BREADTH: ("/api/breadth/history", {"lookback": "1y"}),
            CK_SENTIMENT: ("/api/sentiment", None),
            CK_SECTORS: ("/api/compass/sectors", {"period": "3M"}),
            CK_REGIME: ("/api/compass/picks", None),
            CK_INDICES: ("/api/market/indices", None),
            CK_INDICES_LATEST: ("/api/indices/latest", None),
        }
        entry = key_map.get(cache_key)
        if not entry:
            return None
        return self._fetch_live(entry[0], entry[1])

    # ── Internal: HTTP fetch ──

    def _fetch_live(self, path: str, params: Optional[dict] = None) -> Optional[Any]:
        """Fetch from MarketPulse with short timeout. Returns None on failure."""
        try:
            url = f"{self.base_url}{path}"
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                # Unwrap MarketPulse response envelope
                if isinstance(data, dict) and "data" in data and "success" in data:
                    data = data["data"]
                return data
        except httpx.TimeoutException:
            logger.warning("MarketPulse timeout: %s", path)
            return None
        except httpx.ConnectError:
            logger.warning("MarketPulse unreachable: %s", path)
            return None
        except Exception as e:
            logger.warning("MarketPulse error on %s: %s", path, e)
            return None

    # ── Internal: DB read/write ──

    def _read_db(self, cache_key: str) -> tuple[Optional[Any], Optional[float]]:
        """Read from kv_cache table. Returns (data, age_in_hours) or (None, None)."""
        if not self.db:
            return None, None
        try:
            from app.models.db.system import KVCache
            row = self.db.query(KVCache).filter(KVCache.cache_key == cache_key).first()
            if not row:
                return None, None
            age = (datetime.now(timezone.utc) - row.updated_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
            return row.cache_value, age
        except Exception as e:
            logger.warning("DB cache read error for %s: %s", cache_key, e)
            return None, None

    def _write_db(self, cache_key: str, data: Any) -> None:
        """Write/upsert to kv_cache table."""
        if not self.db:
            return
        try:
            from app.models.db.system import KVCache
            row = self.db.query(KVCache).filter(KVCache.cache_key == cache_key).first()
            now = datetime.now(timezone.utc)
            if row:
                row.cache_value = data
                row.updated_at = now
            else:
                row = KVCache(cache_key=cache_key, cache_value=data, updated_at=now)
                self.db.add(row)
            self.db.commit()
        except Exception as e:
            logger.warning("DB cache write error for %s: %s", cache_key, e)
            try:
                self.db.rollback()
            except Exception:
                pass
