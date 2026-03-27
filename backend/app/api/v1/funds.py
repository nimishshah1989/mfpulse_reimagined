"""Fund read API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas.responses import APIResponse, Meta
from app.services.fund_service import FundService

router = APIRouter(prefix="/funds", tags=["funds"])


@router.get("")
def list_funds(
    category: Optional[str] = None,
    amc: Optional[str] = None,
    search: Optional[str] = None,
    purchase_mode: int = 1,
    sort_by: str = "fund_name",
    sort_dir: str = "asc",
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
) -> dict:
    """List funds with filters, search, sort, pagination."""
    service = FundService(db)
    funds, total = service.list_funds(
        category=category,
        amc=amc,
        search=search,
        purchase_mode=purchase_mode,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )
    return {
        "success": True,
        "data": funds,
        "meta": {"timestamp": Meta().timestamp, "count": total},
        "error": None,
    }


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)) -> dict:
    """All SEBI categories with fund counts and avg returns."""
    service = FundService(db)
    categories = service.get_categories_heatmap()
    return {
        "success": True,
        "data": categories,
        "meta": {"timestamp": Meta().timestamp, "count": len(categories)},
        "error": None,
    }


@router.get("/amcs")
def list_amcs(db: Session = Depends(get_db)) -> dict:
    """All AMCs with fund counts."""
    service = FundService(db)
    amcs = service.fund_repo.get_amcs()
    return {
        "success": True,
        "data": amcs,
        "meta": {"timestamp": Meta().timestamp, "count": len(amcs)},
        "error": None,
    }


@router.get("/{mstar_id}")
def get_fund_detail(mstar_id: str, db: Session = Depends(get_db)) -> dict:
    """Full deep-dive for one fund."""
    service = FundService(db)
    detail = service.get_fund_detail(mstar_id)
    return {
        "success": True,
        "data": detail,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/{mstar_id}/nav")
def get_nav_history(
    mstar_id: str,
    period: str = "1y",
    db: Session = Depends(get_db),
) -> dict:
    """NAV time series for charting."""
    service = FundService(db)
    data = service.get_nav_chart_data(mstar_id, period=period)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp, "count": len(data)},
        "error": None,
    }


@router.get("/{mstar_id}/risk")
def get_risk_history(
    mstar_id: str,
    limit: int = 12,
    db: Session = Depends(get_db),
) -> dict:
    """Monthly risk stats history."""
    service = FundService(db)
    data = service.get_risk_history(mstar_id, limit=limit)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp, "count": len(data)},
        "error": None,
    }


@router.get("/{mstar_id}/holdings")
def get_holdings(
    mstar_id: str,
    top: Optional[int] = None,
    db: Session = Depends(get_db),
) -> dict:
    """Fund holdings with sector and weight."""
    service = FundService(db)
    data = service.get_holdings(mstar_id, top=top)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp, "count": len(data)},
        "error": None,
    }


@router.get("/{mstar_id}/sectors")
def get_sector_exposure(
    mstar_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Sector allocation breakdown."""
    service = FundService(db)
    data = service.get_sector_exposure(mstar_id)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp, "count": len(data)},
        "error": None,
    }


@router.get("/{mstar_id}/peers")
def get_peers(
    mstar_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Peer comparison within same SEBI category."""
    service = FundService(db)
    data = service.get_peer_comparison(mstar_id)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }
