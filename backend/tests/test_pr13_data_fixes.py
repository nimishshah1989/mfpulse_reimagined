"""Tests for PR-13 critical data fixes — purchase_mode mapping, dividend_type derivation, NAV synthesis."""

import os
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.services.fund_service import (
    FundService,
    PURCHASE_MODE_MAP,
    derive_dividend_type,
)


class TestPurchaseModeMapping:
    """purchase_mode must return string 'Regular'/'Direct', not integer 1/2."""

    def test_purchase_mode_1_maps_to_regular(self) -> None:
        assert PURCHASE_MODE_MAP[1] == "Regular"

    def test_purchase_mode_2_maps_to_direct(self) -> None:
        assert PURCHASE_MODE_MAP[2] == "Direct"

    def test_fund_summary_returns_string_purchase_mode(self) -> None:
        fund = MagicMock()
        fund.mstar_id = "F0GBR06S2Q"
        fund.fund_name = "HDFC Top 100 Fund - Regular Plan - Growth"
        fund.legal_name = "HDFC Top 100 Fund"
        fund.amc_name = "HDFC AMC"
        fund.category_name = "Large Cap"
        fund.broad_category = "Equity"
        fund.inception_date = date(2000, 1, 1)
        fund.isin = "INF179K01AA0"
        fund.amfi_code = "100345"
        fund.purchase_mode = 1
        fund.net_expense_ratio = Decimal("1.6200")

        summary = FundService._to_fund_summary(fund, None)
        assert summary["purchase_mode"] == "Regular"

    def test_fund_summary_direct_plan(self) -> None:
        fund = MagicMock()
        fund.mstar_id = "F0GBR06S2Q"
        fund.fund_name = "HDFC Top 100 Fund - Direct Plan - Growth"
        fund.legal_name = "HDFC Top 100 Fund"
        fund.amc_name = "HDFC AMC"
        fund.category_name = "Large Cap"
        fund.broad_category = "Equity"
        fund.inception_date = date(2000, 1, 1)
        fund.isin = "INF179K01AA0"
        fund.amfi_code = "100345"
        fund.purchase_mode = 2
        fund.net_expense_ratio = Decimal("1.6200")

        summary = FundService._to_fund_summary(fund, None)
        assert summary["purchase_mode"] == "Direct"

    def test_fund_summary_unknown_purchase_mode(self) -> None:
        fund = MagicMock()
        fund.mstar_id = "TEST"
        fund.fund_name = "Test Fund"
        fund.legal_name = "Test Fund"
        fund.amc_name = "Test AMC"
        fund.category_name = "Test Cat"
        fund.broad_category = "Equity"
        fund.inception_date = None
        fund.isin = None
        fund.amfi_code = None
        fund.purchase_mode = 99
        fund.net_expense_ratio = None

        summary = FundService._to_fund_summary(fund, None)
        assert summary["purchase_mode"] == "Unknown"


class TestDividendTypeDerivation:
    """dividend_type must be derived from fund_name — IDCW or Growth."""

    def test_growth_fund(self) -> None:
        assert derive_dividend_type("HDFC Top 100 Fund - Growth") == "Growth"

    def test_idcw_fund(self) -> None:
        assert derive_dividend_type("SBI Blue Chip - IDCW") == "IDCW"

    def test_dividend_fund(self) -> None:
        assert derive_dividend_type("SBI Blue Chip - Dividend") == "IDCW"

    def test_payout_fund(self) -> None:
        assert derive_dividend_type("ICICI Pru Value - IDCW Payout") == "IDCW"

    def test_reinvest_fund(self) -> None:
        assert derive_dividend_type("ICICI Pru Value - IDCW Reinvestment") == "IDCW"

    def test_no_keyword_defaults_to_growth(self) -> None:
        assert derive_dividend_type("HDFC Top 100 Fund") == "Growth"

    def test_empty_string(self) -> None:
        assert derive_dividend_type("") == "Growth"

    def test_fund_summary_includes_dividend_type(self) -> None:
        fund = MagicMock()
        fund.mstar_id = "TEST"
        fund.fund_name = "SBI Blue Chip Fund - IDCW"
        fund.legal_name = "SBI Blue Chip Fund"
        fund.amc_name = "SBI AMC"
        fund.category_name = "Large Cap"
        fund.broad_category = "Equity"
        fund.inception_date = None
        fund.isin = None
        fund.amfi_code = None
        fund.purchase_mode = 1
        fund.net_expense_ratio = None

        summary = FundService._to_fund_summary(fund, None)
        assert summary["dividend_type"] == "IDCW"


class TestNavSynthesis:
    """When nav is NULL, synthesize from daily returns."""

    def test_synthesize_nav_from_returns(self) -> None:
        db = MagicMock()
        service = FundService(db)
        service.fund_repo.get_nav_history = MagicMock(return_value=[
            {"nav_date": date(2026, 3, 25), "nav": None, "return_1d": Decimal("0.5")},
            {"nav_date": date(2026, 3, 26), "nav": None, "return_1d": Decimal("-0.2")},
            {"nav_date": date(2026, 3, 27), "nav": None, "return_1d": Decimal("0.3")},
        ])

        result = service.get_nav_chart_data("F0GBR06S2Q", period="1y")

        assert len(result) == 3
        # All nav values should be non-null strings
        for row in result:
            assert row["nav"] is not None

    def test_real_nav_not_synthesized(self) -> None:
        db = MagicMock()
        service = FundService(db)
        service.fund_repo.get_nav_history = MagicMock(return_value=[
            {"nav_date": date(2026, 3, 27), "nav": Decimal("650.00"), "return_1d": Decimal("0.12")},
        ])

        result = service.get_nav_chart_data("F0GBR06S2Q", period="1y")

        assert len(result) == 1
        assert result[0]["nav"] == Decimal("650.00")

    def test_synthesize_handles_null_return(self) -> None:
        db = MagicMock()
        service = FundService(db)
        service.fund_repo.get_nav_history = MagicMock(return_value=[
            {"nav_date": date(2026, 3, 25), "nav": None, "return_1d": None},
            {"nav_date": date(2026, 3, 26), "nav": None, "return_1d": Decimal("0.5")},
        ])

        result = service.get_nav_chart_data("F0GBR06S2Q", period="1y")

        assert len(result) == 2
        for row in result:
            assert row["nav"] is not None

    def test_empty_nav_history(self) -> None:
        db = MagicMock()
        service = FundService(db)
        service.fund_repo.get_nav_history = MagicMock(return_value=[])

        result = service.get_nav_chart_data("F0GBR06S2Q", period="1y")
        assert result == []


class TestPeerPurchaseModeMapping:
    """Peer comparison dicts must also have string purchase_mode."""

    def test_peer_comparison_uses_string_purchase_mode(self) -> None:
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
            {
                "mstar_id": "PEER1",
                "fund_name": "Peer Fund - Regular Plan - Growth",
                "return_1y": Decimal("12.00"),
                "purchase_mode": "Regular",
            },
        ])

        result = service.get_peer_comparison("F0GBR06S2Q")
        assert result["peers"][0]["purchase_mode"] == "Regular"
