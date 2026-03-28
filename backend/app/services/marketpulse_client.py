"""Thin HTTP client for MarketPulse (localhost:8000) with in-memory caching."""

from __future__ import annotations

import logging
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

DEFAULT_BREADTH_TTL = 900    # 15 minutes
DEFAULT_SENTIMENT_TTL = 900  # 15 minutes
DEFAULT_SECTORS_TTL = 3600   # 60 minutes
DEFAULT_PICKS_TTL = 3600     # 60 minutes


class _CacheEntry:
    __slots__ = ("data", "expires_at")

    def __init__(self, data: object, ttl: int) -> None:
        self.data = data
        self.expires_at = time.monotonic() + ttl

    @property
    def is_valid(self) -> bool:
        return time.monotonic() < self.expires_at


class MarketPulseClient:
    """HTTP client for MarketPulse. Returns None on failure — never raises."""

    def __init__(self, base_url: str, timeout: int = 30) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._cache: dict[str, _CacheEntry] = {}

    def _get(self, path: str, params: Optional[dict] = None, ttl: int = 900) -> Optional[dict]:
        """Generic GET with caching. Returns None on any failure.

        If MarketPulse returns a wrapped response like ``{"data": [...], "success": true}``,
        we unwrap and return just the ``data`` value so the MF Pulse proxy doesn't double-wrap.
        """
        cache_key = f"{path}:{params}"
        cached = self._cache.get(cache_key)
        if cached and cached.is_valid:
            return cached.data

        try:
            url = f"{self.base_url}{path}"
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                # Unwrap nested response envelope from MarketPulse
                if isinstance(data, dict) and "data" in data and "success" in data:
                    data = data["data"]
                self._cache[cache_key] = _CacheEntry(data, ttl)
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

    def get_breadth_history(self, lookback: str = "1y") -> Optional[dict]:
        return self._get(
            "/api/breadth/history",
            params={"lookback": lookback},
            ttl=DEFAULT_BREADTH_TTL,
        )

    def get_sentiment(self) -> Optional[dict]:
        return self._get("/api/sentiment", ttl=DEFAULT_SENTIMENT_TTL)

    def get_sector_scores(self, period: str = "3M") -> Optional[list]:
        return self._get(
            "/api/compass/sectors",
            params={"period": period},
            ttl=DEFAULT_SECTORS_TTL,
        )

    def get_market_picks(self) -> Optional[dict]:
        return self._get("/api/compass/picks", ttl=DEFAULT_PICKS_TTL)

    def get_indices(self) -> Optional[dict]:
        """Get market indices data (NIFTY, etc.)."""
        return self._get("/api/market/indices", ttl=DEFAULT_BREADTH_TTL)

    def get_indices_latest(self) -> Optional[dict]:
        """Get latest period returns for indices."""
        return self._get("/api/indices/latest", ttl=DEFAULT_BREADTH_TTL)

    def health_check(self) -> bool:
        """Returns True if MarketPulse is reachable."""
        try:
            url = f"{self.base_url}/health"
            with httpx.Client(timeout=5) as client:
                response = client.get(url)
                return response.status_code == 200
        except Exception:
            return False
