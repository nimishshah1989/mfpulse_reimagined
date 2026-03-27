"""Tests for FundService — business logic orchestration."""

import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.core.exceptions import NotFoundError, ValidationError
from app.services.fund_service import FundService


def _mock_fund_summary() -> dict:
    return {
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
    }


class TestListFunds:
    def test_returns_list_and_count(self) -> None:
        db = MagicMock()
        service = FundService(db)

        # Mock the fund_repo
        fund = MagicMock()
        fund.mstar_id = "F0GBR06S2Q"
        fund.fund_name = "HDFC Top 100"
        fund.legal_name = "HDFC Top 100 Fund"
        fund.amc_name = "HDFC AMC"
        fund.category_name = "Large Cap"
        fund.broad_category = "Equity"
        fund.inception_date = date(2000, 1, 1)
        fund.isin = "INF179K01AA0"
        fund.amfi_code = "100345"
        fund.purchase_mode = 1
        fund.net_expense_ratio = Decimal("1.6200")

        service.fund_repo.get_all_funds = MagicMock(return_value=([fund], 1))
        service.fund_repo.get_latest_navs_batch = MagicMock(return_value={
            "F0GBR06S2Q": {
                "nav": Decimal("650.00"),
                "nav_date": date(2026, 3, 27),
                "return_1y": Decimal("15.50"),
                "return_3y": Decimal("12.30"),
                "return_5y": Decimal("11.80"),
            },
        })

        funds, total = service.list_funds()

        assert total == 1
        assert len(funds) == 1
        assert funds[0]["mstar_id"] == "F0GBR06S2Q"
        assert funds[0]["latest_nav"] == Decimal("650.00")


class TestGetFundDetail:
    def test_assembles_all_data(self) -> None:
        db = MagicMock()
        service = FundService(db)

        fund = MagicMock()
        fund.mstar_id = "F0GBR06S2Q"
        fund.fund_name = "HDFC Top 100"
        fund.legal_name = "HDFC Top 100 Fund"
        fund.amc_name = "HDFC AMC"
        fund.category_name = "Large Cap"
        fund.broad_category = "Equity"
        fund.inception_date = date(2000, 1, 1)
        fund.isin = "INF179K01AA0"
        fund.amfi_code = "100345"
        fund.purchase_mode = 1
        fund.net_expense_ratio = Decimal("1.6200")
        fund.indian_risk_level = "Moderate"
        fund.primary_benchmark = "Nifty 50"
        fund.investment_strategy = "Growth oriented"
        fund.managers = "John Doe"

        service.fund_repo.get_fund_by_mstar_id = MagicMock(return_value=fund)
        service.fund_repo.get_latest_nav = MagicMock(return_value={
            "nav": Decimal("650.00"), "nav_date": date(2026, 3, 27),
            "return_1y": Decimal("15.50"), "return_3y": Decimal("12.30"),
            "return_5y": Decimal("11.80"),
        })
        service.fund_repo.get_trailing_returns = MagicMock(return_value={
            "return_1y": Decimal("15.50"),
        })
        service.fund_repo.get_latest_risk_stats = MagicMock(return_value={
            "sharpe_3y": Decimal("1.25"),
        })
        service.fund_repo.get_latest_ranks = MagicMock(return_value={
            "quartile_1y": 1,
        })
        service.fund_repo.get_category_peers = MagicMock(return_value=[])
        service.holdings_repo.get_latest_snapshot = MagicMock(return_value={
            "num_holdings": 65,
        })
        service.holdings_repo.get_top_holdings = MagicMock(return_value=[])
        service.holdings_repo.get_sector_exposure = MagicMock(return_value=[])
        service.holdings_repo.get_asset_allocation = MagicMock(return_value=None)
        service.holdings_repo.get_credit_quality = MagicMock(return_value=None)

        result = service.get_fund_detail("F0GBR06S2Q")

        assert result["fund"]["mstar_id"] == "F0GBR06S2Q"
        assert result["returns"] is not None
        assert result["risk_stats"] is not None
        assert result["ranks"] is not None

    def test_not_found_raises(self) -> None:
        db = MagicMock()
        service = FundService(db)
        service.fund_repo.get_fund_by_mstar_id = MagicMock(return_value=None)

        with pytest.raises(NotFoundError):
            service.get_fund_detail("NONEXISTENT")


class TestGetNavChartData:
    def test_period_1y(self) -> None:
        db = MagicMock()
        service = FundService(db)
        service.fund_repo.get_nav_history = MagicMock(return_value=[
            {"nav_date": date(2026, 3, 27), "nav": Decimal("650.00"), "return_1d": Decimal("0.12")},
        ])

        result = service.get_nav_chart_data("F0GBR06S2Q", period="1y")

        assert len(result) == 1
        assert result[0]["nav"] == Decimal("650.00")

    def test_invalid_period_raises(self) -> None:
        db = MagicMock()
        service = FundService(db)

        with pytest.raises(ValidationError, match="Invalid period"):
            service.get_nav_chart_data("F0GBR06S2Q", period="99y")


class TestGetCategoriesHeatmap:
    def test_returns_list(self) -> None:
        db = MagicMock()
        service = FundService(db)
        service.fund_repo.get_categories = MagicMock(return_value=[
            {"category_name": "Large Cap", "broad_category": "Equity", "fund_count": 42},
        ])

        result = service.get_categories_heatmap()

        assert len(result) == 1
        assert result[0]["category_name"] == "Large Cap"


class TestGetPeerComparison:
    def test_returns_comparison(self) -> None:
        db = MagicMock()
        service = FundService(db)

        fund = MagicMock()
        fund.mstar_id = "F0GBR06S2Q"
        fund.category_name = "Large Cap"

        service.fund_repo.get_fund_by_mstar_id = MagicMock(return_value=fund)
        service.fund_repo.get_trailing_returns = MagicMock(return_value={
            "return_1y": Decimal("15.50"),
        })
        service.fund_repo.get_category_peers = MagicMock(return_value=[
            {"mstar_id": "PEER1", "fund_name": "Peer Fund", "return_1y": Decimal("12.00")},
        ])

        result = service.get_peer_comparison("F0GBR06S2Q")

        assert result["fund_mstar_id"] == "F0GBR06S2Q"
        assert result["category_name"] == "Large Cap"
        assert result["peer_count"] >= 0

    def test_not_found_raises(self) -> None:
        db = MagicMock()
        service = FundService(db)
        service.fund_repo.get_fund_by_mstar_id = MagicMock(return_value=None)

        with pytest.raises(NotFoundError):
            service.get_peer_comparison("NONEXISTENT")


class TestGetOverlapAnalysis:
    def test_delegates_to_holdings_repo(self) -> None:
        db = MagicMock()
        service = FundService(db)
        service.holdings_repo.compute_overlap = MagicMock(return_value={
            "funds_analyzed": ["A", "B"],
            "overlap_matrix": {},
            "common_holdings": [],
            "effective_sector_allocation": [],
            "effective_market_cap": None,
        })

        result = service.get_overlap_analysis(["A", "B"])

        assert result["funds_analyzed"] == ["A", "B"]
        service.holdings_repo.compute_overlap.assert_called_once_with(["A", "B"])
