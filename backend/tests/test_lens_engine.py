"""Tests for the six-lens classification engine — pure computation, no DB."""

from decimal import Decimal
from typing import Optional

import pytest

from app.engines.lens_engine import (
    ENGINE_VERSION,
    TIER_LABELS,
    TIER_THRESHOLDS,
    LensEngine,
    LensResult,
)


@pytest.fixture
def engine() -> LensEngine:
    return LensEngine()


# ---------------------------------------------------------------------------
# Helpers — build fake data dicts that mirror repo output
# ---------------------------------------------------------------------------

def _returns(
    return_1y: Optional[Decimal] = None,
    return_3y: Optional[Decimal] = None,
    return_5y: Optional[Decimal] = None,
) -> dict:
    return {"return_1y": return_1y, "return_3y": return_3y, "return_5y": return_5y}


def _risk(
    std_dev_3y: Optional[Decimal] = None,
    max_drawdown_3y: Optional[Decimal] = None,
    beta_3y: Optional[Decimal] = None,
    capture_down_3y: Optional[Decimal] = None,
    sortino_3y: Optional[Decimal] = None,
    alpha_3y: Optional[Decimal] = None,
    alpha_5y: Optional[Decimal] = None,
    info_ratio_3y: Optional[Decimal] = None,
    info_ratio_5y: Optional[Decimal] = None,
    capture_up_3y: Optional[Decimal] = None,
) -> dict:
    return {
        "std_dev_3y": std_dev_3y,
        "max_drawdown_3y": max_drawdown_3y,
        "beta_3y": beta_3y,
        "capture_down_3y": capture_down_3y,
        "sortino_3y": sortino_3y,
        "alpha_3y": alpha_3y,
        "alpha_5y": alpha_5y,
        "info_ratio_3y": info_ratio_3y,
        "info_ratio_5y": info_ratio_5y,
        "capture_up_3y": capture_up_3y,
    }


def _ranks(
    quartile_1y: Optional[int] = None,
    quartile_3y: Optional[int] = None,
    quartile_5y: Optional[int] = None,
    cal_year_pctile_1y: Optional[int] = None,
    cal_year_pctile_2y: Optional[int] = None,
    cal_year_pctile_3y: Optional[int] = None,
    cal_year_pctile_4y: Optional[int] = None,
    cal_year_pctile_5y: Optional[int] = None,
    cal_year_pctile_6y: Optional[int] = None,
    cal_year_pctile_7y: Optional[int] = None,
    cal_year_pctile_8y: Optional[int] = None,
    cal_year_pctile_9y: Optional[int] = None,
    cal_year_pctile_10y: Optional[int] = None,
) -> dict:
    return {
        "quartile_1y": quartile_1y,
        "quartile_3y": quartile_3y,
        "quartile_5y": quartile_5y,
        "cal_year_pctile_1y": cal_year_pctile_1y,
        "cal_year_pctile_2y": cal_year_pctile_2y,
        "cal_year_pctile_3y": cal_year_pctile_3y,
        "cal_year_pctile_4y": cal_year_pctile_4y,
        "cal_year_pctile_5y": cal_year_pctile_5y,
        "cal_year_pctile_6y": cal_year_pctile_6y,
        "cal_year_pctile_7y": cal_year_pctile_7y,
        "cal_year_pctile_8y": cal_year_pctile_8y,
        "cal_year_pctile_9y": cal_year_pctile_9y,
        "cal_year_pctile_10y": cal_year_pctile_10y,
    }


def _master(
    net_expense_ratio: Optional[Decimal] = None,
    turnover_ratio: Optional[Decimal] = None,
) -> dict:
    return {
        "net_expense_ratio": net_expense_ratio,
        "turnover_ratio": turnover_ratio,
    }


def _cal_year(
    calendar_year_return_1y: Optional[Decimal] = None,
    calendar_year_return_2y: Optional[Decimal] = None,
    calendar_year_return_3y: Optional[Decimal] = None,
    calendar_year_return_4y: Optional[Decimal] = None,
    calendar_year_return_5y: Optional[Decimal] = None,
    calendar_year_return_6y: Optional[Decimal] = None,
    calendar_year_return_7y: Optional[Decimal] = None,
    calendar_year_return_8y: Optional[Decimal] = None,
    calendar_year_return_9y: Optional[Decimal] = None,
    calendar_year_return_10y: Optional[Decimal] = None,
) -> dict:
    return {
        "calendar_year_return_1y": calendar_year_return_1y,
        "calendar_year_return_2y": calendar_year_return_2y,
        "calendar_year_return_3y": calendar_year_return_3y,
        "calendar_year_return_4y": calendar_year_return_4y,
        "calendar_year_return_5y": calendar_year_return_5y,
        "calendar_year_return_6y": calendar_year_return_6y,
        "calendar_year_return_7y": calendar_year_return_7y,
        "calendar_year_return_8y": calendar_year_return_8y,
        "calendar_year_return_9y": calendar_year_return_9y,
        "calendar_year_return_10y": calendar_year_return_10y,
    }


# ===========================================================================
# Percentile Ranking
# ===========================================================================

class TestPercentileRank:
    """Tests for _percentile_rank utility."""

    def test_five_funds_correct_percentiles(self, engine: LensEngine) -> None:
        values = {
            "A": Decimal("10"),
            "B": Decimal("20"),
            "C": Decimal("30"),
            "D": Decimal("40"),
            "E": Decimal("50"),
        }
        result = engine._percentile_rank(values, higher_is_better=True)
        # E=50 is best → 100, D=40 → 75, C=30 → 50, B=20 → 25, A=10 → 0
        assert result["E"] == Decimal("100")
        assert result["D"] == Decimal("75")
        assert result["C"] == Decimal("50")
        assert result["B"] == Decimal("25")
        assert result["A"] == Decimal("0")

    def test_tied_values_same_percentile(self, engine: LensEngine) -> None:
        values = {"A": Decimal("10"), "B": Decimal("10"), "C": Decimal("20")}
        result = engine._percentile_rank(values, higher_is_better=True)
        assert result["A"] == result["B"]

    def test_single_fund_gets_50(self, engine: LensEngine) -> None:
        values = {"A": Decimal("15")}
        result = engine._percentile_rank(values, higher_is_better=True)
        assert result["A"] == Decimal("50")

    def test_all_none_returns_all_none(self, engine: LensEngine) -> None:
        values = {"A": None, "B": None}
        result = engine._percentile_rank(values, higher_is_better=True)
        assert result["A"] is None
        assert result["B"] is None

    def test_mix_of_none_and_real(self, engine: LensEngine) -> None:
        values = {"A": Decimal("10"), "B": None, "C": Decimal("20")}
        result = engine._percentile_rank(values, higher_is_better=True)
        assert result["B"] is None
        assert result["C"] == Decimal("100")
        assert result["A"] == Decimal("0")

    def test_lower_is_better_inverts(self, engine: LensEngine) -> None:
        values = {"A": Decimal("10"), "B": Decimal("50")}
        result = engine._percentile_rank(values, higher_is_better=False)
        # Lower value A should get higher percentile
        assert result["A"] == Decimal("100")
        assert result["B"] == Decimal("0")


# ===========================================================================
# Return Lens
# ===========================================================================

class TestReturnLens:
    """Tests for the Return lens computation."""

    def test_full_horizons_weighted_correctly(self, engine: LensEngine) -> None:
        """Fund with 1Y/3Y/5Y → weighted 20/35/45."""
        fund_ids = ["A", "B"]
        returns = {
            "A": _returns(Decimal("10"), Decimal("15"), Decimal("20")),
            "B": _returns(Decimal("5"), Decimal("8"), Decimal("12")),
        }
        result = engine._compute_return_lens(fund_ids, returns)
        # A has higher weighted return → higher score
        assert result["A"] is not None
        assert result["B"] is not None
        assert result["A"] > result["B"]

    def test_young_fund_only_1y(self, engine: LensEngine) -> None:
        """Fund with only 1Y → weight redistributed, score still computed."""
        fund_ids = ["A", "B"]
        returns = {
            "A": _returns(Decimal("10"), None, None),
            "B": _returns(Decimal("5"), None, None),
        }
        result = engine._compute_return_lens(fund_ids, returns)
        assert result["A"] is not None
        assert result["B"] is not None
        assert result["A"] > result["B"]

    def test_no_return_data_gives_none(self, engine: LensEngine) -> None:
        fund_ids = ["A", "B"]
        returns = {
            "A": _returns(None, None, None),
            "B": _returns(Decimal("10"), Decimal("15"), Decimal("20")),
        }
        result = engine._compute_return_lens(fund_ids, returns)
        assert result["A"] is None
        assert result["B"] is not None

    def test_category_of_ten_top_bottom(self, engine: LensEngine) -> None:
        """10 funds → top ≈ 100, bottom ≈ 0."""
        fund_ids = [f"F{i}" for i in range(10)]
        returns = {
            f"F{i}": _returns(
                Decimal(str(i * 5)),
                Decimal(str(i * 8)),
                Decimal(str(i * 10)),
            )
            for i in range(10)
        }
        result = engine._compute_return_lens(fund_ids, returns)
        scores = [result[f] for f in fund_ids if result[f] is not None]
        assert max(scores) == Decimal("100")
        assert min(scores) == Decimal("0")


# ===========================================================================
# Risk Lens
# ===========================================================================

class TestRiskLens:
    """Tests for the Risk lens (inverted — lower risk = higher score)."""

    def test_lower_stddev_higher_score(self, engine: LensEngine) -> None:
        fund_ids = ["A", "B"]
        risk_stats = {
            "A": _risk(std_dev_3y=Decimal("5"), max_drawdown_3y=Decimal("-10"),
                       beta_3y=Decimal("0.8"), capture_down_3y=Decimal("80")),
            "B": _risk(std_dev_3y=Decimal("15"), max_drawdown_3y=Decimal("-30"),
                       beta_3y=Decimal("1.2"), capture_down_3y=Decimal("120")),
        }
        result = engine._compute_risk_lens(fund_ids, risk_stats)
        assert result["A"] > result["B"]

    def test_lower_maxdrawdown_higher_score(self, engine: LensEngine) -> None:
        fund_ids = ["A", "B"]
        risk_stats = {
            "A": _risk(std_dev_3y=Decimal("10"), max_drawdown_3y=Decimal("-5"),
                       beta_3y=Decimal("1"), capture_down_3y=Decimal("100")),
            "B": _risk(std_dev_3y=Decimal("10"), max_drawdown_3y=Decimal("-25"),
                       beta_3y=Decimal("1"), capture_down_3y=Decimal("100")),
        }
        result = engine._compute_risk_lens(fund_ids, risk_stats)
        # A has smaller drawdown (less negative = higher abs value but in inversion the one closer to 0 is better)
        assert result["A"] > result["B"]

    def test_all_risk_metrics_averaged(self, engine: LensEngine) -> None:
        """Fund with all 4 risk metrics → average of 4 percentile ranks."""
        fund_ids = ["A", "B", "C"]
        risk_stats = {
            "A": _risk(std_dev_3y=Decimal("5"), max_drawdown_3y=Decimal("-5"),
                       beta_3y=Decimal("0.5"), capture_down_3y=Decimal("50")),
            "B": _risk(std_dev_3y=Decimal("10"), max_drawdown_3y=Decimal("-15"),
                       beta_3y=Decimal("1.0"), capture_down_3y=Decimal("100")),
            "C": _risk(std_dev_3y=Decimal("20"), max_drawdown_3y=Decimal("-30"),
                       beta_3y=Decimal("1.5"), capture_down_3y=Decimal("150")),
        }
        result = engine._compute_risk_lens(fund_ids, risk_stats)
        # A is lowest risk → highest score, C highest risk → lowest
        assert result["A"] > result["B"] > result["C"]


# ===========================================================================
# Consistency Lens
# ===========================================================================

class TestConsistencyLens:
    """Tests for the Consistency lens."""

    def test_always_q1_high_consistency(self, engine: LensEngine) -> None:
        fund_ids = ["A", "B"]
        ranks = {
            "A": _ranks(quartile_1y=1, quartile_3y=1, quartile_5y=1,
                        cal_year_pctile_1y=10, cal_year_pctile_2y=15,
                        cal_year_pctile_3y=20),
            "B": _ranks(quartile_1y=4, quartile_3y=4, quartile_5y=4,
                        cal_year_pctile_1y=90, cal_year_pctile_2y=85,
                        cal_year_pctile_3y=80),
        }
        risk_stats = {
            "A": _risk(sortino_3y=Decimal("2.5")),
            "B": _risk(sortino_3y=Decimal("0.5")),
        }
        result = engine._compute_consistency_lens(fund_ids, ranks, risk_stats)
        assert result["A"] > result["B"]

    def test_alternating_quartiles_low_consistency(self, engine: LensEngine) -> None:
        fund_ids = ["A", "B"]
        ranks = {
            "A": _ranks(quartile_1y=1, quartile_3y=4, quartile_5y=1),
            "B": _ranks(quartile_1y=1, quartile_3y=1, quartile_5y=1),
        }
        risk_stats = {
            "A": _risk(sortino_3y=Decimal("1.0")),
            "B": _risk(sortino_3y=Decimal("1.0")),
        }
        result = engine._compute_consistency_lens(fund_ids, ranks, risk_stats)
        assert result["B"] >= result["A"]

    def test_calendar_year_top_half(self, engine: LensEngine) -> None:
        """8 out of 10 years in top half → high calendar consistency."""
        fund_ids = ["A", "B"]
        ranks = {
            "A": _ranks(
                cal_year_pctile_1y=10, cal_year_pctile_2y=20,
                cal_year_pctile_3y=15, cal_year_pctile_4y=30,
                cal_year_pctile_5y=25, cal_year_pctile_6y=35,
                cal_year_pctile_7y=40, cal_year_pctile_8y=45,
                cal_year_pctile_9y=60, cal_year_pctile_10y=70,
            ),
            "B": _ranks(
                cal_year_pctile_1y=80, cal_year_pctile_2y=75,
                cal_year_pctile_3y=85, cal_year_pctile_4y=90,
                cal_year_pctile_5y=95, cal_year_pctile_6y=70,
                cal_year_pctile_7y=60, cal_year_pctile_8y=55,
                cal_year_pctile_9y=50, cal_year_pctile_10y=45,
            ),
        }
        risk_stats = {
            "A": _risk(sortino_3y=Decimal("1.5")),
            "B": _risk(sortino_3y=Decimal("1.5")),
        }
        result = engine._compute_consistency_lens(fund_ids, ranks, risk_stats)
        assert result["A"] > result["B"]

    def test_sortino_boosts_consistency(self, engine: LensEngine) -> None:
        fund_ids = ["A", "B"]
        # Same quartiles and calendar years, different Sortino
        ranks = {
            "A": _ranks(quartile_1y=2, quartile_3y=2),
            "B": _ranks(quartile_1y=2, quartile_3y=2),
        }
        risk_stats = {
            "A": _risk(sortino_3y=Decimal("3.0")),
            "B": _risk(sortino_3y=Decimal("0.5")),
        }
        result = engine._compute_consistency_lens(fund_ids, ranks, risk_stats)
        assert result["A"] > result["B"]


# ===========================================================================
# Alpha Lens
# ===========================================================================

class TestAlphaLens:
    """Tests for the Alpha lens."""

    def test_positive_alpha_high_score(self, engine: LensEngine) -> None:
        fund_ids = ["A", "B"]
        risk_stats = {
            "A": _risk(alpha_3y=Decimal("5"), alpha_5y=Decimal("4"),
                       info_ratio_3y=Decimal("1.2"), info_ratio_5y=Decimal("1.0")),
            "B": _risk(alpha_3y=Decimal("-2"), alpha_5y=Decimal("-1"),
                       info_ratio_3y=Decimal("-0.5"), info_ratio_5y=Decimal("-0.3")),
        }
        returns = {
            "A": _returns(return_3y=Decimal("18"), return_5y=Decimal("16")),
            "B": _returns(return_3y=Decimal("10"), return_5y=Decimal("9")),
        }
        cat_avg = {"return_3y": Decimal("12"), "return_5y": Decimal("11")}
        result = engine._compute_alpha_lens(fund_ids, risk_stats, returns, cat_avg)
        assert result["A"] > result["B"]

    def test_negative_alpha_low_score(self, engine: LensEngine) -> None:
        fund_ids = ["A", "B", "C"]
        risk_stats = {
            "A": _risk(alpha_3y=Decimal("-5"), alpha_5y=Decimal("-4"),
                       info_ratio_3y=Decimal("-1"), info_ratio_5y=Decimal("-0.8")),
            "B": _risk(alpha_3y=Decimal("0"), alpha_5y=Decimal("0"),
                       info_ratio_3y=Decimal("0"), info_ratio_5y=Decimal("0")),
            "C": _risk(alpha_3y=Decimal("5"), alpha_5y=Decimal("4"),
                       info_ratio_3y=Decimal("1"), info_ratio_5y=Decimal("0.8")),
        }
        returns = {
            "A": _returns(return_3y=Decimal("7"), return_5y=Decimal("7")),
            "B": _returns(return_3y=Decimal("12"), return_5y=Decimal("11")),
            "C": _returns(return_3y=Decimal("17"), return_5y=Decimal("15")),
        }
        cat_avg = {"return_3y": Decimal("12"), "return_5y": Decimal("11")}
        result = engine._compute_alpha_lens(fund_ids, risk_stats, returns, cat_avg)
        assert result["C"] > result["B"] > result["A"]

    def test_5y_weight_greater_than_3y(self, engine: LensEngine) -> None:
        """5Y metrics × 60% > 3Y metrics × 40%."""
        fund_ids = ["A", "B"]
        # A: great 5Y alpha, poor 3Y. B: great 3Y, poor 5Y
        risk_stats = {
            "A": _risk(alpha_3y=Decimal("-1"), alpha_5y=Decimal("8"),
                       info_ratio_3y=Decimal("-0.2"), info_ratio_5y=Decimal("1.5")),
            "B": _risk(alpha_3y=Decimal("8"), alpha_5y=Decimal("-1"),
                       info_ratio_3y=Decimal("1.5"), info_ratio_5y=Decimal("-0.2")),
        }
        returns = {
            "A": _returns(return_3y=Decimal("11"), return_5y=Decimal("19")),
            "B": _returns(return_3y=Decimal("20"), return_5y=Decimal("10")),
        }
        cat_avg = {"return_3y": Decimal("12"), "return_5y": Decimal("11")}
        result = engine._compute_alpha_lens(fund_ids, risk_stats, returns, cat_avg)
        # A should score higher because 5Y weight is 60%
        assert result["A"] > result["B"]


# ===========================================================================
# Efficiency Lens
# ===========================================================================

class TestEfficiencyLens:
    """Tests for the Efficiency lens."""

    def test_low_expense_high_return_high_score(self, engine: LensEngine) -> None:
        fund_ids = ["A", "B"]
        returns = {
            "A": _returns(return_3y=Decimal("18")),
            "B": _returns(return_3y=Decimal("8")),
        }
        master = {
            "A": _master(net_expense_ratio=Decimal("0.5"), turnover_ratio=Decimal("20")),
            "B": _master(net_expense_ratio=Decimal("2.5"), turnover_ratio=Decimal("80")),
        }
        result = engine._compute_efficiency_lens(fund_ids, returns, master)
        assert result["A"] > result["B"]

    def test_high_expense_low_return_low_score(self, engine: LensEngine) -> None:
        fund_ids = ["A", "B"]
        returns = {
            "A": _returns(return_3y=Decimal("5")),
            "B": _returns(return_3y=Decimal("15")),
        }
        master = {
            "A": _master(net_expense_ratio=Decimal("2.5"), turnover_ratio=Decimal("90")),
            "B": _master(net_expense_ratio=Decimal("0.5"), turnover_ratio=Decimal("10")),
        }
        result = engine._compute_efficiency_lens(fund_ids, returns, master)
        assert result["B"] > result["A"]

    def test_return_per_expense_computed(self, engine: LensEngine) -> None:
        """Return per expense ratio = return_3y / expense_ratio."""
        fund_ids = ["A", "B", "C"]
        returns = {
            "A": _returns(return_3y=Decimal("20")),
            "B": _returns(return_3y=Decimal("10")),
            "C": _returns(return_3y=Decimal("15")),
        }
        master = {
            "A": _master(net_expense_ratio=Decimal("1.0"), turnover_ratio=Decimal("50")),
            "B": _master(net_expense_ratio=Decimal("1.0"), turnover_ratio=Decimal("50")),
            "C": _master(net_expense_ratio=Decimal("1.0"), turnover_ratio=Decimal("50")),
        }
        result = engine._compute_efficiency_lens(fund_ids, returns, master)
        # Same expense + turnover, so return_per_expense dominates
        assert result["A"] > result["C"] > result["B"]


# ===========================================================================
# Resilience Lens
# ===========================================================================

class TestResilienceLens:
    """Tests for the Resilience lens."""

    def test_small_drawdown_low_capture_high_score(self, engine: LensEngine) -> None:
        fund_ids = ["A", "B"]
        risk_stats = {
            "A": _risk(max_drawdown_3y=Decimal("-5"), capture_down_3y=Decimal("50"),
                       capture_up_3y=Decimal("110")),
            "B": _risk(max_drawdown_3y=Decimal("-30"), capture_down_3y=Decimal("130"),
                       capture_up_3y=Decimal("90")),
        }
        cal_year = {
            "A": _cal_year(calendar_year_return_1y=Decimal("5"),
                          calendar_year_return_2y=Decimal("-2"),
                          calendar_year_return_3y=Decimal("8")),
            "B": _cal_year(calendar_year_return_1y=Decimal("-15"),
                          calendar_year_return_2y=Decimal("-20"),
                          calendar_year_return_3y=Decimal("3")),
        }
        result = engine._compute_resilience_lens(fund_ids, risk_stats, cal_year)
        assert result["A"] > result["B"]

    def test_worst_year_matters(self, engine: LensEngine) -> None:
        """Fund that lost least in worst year scores highest."""
        fund_ids = ["A", "B"]
        risk_stats = {
            "A": _risk(max_drawdown_3y=Decimal("-10"), capture_down_3y=Decimal("90"),
                       capture_up_3y=Decimal("100")),
            "B": _risk(max_drawdown_3y=Decimal("-10"), capture_down_3y=Decimal("90"),
                       capture_up_3y=Decimal("100")),
        }
        cal_year = {
            "A": _cal_year(calendar_year_return_1y=Decimal("-3"),
                          calendar_year_return_2y=Decimal("10")),
            "B": _cal_year(calendar_year_return_1y=Decimal("-25"),
                          calendar_year_return_2y=Decimal("10")),
        }
        result = engine._compute_resilience_lens(fund_ids, risk_stats, cal_year)
        assert result["A"] > result["B"]

    def test_upside_downside_ratio(self, engine: LensEngine) -> None:
        """capture_up / capture_down > 1 is good."""
        fund_ids = ["A", "B"]
        risk_stats = {
            "A": _risk(max_drawdown_3y=Decimal("-10"), capture_down_3y=Decimal("80"),
                       capture_up_3y=Decimal("120")),  # ratio = 1.5
            "B": _risk(max_drawdown_3y=Decimal("-10"), capture_down_3y=Decimal("120"),
                       capture_up_3y=Decimal("80")),   # ratio = 0.67
        }
        cal_year = {
            "A": _cal_year(calendar_year_return_1y=Decimal("5")),
            "B": _cal_year(calendar_year_return_1y=Decimal("5")),
        }
        result = engine._compute_resilience_lens(fund_ids, risk_stats, cal_year)
        assert result["A"] > result["B"]


# ===========================================================================
# Tier Classification
# ===========================================================================

class TestTierClassification:
    """Tests for _classify_tier mapping."""

    def test_score_80_tier1(self, engine: LensEngine) -> None:
        assert engine._classify_tier(Decimal("80"), "return") == "LEADER"

    def test_score_60_tier2(self, engine: LensEngine) -> None:
        assert engine._classify_tier(Decimal("60"), "return") == "STRONG"

    def test_score_30_tier3(self, engine: LensEngine) -> None:
        assert engine._classify_tier(Decimal("30"), "return") == "AVERAGE"

    def test_score_10_tier4(self, engine: LensEngine) -> None:
        assert engine._classify_tier(Decimal("10"), "return") == "WEAK"

    def test_score_none_returns_none(self, engine: LensEngine) -> None:
        assert engine._classify_tier(None, "return") is None

    def test_boundary_75_is_tier1(self, engine: LensEngine) -> None:
        assert engine._classify_tier(Decimal("75"), "risk") == "LOW_RISK"

    def test_boundary_50_is_tier2(self, engine: LensEngine) -> None:
        assert engine._classify_tier(Decimal("50"), "consistency") == "CONSISTENT"

    def test_boundary_25_is_tier3(self, engine: LensEngine) -> None:
        assert engine._classify_tier(Decimal("25"), "alpha") == "NEUTRAL"

    def test_all_lenses_have_labels(self, engine: LensEngine) -> None:
        for lens_name in TIER_LABELS:
            result = engine._classify_tier(Decimal("90"), lens_name)
            assert result == TIER_LABELS[lens_name][0]


# ===========================================================================
# Headline Generation
# ===========================================================================

class TestHeadlineGeneration:
    """Tests for _generate_headline."""

    def test_leader_low_risk(self, engine: LensEngine) -> None:
        result = LensResult(
            mstar_id="TEST", category_name="Large Cap",
            return_score=Decimal("90"), risk_score=Decimal("85"),
            consistency_score=Decimal("50"), alpha_score=Decimal("50"),
            efficiency_score=Decimal("50"), resilience_score=Decimal("50"),
            return_class="LEADER", risk_class="LOW_RISK",
            consistency_class="CONSISTENT", alpha_class="NEUTRAL",
            efficiency_class="FAIR", resilience_class="STURDY",
            headline_tag="", data_completeness_pct=Decimal("100"),
            available_horizons=3,
        )
        headline = engine._generate_headline(result)
        assert len(headline) > 0
        # Should mention the distinctive traits
        assert "leader" in headline.lower() or "return" in headline.lower()

    def test_weak_high_risk(self, engine: LensEngine) -> None:
        result = LensResult(
            mstar_id="TEST", category_name="Large Cap",
            return_score=Decimal("10"), risk_score=Decimal("10"),
            consistency_score=Decimal("50"), alpha_score=Decimal("50"),
            efficiency_score=Decimal("50"), resilience_score=Decimal("50"),
            return_class="WEAK", risk_class="HIGH_RISK",
            consistency_class="CONSISTENT", alpha_class="NEUTRAL",
            efficiency_class="FAIR", resilience_class="STURDY",
            headline_tag="", data_completeness_pct=Decimal("100"),
            available_horizons=3,
        )
        headline = engine._generate_headline(result)
        assert len(headline) > 0

    def test_mixed_signals(self, engine: LensEngine) -> None:
        result = LensResult(
            mstar_id="TEST", category_name="Large Cap",
            return_score=Decimal("80"), risk_score=Decimal("30"),
            consistency_score=Decimal("60"), alpha_score=Decimal("70"),
            efficiency_score=Decimal("40"), resilience_score=Decimal("20"),
            return_class="LEADER", risk_class="ELEVATED",
            consistency_class="CONSISTENT", alpha_class="POSITIVE",
            efficiency_class="EXPENSIVE", resilience_class="VULNERABLE",
            headline_tag="", data_completeness_pct=Decimal("100"),
            available_horizons=3,
        )
        headline = engine._generate_headline(result)
        assert len(headline) > 0


# ===========================================================================
# Data Completeness
# ===========================================================================

class TestDataCompleteness:
    """Tests for _compute_data_completeness."""

    def test_all_horizons_100_pct(self, engine: LensEngine) -> None:
        returns = {"TEST": _returns(Decimal("10"), Decimal("12"), Decimal("15"))}
        risk_stats = {"TEST": _risk(
            std_dev_3y=Decimal("5"), max_drawdown_3y=Decimal("-10"),
            beta_3y=Decimal("0.9"), capture_down_3y=Decimal("90"),
            sortino_3y=Decimal("1.5"), alpha_3y=Decimal("2"), alpha_5y=Decimal("3"),
        )}
        ranks = {"TEST": _ranks(quartile_1y=1, quartile_3y=1, quartile_5y=2)}
        pct, horizons = engine._compute_data_completeness("TEST", returns, risk_stats, ranks)
        assert pct == Decimal("100")
        assert horizons == 3

    def test_only_1y_lower_completeness(self, engine: LensEngine) -> None:
        returns = {"TEST": _returns(Decimal("10"), None, None)}
        risk_stats = {"TEST": _risk()}
        ranks = {"TEST": _ranks(quartile_1y=1)}
        pct, horizons = engine._compute_data_completeness("TEST", returns, risk_stats, ranks)
        assert pct < Decimal("100")
        assert horizons == 1

    def test_no_data_0_pct(self, engine: LensEngine) -> None:
        returns = {"TEST": _returns(None, None, None)}
        risk_stats = {"TEST": _risk()}
        ranks = {"TEST": _ranks()}
        pct, horizons = engine._compute_data_completeness("TEST", returns, risk_stats, ranks)
        assert pct == Decimal("0")
        assert horizons == 0


# ===========================================================================
# Full Category Computation
# ===========================================================================

class TestFullCategoryComputation:
    """End-to-end test of compute_category with realistic data."""

    def test_ten_funds_all_scored(self, engine: LensEngine) -> None:
        """10 funds with realistic data → all get LensResults, no crashes."""
        n = 10
        fund_ids = [f"F{i:03d}" for i in range(n)]

        latest_returns = {}
        risk_stats_data = {}
        ranks_data = {}
        master_data = {}
        cal_year_data = {}

        for i, fid in enumerate(fund_ids):
            latest_returns[fid] = _returns(
                Decimal(str(5 + i * 2)),
                Decimal(str(8 + i * 1.5)),
                Decimal(str(10 + i * 1.8)),
            )
            risk_stats_data[fid] = _risk(
                std_dev_3y=Decimal(str(20 - i)),
                max_drawdown_3y=Decimal(str(-30 + i * 2)),
                beta_3y=Decimal(str(1.5 - i * 0.1)),
                capture_down_3y=Decimal(str(120 - i * 5)),
                sortino_3y=Decimal(str(0.5 + i * 0.2)),
                alpha_3y=Decimal(str(-3 + i * 0.8)),
                alpha_5y=Decimal(str(-2 + i * 0.6)),
                info_ratio_3y=Decimal(str(-0.5 + i * 0.15)),
                info_ratio_5y=Decimal(str(-0.3 + i * 0.12)),
                capture_up_3y=Decimal(str(80 + i * 5)),
            )
            ranks_data[fid] = _ranks(
                quartile_1y=(4 - min(i // 3, 3)),
                quartile_3y=(4 - min(i // 3, 3)),
                quartile_5y=(4 - min(i // 3, 3)),
                cal_year_pctile_1y=(90 - i * 8),
                cal_year_pctile_2y=(85 - i * 7),
                cal_year_pctile_3y=(88 - i * 9),
            )
            master_data[fid] = _master(
                net_expense_ratio=Decimal(str(2.5 - i * 0.2)),
                turnover_ratio=Decimal(str(80 - i * 5)),
            )
            cal_year_data[fid] = _cal_year(
                calendar_year_return_1y=Decimal(str(-10 + i * 3)),
                calendar_year_return_2y=Decimal(str(-5 + i * 2)),
                calendar_year_return_3y=Decimal(str(5 + i)),
            )

        cat_avg = {"return_3y": Decimal("14"), "return_5y": Decimal("16")}

        results = engine.compute_category(
            category_name="Large Cap",
            fund_ids=fund_ids,
            latest_returns=latest_returns,
            risk_stats=risk_stats_data,
            ranks=ranks_data,
            fund_master=master_data,
            calendar_year_returns=cal_year_data,
            category_avg_returns=cat_avg,
        )

        assert len(results) == n
        for r in results:
            assert isinstance(r, LensResult)
            assert r.category_name == "Large Cap"
            assert r.engine_version == ENGINE_VERSION
            # At least some lenses should be scored
            scored = [s for s in [r.return_score, r.risk_score, r.consistency_score,
                                   r.alpha_score, r.efficiency_score, r.resilience_score]
                      if s is not None]
            assert len(scored) >= 4

    def test_scores_properly_ranked(self, engine: LensEngine) -> None:
        """Best fund ≈ 100, worst ≈ 0 for return lens."""
        fund_ids = ["BEST", "WORST"]
        returns = {
            "BEST": _returns(Decimal("30"), Decimal("25"), Decimal("22")),
            "WORST": _returns(Decimal("2"), Decimal("1"), Decimal("0.5")),
        }
        result = engine._compute_return_lens(fund_ids, returns)
        assert result["BEST"] == Decimal("100")
        assert result["WORST"] == Decimal("0")

    def test_six_lenses_independent(self, engine: LensEngine) -> None:
        """Return score does not influence Risk score."""
        fund_ids = ["A", "B"]
        # A: great returns, terrible risk. B: poor returns, great risk.
        returns = {
            "A": _returns(Decimal("30"), Decimal("25"), Decimal("20")),
            "B": _returns(Decimal("5"), Decimal("3"), Decimal("2")),
        }
        risk_stats_data = {
            "A": _risk(std_dev_3y=Decimal("25"), max_drawdown_3y=Decimal("-40"),
                       beta_3y=Decimal("1.5"), capture_down_3y=Decimal("140")),
            "B": _risk(std_dev_3y=Decimal("5"), max_drawdown_3y=Decimal("-5"),
                       beta_3y=Decimal("0.5"), capture_down_3y=Decimal("40")),
        }
        return_scores = engine._compute_return_lens(fund_ids, returns)
        risk_scores = engine._compute_risk_lens(fund_ids, risk_stats_data)

        # A wins on returns, B wins on risk — they are independent
        assert return_scores["A"] > return_scores["B"]
        assert risk_scores["B"] > risk_scores["A"]
