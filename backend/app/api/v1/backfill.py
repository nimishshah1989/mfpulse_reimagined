"""API endpoints for historical NAV backfill."""

import threading
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.services.nav_backfill_service import NAVBackfillService, backfill_progress

router = APIRouter(prefix="/backfill", tags=["backfill"])


@router.post("/nav")
def trigger_nav_backfill(
    start_date: str = Query(default="2016-01-01"),
    end_date: Optional[str] = Query(default=None),
    concurrency: int = Query(default=10, ge=1, le=50),
) -> dict:
    """Launch full NAV backfill in a background thread. Returns immediately."""

    def _run() -> None:
        # Background thread needs its own session — request session is
        # tied to the request lifecycle and can't be used across threads.
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
def get_backfill_status() -> dict:
    """Return current backfill progress."""
    status = backfill_progress.get_status()

    return {
        "success": True,
        "data": status,
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
        "error": None,
    }
