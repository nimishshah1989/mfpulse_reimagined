"""API endpoints for triggering Morningstar data fetches."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.morningstar_config import API_NAME_MAP
from app.repositories.audit_repo import AuditRepository
from app.services.morningstar_fetcher import MorningstarFetcher

router = APIRouter(prefix="/ingestion/fetch", tags=["ingestion"])


@router.post("/full")
def fetch_full(db: Session = Depends(get_db)) -> dict:
    """Trigger a full Morningstar data refresh (all 8 APIs).

    Returns summary of each API fetch result.
    Takes ~2-3 minutes for ~3000 funds.
    """
    fetcher = MorningstarFetcher(db)
    results = fetcher.fetch_all()
    return {
        "success": True,
        "data": {
            "results": [r.to_dict() for r in results],
            "total_funds": sum(r.fund_count for r in results),
            "errors": sum(1 for r in results if r.status == "error"),
        },
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
        "error": None,
    }


@router.post("/nav")
def fetch_nav(db: Session = Depends(get_db)) -> dict:
    """Trigger daily NAV + returns refresh only (2 API calls).

    Takes ~30 seconds.
    """
    fetcher = MorningstarFetcher(db)
    results = fetcher.fetch_nav_only()
    return {
        "success": True,
        "data": {
            "results": [r.to_dict() for r in results],
            "total_funds": sum(r.fund_count for r in results),
        },
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
        "error": None,
    }


@router.post("/single/{api_name}")
def fetch_single(api_name: str, db: Session = Depends(get_db)) -> dict:
    """Trigger a single API fetch by name.

    Valid names: identifier, additional, category, nav, returns, risk, ranks, catreturns
    """
    api = API_NAME_MAP.get(api_name)
    if api is None:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_API_NAME",
                "message": f"Unknown API name: {api_name}",
                "valid_names": list(API_NAME_MAP.keys()),
            },
        )
    fetcher = MorningstarFetcher(db)
    result = fetcher.fetch_single_api(api)
    return {
        "success": True,
        "data": result.to_dict(),
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
        "error": None,
    }


@router.get("/status")
def fetch_status(db: Session = Depends(get_db)) -> dict:
    """Get last fetch results from audit trail."""
    audit_repo = AuditRepository(db)
    recent = audit_repo.get_recent(limit=20, entity_type="morningstar_fetch")
    entries = [
        {
            "id": str(r.id),
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "entity_id": r.entity_id,
            "action": r.action,
            "details": r.details,
        }
        for r in recent
    ]
    return {
        "success": True,
        "data": {"recent_fetches": entries},
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
        "error": None,
    }
