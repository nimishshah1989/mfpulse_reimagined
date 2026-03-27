"""Tests for lens repository — mocked DB session."""

import os
import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.repositories.lens_repo import LensRepository


def _mock_lens_scores_row(**overrides):
    """Create a mock FundLensScores row."""
    row = MagicMock()
    defaults = {
        "mstar_id": "F001",
        "computed_date": date(2026, 3, 1),
        "category_name": "Large Cap",
        "return_score": Decimal("75"),
        "risk_score": Decimal("60"),
        "consistency_score": Decimal("50"),
        "alpha_score": Decimal("65"),
        "efficiency_score": Decimal("80"),
        "resilience_score": Decimal("55"),
        "data_completeness_pct": Decimal("100"),
        "available_horizons": 3,
        "engine_version": "1.0",
    }
    defaults.update(overrides)
    for k, v in defaults.items():
        setattr(row, k, v)
    return row


def _mock_classification_row(**overrides):
    """Create a mock FundClassification row."""
    row = MagicMock()
    defaults = {
        "mstar_id": "F001",
        "computed_date": date(2026, 3, 1),
        "return_class": "LEADER",
        "risk_class": "MODERATE",
        "consistency_class": "CONSISTENT",
        "alpha_class": "POSITIVE",
        "efficiency_class": "LEAN",
        "resilience_class": "STURDY",
        "headline_tag": "Strong returns with moderate risk",
    }
    defaults.update(overrides)
    for k, v in defaults.items():
        setattr(row, k, v)
    return row


class TestUpsertLensScores:
    def test_empty_records_returns_zero(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        assert repo.upsert_lens_scores([]) == 0
        db.execute.assert_not_called()

    def test_upserts_records_and_returns_count(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        records = [
            {
                "mstar_id": "F001",
                "computed_date": date(2026, 3, 1),
                "category_name": "Large Cap",
                "return_score": Decimal("75"),
                "risk_score": Decimal("60"),
                "consistency_score": Decimal("50"),
                "alpha_score": Decimal("65"),
                "efficiency_score": Decimal("80"),
                "resilience_score": Decimal("55"),
                "data_completeness_pct": Decimal("100"),
                "available_horizons": 3,
                "engine_version": "1.0",
                "input_hash": "abc123",
            },
        ]
        count = repo.upsert_lens_scores(records)
        assert count == 1
        db.execute.assert_called_once()
        db.flush.assert_called_once()

    def test_multiple_records(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        records = [
            {"mstar_id": f"F{i:03d}", "computed_date": date(2026, 3, 1),
             "category_name": "Large Cap", "return_score": Decimal("50"),
             "risk_score": Decimal("50"), "consistency_score": Decimal("50"),
             "alpha_score": Decimal("50"), "efficiency_score": Decimal("50"),
             "resilience_score": Decimal("50"), "data_completeness_pct": Decimal("100"),
             "available_horizons": 3, "engine_version": "1.0", "input_hash": "x"}
            for i in range(5)
        ]
        count = repo.upsert_lens_scores(records)
        assert count == 5


class TestUpsertClassifications:
    def test_empty_records_returns_zero(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        assert repo.upsert_classifications([]) == 0

    def test_upserts_classification_records(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        records = [
            {
                "mstar_id": "F001",
                "computed_date": date(2026, 3, 1),
                "return_class": "LEADER",
                "risk_class": "MODERATE",
                "consistency_class": "CONSISTENT",
                "alpha_class": "POSITIVE",
                "efficiency_class": "LEAN",
                "resilience_class": "STURDY",
                "headline_tag": "Strong returns",
            },
        ]
        count = repo.upsert_classifications(records)
        assert count == 1
        db.execute.assert_called_once()
        db.flush.assert_called_once()


class TestGetLatestScores:
    def test_returns_dict_when_found(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        row = _mock_lens_scores_row()
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.first.return_value = row

        result = repo.get_latest_scores("F001")
        assert result is not None
        assert result["mstar_id"] == "F001"
        assert result["return_score"] == Decimal("75")
        assert result["engine_version"] == "1.0"

    def test_returns_none_when_not_found(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.first.return_value = None

        assert repo.get_latest_scores("NONEXIST") is None


class TestGetLatestClassification:
    def test_returns_dict_when_found(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        row = _mock_classification_row()
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.first.return_value = row

        result = repo.get_latest_classification("F001")
        assert result is not None
        assert result["return_class"] == "LEADER"
        assert result["headline_tag"] == "Strong returns with moderate risk"

    def test_returns_none_when_not_found(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.first.return_value = None

        assert repo.get_latest_classification("NONEXIST") is None


class TestGetCategoryScores:
    def test_returns_list_with_specific_date(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        rows = [_mock_lens_scores_row(mstar_id="F001"), _mock_lens_scores_row(mstar_id="F002")]
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.all.return_value = rows

        result = repo.get_category_scores("Large Cap", computed_date=date(2026, 3, 1))
        assert len(result) == 2
        assert result[0]["mstar_id"] == "F001"

    def test_returns_list_without_date_uses_latest(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        rows = [_mock_lens_scores_row()]
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.all.return_value = rows
        # scalar_subquery is chained from inner query
        inner_q = MagicMock()
        db.query.side_effect = [mock_q, inner_q]

        # Re-setup with proper chain
        db2 = MagicMock()
        repo2 = LensRepository(db2)
        q = MagicMock()
        db2.query.return_value = q
        q.filter.return_value = q
        q.all.return_value = rows
        q.scalar_subquery.return_value = "sub"

        result = repo2.get_category_scores("Large Cap")
        assert len(result) == 1

    def test_empty_category(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.all.return_value = []

        result = repo.get_category_scores("Empty Cat", computed_date=date(2026, 3, 1))
        assert result == []


class TestGetScoreHistory:
    def test_returns_list_of_dicts(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        rows = [
            _mock_lens_scores_row(computed_date=date(2026, 3, 1)),
            _mock_lens_scores_row(computed_date=date(2026, 2, 1)),
        ]
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.limit.return_value = mock_q
        mock_q.all.return_value = rows

        result = repo.get_score_history("F001", limit=12)
        assert len(result) == 2
        assert result[0]["computed_date"] == date(2026, 3, 1)

    def test_empty_history(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.limit.return_value = mock_q
        mock_q.all.return_value = []

        assert repo.get_score_history("F001") == []


class TestGetClassificationDistribution:
    def test_returns_distribution_dict(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)

        row1 = _mock_classification_row(mstar_id="F001", return_class="LEADER", risk_class="LOW_RISK")
        row2 = _mock_classification_row(mstar_id="F002", return_class="LEADER", risk_class="MODERATE")
        row3 = _mock_classification_row(mstar_id="F003", return_class="STRONG", risk_class="MODERATE")

        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.join.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.all.return_value = [row1, row2, row3]

        result = repo.get_classification_distribution()
        assert "return" in result
        assert "risk" in result
        assert result["return"]["LEADER"] == 2
        assert result["return"]["STRONG"] == 1
        assert result["risk"]["LOW_RISK"] == 1
        assert result["risk"]["MODERATE"] == 2

    def test_empty_distribution(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.join.return_value = mock_q
        mock_q.all.return_value = []

        result = repo.get_classification_distribution()
        assert all(v == {} for v in result.values())

    def test_with_category_filter(self) -> None:
        db = MagicMock()
        repo = LensRepository(db)
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.join.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.all.return_value = [_mock_classification_row()]

        result = repo.get_classification_distribution(category_name="Large Cap")
        assert result["return"]["LEADER"] == 1


class TestScoresToDict:
    def test_all_fields_present(self) -> None:
        row = _mock_lens_scores_row()
        result = LensRepository._scores_to_dict(row)
        expected_keys = {
            "mstar_id", "computed_date", "category_name",
            "return_score", "risk_score", "consistency_score",
            "alpha_score", "efficiency_score", "resilience_score",
            "data_completeness_pct", "available_horizons", "engine_version",
        }
        assert set(result.keys()) == expected_keys


class TestClassificationToDict:
    def test_all_fields_present(self) -> None:
        row = _mock_classification_row()
        result = LensRepository._classification_to_dict(row)
        expected_keys = {
            "mstar_id", "computed_date",
            "return_class", "risk_class", "consistency_class",
            "alpha_class", "efficiency_class", "resilience_class",
            "headline_tag",
        }
        assert set(result.keys()) == expected_keys
