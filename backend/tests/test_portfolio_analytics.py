"""Tests for portfolio analytics service and API endpoint."""

from __future__ import annotations

import os
import uuid
from decimal import Decimal
from typing import Optional
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.services.portfolio_analytics_service import PortfolioAnalyticsService
from app.services.portfolio_computations import (
    cosine_similarity as _cosine_similarity,
    safe_decimal as _safe_decimal,
    compute_blended_sectors,
    compute_market_cap_split,
    compute_return_contributions,
    compute_risk_contributions,
    compute_weighted_lens,
    LENS_NAMES as _LENS_NAMES,
)


# --- Helpers ---

def _make_holdings(weights: list[str], mstar_ids: Optional[list[str]] = None) -> list[dict]:
    """Create mock holdings with given weights."""
    if mstar_ids is None:
        mstar_ids = [f"F{i:09d}" for i in range(len(weights))]
    return [
        {"mstar_id": mid, "weight_pct": Decimal(w), "units": None, "entry_date": None, "entry_nav": None}
        for mid, w in zip(mstar_ids, weights)
    ]


# --- Unit Tests: _safe_decimal ---

class TestSafeDecimal:
    def test_none_returns_zero(self) -> None:
        assert _safe_decimal(None) == Decimal("0")

    def test_string_number(self) -> None:
        assert _safe_decimal("12.34") == Decimal("12.34")

    def test_invalid_returns_zero(self) -> None:
        assert _safe_decimal("not_a_number") == Decimal("0")

    def test_int(self) -> None:
        assert _safe_decimal(42) == Decimal("42")


# --- Unit Tests: _cosine_similarity ---

class TestCosineSimilarity:
    def test_identical_vectors(self) -> None:
        vec = [Decimal("30"), Decimal("20"), Decimal("50")]
        sim = _cosine_similarity(vec, vec)
        assert sim == Decimal("1.0000")

    def test_orthogonal_vectors(self) -> None:
        a = [Decimal("1"), Decimal("0")]
        b = [Decimal("0"), Decimal("1")]
        sim = _cosine_similarity(a, b)
        assert sim == Decimal("0.0000")

    def test_empty_vectors(self) -> None:
        assert _cosine_similarity([], []) == Decimal("0")

    def test_zero_vectors(self) -> None:
        a = [Decimal("0"), Decimal("0")]
        b = [Decimal("1"), Decimal("2")]
        assert _cosine_similarity(a, b) == Decimal("0")

    def test_mismatched_lengths(self) -> None:
        a = [Decimal("1")]
        b = [Decimal("1"), Decimal("2")]
        assert _cosine_similarity(a, b) == Decimal("0")


# --- Unit Tests: Sector Blend ---

class TestSectorBlend:
    def test_weighted_average(self) -> None:
        """Two funds with 60/40 split, different sector exposures."""
        holdings = _make_holdings(["60", "40"], ["F1", "F2"])
        sector_exposures = {
            "F1": {"Financial Services": Decimal("30"), "Technology": Decimal("20")},
            "F2": {"Financial Services": Decimal("10"), "Healthcare": Decimal("40")},
        }

        result = compute_blended_sectors(holdings, sector_exposures)

        # Financial: (60*30 + 40*10) / 100 = 2200/100 = 22.00
        assert result["Financial Services"] == "22.00"
        # Technology: (60*20 + 40*0) / 100 = 1200/100 = 12.00
        assert result["Technology"] == "12.00"
        # Healthcare: (60*0 + 40*40) / 100 = 1600/100 = 16.00
        assert result["Healthcare"] == "16.00"

    def test_empty_holdings(self) -> None:
        result = compute_blended_sectors([], {})
        assert result == {}

    def test_zero_weight_holdings_ignored(self) -> None:
        holdings = _make_holdings(["0", "100"], ["F1", "F2"])
        sector_exposures = {
            "F1": {"Tech": Decimal("50")},
            "F2": {"Tech": Decimal("20")},
        }
        result = compute_blended_sectors(holdings, sector_exposures)
        assert result["Tech"] == "20.00"


# --- Unit Tests: Market Cap Split ---

class TestMarketCapSplit:
    def test_weighted_split(self) -> None:
        holdings = _make_holdings(["50", "50"], ["F1", "F2"])
        allocations = {
            "F1": {
                "equity_net": Decimal("95"), "bond_net": Decimal("5"),
                "india_large_cap_pct": Decimal("70"), "india_mid_cap_pct": Decimal("20"),
                "india_small_cap_pct": Decimal("10"),
            },
            "F2": {
                "equity_net": Decimal("90"), "bond_net": Decimal("10"),
                "india_large_cap_pct": Decimal("30"), "india_mid_cap_pct": Decimal("40"),
                "india_small_cap_pct": Decimal("30"),
            },
        }

        result = compute_market_cap_split(holdings, allocations)

        # Large: (50*70 + 50*30) / 100 = 50.00
        assert result["large_cap_pct"] == "50.00"
        # Mid: (50*20 + 50*40) / 100 = 30.00
        assert result["mid_cap_pct"] == "30.00"
        # Small: (50*10 + 50*30) / 100 = 20.00
        assert result["small_cap_pct"] == "20.00"

    def test_missing_allocation_data(self) -> None:
        holdings = _make_holdings(["100"], ["F1"])
        allocations: dict = {}  # No data at all
        result = compute_market_cap_split(holdings, allocations)
        assert result["large_cap_pct"] == "0"


# --- Unit Tests: Return Contribution ---

class TestReturnContribution:
    def test_contribution_sums_to_100(self) -> None:
        holdings = _make_holdings(["60", "40"], ["F1", "F2"])
        nav_data = {
            "F1": {"nav": Decimal("100"), "return_1y": Decimal("15"), "return_3y": Decimal("12")},
            "F2": {"nav": Decimal("50"), "return_1y": Decimal("10"), "return_3y": Decimal("8")},
        }

        result = compute_return_contributions(holdings, nav_data)

        total = sum(Decimal(r["contribution_pct"]) for r in result)
        assert total == Decimal("100.00")

    def test_zero_portfolio_return(self) -> None:
        holdings = _make_holdings(["50", "50"], ["F1", "F2"])
        nav_data = {
            "F1": {"nav": Decimal("100"), "return_1y": Decimal("0"), "return_3y": Decimal("0")},
            "F2": {"nav": Decimal("50"), "return_1y": Decimal("0"), "return_3y": Decimal("0")},
        }
        result = compute_return_contributions(holdings, nav_data)
        for r in result:
            assert r["contribution_pct"] == "0"


# --- Unit Tests: Weighted Lens ---

class TestWeightedLens:
    def test_weighted_lens_scores(self) -> None:
        holdings = _make_holdings(["70", "30"], ["F1", "F2"])
        lens_scores = {
            "F1": {name: Decimal("80") for name in _LENS_NAMES},
            "F2": {name: Decimal("40") for name in _LENS_NAMES},
        }

        result = compute_weighted_lens(holdings, lens_scores)

        # Each lens: (70*80 + 30*40) / 100 = 68.00
        for name in _LENS_NAMES:
            assert result[name] == "68.00"

    def test_missing_lens_data(self) -> None:
        holdings = _make_holdings(["100"], ["F1"])
        lens_scores: dict = {}
        result = compute_weighted_lens(holdings, lens_scores)
        for name in _LENS_NAMES:
            assert result[name] == "0"


# --- API Endpoint Tests ---

from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from app.main import app
    return TestClient(app)


class TestPortfolioAnalyticsEndpoint:
    @patch("app.api.v1.portfolio_analytics.PortfolioAnalyticsService")
    def test_returns_success_envelope(self, mock_cls: MagicMock, client: TestClient) -> None:
        portfolio_id = str(uuid.uuid4())
        mock_cls.return_value.get_analytics.return_value = {
            "portfolio": {"id": portfolio_id, "name": "Test"},
            "holdings": [],
            "blended_sectors": {},
            "market_cap_split": {"large_cap_pct": "0", "mid_cap_pct": "0", "small_cap_pct": "0"},
            "weighted_lens_scores": {name: "0" for name in _LENS_NAMES},
            "return_contributions": [],
            "risk_contributions": [],
            "risk_profile": {"portfolio": {}, "benchmark": {}},
            "similar_funds": [],
            "change_trail": [],
        }
        resp = client.get(f"/api/v1/strategies/portfolios/{portfolio_id}/analytics")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "data" in body
        assert "meta" in body
        assert body["error"] is None

    @patch("app.api.v1.portfolio_analytics.PortfolioAnalyticsService")
    def test_response_shape(self, mock_cls: MagicMock, client: TestClient) -> None:
        portfolio_id = str(uuid.uuid4())
        mock_cls.return_value.get_analytics.return_value = {
            "portfolio": {"id": portfolio_id},
            "holdings": [{"mstar_id": "F001"}],
            "blended_sectors": {"Tech": "25.00"},
            "market_cap_split": {"large_cap_pct": "60.00", "mid_cap_pct": "30.00", "small_cap_pct": "10.00"},
            "weighted_lens_scores": {name: "50.00" for name in _LENS_NAMES},
            "return_contributions": [{"mstar_id": "F001", "contribution_pct": "100.00"}],
            "risk_contributions": [{"mstar_id": "F001", "contribution_pct": "100.00"}],
            "risk_profile": {"portfolio": {"sharpe_3y": "1.20"}, "benchmark": {"cat_sharpe_3y": "0.90"}},
            "similar_funds": [{"mstar_id": "F999", "similarity": "0.9500"}],
            "change_trail": [],
        }
        resp = client.get(f"/api/v1/strategies/portfolios/{portfolio_id}/analytics")
        assert resp.status_code == 200
        data = resp.json()["data"]
        expected_keys = {
            "portfolio", "holdings", "blended_sectors", "market_cap_split",
            "weighted_lens_scores", "return_contributions", "risk_contributions",
            "risk_profile", "similar_funds", "change_trail",
        }
        assert set(data.keys()) == expected_keys
