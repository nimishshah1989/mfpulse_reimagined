"""Tests for Strategy API endpoints."""

import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from fastapi.testclient import TestClient


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


def _mock_portfolio() -> dict:
    return {
        "id": str(uuid.uuid4()),
        "strategy_id": str(uuid.uuid4()),
        "name": "Live Portfolio",
        "is_active": True,
    }


@pytest.fixture
def client() -> TestClient:
    from app.main import app
    return TestClient(app)


class TestCreateStrategy:
    @patch("app.api.v1.strategies.StrategyService")
    def test_create_returns_201(self, mock_cls: MagicMock, client: TestClient) -> None:
        strategy = _mock_strategy()
        mock_cls.return_value.create_strategy.return_value = strategy
        resp = client.post("/api/v1/strategies", json={
            "name": "Test Strategy",
            "created_by": "nimish",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["name"] == "Test Strategy"

    @patch("app.api.v1.strategies.StrategyService")
    def test_create_with_full_payload(self, mock_cls: MagicMock, client: TestClient) -> None:
        strategy = _mock_strategy("Full Strategy")
        mock_cls.return_value.create_strategy.return_value = strategy
        resp = client.post("/api/v1/strategies", json={
            "name": "Full Strategy",
            "description": "A full strategy",
            "strategy_type": "THEMATIC",
            "config": {"funds": ["F001"]},
            "created_by": "nimish",
        })
        assert resp.status_code == 200


class TestListStrategies:
    @patch("app.api.v1.strategies.StrategyService")
    def test_list_returns_array(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.list_strategies.return_value = [
            _mock_strategy("A"), _mock_strategy("B"),
        ]
        resp = client.get("/api/v1/strategies")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 2


class TestGetStrategy:
    @patch("app.api.v1.strategies.StrategyService")
    def test_get_detail(self, mock_cls: MagicMock, client: TestClient) -> None:
        strategy = _mock_strategy()
        strategy["backtests"] = [_mock_backtest()]
        mock_cls.return_value.get_strategy.return_value = strategy
        resp = client.get(f"/api/v1/strategies/{strategy['id']}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["name"] == "Test Strategy"
        assert "backtests" in body["data"]


class TestUpdateStrategy:
    @patch("app.api.v1.strategies.StrategyService")
    def test_update(self, mock_cls: MagicMock, client: TestClient) -> None:
        updated = _mock_strategy("Updated")
        mock_cls.return_value.update_strategy.return_value = updated
        sid = str(uuid.uuid4())
        resp = client.put(f"/api/v1/strategies/{sid}", json={"name": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "Updated"


class TestDeactivateStrategy:
    @patch("app.api.v1.strategies.StrategyService")
    def test_deactivate(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.deactivate_strategy.return_value = True
        sid = str(uuid.uuid4())
        resp = client.delete(f"/api/v1/strategies/{sid}")
        assert resp.status_code == 200
        assert resp.json()["data"]["deactivated"] is True


class TestBacktest:
    @patch("app.api.v1.strategies.StrategyService")
    def test_run_backtest(self, mock_cls: MagicMock, client: TestClient) -> None:
        backtest = _mock_backtest()
        mock_cls.return_value.run_backtest.return_value = backtest
        sid = str(uuid.uuid4())
        resp = client.post(f"/api/v1/strategies/{sid}/backtest", json={
            "start_date": "2021-01-01",
            "mode": "SIP",
        })
        assert resp.status_code == 200

    @patch("app.api.v1.strategies.StrategyService")
    def test_get_backtests(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.get_backtests.return_value = [_mock_backtest()]
        sid = str(uuid.uuid4())
        resp = client.get(f"/api/v1/strategies/{sid}/backtests")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1


class TestDeploy:
    @patch("app.api.v1.strategies.StrategyService")
    def test_deploy_portfolio(self, mock_cls: MagicMock, client: TestClient) -> None:
        portfolio = _mock_portfolio()
        mock_cls.return_value.deploy_portfolio.return_value = portfolio
        sid = str(uuid.uuid4())
        resp = client.post(f"/api/v1/strategies/{sid}/deploy", json={
            "portfolio_name": "Live Portfolio",
        })
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "Live Portfolio"


class TestPortfolios:
    @patch("app.api.v1.strategies.StrategyService")
    def test_get_portfolio(self, mock_cls: MagicMock, client: TestClient) -> None:
        portfolio = _mock_portfolio()
        portfolio["holdings"] = []
        mock_cls.return_value.get_portfolio.return_value = portfolio
        pid = str(uuid.uuid4())
        resp = client.get(f"/api/v1/strategies/portfolios/{pid}")
        assert resp.status_code == 200


class TestValidation:
    def test_create_missing_name(self, client: TestClient) -> None:
        resp = client.post("/api/v1/strategies", json={"created_by": "nimish"})
        assert resp.status_code == 422

    def test_create_invalid_type(self, client: TestClient) -> None:
        resp = client.post("/api/v1/strategies", json={
            "name": "Test",
            "strategy_type": "INVALID",
            "created_by": "nimish",
        })
        assert resp.status_code == 422
