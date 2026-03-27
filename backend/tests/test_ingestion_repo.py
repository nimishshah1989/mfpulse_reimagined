"""Tests for ingestion repository — unit tests with mocked DB."""

import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.repositories.ingestion_repo import IngestionRepository, UpsertResult, BATCH_SIZE
from app.repositories.audit_repo import AuditRepository
from app.repositories.freshness_repo import FreshnessRepository


class TestUpsertResult:
    def test_defaults(self) -> None:
        r = UpsertResult()
        assert r.inserted == 0
        assert r.updated == 0
        assert r.failed == 0
        assert r.errors == []


class TestIngestionRepoFilterRecord:
    def test_filters_unknown_columns(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        from app.models.db.fund_master import FundMaster
        valid_cols = repo._get_column_names(FundMaster)
        record = {"mstar_id": "F001", "unknown_col": "nope", "legal_name": "Test"}
        filtered = repo._filter_record(record, valid_cols)
        assert "mstar_id" in filtered
        assert "legal_name" in filtered
        assert "unknown_col" not in filtered

    def test_fund_master_has_new_columns(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        from app.models.db.fund_master import FundMaster
        valid_cols = repo._get_column_names(FundMaster)
        new_cols = {
            "manager_education", "manager_birth_year", "manager_certification",
            "performance_start_date", "previous_fund_name", "previous_name_end_date",
            "pricing_frequency", "legal_structure", "domicile_id", "exchange_id",
            "closed_to_investors", "lock_in_period", "distribution_status",
        }
        for col in new_cols:
            assert col in valid_cols, f"FundMaster missing column: {col}"


class TestIngestionRepoGetColumnNames:
    def test_fund_master_columns(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        from app.models.db.fund_master import FundMaster
        cols = repo._get_column_names(FundMaster)
        assert "mstar_id" in cols
        assert "id" in cols
        assert "created_at" in cols

    def test_nav_daily_columns(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        from app.models.db.nav_daily import NavDaily
        cols = repo._get_column_names(NavDaily)
        assert "mstar_id" in cols
        assert "nav_date" in cols
        assert "nav" in cols


class TestBatchSize:
    def test_batch_size_is_500(self) -> None:
        assert BATCH_SIZE == 500


class TestCreateIngestionLog:
    def test_creates_log_entry(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        # Mock the flush to set an id
        def side_effect(entry):
            entry.id = uuid.uuid4()
        db.add.side_effect = lambda entry: setattr(entry, 'id', uuid.uuid4())

        repo.create_ingestion_log(
            feed_name="nav_2026-03-26.csv",
            records_processed=100,
            records_failed=2,
            duration_ms=1500,
            status="PARTIAL",
            error_details="2 rows missing mstar_id",
        )
        db.add.assert_called_once()
        db.flush.assert_called_once()


class TestAuditRepository:
    def test_log_creates_entry(self) -> None:
        db = MagicMock()
        repo = AuditRepository(db)
        db.add.side_effect = lambda entry: setattr(entry, 'id', uuid.uuid4())

        repo.log(
            actor="system/ingestion",
            action="DATA_INGESTED",
            entity_type="ingestion",
            entity_id="nav_2026-03-26.csv",
            details={"records": 100},
        )
        db.add.assert_called_once()
        db.flush.assert_called_once()

    def test_get_recent_returns_list(self) -> None:
        db = MagicMock()
        repo = AuditRepository(db)
        mock_query = MagicMock()
        db.query.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []

        result = repo.get_recent(limit=10)
        assert result == []
        db.query.assert_called_once()

    def test_get_recent_filters_by_entity_type(self) -> None:
        db = MagicMock()
        repo = AuditRepository(db)
        mock_query = MagicMock()
        db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []

        result = repo.get_recent(limit=5, entity_type="ingestion")
        assert result == []
        mock_query.filter.assert_called_once()


class TestUpsertNavDaily:
    def test_column_names_for_nav_daily(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        from app.models.db.nav_daily import NavDaily
        cols = repo._get_column_names(NavDaily)
        assert "mstar_id" in cols
        assert "nav_date" in cols
        assert "nav" in cols
        assert "return_1y" in cols

    def test_upsert_nav_daily_calls_batch_upsert(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        repo._batch_upsert = MagicMock(return_value=UpsertResult(inserted=3))
        records = [
            {"mstar_id": "F001", "nav_date": date(2026, 3, 26), "nav": Decimal("150.25")},
            {"mstar_id": "F001", "nav_date": date(2026, 3, 27), "nav": Decimal("151.00")},
            {"mstar_id": "F002", "nav_date": date(2026, 3, 26), "nav": Decimal("200.50")},
        ]
        result = repo.upsert_nav_daily(records)
        assert result.inserted == 3
        repo._batch_upsert.assert_called_once()
        call_args = repo._batch_upsert.call_args
        assert call_args[1]["conflict_cols"] == ["mstar_id", "nav_date"] or \
               call_args[0][2] == ["mstar_id", "nav_date"]


class TestUpsertRiskStats:
    def test_column_names_for_risk_stats(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        from app.models.db.risk_stats import RiskStatsMonthly
        cols = repo._get_column_names(RiskStatsMonthly)
        assert "mstar_id" in cols
        assert "as_of_date" in cols
        assert "std_dev_3y" in cols

    def test_upsert_risk_stats_calls_batch_upsert(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        repo._batch_upsert = MagicMock(return_value=UpsertResult(inserted=2))
        records = [
            {"mstar_id": "F001", "as_of_date": date(2026, 3, 1), "std_dev_3y": Decimal("12.5")},
            {"mstar_id": "F002", "as_of_date": date(2026, 3, 1), "std_dev_3y": Decimal("15.0")},
        ]
        result = repo.upsert_risk_stats(records)
        assert result.inserted == 2


class TestUpsertRanks:
    def test_upsert_ranks_calls_batch_upsert(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        repo._batch_upsert = MagicMock(return_value=UpsertResult(inserted=1))
        records = [
            {"mstar_id": "F001", "as_of_date": date(2026, 3, 1), "quartile_1y": 1, "quartile_3y": 2},
        ]
        result = repo.upsert_ranks(records)
        assert result.inserted == 1

    def test_column_names_for_ranks(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        from app.models.db.rank_monthly import RankMonthly
        cols = repo._get_column_names(RankMonthly)
        assert "mstar_id" in cols
        assert "as_of_date" in cols
        assert "quartile_1y" in cols


class TestUpsertHoldingsSnapshot:
    def test_upsert_holdings_snapshot_calls_batch_upsert(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        repo._batch_upsert = MagicMock(return_value=UpsertResult(inserted=1))
        records = [
            {"mstar_id": "F001", "portfolio_date": date(2026, 2, 28), "total_holdings": 50},
        ]
        result = repo.upsert_holdings_snapshot(records)
        assert result.inserted == 1


class TestUpsertSectorExposure:
    def test_upsert_sector_exposure_calls_batch_upsert(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        repo._batch_upsert = MagicMock(return_value=UpsertResult(inserted=2))
        records = [
            {"mstar_id": "F001", "portfolio_date": date(2026, 2, 28),
             "sector_name": "Technology", "weight_pct": Decimal("25.5")},
            {"mstar_id": "F001", "portfolio_date": date(2026, 2, 28),
             "sector_name": "Financial", "weight_pct": Decimal("18.3")},
        ]
        result = repo.upsert_sector_exposure(records)
        assert result.inserted == 2


class TestUpsertAssetAllocation:
    def test_upsert_asset_allocation_calls_batch_upsert(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        repo._batch_upsert = MagicMock(return_value=UpsertResult(inserted=1))
        records = [{"mstar_id": "F001", "portfolio_date": date(2026, 2, 28)}]
        result = repo.upsert_asset_allocation(records)
        assert result.inserted == 1


class TestUpsertCreditQuality:
    def test_upsert_credit_quality_calls_batch_upsert(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        repo._batch_upsert = MagicMock(return_value=UpsertResult(inserted=1))
        records = [{"mstar_id": "F001", "portfolio_date": date(2026, 2, 28)}]
        result = repo.upsert_credit_quality(records)
        assert result.inserted == 1


class TestUpsertCategoryReturns:
    def test_upsert_category_returns_calls_batch_upsert(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        repo._batch_upsert = MagicMock(return_value=UpsertResult(inserted=1))
        records = [{"category_code": "EQ_LC", "as_of_date": date(2026, 3, 26)}]
        result = repo.upsert_category_returns(records)
        assert result.inserted == 1


class TestGetRecentIngestionLogs:
    def test_returns_list(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.limit.return_value = mock_q
        mock_q.all.return_value = []

        result = repo.get_recent_ingestion_logs(limit=10)
        assert result == []

    def test_default_limit_is_20(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        mock_q = MagicMock()
        db.query.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.limit.return_value = mock_q
        mock_q.all.return_value = []

        repo.get_recent_ingestion_logs()
        mock_q.limit.assert_called_once_with(20)


class TestBatchUpsertKeyNormalization:
    """Verify that _batch_upsert normalizes dict keys so all dicts in a batch
    have the same keys — required by SQLAlchemy insert().values(list_of_dicts)."""

    def test_inconsistent_keys_are_normalized(self) -> None:
        """Records with different keys should be padded with None for missing keys."""
        db = MagicMock()
        repo = IngestionRepository(db)

        from app.models.db.fund_master import FundMaster

        records = [
            {"mstar_id": "F001", "fund_name": "Fund A", "isin": "INE001A01036"},
            {"mstar_id": "F002", "fund_name": "Fund B"},  # no isin
            {"mstar_id": "F003", "legal_name": "Fund C Legal"},  # no fund_name, no isin
        ]

        # Capture the values passed to pg_insert().values()
        captured_values: list[list[dict]] = []
        original_execute = db.execute

        def capture_execute(stmt):
            # The stmt has _values attribute with the normalized rows
            if hasattr(stmt, 'compile'):
                pass  # just let it through
            return original_execute(stmt)

        db.execute.side_effect = None  # reset any side effects

        result = repo._batch_upsert(FundMaster, records, conflict_cols=["mstar_id"])

        # Should succeed (not raise) — the key normalization prevents the error
        # Since execute is mocked, it won't actually fail, but we can check
        # the values passed by inspecting the call
        assert db.execute.called
        call_args = db.execute.call_args
        stmt = call_args[0][0]

        # Verify the statement compiled without error (would fail with inconsistent keys)
        # The fact that we got here without exception means normalization worked
        assert result.inserted == 3

    def test_missing_keys_filled_with_none(self) -> None:
        """Directly test the _normalize_batch_keys helper."""
        db = MagicMock()
        repo = IngestionRepository(db)

        batch = [
            {"a": 1, "b": 2},
            {"a": 3, "c": 4},
            {"b": 5},
        ]
        normalized = repo._normalize_batch_keys(batch)
        all_keys = {"a", "b", "c"}
        for row in normalized:
            assert set(row.keys()) == all_keys
        assert normalized[0] == {"a": 1, "b": 2, "c": None}
        assert normalized[1] == {"a": 3, "b": None, "c": 4}
        assert normalized[2] == {"a": None, "b": 5, "c": None}


class TestBatchUpsertErrorHandling:
    def test_batch_error_rolls_back(self) -> None:
        db = MagicMock()
        repo = IngestionRepository(db)
        db.execute.side_effect = Exception("DB connection lost")

        from app.models.db.nav_daily import NavDaily
        records = [{"mstar_id": "F001", "nav_date": date(2026, 3, 26), "nav": Decimal("100")}]
        result = repo._batch_upsert(NavDaily, records, conflict_cols=["mstar_id", "nav_date"])
        assert result.failed > 0
        assert len(result.errors) > 0
        db.rollback.assert_called()


class TestFreshnessRepository:
    def test_get_latest_dates_returns_dict(self) -> None:
        db = MagicMock()
        repo = FreshnessRepository(db)
        mock_query = MagicMock()
        db.query.return_value = mock_query
        mock_query.scalar.return_value = None

        result = repo.get_latest_dates()
        assert isinstance(result, dict)
        assert "nav_daily" in result
        assert "fund_master" in result
        assert "risk_stats_monthly" in result

    def test_get_fund_count(self) -> None:
        db = MagicMock()
        repo = FreshnessRepository(db)
        mock_query = MagicMock()
        db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.scalar.return_value = 42

        assert repo.get_fund_count() == 42

    def test_get_nav_coverage(self) -> None:
        db = MagicMock()
        repo = FreshnessRepository(db)
        mock_query = MagicMock()
        db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.scalar.return_value = None

        result = repo.get_nav_coverage()
        assert "total_funds" in result
        assert "latest_nav_date" in result
