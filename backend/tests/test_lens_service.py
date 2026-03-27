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


class TestComputeAllCategoriesErrorHandling:
    def test_handles_category_error_gracefully(self) -> None:
        db = MagicMock()
        service = LensService(db)
        db.query.return_value.filter.return_value.distinct.return_value.all.return_value = [
            ("Large Cap",), ("Bad Category",),
        ]
        service.compute_single_category = MagicMock(side_effect=[
            {"category": "Large Cap", "funds_scored": 10},
            Exception("Data missing for Bad Category"),
        ])
        service.audit_repo.log = MagicMock()

        result = service.compute_all_categories()
        assert result["categories_processed"] == 2
        assert result["funds_scored"] == 10
        assert len(result["errors"]) == 1
        assert "Bad Category" in result["errors"][0]

    def test_empty_categories_list(self) -> None:
        db = MagicMock()
        service = LensService(db)
        db.query.return_value.filter.return_value.distinct.return_value.all.return_value = []
        service.audit_repo.log = MagicMock()

        result = service.compute_all_categories()
        assert result["categories_processed"] == 0
        assert result["funds_scored"] == 0
        assert result["errors"] == []


class TestLoadCategoryData:
    def test_empty_category_returns_empty_structure(self) -> None:
        db = MagicMock()
        service = LensService(db)
        db.query.return_value.filter.return_value.all.return_value = []

        result = service._load_category_data("Empty Category")
        assert result["fund_ids"] == []
        assert result["latest_returns"] == {}
        assert result["risk_stats"] == {}
        assert result["ranks"] == {}
        assert result["fund_master"] == {}
        assert result["calendar_year_returns"] == {}
        assert result["category_avg_returns"] == {}

    def test_loads_data_for_eligible_funds(self) -> None:
        db = MagicMock()
        service = LensService(db)

        fund1 = _mock_fund("F001")
        fund2 = _mock_fund("F002")

        # First query: FundMaster eligible funds
        fund_query = MagicMock()
        fund_query.filter.return_value = fund_query
        fund_query.all.return_value = [fund1, fund2]

        # Subsequent queries for NAV, risk, ranks, category
        nav_row = MagicMock()
        nav_row.mstar_id = "F001"
        nav_row.return_1y = Decimal("12")
        nav_row.return_3y = Decimal("15")
        nav_row.return_5y = Decimal("18")
        for i in range(1, 11):
            setattr(nav_row, f"calendar_year_return_{i}y", Decimal("10"))

        nav_query = MagicMock()
        nav_query.join.return_value = nav_query
        nav_query.all.return_value = [nav_row]

        risk_row = MagicMock()
        risk_row.mstar_id = "F001"
        risk_row.std_dev_3y = Decimal("10")
        risk_row.max_drawdown_3y = Decimal("-15")
        risk_row.beta_3y = Decimal("0.9")
        risk_row.capture_down_3y = Decimal("85")
        risk_row.capture_up_3y = Decimal("105")
        risk_row.sortino_3y = Decimal("1.5")
        risk_row.alpha_3y = Decimal("2")
        risk_row.alpha_5y = Decimal("1.8")
        risk_row.info_ratio_3y = Decimal("0.5")
        risk_row.info_ratio_5y = Decimal("0.4")

        risk_query = MagicMock()
        risk_query.join.return_value = risk_query
        risk_query.all.return_value = [risk_row]

        rank_row = MagicMock()
        rank_row.mstar_id = "F001"
        rank_row.quartile_1y = 1
        rank_row.quartile_3y = 1
        rank_row.quartile_5y = 2
        for i in range(1, 11):
            setattr(rank_row, f"cal_year_pctile_{i}y", 20)

        rank_query = MagicMock()
        rank_query.join.return_value = rank_query
        rank_query.all.return_value = [rank_row]

        cat_row = MagicMock()
        cat_row.cat_return_3y = Decimal("12")
        cat_row.cat_return_5y = Decimal("14")
        cat_query = MagicMock()
        cat_query.filter.return_value = cat_query
        cat_query.order_by.return_value = cat_query
        cat_query.first.return_value = cat_row

        # Chain the queries in order
        sub_queries = []
        for _ in range(3):
            sq = MagicMock()
            sq.filter.return_value = sq
            sq.group_by.return_value = sq
            sq.subquery.return_value = MagicMock()
            sub_queries.append(sq)

        # db.query called multiple times
        call_count = [0]
        query_returns = [fund_query, sub_queries[0], nav_query,
                         sub_queries[1], risk_query, sub_queries[2], rank_query, cat_query]

        def query_side_effect(*args, **kwargs):
            idx = call_count[0]
            call_count[0] += 1
            if idx < len(query_returns):
                return query_returns[idx]
            return MagicMock()

        db.query.side_effect = query_side_effect

        result = service._load_category_data("Large Cap")
        assert "F001" in result["fund_ids"]
        assert "F002" in result["fund_ids"]


class TestSaveResults:
    def test_saves_scores_and_classifications(self) -> None:
        db = MagicMock()
        service = LensService(db)
        service.lens_repo = MagicMock()

        results = [_make_lens_result("F001"), _make_lens_result("F002")]
        service._save_results(results, date(2026, 3, 1))

        service.lens_repo.upsert_lens_scores.assert_called_once()
        service.lens_repo.upsert_classifications.assert_called_once()

        score_records = service.lens_repo.upsert_lens_scores.call_args[0][0]
        assert len(score_records) == 2
        assert score_records[0]["mstar_id"] == "F001"
        assert score_records[0]["computed_date"] == date(2026, 3, 1)
        assert score_records[0]["return_score"] == Decimal("75")

        class_records = service.lens_repo.upsert_classifications.call_args[0][0]
        assert len(class_records) == 2
        assert class_records[0]["return_class"] == "LEADER"
        assert class_records[0]["headline_tag"] is not None

    def test_empty_results_calls_upsert_with_empty_lists(self) -> None:
        db = MagicMock()
        service = LensService(db)
        service.lens_repo = MagicMock()

        service._save_results([], date(2026, 3, 1))
        service.lens_repo.upsert_lens_scores.assert_called_once_with([])
        service.lens_repo.upsert_classifications.assert_called_once_with([])


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
