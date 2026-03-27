"""Holdings and overlap API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas.fund_schemas import OverlapRequest
from app.models.schemas.responses import Meta
from app.services.fund_service import FundService

router = APIRouter(prefix="/holdings", tags=["holdings"])


@router.post("/overlap")
def compute_overlap(
    request: OverlapRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Overlap analysis for 2-5 funds."""
    service = FundService(db)
    data = service.get_overlap_analysis(request.mstar_ids)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }
