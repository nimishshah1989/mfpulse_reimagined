"""Historical NAV backfill from AMFI (mfapi.in) API.

Fetches 5-10 years of daily NAV history for simulation backtesting.
Uses the free AMFI API which has complete NAV history for all Indian MFs.
Uses ON CONFLICT DO NOTHING so historical records never overwrite
fresh daily data (which includes return columns).

Data source: https://api.mfapi.in/mf/{amfi_code}
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional

import httpx
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.db.fund_master import FundMaster
from app.repositories.audit_repo import AuditRepository
from app.repositories.ingestion_repo import IngestionRepository

logger = logging.getLogger(__name__)

MFAPI_BASE = "https://api.mfapi.in/mf"


def _parse_mfapi_response(
    data: dict,
    mstar_id: str,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    """Parse mfapi.in JSON response into DB-ready records.

    mfapi.in returns:
        {"meta": {...}, "data": [{"date": "27-03-2026", "nav": "204.038"}, ...]}

    Date format is DD-MM-YYYY. Returns list of {mstar_id, nav_date, nav}.
    Filters to [start_date, end_date] range if provided.
    """
    nav_entries = data.get("data")
    if not nav_entries or not isinstance(nav_entries, list):
        return []

    records: list[dict] = []
    for entry in nav_entries:
        date_str = entry.get("date")
        nav_str = entry.get("nav")

        if not date_str or not nav_str:
            continue

        # Parse DD-MM-YYYY
        try:
            parts = date_str.split("-")
            nav_date_val = date(int(parts[2]), int(parts[1]), int(parts[0]))
        except (ValueError, IndexError):
            logger.debug("Bad date for %s: %s", mstar_id, date_str)
            continue

        # Filter by date range
        if start_date and nav_date_val < start_date:
            continue
        if end_date and nav_date_val > end_date:
            continue

        try:
            nav_val = Decimal(nav_str)
        except (InvalidOperation, ValueError):
            logger.debug("Bad NAV for %s on %s: %s", mstar_id, date_str, nav_str)
            continue

        records.append({
            "mstar_id": mstar_id,
            "nav_date": nav_date_val,
            "nav": nav_val,
        })

    return records


class _RateLimiter:
    """Sliding window rate limiter. Thread-safe."""

    def __init__(self, max_calls: int = 50, period_seconds: float = 60.0) -> None:
        self._max_calls = max_calls
        self._period = period_seconds
        self._timestamps: list[float] = []
        self._lock = threading.Lock()

    def acquire(self) -> None:
        """Block until a call slot is available."""
        while True:
            with self._lock:
                now = time.monotonic()
                cutoff = now - self._period
                self._timestamps = [t for t in self._timestamps if t > cutoff]

                if len(self._timestamps) < self._max_calls:
                    self._timestamps.append(now)
                    return

                wait = self._timestamps[0] - cutoff
            time.sleep(max(wait, 0.05))


class BackfillProgress:
    """Thread-safe progress tracker for backfill runs."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._total_funds = 0
        self._completed = 0
        self._failed = 0
        self._total_navs = 0
        self._running = False
        self._started_at: str | None = None
        self._current_fund: str | None = None

    def try_start(self) -> bool:
        """Atomically check if already running and mark as starting. Returns False if already running."""
        with self._lock:
            if self._running:
                return False
            self._running = True
            return True

    def start(self, total: int) -> None:
        with self._lock:
            self._total_funds = total
            self._completed = 0
            self._failed = 0
            self._total_navs = 0
            self._running = True
            self._started_at = datetime.now(timezone.utc).isoformat()

    def mark_completed(self, nav_count: int = 0) -> None:
        with self._lock:
            self._completed += 1
            self._total_navs += nav_count

    def mark_failed(self) -> None:
        with self._lock:
            self._failed += 1
            self._completed += 1

    def set_current(self, mstar_id: str) -> None:
        with self._lock:
            self._current_fund = mstar_id

    def finish(self) -> None:
        with self._lock:
            self._running = False

    def get_status(self) -> dict:
        with self._lock:
            return {
                "total_funds": self._total_funds,
                "completed": self._completed,
                "failed": self._failed,
                "total_navs_inserted": self._total_navs,
                "running": self._running,
                "started_at": self._started_at,
                "current_fund": self._current_fund,
            }


# Module-level singleton for status polling
backfill_progress = BackfillProgress()


class NAVBackfillService:
    """Fetches historical daily NAV from AMFI API (mfapi.in)."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = IngestionRepository(db)
        self._audit_repo = AuditRepository(db)
        # Conservative: 50 req/min for the free API
        self._rate_limiter = _RateLimiter(max_calls=50, period_seconds=60.0)

    def get_backfill_candidates(self) -> list[dict]:
        """Return funds eligible for backfill as [{mstar_id, amfi_code}, ...].

        Criteria: purchase_mode=1, active (or NULL), has category_name, has amfi_code.
        """
        stmt = (
            select(FundMaster.mstar_id, FundMaster.amfi_code)
            .where(FundMaster.purchase_mode == 1)
            .where(
                (FundMaster.is_active == True) | (FundMaster.is_active.is_(None))  # noqa: E712
            )
            .where(FundMaster.category_name.isnot(None))
            .where(FundMaster.amfi_code.isnot(None))
        )
        rows = self._db.execute(stmt).fetchall()
        candidates = [{"mstar_id": row.mstar_id, "amfi_code": row.amfi_code} for row in rows]
        logger.info("Backfill candidates: %d funds with amfi_code", len(candidates))
        return candidates

    def backfill_all(
        self,
        start_date: str = "2016-01-01",
        end_date: str | None = None,
        concurrency: int = 5,
    ) -> dict:
        """Backfill all eligible funds using a thread pool.

        Each thread gets its own DB session. Returns summary dict.
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        if end_date is None:
            end_date = str(date.today())

        start_dt = date.fromisoformat(start_date)
        candidates = self.get_backfill_candidates()
        earliest_dates = self._repo.get_earliest_nav_dates()

        # Filter out already-backfilled funds
        to_backfill = [
            c for c in candidates
            if c["mstar_id"] not in earliest_dates
            or earliest_dates[c["mstar_id"]] > start_dt
        ]

        logger.info(
            "Backfill: %d candidates, %d already done, %d to fetch",
            len(candidates), len(candidates) - len(to_backfill), len(to_backfill),
        )

        backfill_progress.start(total=len(to_backfill))

        total_navs = 0
        failed = 0

        def _worker(fund: dict) -> int:
            """Worker function — uses its own DB session."""
            return self._backfill_single(
                fund["mstar_id"], fund["amfi_code"], start_date, end_date
            )

        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = {pool.submit(_worker, f): f for f in to_backfill}
            for future in as_completed(futures):
                fund = futures[future]
                try:
                    count = future.result()
                    total_navs += count
                    backfill_progress.mark_completed(nav_count=count)
                except Exception as e:
                    failed += 1
                    backfill_progress.mark_failed()
                    logger.error("Backfill failed for %s: %s", fund["mstar_id"], e)

        backfill_progress.finish()

        summary = {
            "total_candidates": len(candidates),
            "backfilled": len(to_backfill) - failed,
            "skipped": len(candidates) - len(to_backfill),
            "failed": failed,
            "total_navs_inserted": total_navs,
        }

        # Audit trail
        self._audit_repo.log(
            entity_type="nav_backfill",
            entity_id="batch",
            action="backfill_complete",
            actor="system",
            details=summary,
        )
        self._db.commit()

        logger.info("Backfill complete: %s", summary)
        return summary

    def _backfill_single(
        self, mstar_id: str, amfi_code: str, start_date: str, end_date: str,
    ) -> int:
        """Backfill a single fund via AMFI API. Uses its own DB session for thread safety."""
        db = SessionLocal()
        try:
            repo = IngestionRepository(db)
            self._rate_limiter.acquire()
            backfill_progress.set_current(mstar_id)

            url = f"{MFAPI_BASE}/{amfi_code}"
            with httpx.Client(timeout=30) as client:
                response = client.get(url)
                response.raise_for_status()

            data = response.json()
            records = _parse_mfapi_response(
                data, mstar_id,
                start_date=date.fromisoformat(start_date),
                end_date=date.fromisoformat(end_date),
            )

            if records:
                result = repo.insert_nav_daily_backfill(records)
                logger.info("Backfilled %s (AMFI %s): %d NAVs", mstar_id, amfi_code, result.inserted)
                return result.inserted

            return 0
        except Exception:
            logger.exception("Error backfilling %s (AMFI %s)", mstar_id, amfi_code)
            raise
        finally:
            db.close()

    def backfill_fund(
        self,
        mstar_id: str,
        start_date: str,
        end_date: str | None = None,
        amfi_code: str | None = None,
    ) -> int:
        """Backfill a single fund synchronously (for testing / API endpoint).

        If amfi_code not provided, looks it up from fund_master.
        """
        if end_date is None:
            end_date = str(date.today())

        if amfi_code is None:
            row = self._db.execute(
                select(FundMaster.amfi_code)
                .where(FundMaster.mstar_id == mstar_id)
            ).first()
            if not row or not row.amfi_code:
                logger.error("No amfi_code found for %s", mstar_id)
                return 0
            amfi_code = row.amfi_code

        self._rate_limiter.acquire()

        url = f"{MFAPI_BASE}/{amfi_code}"
        with httpx.Client(timeout=30) as client:
            response = client.get(url)
            response.raise_for_status()

        data = response.json()
        records = _parse_mfapi_response(
            data, mstar_id,
            start_date=date.fromisoformat(start_date),
            end_date=date.fromisoformat(end_date),
        )

        if records:
            result = self._repo.insert_nav_daily_backfill(records)
            return result.inserted

        return 0
