"""Historical NAV backfill from Morningstar per-fund API.

Fetches 5-10 years of daily NAV history for simulation backtesting.
Uses ON CONFLICT DO NOTHING so historical records never overwrite
fresh daily data (which includes return columns).
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional
from xml.etree import ElementTree as ET

import httpx
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.morningstar_config import API_BASE
from app.models.db.fund_master import FundMaster
from app.repositories.audit_repo import AuditRepository
from app.repositories.ingestion_repo import IngestionRepository

logger = logging.getLogger(__name__)

# NAV hash from morningstar_config — per-fund with date params
NAV_HASH = "n0fys3tcvprq4375"


def _parse_historical_nav_xml(xml_content: bytes, mstar_id: str) -> list[dict]:
    """Parse Morningstar per-fund historical NAV XML.

    Expected structure:
        <serviceresponse>
            <status><code>0</code></status>
            <data _id="F00000VSLQ">
                <api>
                    <TS-DayEndNAV date="2024-01-02">152.3400</TS-DayEndNAV>
                    ...
                </api>
            </data>
        </serviceresponse>

    Returns list of {mstar_id, nav_date: date, nav: Decimal}.
    """
    if not xml_content:
        return []

    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError:
        logger.warning("XML parse error for %s", mstar_id)
        return []

    # Check status
    status_code = root.findtext(".//status/code")
    if status_code != "0":
        msg = root.findtext(".//status/message") or "Unknown error"
        logger.warning("API error for %s: status %s — %s", mstar_id, status_code, msg)
        return []

    records: list[dict] = []
    for data_elem in root.findall("data"):
        api_elem = data_elem.find("api")
        if api_elem is None:
            continue

        for child in api_elem:
            nav_date_str = child.get("date")
            nav_text = child.text

            if not nav_date_str or not nav_text:
                continue

            try:
                nav_date_val = date.fromisoformat(nav_date_str)
            except ValueError:
                logger.debug("Bad date for %s: %s", mstar_id, nav_date_str)
                continue

            try:
                nav_val = Decimal(nav_text.strip())
            except (InvalidOperation, ValueError):
                logger.debug("Bad NAV for %s on %s: %s", mstar_id, nav_date_str, nav_text)
                continue

            records.append({
                "mstar_id": mstar_id,
                "nav_date": nav_date_val,
                "nav": nav_val,
            })

    return records


class _RateLimiter:
    """Sliding window rate limiter. Thread-safe."""

    def __init__(self, max_calls: int = 9500, period_seconds: float = 3600.0) -> None:
        self._max_calls = max_calls
        self._period = period_seconds
        self._timestamps: list[float] = []
        self._lock = threading.Lock()

    def acquire(self) -> None:
        """Block until a call slot is available."""
        while True:
            with self._lock:
                now = time.monotonic()
                # Evict expired timestamps
                cutoff = now - self._period
                self._timestamps = [t for t in self._timestamps if t > cutoff]

                if len(self._timestamps) < self._max_calls:
                    self._timestamps.append(now)
                    return

                # Calculate wait time until oldest expires
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
    """Fetches historical daily NAV from Morningstar per-fund API."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = IngestionRepository(db)
        self._audit_repo = AuditRepository(db)
        self._settings = get_settings()
        self._access_code = self._settings.morningstar_access_code
        self._rate_limiter = _RateLimiter()

    def get_backfill_candidates(self) -> list[str]:
        """Return mstar_ids eligible for backfill.

        Criteria: purchase_mode=1, active (or NULL), has category_name.
        """
        stmt = (
            select(FundMaster.mstar_id)
            .where(FundMaster.purchase_mode == 1)
            .where(
                (FundMaster.is_active == True) | (FundMaster.is_active.is_(None))  # noqa: E712
            )
            .where(FundMaster.category_name.isnot(None))
        )
        rows = self._db.execute(stmt).fetchall()
        candidates = [row.mstar_id for row in rows]
        logger.info("Backfill candidates: %d funds", len(candidates))
        return candidates

    def backfill_all(
        self,
        start_date: str = "2016-01-01",
        end_date: str | None = None,
        concurrency: int = 10,
    ) -> dict:
        """Backfill all eligible funds using a thread pool.

        Each thread gets its own DB session. Returns summary dict.
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        if end_date is None:
            end_date = str(date.today())

        candidates = self.get_backfill_candidates()
        earliest_dates = self._repo.get_earliest_nav_dates()

        # Filter out already-backfilled funds
        to_backfill = [
            mid for mid in candidates
            if mid not in earliest_dates
            or earliest_dates[mid] > date.fromisoformat(start_date)
        ]

        logger.info(
            "Backfill: %d candidates, %d already done, %d to fetch",
            len(candidates), len(candidates) - len(to_backfill), len(to_backfill),
        )

        backfill_progress.start(total=len(to_backfill))

        total_navs = 0
        failed = 0

        def _worker(mstar_id: str) -> int:
            """Worker function — uses its own DB session."""
            return self._backfill_single(mstar_id, start_date, end_date)

        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = {pool.submit(_worker, mid): mid for mid in to_backfill}
            for future in as_completed(futures):
                mid = futures[future]
                try:
                    count = future.result()
                    total_navs += count
                    backfill_progress.mark_completed(nav_count=count)
                except Exception as e:
                    failed += 1
                    backfill_progress.mark_failed()
                    logger.error("Backfill failed for %s: %s", mid, e)

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

    def _backfill_single(self, mstar_id: str, start_date: str, end_date: str) -> int:
        """Backfill a single fund. Uses its own DB session for thread safety."""
        db = SessionLocal()
        try:
            repo = IngestionRepository(db)
            self._rate_limiter.acquire()

            backfill_progress.set_current(mstar_id)

            url = (
                f"{API_BASE}/{NAV_HASH}/mstarid/{mstar_id}"
                f"?accesscode={self._access_code}"
                f"&startdate={start_date}&enddate={end_date}&frequency=D"
            )

            with httpx.Client(timeout=120) as client:
                response = client.get(url)
                response.raise_for_status()

            records = _parse_historical_nav_xml(response.content, mstar_id)

            if records:
                result = repo.insert_nav_daily_backfill(records)
                logger.info(
                    "Backfilled %s: %d NAVs inserted",
                    mstar_id, result.inserted,
                )
                return result.inserted

            return 0
        except Exception:
            logger.exception("Error backfilling %s", mstar_id)
            raise
        finally:
            db.close()

    def backfill_fund(self, mstar_id: str, start_date: str, end_date: str | None = None) -> int:
        """Backfill a single fund synchronously (for testing / API endpoint)."""
        if end_date is None:
            end_date = str(date.today())

        self._rate_limiter.acquire()

        url = (
            f"{API_BASE}/{NAV_HASH}/mstarid/{mstar_id}"
            f"?accesscode={self._access_code}"
            f"&startdate={start_date}&enddate={end_date}&frequency=D"
        )

        with httpx.Client(timeout=120) as client:
            response = client.get(url)
            response.raise_for_status()

        records = _parse_historical_nav_xml(response.content, mstar_id)

        if records:
            result = self._repo.insert_nav_daily_backfill(records)
            return result.inserted

        return 0
