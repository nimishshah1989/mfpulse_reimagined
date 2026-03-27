"""Tests for fund API endpoints — routes and response envelope."""

import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from fastapi.testclient import TestClient

from app.core.exceptions import NotFoundError, ValidationError
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# --- Helpers ---

def _fund_summary_dict(**overrides) -> dict:
    defaults = {
        "mstar_id": "F0GBR06S2Q",
        "fund_name": "HDFC Top 100",
        "legal_name": "HDFC Top 100 Fund",
        "amc_name": "HDFC AMC",
        "category_name": "Large Cap",
        "broad_category": "Equity",
        "inception_date": date(2000, 1, 1),
        "isin": "INF179K01AA0",
        "amfi_code": "100345",
        "purchase_mode": 1,
        "net_expense_ratio": Decimal("1.6200"),
        "latest_nav": Decimal("650.00"),
        "latest_nav_date": date(2026, 3, 27),
        "return_1y": Decimal("15.50"),
        "return_3y": Decimal("12.30"),
        "return_5y": Decimal("11.80"),
    }
    defaults.update(overrides)
    return defaults


def _fund_detail_dict(**overrides) -> dict:
    defaults = {
        "fund": _fund_summary_dict(),
        "indian_risk_level": "Moderate",
        "primary_benchmark": "Nifty 50",
        "investment_strategy": "Growth oriented",
        "managers": "John Doe",
        "returns": {"return_1y": Decimal("15.50")},
        "risk_stats": {"sharpe_3y": Decimal("1.25")},
        "ranks": {"quartile_1y": 1},
        "portfolio": {"num_holdings": 65},
        "top_holdings": [],
        "sector_exposure": [],
        "asset_allocation": None,
        "credit_quality": None,
        "category_avg_returns": None,
        "category_fund_count": 42,
    }
    defaults.update(overrides)
    return defaults


# --- Fund List ---

class TestListFunds:
    @patch("app.api.v1.funds.FundService")
    def test_get_funds_returns_paginated(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.list_funds.return_value = ([_fund_summary_dict()], 1)

        resp = client.get("/api/v1/funds")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["meta"]["count"] == 1
        assert len(body["data"]) == 1

    @patch("app.api.v1.funds.FundService")
    def test_get_funds_with_category_filter(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.list_funds.return_value = ([], 0)

        resp = client.get("/api/v1/funds?category=Large+Cap")

        assert resp.status_code == 200
        body = resp.json()
        assert body["meta"]["count"] == 0

    @patch("app.api.v1.funds.FundService")
    def test_get_funds_with_search(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.list_funds.return_value = ([_fund_summary_dict()], 1)

        resp = client.get("/api/v1/funds?search=HDFC")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True


# --- Fund Detail ---

class TestGetFundDetail:
    @patch("app.api.v1.funds.FundService")
    def test_get_fund_detail(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_fund_detail.return_value = _fund_detail_dict()

        resp = client.get("/api/v1/funds/F0GBR06S2Q")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["fund"]["mstar_id"] == "F0GBR06S2Q"

    @patch("app.api.v1.funds.FundService")
    def test_fund_not_found_returns_404(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_fund_detail.side_effect = NotFoundError(
            "Fund NONEXISTENT not found"
        )

        resp = client.get("/api/v1/funds/NONEXISTENT")

        assert resp.status_code == 404
        body = resp.json()
        assert body["success"] is False
        assert body["error"]["code"] == "NOT_FOUND"


# --- NAV History ---

class TestGetNavHistory:
    @patch("app.api.v1.funds.FundService")
    def test_nav_history_1y(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_nav_chart_data.return_value = [
            {"date": date(2026, 3, 27), "nav": Decimal("650.00"), "return_1d": Decimal("0.12")},
        ]

        resp = client.get("/api/v1/funds/F0GBR06S2Q/nav?period=1y")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1

    @patch("app.api.v1.funds.FundService")
    def test_invalid_period_returns_422(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_nav_chart_data.side_effect = ValidationError(
            "Invalid period 'invalid'",
            details={"period": "invalid"},
        )

        resp = client.get("/api/v1/funds/F0GBR06S2Q/nav?period=invalid")

        assert resp.status_code == 422
        body = resp.json()
        assert body["success"] is False
        assert body["error"]["code"] == "VALIDATION_ERROR"


# --- Holdings ---

class TestGetHoldings:
    @patch("app.api.v1.funds.FundService")
    def test_get_holdings(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_holdings.return_value = [
            {"holding_name": "HDFC Bank", "weighting_pct": Decimal("8.50")},
        ]

        resp = client.get("/api/v1/funds/F0GBR06S2Q/holdings")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True


# --- Sectors ---

class TestGetSectorExposure:
    @patch("app.api.v1.funds.FundService")
    def test_get_sectors(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_sector_exposure.return_value = [
            {"sector_name": "Technology", "net_pct": Decimal("28.50")},
        ]

        resp = client.get("/api/v1/funds/F0GBR06S2Q/sectors")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True


# --- Peers ---

class TestGetPeers:
    @patch("app.api.v1.funds.FundService")
    def test_get_peers(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_peer_comparison.return_value = {
            "fund_mstar_id": "F0GBR06S2Q",
            "category_name": "Large Cap",
            "peer_count": 42,
            "fund_return_1y": Decimal("15.50"),
            "category_avg_1y": Decimal("12.00"),
            "fund_percentile_1y": 85,
            "peers": [],
        }

        resp = client.get("/api/v1/funds/F0GBR06S2Q/peers")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["peer_count"] == 42


# --- Risk History ---

class TestGetRiskHistory:
    @patch("app.api.v1.funds.FundService")
    def test_get_risk_history(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_risk_history.return_value = [
            {"as_of_date": date(2026, 2, 28), "sharpe_3y": Decimal("1.25")},
        ]

        resp = client.get("/api/v1/funds/F0GBR06S2Q/risk")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True


# --- Categories ---

class TestCategories:
    @patch("app.api.v1.categories.FundService")
    def test_list_categories(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_categories_heatmap.return_value = [
            {"category_name": "Large Cap", "broad_category": "Equity", "fund_count": 42},
        ]

        resp = client.get("/api/v1/categories")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1

    @patch("app.api.v1.categories.FundService")
    def test_list_category_funds(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.list_category_funds.return_value = ([_fund_summary_dict()], 1)

        resp = client.get("/api/v1/categories/Large%20Cap/funds")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True

    @patch("app.api.v1.categories.FundService")
    def test_get_category_returns(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_category_returns.return_value = {
            "cat_return_3y": Decimal("12.50"),
        }

        resp = client.get("/api/v1/categories/Large%20Cap/returns")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True


# --- Holdings Overlap ---

class TestOverlap:
    @patch("app.api.v1.holdings.FundService")
    def test_compute_overlap(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_overlap_analysis.return_value = {
            "funds_analyzed": ["FUND_A", "FUND_B"],
            "overlap_matrix": {"FUND_A": {"FUND_B": 25.5}},
            "common_holdings": [{"isin": "INE040A01034", "name": "HDFC Bank"}],
            "effective_sector_allocation": [],
            "effective_market_cap": None,
        }

        resp = client.post(
            "/api/v1/holdings/overlap",
            json={"mstar_ids": ["FUND_A", "FUND_B"]},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]["funds_analyzed"]) == 2

    @patch("app.api.v1.holdings.FundService")
    def test_overlap_too_few_funds_returns_422(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_overlap_analysis.side_effect = ValidationError(
            "Overlap analysis requires at least 2 funds",
            details={"count": 1},
        )

        resp = client.post(
            "/api/v1/holdings/overlap",
            json={"mstar_ids": ["FUND_A"]},
        )

        assert resp.status_code == 422
        body = resp.json()
        assert body["success"] is False
        assert body["error"]["code"] == "VALIDATION_ERROR"

    @patch("app.api.v1.holdings.FundService")
    def test_overlap_too_many_funds_returns_422(self, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_overlap_analysis.side_effect = ValidationError(
            "Overlap analysis supports at most 5 funds",
            details={"count": 6},
        )

        resp = client.post(
            "/api/v1/holdings/overlap",
            json={"mstar_ids": ["A", "B", "C", "D", "E", "F"]},
        )

        assert resp.status_code == 422
        body = resp.json()
        assert body["success"] is False
        assert body["error"]["code"] == "VALIDATION_ERROR"
