"""Portfolio analytics API — comprehensive analytics for deployed portfolios."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas.responses import Meta
from app.services.portfolio_analytics_service import PortfolioAnalyticsService

router = APIRouter(prefix="/strategies/portfolios", tags=["portfolio-analytics"])


@router.get("/{portfolio_id}/analytics")
def get_portfolio_analytics(
    portfolio_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Get comprehensive analytics for a deployed portfolio.

    Returns blended sector exposure, market cap split, weighted lens scores,
    return/risk contributions per holding, risk profile vs benchmark,
    similar funds, and audit change trail.
    """
    service = PortfolioAnalyticsService(db)
    analytics = service.get_analytics(portfolio_id)
    return {
        "success": True,
        "data": analytics,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }
