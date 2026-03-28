"""Holdings detail backfill from Morningstar per-fund API.

Fetches individual stock/bond holdings for all Regular funds using
the per-fund Holdings Detail API. Each fund commits independently
so interruptions don't lose already-fetched data.

Usage:
    service = HoldingsBackfillService(db)
    service.fetch_all(concurrency=10)          # All Regular funds
    service.fetch_fund_holdings("F00001ISYO")  # One fund (testing)
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from datetime import date, datetime, timezone
from xml.etree import ElementTree as ET

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.morningstar_config import API_BASE
from app.ingestion.field_maps import HOLDING_DETAIL_NESTED_MAP
from app.models.db.fund_master import FundMaster
from app.models.db.holdings import FundHoldingsSnapshot
from app.repositories.audit_repo import AuditRepository
from app.repositories.ingestion_repo import IngestionRepository, UpsertResult

logger = logging.getLogger(__name__)

HOLDINGS_DETAIL_HASH = "fq9mxhk7xeb20f3b"


def _parse_holdings_xml(
    xml_content: bytes, mstar_id: str,
) -> list[dict[str, str]]:
    """Parse per-fund Holdings Detail XML into a list of holding dicts.

    Expected structure:
        <response>
            <status><code>0</code></status>
            <data _id="F001">
                <api>
                    <FHV2-Holdings>
                        <HoldingDetail>
                            <Name>HDFC Bank</Name>
                            <Weighting>8.5</Weighting>
                            ...
                        </HoldingDetail>
                    </FHV2-Holdings>
                </api>
            </data>
        </response>

    Returns list of dicts with DB column names as keys.
    """
    if not xml_content:
        return []

    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError:
        logger.warning("XML parse error for %s", mstar_id)
        return []

    status_code = root.findtext(".//status/code")
    if status_code != "0":
        msg = root.findtext(".//status/message") or "Unknown error"
        logger.warning("API error for %s: status %s — %s", mstar_id, status_code, msg)
        return []

    holdings: list[dict[str, str]] = []
    for elem in root.iter("HoldingDetail"):
        holding: dict[str, str] = {}
        for child in elem:
            if child.text and child.tag in HOLDING_DETAIL_NESTED_MAP:
                holding[HOLDING_DETAIL_NESTED_MAP[child.tag]] = child.text.strip()
        if holding.get("holding_name"):
            holdings.append(holding)

    return holdings


class _RateLimiter:
    """Sliding window rate limiter. Thread-safe."""

    def __init__(self, max_calls: int = 50, period_seconds: float = 60.0) -> None:
        self._max_calls = max_calls
        self._period = period_seconds
        self._timestamps: list[float] = []
        self._lock = threading.Lock()

    def acquire(self) -> None:
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


class HoldingsBackfillProgress:
    """Thread-safe progress tracker for holdings backfill."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._total_funds = 0
        self._completed = 0
        self._failed = 0
        self._total_holdings = 0
        self._running = False
        self._started_at: str | None = None
        self._current_fund: str | None = None

    def start(self, total: int) -> None:
        with self._lock:
            self._total_funds = total
            self._completed = 0
            self._failed = 0
            self._total_holdings = 0
            self._running = True
            self._started_at = datetime.now(timezone.utc).isoformat()

    def mark_completed(self, holdings_count: int = 0) -> None:
        with self._lock:
            self._completed += 1
            self._total_holdings += holdings_count

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
                "total_holdings_inserted": self._total_holdings,
                "running": self._running,
                "started_at": self._started_at,
                "current_fund": self._current_fund,
            }


# Module-level singleton for status polling
holdings_backfill_progress = HoldingsBackfillProgress()


class HoldingsBackfillService:
    """Fetches individual fund holdings from Morningstar per-fund API."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = IngestionRepository(db)
        self._audit_repo = AuditRepository(db)
        self._settings = get_settings()
        self._access_code = self._settings.morningstar_access_code
        self._rate_limiter = _RateLimiter()

    def get_candidates(self) -> list[str]:
        """Return mstar_ids eligible for holdings fetch.

        Criteria: purchase_mode=1 (Regular), active, has category_name.
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
        logger.info("Holdings candidates: %d Regular funds", len(candidates))
        return candidates

    def fetch_all(self, concurrency: int = 10) -> dict:
        """Fetch holdings for all eligible funds using a thread pool.

        Each fund uses its own DB session. Returns summary dict.
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        candidates = self.get_candidates()
        logger.info("Holdings backfill: %d funds to fetch", len(candidates))

        holdings_backfill_progress.start(total=len(candidates))

        total_holdings = 0
        failed = 0

        def _worker(mstar_id: str) -> int:
            return self._fetch_single(mstar_id)

        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = {pool.submit(_worker, mid): mid for mid in candidates}
            for future in as_completed(futures):
                mid = futures[future]
                try:
                    count = future.result()
                    total_holdings += count
                    holdings_backfill_progress.mark_completed(holdings_count=count)
                except Exception as e:
                    failed += 1
                    holdings_backfill_progress.mark_failed()
                    logger.error("Holdings fetch failed for %s: %s", mid, e)

        holdings_backfill_progress.finish()

        summary = {
            "total_candidates": len(candidates),
            "fetched": len(candidates) - failed,
            "failed": failed,
            "total_holdings": total_holdings,
        }

        self._audit_repo.log(
            entity_type="holdings_backfill",
            entity_id="batch",
            action="backfill_complete",
            actor="system",
            details=summary,
        )
        self._db.commit()

        logger.info("Holdings backfill complete: %s", summary)
        return summary

    def _fetch_single(self, mstar_id: str) -> int:
        """Fetch holdings for one fund. Uses its own DB session for thread safety."""
        db = SessionLocal()
        try:
            repo = IngestionRepository(db)
            self._rate_limiter.acquire()
            holdings_backfill_progress.set_current(mstar_id)

            url = (
                f"{API_BASE}/{HOLDINGS_DETAIL_HASH}/mstarid/{mstar_id}"
                f"?accesscode={self._access_code}"
            )

            with httpx.Client(timeout=30) as client:
                response = client.get(url)
                response.raise_for_status()

            holdings = _parse_holdings_xml(response.content, mstar_id)

            if not holdings:
                return 0

            # Upsert snapshot (creates if not exists)
            today = date.today()
            snapshot_rec = {
                "mstar_id": mstar_id,
                "portfolio_date": today,
                "num_holdings": len(holdings),
            }
            repo.upsert_holdings_snapshot([snapshot_rec])

            # Look up the snapshot ID (use date object, not string)
            snap = db.execute(
                select(FundHoldingsSnapshot.id)
                .where(FundHoldingsSnapshot.mstar_id == mstar_id)
                .where(FundHoldingsSnapshot.portfolio_date == today)
            ).fetchone()

            if snap:
                result = repo.upsert_holding_details(snap.id, holdings)
                if result.errors:
                    logger.error("Holdings insert errors for %s: %s", mstar_id, result.errors)
                logger.info("Holdings for %s: %d parsed, %d inserted, %d failed",
                            mstar_id, len(holdings), result.inserted, result.failed)
            else:
                logger.error("Snapshot lookup failed for %s on %s — holdings not inserted", mstar_id, today)
                return 0

            return result.inserted
        except Exception:
            logger.exception("Error fetching holdings for %s", mstar_id)
            raise
        finally:
            db.close()

    def fetch_fund_holdings(self, mstar_id: str) -> int:
        """Fetch holdings for a single fund. For testing / API endpoint."""
        return self._fetch_single(mstar_id)
