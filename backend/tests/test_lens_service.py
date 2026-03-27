"""Tests for the lens service — orchestration layer."""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.engines.lens_engine import LensResult
from app.services.lens_service import LensService


def _mock_fund(mstar_id: str, category_name: str = "Large Cap") -> MagicMock:
    fund = MagicMock()
    fund.mstar_id = mstar_id
    fund.category_name = category_name
    fund.is_eligible = True
    fund.net_expense_ratio = Decimal("1.5")
    fund.turnover_ratio = Decimal("30")
    return fund


def _make_lens_result(mstar_id: str, category: str = "Large Cap") -> LensResult:
    return LensResult(
        mstar_id=mstar_id,
        category_name=category,
        return_score=Decimal("75"),
        risk_score=Decimal("60"),
        consistency_score=Decimal("50"),
        alpha_score=Decimal("65"),
        efficiency_score=Decimal("80"),
        resilience_score=Decimal("55"),
        return_class="LEADER",
        risk_class="MODERATE",
        consistency_class="CONSISTENT",
        alpha_class="POSITIVE",
        efficiency_class="LEAN",
        resilience_class="STURDY",
        headline_tag="Strong returns with cost-efficient and moderate risk",
        data_completeness_pct=Decimal("100"),
        available_horizons=3,
    )


class TestComputeSingleCategory:
    def test_loads_data_produces_results_saves(self) -> None:
        db = MagicMock()
        service = LensService(db)

        # Mock _load_category_data
        service._load_category_data = MagicMock(return_value={
            "fund_ids": ["F001", "F002"],
            "latest_returns": {
                "F001": {"return_1y": Decimal("12"), "return_3y": Decimal("15"), "return_5y": Decimal("18")},
                "F002": {"return_1y": Decimal("8"), "return_3y": Decimal("10"), "return_5y": Decimal("12")},
            },
            "risk_stats": {
                "F001": {"std_dev_3y": Decimal("10"), "max_drawdown_3y": Decimal("-15"),
                         "beta_3y": Decimal("0.9"), "capture_down_3y": Decimal("85"),
                         "sortino_3y": Decimal("1.5"), "alpha_3y": Decimal("2"),
                         "alpha_5y": Decimal("1.8"), "info_ratio_3y": Decimal("0.5"),
                         "info_ratio_5y": Decimal("0.4"), "capture_up_3y": Decimal("105")},
                "F002": {"std_dev_3y": Decimal("15"), "max_drawdown_3y": Decimal("-25"),
                         "beta_3y": Decimal("1.1"), "capture_down_3y": Decimal("110"),
                         "sortino_3y": Decimal("0.8"), "alpha_3y": Decimal("-1"),
                         "alpha_5y": Decimal("-0.5"), "info_ratio_3y": Decimal("-0.2"),
                         "info_ratio_5y": Decimal("-0.1"), "capture_up_3y": Decimal("95")},
            },
            "ranks": {
                "F001": {"quartile_1y": 1, "quartile_3y": 1, "quartile_5y": 2,
                         "cal_year_pctile_1y": 20, "cal_year_pctile_2y": 25},
                "F002": {"quartile_1y": 3, "quartile_3y": 3, "quartile_5y": 4,
                         "cal_year_pctile_1y": 70, "cal_year_pctile_2y": 75},
            },
            "fund_master": {
                "F001": {"net_expense_ratio": Decimal("1.0"), "turnover_ratio": Decimal("30")},
                "F002": {"net_expense_ratio": Decimal("2.0"), "turnover_ratio": Decimal("60")},
            },
            "calendar_year_returns": {
                "F001": {"calendar_year_return_1y": Decimal("10"), "calendar_year_return_2y": Decimal("8")},
                "F002": {"calendar_year_return_1y": Decimal("-5"), "calendar_year_return_2y": Decimal("3")},
            },
            "category_avg_returns": {"return_3y": Decimal("12"), "return_5y": Decimal("14")},
        })

        # Mock _save_results
        service._save_results = MagicMock()
        service.audit_repo.log = MagicMock()

        result = service.compute_single_category("Large Cap")

        assert result["category"] == "Large Cap"
        assert result["funds_scored"] == 2
        service._save_results.assert_called_once()
        service.audit_repo.log.assert_called_once()

    def test_empty_category_handled(self) -> None:
        db = MagicMock()
        service = LensService(db)
        service._load_category_data = MagicMock(return_value={
            "fund_ids": [],
            "latest_returns": {},
            "risk_stats": {},
            "ranks": {},
            "fund_master": {},
            "calendar_year_returns": {},
            "category_avg_returns": {},
        })

        result = service.compute_single_category("Empty Category")
        assert result["funds_scored"] == 0


class TestComputeAllCategories:
    def test_processes_multiple_categories(self) -> None:
        db = MagicMock()
        service = LensService(db)

        # Mock distinct categories query
        db.query.return_value.filter.return_value.distinct.return_value.all.return_value = [
            ("Large Cap",), ("Mid Cap",),
        ]

        service.compute_single_category = MagicMock(side_effect=[
            {"category": "Large Cap", "funds_scored": 10},
            {"category": "Mid Cap", "funds_scored": 8},
        ])
        service.audit_repo.log = MagicMock()

        result = service.compute_all_categories()
        assert result["categories_processed"] == 2
        assert result["funds_scored"] == 18
        assert result["errors"] == []


class TestComputeSingleFund:
    def test_computes_for_one_fund_in_category(self) -> None:
        db = MagicMock()
        service = LensService(db)

        fund = _mock_fund("F001")
        db.query.return_value.filter.return_value.first.return_value = fund

        service._load_category_data = MagicMock(return_value={
            "fund_ids": ["F001"],
            "latest_returns": {
                "F001": {"return_1y": Decimal("12"), "return_3y": Decimal("15"), "return_5y": Decimal("18")},
            },
            "risk_stats": {
                "F001": {"std_dev_3y": Decimal("10"), "max_drawdown_3y": Decimal("-15"),
                         "beta_3y": Decimal("0.9"), "capture_down_3y": Decimal("85"),
                         "sortino_3y": Decimal("1.5"), "alpha_3y": Decimal("2"),
                         "alpha_5y": Decimal("1.8"), "info_ratio_3y": Decimal("0.5"),
                         "info_ratio_5y": Decimal("0.4"), "capture_up_3y": Decimal("105")},
            },
            "ranks": {
                "F001": {"quartile_1y": 1, "quartile_3y": 1, "quartile_5y": 2},
            },
            "fund_master": {
                "F001": {"net_expense_ratio": Decimal("1.0"), "turnover_ratio": Decimal("30")},
            },
            "calendar_year_returns": {
                "F001": {"calendar_year_return_1y": Decimal("10")},
            },
            "category_avg_returns": {"return_3y": Decimal("12"), "return_5y": Decimal("14")},
        })
        service._save_results = MagicMock()
        service.audit_repo.log = MagicMock()

        result = service.compute_single_fund("F001")
        assert result is not None
        assert result.mstar_id == "F001"

    def test_nonexistent_fund_returns_none(self) -> None:
        db = MagicMock()
        service = LensService(db)
        db.query.return_value.filter.return_value.first.return_value = None

        result = service.compute_single_fund("NONEXIST")
        assert result is None


class TestAuditTrail:
    def test_audit_entry_created_on_compute(self) -> None:
        db = MagicMock()
        service = LensService(db)
        service._load_category_data = MagicMock(return_value={
            "fund_ids": ["F001"],
            "latest_returns": {"F001": {"return_1y": Decimal("12")}},
            "risk_stats": {"F001": {}},
            "ranks": {"F001": {}},
            "fund_master": {"F001": {}},
            "calendar_year_returns": {"F001": {}},
            "category_avg_returns": {},
        })
        service._save_results = MagicMock()
        service.audit_repo.log = MagicMock()

        service.compute_single_category("Test Category")

        service.audit_repo.log.assert_called_once()
        call_kwargs = service.audit_repo.log.call_args
        assert call_kwargs[1]["action"] == "compute_category"
        assert call_kwargs[1]["entity_type"] == "lens_scores"


class TestSingleFundCategory:
    def test_single_fund_category_gets_score_50(self) -> None:
        """Category with only 1 fund → fund gets score 50 for all lenses."""
        db = MagicMock()
        service = LensService(db)

        fund = _mock_fund("F001")
        db.query.return_value.filter.return_value.first.return_value = fund

        service._load_category_data = MagicMock(return_value={
            "fund_ids": ["F001"],
            "latest_returns": {
                "F001": {"return_1y": Decimal("12"), "return_3y": Decimal("15"), "return_5y": Decimal("18")},
            },
            "risk_stats": {
                "F001": {"std_dev_3y": Decimal("10"), "max_drawdown_3y": Decimal("-15"),
                         "beta_3y": Decimal("0.9"), "capture_down_3y": Decimal("85"),
                         "sortino_3y": Decimal("1.5"), "alpha_3y": Decimal("2"),
                         "alpha_5y": Decimal("1.8"), "info_ratio_3y": Decimal("0.5"),
                         "info_ratio_5y": Decimal("0.4"), "capture_up_3y": Decimal("105")},
            },
            "ranks": {
                "F001": {"quartile_1y": 1, "quartile_3y": 1, "quartile_5y": 2,
                         "cal_year_pctile_1y": 20},
            },
            "fund_master": {
                "F001": {"net_expense_ratio": Decimal("1.0"), "turnover_ratio": Decimal("30")},
            },
            "calendar_year_returns": {
                "F001": {"calendar_year_return_1y": Decimal("10")},
            },
            "category_avg_returns": {"return_3y": Decimal("12"), "return_5y": Decimal("14")},
        })
        service._save_results = MagicMock()
        service.audit_repo.log = MagicMock()

        result = service.compute_single_fund("F001")
        assert result is not None
        # Single fund → percentile 50 for directly ranked metrics
        assert result.return_score == Decimal("50")
