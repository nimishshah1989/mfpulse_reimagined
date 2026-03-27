"""Tests for StrategyService — CRUD orchestration with audit trail."""

import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.core.exceptions import NotFoundError
from app.services.strategy_service import StrategyService


def _mock_strategy(name: str = "Test Strategy") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": "Test description",
        "strategy_type": "MODEL_PORTFOLIO",
        "config": {},
        "created_by": "nimish",
        "is_active": True,
        "created_at": str(datetime.now(timezone.utc)),
        "updated_at": str(datetime.now(timezone.utc)),
    }


def _mock_backtest() -> dict:
    return {
        "id": str(uuid.uuid4()),
        "strategy_id": str(uuid.uuid4()),
        "run_date": str(datetime.now(timezone.utc)),
        "mode": "SIP",
        "initial_investment": Decimal("1000000"),
        "final_value": Decimal("1500000"),
        "cagr": Decimal("8.5"),
    }


class TestCreateStrategy:
    def test_creates_with_audit_trail(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        strategy = _mock_strategy()
        service.strategy_repo.create_strategy = MagicMock(return_value=strategy)
        service.audit_repo.log = MagicMock(return_value=uuid.uuid4())

        data = {"name": "Test", "created_by": "nimish", "config": {}}
        result = service.create_strategy(data)

        assert result["name"] == strategy["name"]
        service.audit_repo.log.assert_called_once()
        call_kwargs = service.audit_repo.log.call_args
        assert call_kwargs[1]["action"] == "STRATEGY_CREATE" or call_kwargs.kwargs["action"] == "STRATEGY_CREATE"
        db.commit.assert_called_once()


class TestGetStrategy:
    def test_returns_with_backtests(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        strategy = _mock_strategy()
        service.strategy_repo.get_strategy = MagicMock(return_value=strategy)
        service.strategy_repo.get_backtest_runs = MagicMock(return_value=[_mock_backtest()])

        result = service.get_strategy(strategy["id"])
        assert "backtests" in result
        assert len(result["backtests"]) == 1

    def test_raises_not_found(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        service.strategy_repo.get_strategy = MagicMock(return_value=None)

        with pytest.raises(NotFoundError):
            service.get_strategy(str(uuid.uuid4()))


class TestUpdateStrategy:
    def test_updates_with_audit(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        updated = _mock_strategy(name="Updated")
        service.strategy_repo.update_strategy = MagicMock(return_value=updated)
        service.audit_repo.log = MagicMock(return_value=uuid.uuid4())

        result = service.update_strategy(updated["id"], {"name": "Updated"})
        assert result["name"] == "Updated"
        service.audit_repo.log.assert_called_once()
        db.commit.assert_called_once()

    def test_raises_not_found(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        service.strategy_repo.update_strategy = MagicMock(return_value=None)

        with pytest.raises(NotFoundError):
            service.update_strategy(str(uuid.uuid4()), {"name": "X"})


class TestDeactivateStrategy:
    def test_deactivates_with_audit(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        service.strategy_repo.deactivate_strategy = MagicMock(return_value=True)
        service.audit_repo.log = MagicMock(return_value=uuid.uuid4())

        result = service.deactivate_strategy(str(uuid.uuid4()))
        assert result is True
        service.audit_repo.log.assert_called_once()

    def test_raises_not_found(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        service.strategy_repo.deactivate_strategy = MagicMock(return_value=False)

        with pytest.raises(NotFoundError):
            service.deactivate_strategy(str(uuid.uuid4()))


class TestRunBacktest:
    def test_saves_with_audit(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        strategy = _mock_strategy()
        backtest = _mock_backtest()
        service.strategy_repo.get_strategy = MagicMock(return_value=strategy)
        service.strategy_repo.save_backtest_run = MagicMock(return_value=backtest)
        service.audit_repo.log = MagicMock(return_value=uuid.uuid4())

        data = {"mode": "SIP", "initial_investment": Decimal("1000000")}
        result = service.run_backtest(strategy["id"], data)

        service.audit_repo.log.assert_called_once()
        call_kwargs = service.audit_repo.log.call_args
        assert "BACKTEST_RUN" in str(call_kwargs)
        db.commit.assert_called_once()

    def test_raises_not_found_for_missing_strategy(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        service.strategy_repo.get_strategy = MagicMock(return_value=None)

        with pytest.raises(NotFoundError):
            service.run_backtest(str(uuid.uuid4()), {})


class TestDeployPortfolio:
    def test_deploys_with_audit(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        strategy = _mock_strategy()
        portfolio = {
            "id": str(uuid.uuid4()),
            "strategy_id": strategy["id"],
            "name": "Live Portfolio",
        }
        service.strategy_repo.get_strategy = MagicMock(return_value=strategy)
        service.strategy_repo.create_live_portfolio = MagicMock(return_value=portfolio)
        service.audit_repo.log = MagicMock(return_value=uuid.uuid4())

        data = {"portfolio_name": "Live Portfolio"}
        result = service.deploy_portfolio(strategy["id"], data)

        assert result["name"] == "Live Portfolio"
        service.audit_repo.log.assert_called_once()
        db.commit.assert_called_once()


class TestGetPortfolio:
    def test_returns_with_holdings(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        portfolio = {"id": str(uuid.uuid4()), "name": "Test"}
        holdings = [{"mstar_id": "F001", "weight_pct": Decimal("50")}]
        service.strategy_repo.get_live_portfolio = MagicMock(return_value=portfolio)
        service.strategy_repo.get_holdings = MagicMock(return_value=holdings)

        result = service.get_portfolio(portfolio["id"])
        assert "holdings" in result
        assert len(result["holdings"]) == 1

    def test_raises_not_found(self) -> None:
        db = MagicMock()
        service = StrategyService(db)
        service.strategy_repo.get_live_portfolio = MagicMock(return_value=None)

        with pytest.raises(NotFoundError):
            service.get_portfolio(str(uuid.uuid4()))
