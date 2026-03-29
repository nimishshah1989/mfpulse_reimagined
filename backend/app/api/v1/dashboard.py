"""Dashboard API endpoints — smart buckets and briefing data."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas.responses import Meta
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/smart-buckets")
def get_smart_buckets(db: Session = Depends(get_db)):
    """Pre-computed fund groupings from lens classifications.

    Returns 6 buckets: Consistent Alpha, Low-Risk Leaders, High Efficiency,
    Fortress Funds, Turnaround Watch, Avoid Zone.
    """
    svc = DashboardService(db)
    data = svc.get_smart_buckets()
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp, "count": len(data)},
        "error": None,
    }


@router.get("/archetypes")
def get_fund_archetypes(db: Session = Depends(get_db)):
    """Cluster all scored funds into 9 lens-pattern archetypes."""
    svc = DashboardService(db)
    data = svc.get_archetypes()
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp, "count": len(data)},
        "error": None,
    }
