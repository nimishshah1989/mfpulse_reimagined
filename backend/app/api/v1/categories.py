"""Category read API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas.responses import Meta
from app.services.fund_service import FundService

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("")
def list_categories(db: Session = Depends(get_db)) -> dict:
    """All categories with fund count + avg returns — drives the heatmap."""
    service = FundService(db)
    categories = service.get_categories_heatmap()
    return {
        "success": True,
        "data": categories,
        "meta": {"timestamp": Meta().timestamp, "count": len(categories)},
        "error": None,
    }


@router.get("/{category_name}/funds")
def list_category_funds(
    category_name: str,
    sort_by: str = "return_1y",
    sort_dir: str = "desc",
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
) -> dict:
    """All funds in a category sorted by performance."""
    service = FundService(db)
    funds, total = service.list_category_funds(
        category_name=category_name,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
    )
    return {
        "success": True,
        "data": funds,
        "meta": {"timestamp": Meta().timestamp, "count": total},
        "error": None,
    }


@router.get("/{category_name}/returns")
def get_category_returns(
    category_name: str,
    db: Session = Depends(get_db),
) -> dict:
    """Category average returns across all periods."""
    service = FundService(db)
    data = service.get_category_returns(category_name)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }
