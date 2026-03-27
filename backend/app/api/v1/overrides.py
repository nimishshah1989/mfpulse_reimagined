"""FM Override API endpoints — CRUD and expiration."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas.responses import Meta
from app.models.schemas.strategy_schemas import CreateOverrideRequest
from app.services.override_service import OverrideService

router = APIRouter(prefix="/overrides", tags=["overrides"])


@router.post("")
def create_override(
    request: CreateOverrideRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Create a new FM override."""
    service = OverrideService(db)
    override = service.create_override(request.model_dump())
    return {
        "success": True,
        "data": override,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("")
def list_overrides(
    active_only: bool = True,
    override_type: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict:
    """List all overrides with optional filters."""
    service = OverrideService(db)
    overrides = service.list_overrides(
        active_only=active_only,
        override_type=override_type,
    )
    return {
        "success": True,
        "data": overrides,
        "meta": {"timestamp": Meta().timestamp, "count": len(overrides)},
        "error": None,
    }


@router.get("/{override_id}")
def get_override(
    override_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Get a single override by ID."""
    service = OverrideService(db)
    override = service.get_override(override_id)
    return {
        "success": True,
        "data": override,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.delete("/{override_id}")
def deactivate_override(
    override_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Deactivate an override."""
    service = OverrideService(db)
    service.deactivate_override(override_id)
    return {
        "success": True,
        "data": {"deactivated": True},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/fund/{mstar_id}")
def get_overrides_for_fund(
    mstar_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Get all active overrides for a fund."""
    service = OverrideService(db)
    overrides = service.get_overrides_for_fund(mstar_id)
    return {
        "success": True,
        "data": overrides,
        "meta": {"timestamp": Meta().timestamp, "count": len(overrides)},
        "error": None,
    }


@router.post("/expire-stale")
def expire_stale_overrides(
    db: Session = Depends(get_db),
) -> dict:
    """Expire all overrides past their expiry date."""
    service = OverrideService(db)
    count = service.expire_stale_overrides()
    return {
        "success": True,
        "data": {"expired_count": count},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }
