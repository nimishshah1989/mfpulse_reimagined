"""Strategy API endpoints — CRUD, backtest, deploy."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas.responses import Meta
from app.models.schemas.strategy_schemas import (
    BacktestRequest,
    CreateStrategyRequest,
    DeployRequest,
    UpdateStrategyRequest,
)
from app.services.strategy_service import StrategyService

router = APIRouter(prefix="/strategies", tags=["strategies"])


@router.post("")
def create_strategy(
    request: CreateStrategyRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Create a new strategy definition."""
    service = StrategyService(db)
    strategy = service.create_strategy(request.model_dump())
    return {
        "success": True,
        "data": strategy,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("")
def list_strategies(
    active_only: bool = True,
    db: Session = Depends(get_db),
) -> dict:
    """List all strategy definitions."""
    service = StrategyService(db)
    strategies = service.list_strategies(active_only=active_only)
    return {
        "success": True,
        "data": strategies,
        "meta": {"timestamp": Meta().timestamp, "count": len(strategies)},
        "error": None,
    }


@router.get("/{strategy_id}")
def get_strategy(
    strategy_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Get strategy detail with recent backtests."""
    service = StrategyService(db)
    strategy = service.get_strategy(strategy_id)
    return {
        "success": True,
        "data": strategy,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.put("/{strategy_id}")
def update_strategy(
    strategy_id: str,
    request: UpdateStrategyRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Update a strategy definition."""
    service = StrategyService(db)
    data = {k: v for k, v in request.model_dump().items() if v is not None}
    strategy = service.update_strategy(strategy_id, data)
    return {
        "success": True,
        "data": strategy,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.delete("/{strategy_id}")
def deactivate_strategy(
    strategy_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Deactivate (soft-delete) a strategy."""
    service = StrategyService(db)
    service.deactivate_strategy(strategy_id)
    return {
        "success": True,
        "data": {"deactivated": True},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.post("/{strategy_id}/backtest")
def run_backtest(
    strategy_id: str,
    request: BacktestRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Run a backtest for a strategy."""
    service = StrategyService(db)
    result = service.run_backtest(strategy_id, request.model_dump())
    return {
        "success": True,
        "data": result,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/{strategy_id}/backtests")
def get_backtests(
    strategy_id: str,
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
) -> dict:
    """Get recent backtest runs for a strategy."""
    service = StrategyService(db)
    backtests = service.get_backtests(strategy_id, limit=limit)
    return {
        "success": True,
        "data": backtests,
        "meta": {"timestamp": Meta().timestamp, "count": len(backtests)},
        "error": None,
    }


@router.post("/{strategy_id}/deploy")
def deploy_portfolio(
    strategy_id: str,
    request: DeployRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Deploy a strategy as a live portfolio."""
    service = StrategyService(db)
    portfolio = service.deploy_portfolio(strategy_id, request.model_dump())
    return {
        "success": True,
        "data": portfolio,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/portfolios/all")
def list_portfolios(
    active_only: bool = True,
    db: Session = Depends(get_db),
) -> dict:
    """List all live portfolios."""
    service = StrategyService(db)
    portfolios = service.list_portfolios(active_only=active_only)
    return {
        "success": True,
        "data": portfolios,
        "meta": {"timestamp": Meta().timestamp, "count": len(portfolios)},
        "error": None,
    }


@router.get("/portfolios/{portfolio_id}")
def get_portfolio(
    portfolio_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Get portfolio detail with holdings."""
    service = StrategyService(db)
    portfolio = service.get_portfolio(portfolio_id)
    return {
        "success": True,
        "data": portfolio,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }
