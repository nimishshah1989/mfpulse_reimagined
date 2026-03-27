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
