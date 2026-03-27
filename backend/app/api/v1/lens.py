"""Lens classification API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas.responses import Meta
from app.repositories.lens_repo import LensRepository
from app.services.lens_service import LensService

router = APIRouter(prefix="/lens", tags=["lens"])


@router.get("/scores")
def get_all_scores(
    category: Optional[str] = None,
    sort_by: str = "return_score",
    sort_dir: str = "desc",
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
) -> dict:
    """Fund lens scores — the main explorer table."""
    repo = LensRepository(db)
    scores, total = repo.get_all_scores(
        category=category,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )
    return {
        "success": True,
        "data": scores,
        "meta": {"timestamp": Meta().timestamp, "count": total},
        "error": None,
    }


@router.get("/scores/{mstar_id}")
def get_fund_scores(mstar_id: str, db: Session = Depends(get_db)) -> dict:
    """Lens scores + classification for one fund."""
    repo = LensRepository(db)
    scores = repo.get_latest_scores(mstar_id)
    classification = repo.get_latest_classification(mstar_id)
    if scores is None:
        return {
            "success": True,
            "data": None,
            "meta": {"timestamp": Meta().timestamp},
            "error": None,
        }
    data = {**scores}
    if classification:
        data.update(classification)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/scores/{mstar_id}/history")
def get_score_history(
    mstar_id: str,
    limit: int = 12,
    db: Session = Depends(get_db),
) -> dict:
    """Monthly lens score history for trend chart."""
    repo = LensRepository(db)
    history = repo.get_score_history(mstar_id, limit=limit)
    return {
        "success": True,
        "data": history,
        "meta": {"timestamp": Meta().timestamp, "count": len(history)},
        "error": None,
    }


@router.get("/distribution")
def get_distribution(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict:
    """Classification distribution (count per tier per lens)."""
    repo = LensRepository(db)
    distribution = repo.get_classification_distribution(category_name=category)
    total = sum(
        sum(tier_counts.values())
        for tier_counts in distribution.values()
        if tier_counts
    )
    # Total is max across lenses (each fund counted once per lens)
    lens_totals = [
        sum(tier_counts.values())
        for tier_counts in distribution.values()
        if tier_counts
    ]
    total_funds = max(lens_totals) if lens_totals else 0
    return {
        "success": True,
        "data": {
            "category_name": category,
            "distribution": distribution,
            "total_funds": total_funds,
        },
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.post("/compute")
def trigger_computation(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict:
    """
    Trigger lens computation. If category specified, compute that category only.
    Otherwise compute all categories.
    """
    service = LensService(db)
    if category:
        result = service.compute_single_category(category)
        return {
            "success": True,
            "data": result,
            "meta": {"timestamp": Meta().timestamp},
            "error": None,
        }
    result = service.compute_all_categories()
    return {
        "success": True,
        "data": result,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.post("/compute/{mstar_id}")
def trigger_single_fund(
    mstar_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Recompute lenses for a single fund."""
    service = LensService(db)
    result = service.compute_single_fund(mstar_id)
    if result is None:
        return {
            "success": True,
            "data": None,
            "meta": {"timestamp": Meta().timestamp},
            "error": None,
        }
    return {
        "success": True,
        "data": {
            "mstar_id": result.mstar_id,
            "category_name": result.category_name,
            "return_score": result.return_score,
            "risk_score": result.risk_score,
            "consistency_score": result.consistency_score,
            "alpha_score": result.alpha_score,
            "efficiency_score": result.efficiency_score,
            "resilience_score": result.resilience_score,
            "headline_tag": result.headline_tag,
        },
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }
