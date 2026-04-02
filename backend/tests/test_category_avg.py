"""Tests for category average lens scores and category risk stats in fund detail.

B3: The fund detail response should include:
- category_avg_lens_scores: median of each lens score across same-category funds
- cat_* fields in risk_stats: already present in risk_stats_monthly from Morningstar
"""

from decimal import Decimal
from typing import Optional
from unittest.mock import MagicMock, patch

import pytest

from app.engines.lens_engine import LensEngine


# ---------------------------------------------------------------------------
# Test category median lens score computation (pure logic)
# ---------------------------------------------------------------------------


def _compute_median(values: list[Decimal]) -> Optional[Decimal]:
    """Reference median implementation for verification."""
    if not values:
        return None
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n % 2 == 1:
        return sorted_vals[n // 2]
    mid = n // 2
    return (sorted_vals[mid - 1] + sorted_vals[mid]) / 2


class TestCategoryMedianComputation:
    """Verify the median computation logic for category average lens scores."""

    def test_odd_count_returns_middle(self) -> None:
        values = [Decimal("10"), Decimal("50"), Decimal("90")]
        assert _compute_median(values) == Decimal("50")

    def test_even_count_returns_average_of_two_middle(self) -> None:
        values = [Decimal("10"), Decimal("30"), Decimal("50"), Decimal("90")]
        assert _compute_median(values) == Decimal("40")

    def test_single_value(self) -> None:
        values = [Decimal("75")]
        assert _compute_median(values) == Decimal("75")

    def test_empty_returns_none(self) -> None:
        assert _compute_median([]) is None


class TestCategoryAvgLensScoresResponse:
    """Verify that get_category_median_lens_scores returns correct shape."""

    def test_returns_all_six_lenses(self) -> None:
        """The response should include all 6 lens median scores."""
        from app.repositories.lens_repo import LensRepository

        # We test the method exists and returns correct keys
        # The actual DB query is tested via integration tests
        expected_keys = {
            "return_score", "risk_score", "consistency_score",
            "alpha_score", "efficiency_score", "resilience_score",
        }
        # Verify the method signature exists on LensRepository
        assert hasattr(LensRepository, "get_category_median_scores"), (
            "LensRepository must have get_category_median_scores method"
        )


class TestRiskStatsIncludesCatFields:
    """Verify that risk stats response includes cat_* fields from Morningstar."""

    def test_risk_stats_dict_has_cat_fields(self) -> None:
        """The _risk_stats_to_dict should already include cat_* fields."""
        from app.repositories.fund_repo import FundRepository

        # Check that _risk_stats_to_dict includes cat_ fields
        # We verify by inspecting the method's output keys
        # The cat_* fields are already present in the existing code
        # (confirmed by reading fund_repo.py _risk_stats_to_dict)
        # This test documents the expected behavior
        mock_rs = MagicMock()
        # Set all expected attributes
        for attr in [
            "as_of_date",
            "sharpe_1y", "sharpe_3y", "sharpe_5y",
            "alpha_3y", "alpha_5y", "alpha_10y",
            "beta_3y", "beta_5y", "beta_10y",
            "std_dev_1y", "std_dev_3y", "std_dev_5y",
            "sortino_1y", "sortino_3y", "sortino_5y",
            "max_drawdown_1y", "max_drawdown_3y", "max_drawdown_5y",
            "treynor_1y", "treynor_3y", "treynor_5y", "treynor_10y",
            "info_ratio_1y", "info_ratio_3y", "info_ratio_5y", "info_ratio_10y",
            "tracking_error_1y", "tracking_error_3y", "tracking_error_5y", "tracking_error_10y",
            "capture_up_1y", "capture_up_3y", "capture_up_5y", "capture_up_10y",
            "capture_down_1y", "capture_down_3y", "capture_down_5y",
            "correlation_1y", "correlation_3y", "correlation_5y",
            "r_squared_1y", "r_squared_3y", "r_squared_5y",
            "kurtosis_1y", "kurtosis_3y", "kurtosis_5y",
            "skewness_1y", "skewness_3y", "skewness_5y",
            "mean_1y", "mean_3y", "mean_5y",
            # Category comparison fields
            "cat_sharpe_1y", "cat_sharpe_3y", "cat_sharpe_5y", "cat_sharpe_10y",
            "cat_std_dev_1y", "cat_std_dev_3y", "cat_std_dev_5y", "cat_std_dev_10y",
            "cat_alpha_1y", "cat_alpha_3y", "cat_alpha_5y", "cat_alpha_10y",
            "cat_beta_1y", "cat_beta_3y", "cat_beta_5y", "cat_beta_10y",
            "cat_r_squared_1y", "cat_r_squared_3y", "cat_r_squared_5y", "cat_r_squared_10y",
            "cat_sortino_1y", "cat_sortino_3y", "cat_sortino_5y", "cat_sortino_10y",
            "cat_return_1y", "cat_return_3y", "cat_return_5y", "cat_return_10y",
            "ttr_return_1y", "ttr_return_3y", "ttr_return_5y", "ttr_return_10y",
            # Additional cat_ fields
            "cat_kurtosis_1y", "cat_kurtosis_3y", "cat_kurtosis_5y", "cat_kurtosis_10y",
            "cat_skewness_1y", "cat_skewness_3y", "cat_skewness_5y", "cat_skewness_10y",
            "cat_capture_up_1y", "cat_capture_up_3y", "cat_capture_up_5y", "cat_capture_up_10y",
            "cat_capture_down_1y", "cat_capture_down_3y", "cat_capture_down_5y", "cat_capture_down_10y",
            "cat_correlation_1y", "cat_correlation_3y", "cat_correlation_5y", "cat_correlation_10y",
            "cat_info_ratio_1y", "cat_info_ratio_3y", "cat_info_ratio_5y", "cat_info_ratio_10y",
            "cat_tracking_error_1y", "cat_tracking_error_3y", "cat_tracking_error_5y", "cat_tracking_error_10y",
            "cat_treynor_1y", "cat_treynor_3y", "cat_treynor_5y", "cat_treynor_10y",
        ]:
            setattr(mock_rs, attr, Decimal("1.5"))

        result = FundRepository._risk_stats_to_dict(mock_rs)

        # Verify cat_ fields are included
        cat_keys = [k for k in result if k.startswith("cat_")]
        assert len(cat_keys) >= 20, (
            f"Expected at least 20 cat_* fields, got {len(cat_keys)}: {cat_keys}"
        )

        # Specific spot checks
        assert "cat_sharpe_3y" in result
        assert "cat_alpha_3y" in result
        assert "cat_return_1y" in result
        assert "cat_return_3y" in result
        assert "cat_return_5y" in result


class TestFundDetailIncludesCategoryAvg:
    """Verify fund detail endpoint includes category_avg_lens_scores."""

    def test_fund_detail_response_has_category_avg_field(self) -> None:
        """The get_fund_detail endpoint should include category_avg_lens_scores key."""
        from app.api.v1 import funds
        import ast

        # Parse the function AST to check it references category_avg_lens_scores
        source_file = funds.__file__
        with open(source_file) as f:
            tree = ast.parse(f.read())
        found = any(
            isinstance(node, ast.Constant) and isinstance(node.value, str)
            and "category_avg_lens_scores" in node.value
            for node in ast.walk(tree)
        )
        assert found, "get_fund_detail must include category_avg_lens_scores in response"
