"""Sector rotation API endpoints — Morningstar-derived sector intelligence."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import require_admin_key
from app.core.database import get_db
from app.services.category_alignment import CategoryAlignmentService
from app.services.sector_rotation import SectorRotationService

router = APIRouter(prefix="/sectors", tags=["Sectors"])


@router.get("/rotation")
def get_sector_rotation(db: Session = Depends(get_db)):
    """Current sector rotation — weights, momentum, quadrant for all 11 Morningstar sectors."""
    svc = SectorRotationService(db)
    data = svc.get_current_rotation()
    return {"success": True, "data": data, "meta": {"count": len(data)}, "error": None}


@router.get("/history")
def get_sector_history(
    months: int = Query(default=6, ge=1, le=24),
    db: Session = Depends(get_db),
):
    """Sector rotation history for rotation chart."""
    svc = SectorRotationService(db)
    data = svc.get_history(months=months)
    return {"success": True, "data": data, "meta": {"months": months, "count": len(data)}, "error": None}


@router.get("/fund-exposure")
def get_fund_exposure_by_sector(
    sector: str = Query(..., description="Sector name, e.g. 'Technology'"),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Top funds by allocation to a specific Morningstar sector."""
    svc = SectorRotationService(db)
    data = svc.get_fund_exposure_by_sector(sector, limit=limit)
    return {"success": True, "data": data, "meta": {"sector": sector, "count": len(data)}, "error": None}


@router.get("/drill/{sector_name}")
def get_sector_drill_down(
    sector_name: str,
    min_pct: float = Query(default=5.0, ge=0, le=100),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Drill into a sector — funds with significant exposure, enriched with lens scores + returns."""
    svc = SectorRotationService(db)
    data = svc.get_sector_drill_down(sector_name, min_pct=min_pct, limit=limit)
    return {"success": True, "data": data, "meta": {"sector": sector_name, "count": len(data)}, "error": None}


@router.get("/fund-exposure-matrix")
def get_fund_exposure_matrix(
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Top N funds by AUM with all 11 sector exposures — single batch query."""
    svc = SectorRotationService(db)
    data = svc.get_fund_exposure_matrix(limit=limit)
    return {"success": True, "data": data, "meta": {"count": len(data)}, "error": None}


@router.get("/category-alignment")
def get_category_alignment(db: Session = Depends(get_db)):
    """Per-category portfolio exposure across sector rotation zones."""
    svc = CategoryAlignmentService(db)
    data = svc.get_category_alignment()
    return {"success": True, "data": data, "meta": {"count": len(data)}, "error": None}


@router.post("/compute", dependencies=[Depends(require_admin_key)])
def trigger_sector_computation(db: Session = Depends(get_db)):
    """Manually trigger sector rotation computation from latest holdings data."""
    svc = SectorRotationService(db)
    data = svc.compute_current()
    return {"success": True, "data": data, "meta": {"count": len(data)}, "error": None}


@router.post("/backfill", dependencies=[Depends(require_admin_key)])
def trigger_sector_backfill(
    months: int = Query(default=6, ge=1, le=24),
    db: Session = Depends(get_db),
):
    """Backfill sector rotation history for the last N months of portfolio dates."""
    svc = SectorRotationService(db)
    data = svc.backfill_history(months=months)
    return {"success": True, "data": data, "meta": {"count": len(data)}, "error": None}
