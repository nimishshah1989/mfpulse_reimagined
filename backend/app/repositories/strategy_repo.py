"""Strategy CRUD repository — definitions, backtests, portfolios, holdings."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.db.strategy import (
    StrategyBacktestRun,
    StrategyDefinition,
    StrategyLivePortfolio,
    StrategyPortfolioHolding,
)


class StrategyRepository:
    """All DB access for strategy definitions, backtests, portfolios, and holdings."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # --- Strategy Definition ---

    def create_strategy(self, data: dict) -> dict:
        """Create a new strategy definition."""
        strategy = StrategyDefinition(
            name=data["name"],
            description=data.get("description"),
            strategy_type=data.get("strategy_type", "MODEL_PORTFOLIO"),
            config=data.get("config", {}),
            created_by=data.get("created_by"),
            is_active=True,
        )
        self.db.add(strategy)
        self.db.flush()
        return self._strategy_to_dict(strategy)

    def get_strategy(self, strategy_id: str) -> dict | None:
        """Get a single strategy by ID."""
        sid = uuid.UUID(strategy_id) if isinstance(strategy_id, str) else strategy_id
        row = (
            self.db.query(StrategyDefinition)
            .filter(StrategyDefinition.id == sid)
            .first()
        )
        return self._strategy_to_dict(row) if row else None

    def list_strategies(self, active_only: bool = True) -> list[dict]:
        """List all strategies, optionally filtered to active only."""
        query = self.db.query(StrategyDefinition)
        if active_only:
            query = query.filter(StrategyDefinition.is_active.is_(True))
        rows = query.order_by(StrategyDefinition.name).all()
        return [self._strategy_to_dict(r) for r in rows]

    def update_strategy(self, strategy_id: str, data: dict) -> dict | None:
        """Update a strategy definition. Returns None if not found."""
        sid = uuid.UUID(strategy_id) if isinstance(strategy_id, str) else strategy_id
        row = (
            self.db.query(StrategyDefinition)
            .filter(StrategyDefinition.id == sid)
            .first()
        )
        if row is None:
            return None
        for key, value in data.items():
            if value is not None and hasattr(row, key):
                setattr(row, key, value)
        row.updated_at = datetime.now(timezone.utc)
        self.db.flush()
        return self._strategy_to_dict(row)

    def deactivate_strategy(self, strategy_id: str) -> bool:
        """Soft-delete a strategy. Returns True if found and deactivated."""
        sid = uuid.UUID(strategy_id) if isinstance(strategy_id, str) else strategy_id
        row = (
            self.db.query(StrategyDefinition)
            .filter(StrategyDefinition.id == sid)
            .first()
        )
        if row is None:
            return False
        row.is_active = False
        row.updated_at = datetime.now(timezone.utc)
        self.db.flush()
        return True

    # --- Backtest Runs ---

    def save_backtest_run(self, data: dict) -> dict:
        """Save a backtest run result."""
        run = StrategyBacktestRun(
            strategy_id=uuid.UUID(data["strategy_id"]) if isinstance(data["strategy_id"], str) else data["strategy_id"],
            run_date=data.get("run_date", datetime.now(timezone.utc)),
            params=data.get("params"),
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
            initial_investment=data.get("initial_investment"),
            mode=data.get("mode"),
            final_value=data.get("final_value"),
            cagr=data.get("cagr"),
            xirr=data.get("xirr"),
            max_drawdown=data.get("max_drawdown"),
            sharpe=data.get("sharpe"),
            benchmark_cagr=data.get("benchmark_cagr"),
            alpha_vs_benchmark=data.get("alpha_vs_benchmark"),
            monthly_returns=data.get("monthly_returns"),
            nav_series=data.get("nav_series"),
            simulation_hash=data.get("simulation_hash"),
            compute_time_ms=data.get("compute_time_ms"),
        )
        self.db.add(run)
        self.db.flush()
        return self._backtest_to_dict(run)

    def get_backtest_runs(self, strategy_id: str, limit: int = 10) -> list[dict]:
        """Get recent backtest runs for a strategy."""
        sid = uuid.UUID(strategy_id) if isinstance(strategy_id, str) else strategy_id
        rows = (
            self.db.query(StrategyBacktestRun)
            .filter(StrategyBacktestRun.strategy_id == sid)
            .order_by(StrategyBacktestRun.run_date.desc())
            .limit(limit)
            .all()
        )
        return [self._backtest_to_dict(r) for r in rows]

    # --- Live Portfolios ---

    def create_live_portfolio(self, data: dict) -> dict:
        """Create a live portfolio for a strategy."""
        portfolio = StrategyLivePortfolio(
            strategy_id=uuid.UUID(data["strategy_id"]) if isinstance(data["strategy_id"], str) else data["strategy_id"],
            name=data.get("name"),
            inception_date=data.get("inception_date"),
            current_nav=data.get("current_nav"),
            current_aum=data.get("current_aum"),
            is_active=True,
        )
        self.db.add(portfolio)
        self.db.flush()
        return self._portfolio_to_dict(portfolio)

    def get_live_portfolio(self, portfolio_id: str) -> dict | None:
        """Get a single live portfolio."""
        pid = uuid.UUID(portfolio_id) if isinstance(portfolio_id, str) else portfolio_id
        row = (
            self.db.query(StrategyLivePortfolio)
            .filter(StrategyLivePortfolio.id == pid)
            .first()
        )
        return self._portfolio_to_dict(row) if row else None

    def list_live_portfolios(self, active_only: bool = True) -> list[dict]:
        """List all live portfolios."""
        query = self.db.query(StrategyLivePortfolio)
        if active_only:
            query = query.filter(StrategyLivePortfolio.is_active.is_(True))
        rows = query.order_by(StrategyLivePortfolio.name).all()
        return [self._portfolio_to_dict(r) for r in rows]

    # --- Holdings ---

    def set_holdings(self, portfolio_id: str, holdings: list[dict]) -> int:
        """Replace all holdings for a portfolio. Returns count set."""
        pid = uuid.UUID(portfolio_id) if isinstance(portfolio_id, str) else portfolio_id
        # Delete existing
        self.db.query(StrategyPortfolioHolding).filter(
            StrategyPortfolioHolding.portfolio_id == pid,
        ).delete()
        # Insert new
        for h in holdings:
            holding = StrategyPortfolioHolding(
                portfolio_id=pid,
                mstar_id=h["mstar_id"],
                weight_pct=h.get("weight_pct"),
                units=h.get("units"),
                entry_date=h.get("entry_date"),
                entry_nav=h.get("entry_nav"),
            )
            self.db.add(holding)
        self.db.flush()
        return len(holdings)

    def get_holdings(self, portfolio_id: str) -> list[dict]:
        """Get all holdings for a portfolio."""
        pid = uuid.UUID(portfolio_id) if isinstance(portfolio_id, str) else portfolio_id
        rows = (
            self.db.query(StrategyPortfolioHolding)
            .filter(StrategyPortfolioHolding.portfolio_id == pid)
            .all()
        )
        return [self._holding_to_dict(r) for r in rows]

    # --- Private helpers ---

    @staticmethod
    def _strategy_to_dict(row: StrategyDefinition) -> dict:
        return {
            "id": str(row.id),
            "name": row.name,
            "description": row.description,
            "strategy_type": row.strategy_type,
            "config": row.config,
            "created_by": row.created_by,
            "is_active": row.is_active,
            "created_at": str(row.created_at) if row.created_at else None,
            "updated_at": str(row.updated_at) if row.updated_at else None,
        }

    @staticmethod
    def _backtest_to_dict(row: StrategyBacktestRun) -> dict:
        return {
            "id": str(row.id),
            "strategy_id": str(row.strategy_id),
            "run_date": str(row.run_date),
            "params": row.params,
            "start_date": str(row.start_date) if row.start_date else None,
            "end_date": str(row.end_date) if row.end_date else None,
            "initial_investment": row.initial_investment,
            "mode": row.mode,
            "final_value": row.final_value,
            "cagr": row.cagr,
            "xirr": row.xirr,
            "max_drawdown": row.max_drawdown,
            "sharpe": row.sharpe,
            "benchmark_cagr": row.benchmark_cagr,
            "alpha_vs_benchmark": row.alpha_vs_benchmark,
            "simulation_hash": row.simulation_hash,
            "compute_time_ms": row.compute_time_ms,
        }

    @staticmethod
    def _portfolio_to_dict(row: StrategyLivePortfolio) -> dict:
        return {
            "id": str(row.id),
            "strategy_id": str(row.strategy_id),
            "name": row.name,
            "inception_date": str(row.inception_date) if row.inception_date else None,
            "current_nav": row.current_nav,
            "current_aum": row.current_aum,
            "is_active": row.is_active,
            "last_rebalance_date": str(row.last_rebalance_date) if row.last_rebalance_date else None,
            "next_rebalance_due": str(row.next_rebalance_due) if row.next_rebalance_due else None,
            "created_at": str(row.created_at) if row.created_at else None,
        }

    @staticmethod
    def _holding_to_dict(row: StrategyPortfolioHolding) -> dict:
        return {
            "mstar_id": row.mstar_id,
            "weight_pct": row.weight_pct,
            "units": row.units,
            "entry_date": str(row.entry_date) if row.entry_date else None,
            "entry_nav": row.entry_nav,
        }
