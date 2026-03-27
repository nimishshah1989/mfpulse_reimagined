"""Tests for StrategyRepository — CRUD, backtests, portfolios, holdings."""

import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch, call

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.models.db.strategy import (
    StrategyBacktestRun,
    StrategyDefinition,
    StrategyLivePortfolio,
    StrategyPortfolioHolding,
)
from app.repositories.strategy_repo import StrategyRepository


def _make_strategy(**overrides) -> StrategyDefinition:
    defaults = {
        "id": uuid.uuid4(),
        "name": "Aggressive Growth",
        "description": "High-growth equity portfolio",
        "strategy_type": "MODEL_PORTFOLIO",
        "config": {"rebalance_freq": "quarterly"},
        "created_by": "nimish",
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    obj = StrategyDefinition()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _make_backtest(strategy_id: uuid.UUID, **overrides) -> StrategyBacktestRun:
    defaults = {
        "id": uuid.uuid4(),
        "strategy_id": strategy_id,
        "run_date": datetime.now(timezone.utc),
        "params": {"sip_amount": 10000},
        "start_date": date(2021, 1, 1),
        "end_date": date(2026, 1, 1),
        "initial_investment": Decimal("1000000"),
        "mode": "SIP",
        "final_value": Decimal("1550000"),
        "cagr": Decimal("9.2500"),
        "xirr": Decimal("10.1200"),
        "max_drawdown": Decimal("-15.3000"),
        "sharpe": Decimal("1.2500"),
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    obj = StrategyBacktestRun()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _make_portfolio(strategy_id: uuid.UUID, **overrides) -> StrategyLivePortfolio:
    defaults = {
        "id": uuid.uuid4(),
        "strategy_id": strategy_id,
        "name": "Aggressive Growth Live",
        "inception_date": date(2026, 1, 1),
        "current_nav": Decimal("105.5000"),
        "current_aum": Decimal("5000000"),
        "is_active": True,
        "last_rebalance_date": None,
        "next_rebalance_due": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    obj = StrategyLivePortfolio()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _make_holding(portfolio_id: uuid.UUID, **overrides) -> StrategyPortfolioHolding:
    defaults = {
        "id": uuid.uuid4(),
        "portfolio_id": portfolio_id,
        "mstar_id": "F0GBR06S2Q",
        "weight_pct": Decimal("25.0000"),
        "units": Decimal("100.0000"),
        "entry_date": date(2026, 1, 1),
        "entry_nav": Decimal("650.0000"),
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    obj = StrategyPortfolioHolding()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


class TestCreateStrategy:
    def test_creates_and_returns_dict(self) -> None:
        db = MagicMock()
        repo = StrategyRepository(db)
        data = {
            "name": "Conservative Income",
            "description": "Low-risk debt",
            "strategy_type": "MODEL_PORTFOLIO",
            "config": {},
            "created_by": "nimish",
        }
        result = repo.create_strategy(data)
        db.add.assert_called_once()
        db.flush.assert_called_once()
        assert result["name"] == "Conservative Income"
        assert result["is_active"] is True

    def test_strategy_with_config(self) -> None:
        db = MagicMock()
        repo = StrategyRepository(db)
        config = {"funds": ["F001", "F002"], "weights": [50, 50]}
        data = {"name": "Balanced", "config": config, "created_by": "nimish"}
        result = repo.create_strategy(data)
        assert result["config"] == config


class TestGetStrategy:
    def test_returns_dict_when_found(self) -> None:
        strategy = _make_strategy()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = strategy
        repo = StrategyRepository(db)
        result = repo.get_strategy(str(strategy.id))
        assert result is not None
        assert result["name"] == "Aggressive Growth"

    def test_returns_none_when_not_found(self) -> None:
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        repo = StrategyRepository(db)
        result = repo.get_strategy(str(uuid.uuid4()))
        assert result is None


class TestListStrategies:
    def test_active_only(self) -> None:
        s1 = _make_strategy(name="A")
        s2 = _make_strategy(name="B")
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [s1, s2]
        repo = StrategyRepository(db)
        result = repo.list_strategies(active_only=True)
        assert len(result) == 2

    def test_includes_inactive(self) -> None:
        s1 = _make_strategy(name="A")
        db = MagicMock()
        db.query.return_value.order_by.return_value.all.return_value = [s1]
        repo = StrategyRepository(db)
        result = repo.list_strategies(active_only=False)
        assert len(result) == 1


class TestUpdateStrategy:
    def test_updates_fields(self) -> None:
        strategy = _make_strategy()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = strategy
        repo = StrategyRepository(db)
        result = repo.update_strategy(str(strategy.id), {"name": "Updated Name"})
        assert result is not None
        assert result["name"] == "Updated Name"
        db.flush.assert_called_once()

    def test_returns_none_when_not_found(self) -> None:
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        repo = StrategyRepository(db)
        result = repo.update_strategy(str(uuid.uuid4()), {"name": "X"})
        assert result is None


class TestDeactivateStrategy:
    def test_deactivates_existing(self) -> None:
        strategy = _make_strategy()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = strategy
        repo = StrategyRepository(db)
        assert repo.deactivate_strategy(str(strategy.id)) is True
        assert strategy.is_active is False

    def test_returns_false_when_not_found(self) -> None:
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        repo = StrategyRepository(db)
        assert repo.deactivate_strategy(str(uuid.uuid4())) is False


class TestBacktestRuns:
    def test_save_backtest_run(self) -> None:
        sid = uuid.uuid4()
        db = MagicMock()
        repo = StrategyRepository(db)
        data = {
            "strategy_id": str(sid),
            "mode": "SIP",
            "initial_investment": Decimal("1000000"),
            "final_value": Decimal("1500000"),
            "cagr": Decimal("8.5"),
        }
        result = repo.save_backtest_run(data)
        db.add.assert_called_once()
        db.flush.assert_called_once()

    def test_get_backtest_runs(self) -> None:
        sid = uuid.uuid4()
        bt1 = _make_backtest(sid)
        bt2 = _make_backtest(sid)
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [bt1, bt2]
        repo = StrategyRepository(db)
        result = repo.get_backtest_runs(str(sid))
        assert len(result) == 2


class TestLivePortfolio:
    def test_create_live_portfolio(self) -> None:
        sid = uuid.uuid4()
        db = MagicMock()
        repo = StrategyRepository(db)
        data = {"strategy_id": str(sid), "name": "Test Portfolio"}
        result = repo.create_live_portfolio(data)
        db.add.assert_called_once()

    def test_get_live_portfolio_found(self) -> None:
        sid = uuid.uuid4()
        portfolio = _make_portfolio(sid)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = portfolio
        repo = StrategyRepository(db)
        result = repo.get_live_portfolio(str(portfolio.id))
        assert result is not None
        assert result["name"] == "Aggressive Growth Live"

    def test_get_live_portfolio_not_found(self) -> None:
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        repo = StrategyRepository(db)
        assert repo.get_live_portfolio(str(uuid.uuid4())) is None

    def test_list_live_portfolios(self) -> None:
        sid = uuid.uuid4()
        p1 = _make_portfolio(sid, name="A")
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [p1]
        repo = StrategyRepository(db)
        result = repo.list_live_portfolios()
        assert len(result) == 1


class TestHoldings:
    def test_set_holdings(self) -> None:
        pid = uuid.uuid4()
        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = 0
        repo = StrategyRepository(db)
        holdings = [
            {"mstar_id": "F001", "weight_pct": Decimal("50")},
            {"mstar_id": "F002", "weight_pct": Decimal("50")},
        ]
        count = repo.set_holdings(str(pid), holdings)
        assert count == 2
        assert db.add.call_count == 2

    def test_get_holdings(self) -> None:
        pid = uuid.uuid4()
        h1 = _make_holding(pid, mstar_id="F001")
        h2 = _make_holding(pid, mstar_id="F002")
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [h1, h2]
        repo = StrategyRepository(db)
        result = repo.get_holdings(str(pid))
        assert len(result) == 2
        assert result[0]["mstar_id"] == "F001"
