"""Audit trail API — paginated read access to audit log."""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.audit_repo import AuditRepository

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit_entries(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    actor: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
) -> dict:
    """Paginated audit trail with filters."""
    repo = AuditRepository(db)
    items, total = repo.get_paginated(
        page=page,
        page_size=page_size,
        entity_type=entity_type,
        action=action,
        actor=actor,
        start_date=start_date,
        end_date=end_date,
    )
    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        },
        "error": None,
    }


@router.get("/summary")
def audit_summary(
    days: int = Query(7, ge=1, le=365),
    db: Session = Depends(get_db),
) -> dict:
    """Activity summary for last N days."""
    repo = AuditRepository(db)
    summary = repo.get_summary(days=days)
    return {
        "success": True,
        "data": summary,
        "error": None,
    }


@router.get("/fund/{mstar_id}")
def fund_audit(
    mstar_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Audit entries for a specific fund."""
    repo = AuditRepository(db)
    entries = repo.get_by_entity(entity_id=mstar_id)
    return {
        "success": True,
        "data": entries,
        "error": None,
    }
