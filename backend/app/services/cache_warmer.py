"""Cache pre-computation service — warms expensive API responses into kv_cache."""

import logging
import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.cache_keys import (
    CACHE_ARCHETYPES,
    CACHE_CATEGORIES_HEATMAP,
    CACHE_SMART_BUCKETS,
    CACHE_UNIVERSE_DATA,
)
from app.repositories.cache_repo import CacheRepository

logger = logging.getLogger(__name__)


def _serialize(obj: Any) -> Any:
    """Make objects JSON-serializable for JSONB storage."""
    from datetime import date, datetime
    from decimal import Decimal

    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_serialize(item) for item in obj]
    return obj


class CacheWarmer:
    """Pre-computes expensive API responses and stores in kv_cache."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.cache = CacheRepository(db)

    def warm_all(self) -> dict[str, bool]:
        """Run all pre-computations. Returns success status per key."""
        results = {}
        results["universe"] = self._warm_universe()
        results["smart_buckets"] = self._warm_smart_buckets()
        results["archetypes"] = self._warm_archetypes()
        results["categories"] = self._warm_categories()
        return results

    def sync_latest_aum(self) -> int:
        """Sync latest AUM from holdings snapshots to fund_master. Returns updated count."""
        result = self.db.execute(text("""
            UPDATE fund_master fm
            SET latest_aum = sub.aum,
                updated_at = NOW()
            FROM (
                SELECT DISTINCT ON (mstar_id)
                    mstar_id, aum
                FROM fund_holdings_snapshot
                WHERE aum IS NOT NULL
                ORDER BY mstar_id, portfolio_date DESC
            ) sub
            WHERE fm.mstar_id = sub.mstar_id
            AND (fm.latest_aum IS DISTINCT FROM sub.aum)
        """))
        self.db.commit()
        count = result.rowcount
        logger.info("AUM sync: updated %d fund_master rows", count)
        return count

    def _warm_universe(self) -> bool:
        """Pre-compute universe data (~14s query -> cached)."""
        try:
            start = time.monotonic()
            from app.services.fund_service import FundService
            svc = FundService(self.db)
            data = svc.get_universe_data()
            serialized = _serialize(data)
            self.cache.set(CACHE_UNIVERSE_DATA, serialized)
            elapsed = round((time.monotonic() - start) * 1000)
            logger.info("Cache warm: universe (%d funds, %dms)", len(data), elapsed)
            return True
        except Exception as e:
            logger.error("Cache warm failed: universe — %s", e)
            return False

    def _warm_smart_buckets(self) -> bool:
        """Pre-compute dashboard smart buckets."""
        try:
            start = time.monotonic()
            from app.services.dashboard_service import DashboardService
            svc = DashboardService(self.db)
            data = svc.get_smart_buckets()
            self.cache.set(CACHE_SMART_BUCKETS, _serialize(data))
            elapsed = round((time.monotonic() - start) * 1000)
            logger.info("Cache warm: smart_buckets (%dms)", elapsed)
            return True
        except Exception as e:
            logger.error("Cache warm failed: smart_buckets — %s", e)
            return False

    def _warm_archetypes(self) -> bool:
        """Pre-compute dashboard archetypes."""
        try:
            start = time.monotonic()
            from app.services.dashboard_service import DashboardService
            svc = DashboardService(self.db)
            data = svc.get_archetypes()
            self.cache.set(CACHE_ARCHETYPES, _serialize(data))
            elapsed = round((time.monotonic() - start) * 1000)
            logger.info("Cache warm: archetypes (%dms)", elapsed)
            return True
        except Exception as e:
            logger.error("Cache warm failed: archetypes — %s", e)
            return False

    def _warm_categories(self) -> bool:
        """Pre-compute categories heatmap."""
        try:
            start = time.monotonic()
            from app.services.fund_service import FundService
            svc = FundService(self.db)
            data = svc.get_categories_heatmap()
            self.cache.set(CACHE_CATEGORIES_HEATMAP, _serialize(data))
            elapsed = round((time.monotonic() - start) * 1000)
            logger.info("Cache warm: categories (%dms)", elapsed)
            return True
        except Exception as e:
            logger.error("Cache warm failed: categories — %s", e)
            return False
