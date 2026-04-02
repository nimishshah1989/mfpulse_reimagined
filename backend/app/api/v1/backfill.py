"""API endpoints for historical NAV and holdings backfill."""

import threading
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.services.nav_backfill_service import NAVBackfillService, backfill_progress
from app.services.holdings_backfill_service import (
    HoldingsBackfillService,
    holdings_backfill_progress,
)

router = APIRouter(prefix="/backfill", tags=["backfill"])


@router.post("/nav")
def trigger_nav_backfill(
    start_date: str = Query(default="2016-01-01"),
    end_date: Optional[str] = Query(default=None),
    concurrency: int = Query(default=10, ge=1, le=50),
) -> dict:
    """Launch full NAV backfill in a background thread. Returns immediately."""
    if not backfill_progress.try_start():
        return JSONResponse(
            status_code=409,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "BACKFILL_RUNNING",
                    "message": "NAV backfill is already running",
                    "details": backfill_progress.get_status(),
                },
            },
        )

    def _run() -> None:
        bg_db = SessionLocal()
        try:
            service = NAVBackfillService(bg_db)
            service.backfill_all(
                start_date=start_date,
                end_date=end_date,
                concurrency=concurrency,
            )
        finally:
            bg_db.close()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    return {
        "success": True,
        "data": {
            "status": "Backfill launched in background",
            "start_date": start_date,
            "end_date": end_date or str(date.today()),
            "concurrency": concurrency,
        },
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
        "error": None,
    }


@router.post("/nav/single/{mstar_id}")
def backfill_single_fund(
    mstar_id: str,
    start_date: str = Query(default="2016-01-01"),
    end_date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Backfill one fund synchronously. For testing and debugging."""
    service = NAVBackfillService(db)
    count = service.backfill_fund(mstar_id, start_date, end_date)

    return {
        "success": True,
        "data": {
            "mstar_id": mstar_id,
            "nav_count": count,
            "start_date": start_date,
            "end_date": end_date or str(date.today()),
        },
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
        "error": None,
    }


@router.get("/nav/status")
def get_backfill_status(db: Session = Depends(get_db)) -> dict:
    """Return current backfill progress with actual DB totals."""
    from sqlalchemy import func, text
    from app.models.db.nav_daily import NavDaily

    status = backfill_progress.get_status()

    # Always include actual DB counts — immune to container restarts
    row = db.execute(
        text(
            "SELECT COUNT(DISTINCT mstar_id) AS funds,"
            " COUNT(*) AS navs,"
            " MIN(nav_date) AS earliest,"
            " MAX(nav_date) AS latest"
            " FROM nav_daily"
        )
    ).first()

    status["db_total_funds"] = row.funds if row else 0
    status["db_total_navs"] = row.navs if row else 0
    status["db_earliest_date"] = str(row.earliest) if row and row.earliest else None
    status["db_latest_date"] = str(row.latest) if row and row.latest else None

    return {
        "success": True,
        "data": status,
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
        "error": None,
    }


# --- Holdings Backfill ---

@router.post("/holdings")
def trigger_holdings_backfill(
    concurrency: int = Query(default=10, ge=1, le=50),
) -> dict:
    """Launch full holdings backfill in a background thread. Returns immediately.

    Fetches individual stock/bond holdings for all Regular funds (~3K)
    via per-fund Morningstar API. ~2-3 hours at 10 concurrency.
    Each fund commits independently — safe to interrupt.
    """
    if not holdings_backfill_progress.try_start():
        return JSONResponse(
            status_code=409,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "BACKFILL_RUNNING",
                    "message": "Holdings backfill is already running",
                    "details": holdings_backfill_progress.get_status(),
                },
            },
        )

    def _run() -> None:
        bg_db = SessionLocal()
        try:
            service = HoldingsBackfillService(bg_db)
            service.fetch_all(concurrency=concurrency)
        finally:
            bg_db.close()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    return {
        "success": True,
        "data": {
            "status": "Holdings backfill launched in background",
            "concurrency": concurrency,
        },
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
        "error": None,
    }


@router.post("/holdings/single/{mstar_id}")
def backfill_single_holdings(
    mstar_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Fetch holdings for one fund synchronously. For testing."""
    service = HoldingsBackfillService(db)
    count = service.fetch_fund_holdings(mstar_id)

    return {
        "success": True,
        "data": {
            "mstar_id": mstar_id,
            "holdings_count": count,
        },
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
        "error": None,
    }


@router.get("/holdings/status")
def get_holdings_backfill_status(db: Session = Depends(get_db)) -> dict:
    """Return current holdings backfill progress with DB totals."""
    from sqlalchemy import text

    status = holdings_backfill_progress.get_status()

    row = db.execute(
        text(
            "SELECT COUNT(DISTINCT fhs.mstar_id) AS funds,"
            " COUNT(fhd.id) AS details"
            " FROM fund_holdings_snapshot fhs"
            " LEFT JOIN fund_holding_detail fhd ON fhd.snapshot_id = fhs.id"
        )
    ).first()

    status["db_funds_with_snapshots"] = row.funds if row else 0
    status["db_total_holding_details"] = row.details if row else 0

    return {
        "success": True,
        "data": status,
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
        "error": None,
    }
