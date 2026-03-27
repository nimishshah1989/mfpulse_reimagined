"""Strategy service — CRUD orchestration with audit trail."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.repositories.audit_repo import AuditRepository
from app.repositories.strategy_repo import StrategyRepository


class StrategyService:
    """Orchestrates strategy CRUD, backtests, and portfolio deployment."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.strategy_repo = StrategyRepository(db)
        self.audit_repo = AuditRepository(db)

    def create_strategy(self, data: dict) -> dict:
        """Create strategy + audit trail."""
        strategy = self.strategy_repo.create_strategy(data)
        self.audit_repo.log(
            actor=data.get("created_by", "system"),
            action="STRATEGY_CREATE",
            entity_type="strategy",
            entity_id=strategy["id"],
            details={"name": strategy["name"], "strategy_type": strategy.get("strategy_type")},
        )
        self.db.commit()
        return strategy

    def get_strategy(self, strategy_id: str) -> dict:
        """Get strategy detail, including recent backtests."""
        strategy = self.strategy_repo.get_strategy(strategy_id)
        if strategy is None:
            raise NotFoundError(
                f"Strategy {strategy_id} not found",
                details={"strategy_id": strategy_id},
            )
        strategy["backtests"] = self.strategy_repo.get_backtest_runs(strategy_id, limit=5)
        return strategy

    def list_strategies(self, active_only: bool = True) -> list[dict]:
        """List all strategies."""
        return self.strategy_repo.list_strategies(active_only=active_only)

    def update_strategy(self, strategy_id: str, data: dict) -> dict:
        """Update strategy + audit trail."""
        result = self.strategy_repo.update_strategy(strategy_id, data)
        if result is None:
            raise NotFoundError(
                f"Strategy {strategy_id} not found",
                details={"strategy_id": strategy_id},
            )
        self.audit_repo.log(
            actor="system",
            action="STRATEGY_UPDATE",
            entity_type="strategy",
            entity_id=strategy_id,
            details={"updated_fields": list(data.keys())},
        )
        self.db.commit()
        return result

    def deactivate_strategy(self, strategy_id: str) -> bool:
        """Deactivate strategy + audit trail."""
        success = self.strategy_repo.deactivate_strategy(strategy_id)
        if not success:
            raise NotFoundError(
                f"Strategy {strategy_id} not found",
                details={"strategy_id": strategy_id},
            )
        self.audit_repo.log(
            actor="system",
            action="STRATEGY_DEACTIVATE",
            entity_type="strategy",
            entity_id=strategy_id,
        )
        self.db.commit()
        return True

    def run_backtest(self, strategy_id: str, data: dict) -> dict:
        """Save a backtest run result + audit trail."""
        # Verify strategy exists
        strategy = self.strategy_repo.get_strategy(strategy_id)
        if strategy is None:
            raise NotFoundError(
                f"Strategy {strategy_id} not found",
                details={"strategy_id": strategy_id},
            )
        data["strategy_id"] = strategy_id
        data["run_date"] = datetime.now(timezone.utc)
        result = self.strategy_repo.save_backtest_run(data)
        self.audit_repo.log(
            actor="system",
            action="BACKTEST_RUN",
            entity_type="backtest",
            entity_id=result["id"],
            details={"strategy_id": strategy_id, "mode": data.get("mode")},
        )
        self.db.commit()
        return result

    def get_backtests(self, strategy_id: str, limit: int = 10) -> list[dict]:
        """Get recent backtests for a strategy."""
        return self.strategy_repo.get_backtest_runs(strategy_id, limit=limit)

    def deploy_portfolio(self, strategy_id: str, data: dict) -> dict:
        """Deploy a strategy as a live portfolio + audit trail."""
        strategy = self.strategy_repo.get_strategy(strategy_id)
        if strategy is None:
            raise NotFoundError(
                f"Strategy {strategy_id} not found",
                details={"strategy_id": strategy_id},
            )
        portfolio_data = {
            "strategy_id": strategy_id,
            "name": data.get("portfolio_name"),
            "inception_date": data.get("inception_date"),
            "current_aum": data.get("initial_aum"),
        }
        portfolio = self.strategy_repo.create_live_portfolio(portfolio_data)

        # Set initial holdings if provided
        holdings = data.get("holdings", [])
        if holdings:
            holding_dicts = [
                {"mstar_id": h.mstar_id, "weight_pct": h.weight_pct}
                if hasattr(h, "mstar_id")
                else h
                for h in holdings
            ]
            self.strategy_repo.set_holdings(portfolio["id"], holding_dicts)
            portfolio["holdings"] = self.strategy_repo.get_holdings(portfolio["id"])

        self.audit_repo.log(
            actor="system",
            action="PORTFOLIO_DEPLOY",
            entity_type="portfolio",
            entity_id=portfolio["id"],
            details={"strategy_id": strategy_id, "name": data.get("portfolio_name")},
        )
        self.db.commit()
        return portfolio

    def list_portfolios(self, active_only: bool = True) -> list[dict]:
        """List all live portfolios."""
        return self.strategy_repo.list_live_portfolios(active_only=active_only)

    def get_portfolio(self, portfolio_id: str) -> dict:
        """Get portfolio detail with holdings."""
        portfolio = self.strategy_repo.get_live_portfolio(portfolio_id)
        if portfolio is None:
            raise NotFoundError(
                f"Portfolio {portfolio_id} not found",
                details={"portfolio_id": portfolio_id},
            )
        portfolio["holdings"] = self.strategy_repo.get_holdings(portfolio_id)
        return portfolio
