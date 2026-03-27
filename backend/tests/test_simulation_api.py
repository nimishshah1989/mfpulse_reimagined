"""Tests for simulation API endpoints."""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from app.main import app
    return TestClient(app)


class TestGetDefaultRules:
    def test_returns_rules(self, client: TestClient) -> None:
        resp = client.get("/api/v1/simulate/rules/defaults")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) > 0
        rule = body["data"][0]
        assert "name" in rule
        assert "conditions" in rule
        assert "multiplier" in rule


class TestValidateRules:
    def test_valid_rules(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/simulate/validate-rules",
            json={
                "rules": [
                    {
                        "name": "test",
                        "conditions": [
                            {"signal_name": "breadth", "operator": "BELOW", "threshold": 30.0}
                        ],
                        "logic": "AND",
                        "multiplier": 1.0,
                        "cooloff_days": 30,
                    }
                ]
            },
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["valid"] is True

    def test_empty_conditions_fails(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/simulate/validate-rules",
            json={
                "rules": [
                    {
                        "name": "test",
                        "conditions": [],
                        "logic": "AND",
                        "multiplier": 1.0,
                        "cooloff_days": 30,
                    }
                ]
            },
        )
        assert resp.status_code == 422
        body = resp.json()
        assert body["success"] is False


class TestRunSimulation:
    @patch("app.api.v1.simulation.SimulationService")
    def test_post_simulate_returns_200(
        self, mock_service_cls: MagicMock, client: TestClient
    ) -> None:
        # Build a mock SimulationResult
        mock_result = MagicMock()
        mock_result.mode = "SIP"
        mock_result.total_invested = Decimal("120000")
        mock_result.final_value = Decimal("130000")
        mock_result.absolute_return_pct = Decimal("8.33")
        mock_result.xirr_pct = Decimal("12.5")
        mock_result.cagr_pct = Decimal("10.0")
        mock_result.max_drawdown_pct = Decimal("5.0")
        mock_result.sharpe_ratio = Decimal("1.5")
        mock_result.sortino_ratio = Decimal("2.0")
        mock_result.num_sips = 12
        mock_result.num_topups = 0
        mock_result.topup_invested = Decimal("0")
        mock_result.signal_hit_rate_3m = None
        mock_result.signal_hit_rate_6m = None
        mock_result.signal_hit_rate_12m = None
        mock_result.capital_efficiency = None
        mock_result.benchmark_cagr_pct = None
        mock_result.alpha_vs_benchmark = None
        mock_result.fund_name = "Test Fund"
        mock_result.mstar_id = "F001"
        mock_result.simulation_hash = "abc123"
        mock_result.compute_time_ms = 50
        mock_result.daily_timeline = []
        mock_result.cashflow_events = []
        mock_result.signal_events = []
        mock_result.rolling_1y_xirr = []
        mock_result.monthly_returns = []

        mock_service_cls.return_value.run_simulation.return_value = mock_result

        resp = client.post(
            "/api/v1/simulate",
            json={
                "mstar_id": "F001",
                "mode": "SIP",
                "sip_amount": "10000",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["summary"]["mode"] == "SIP"

    def test_invalid_mode_returns_422(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/simulate",
            json={
                "mstar_id": "F001",
                "mode": "INVALID",
                "sip_amount": "10000",
                "start_date": "2024-01-01",
            },
        )
        assert resp.status_code == 422

    @patch("app.api.v1.simulation.SimulationService")
    def test_not_found_returns_404(
        self, mock_service_cls: MagicMock, client: TestClient
    ) -> None:
        from app.core.exceptions import NotFoundError

        mock_service_cls.return_value.run_simulation.side_effect = NotFoundError(
            "No NAV data for fund BADID",
            details={"mstar_id": "BADID"},
        )
        resp = client.post(
            "/api/v1/simulate",
            json={
                "mstar_id": "BADID",
                "mode": "SIP",
                "sip_amount": "10000",
                "start_date": "2024-01-01",
            },
        )
        assert resp.status_code == 404
        assert resp.json()["success"] is False


class TestCompare:
    @patch("app.api.v1.simulation.SimulationService")
    def test_compare_returns_4_modes(
        self, mock_service_cls: MagicMock, client: TestClient
    ) -> None:
        mock_result = MagicMock()
        mock_result.mode = "SIP"
        mock_result.total_invested = Decimal("120000")
        mock_result.final_value = Decimal("130000")
        mock_result.absolute_return_pct = Decimal("8")
        mock_result.xirr_pct = Decimal("12")
        mock_result.cagr_pct = Decimal("10")
        mock_result.max_drawdown_pct = Decimal("5")
        mock_result.sharpe_ratio = None
        mock_result.sortino_ratio = None
        mock_result.num_sips = 12
        mock_result.num_topups = 0
        mock_result.topup_invested = Decimal("0")
        mock_result.signal_hit_rate_3m = None
        mock_result.signal_hit_rate_6m = None
        mock_result.signal_hit_rate_12m = None
        mock_result.capital_efficiency = None
        mock_result.benchmark_cagr_pct = None
        mock_result.alpha_vs_benchmark = None
        mock_result.fund_name = "Test"
        mock_result.mstar_id = "F001"
        mock_result.simulation_hash = "abc"
        mock_result.compute_time_ms = 10
        mock_result.daily_timeline = []
        mock_result.cashflow_events = []
        mock_result.signal_events = []
        mock_result.rolling_1y_xirr = []
        mock_result.monthly_returns = []

        mock_service_cls.return_value.compare_modes.return_value = {
            "pure_sip": mock_result,
            "sip_signal": mock_result,
            "lumpsum": mock_result,
            "hybrid": mock_result,
        }

        resp = client.post(
            "/api/v1/simulate/compare",
            json={
                "mstar_id": "F001",
                "sip_amount": "10000",
                "start_date": "2024-01-01",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "pure_sip" in body["data"]
        assert "sip_signal" in body["data"]
        assert "lumpsum" in body["data"]
        assert "hybrid" in body["data"]
