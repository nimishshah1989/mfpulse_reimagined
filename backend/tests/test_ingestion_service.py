"""Tests for ingestion service — orchestration logic."""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.services.ingestion_service import (
    IngestionService,
    IngestionResult,
    _detect_feed_type,
)
from app.repositories.ingestion_repo import UpsertResult


# --- Feed type detection ---

class TestDetectFeedType:
    def test_master_file(self) -> None:
        assert _detect_feed_type("master_2026-03-26.csv") == "master"
        assert _detect_feed_type("Master_Weekly.csv") == "master"

    def test_nav_file(self) -> None:
        assert _detect_feed_type("nav_2026-03-26.csv") == "nav"
        assert _detect_feed_type("NAV_Daily.csv") == "nav"

    def test_risk_stats_file(self) -> None:
        assert _detect_feed_type("risk_stats_2026-02.csv") == "risk_stats"
        assert _detect_feed_type("RiskStats_Monthly.csv") == "risk_stats"

    def test_ranks_file(self) -> None:
        assert _detect_feed_type("ranks_2026-02.csv") == "ranks"
        assert _detect_feed_type("Rank_Monthly.csv") == "ranks"

    def test_holdings_file(self) -> None:
        assert _detect_feed_type("holdings_2026-02.csv") == "holdings"

    def test_category_returns_file(self) -> None:
        assert _detect_feed_type("category_returns_2026-03.csv") == "category_returns"
        assert _detect_feed_type("cat_ret_daily.csv") == "category_returns"

    def test_unknown_file(self) -> None:
        assert _detect_feed_type("random_data.csv") is None


# --- IngestionResult ---

class TestIngestionResult:
    def test_defaults(self) -> None:
        r = IngestionResult()
        assert r.status == "FAILED"
        assert r.inserted == 0
        assert r.errors == []


# --- IngestionService orchestration ---

class TestIngestionServiceFlow:
    """Test the full parse → upsert → log flow using sample CSV fixtures."""

    def test_full_nav_flow(self) -> None:
        """Parse a real nav CSV, mock the DB upsert, verify orchestration."""
        db = MagicMock()
        service = IngestionService(db)

        # Mock the repo upsert to return success
        service.repo.upsert_nav_daily = MagicMock(
            return_value=UpsertResult(inserted=10, updated=0, failed=0)
        )
        service.repo.create_ingestion_log = MagicMock()
        service.audit.log = MagicMock()

        fixtures_dir = Path(__file__).parent / "fixtures"
        result = service.ingest_nav_feed(str(fixtures_dir / "sample_nav.csv"))

        assert result.feed_type == "nav"
        assert result.status == "SUCCESS"
        assert result.total_rows == 10
        assert result.parsed_rows == 10
        assert result.inserted == 10
        assert result.failed == 0

        # Verify upsert was called with 10 records
        service.repo.upsert_nav_daily.assert_called_once()
        records = service.repo.upsert_nav_daily.call_args[0][0]
        assert len(records) == 10

        # Verify logging happened
        service.repo.create_ingestion_log.assert_called_once()
        service.audit.log.assert_called_once()

    def test_full_master_flow(self) -> None:
        db = MagicMock()
        service = IngestionService(db)
        service.repo.upsert_fund_masters = MagicMock(
            return_value=UpsertResult(inserted=5, updated=0, failed=0)
        )
        service.repo.create_ingestion_log = MagicMock()
        service.audit.log = MagicMock()

        fixtures_dir = Path(__file__).parent / "fixtures"
        result = service.ingest_master_feed(str(fixtures_dir / "sample_master.csv"))

        assert result.status == "SUCCESS"
        assert result.total_rows == 5
        assert result.inserted == 5

    def test_partial_failure(self) -> None:
        """When some rows fail parsing, status should be PARTIAL if any succeed."""
        db = MagicMock()
        service = IngestionService(db)
        service.repo.upsert_nav_daily = MagicMock(
            return_value=UpsertResult(inserted=1, updated=0, failed=0)
        )
        service.repo.create_ingestion_log = MagicMock()
        service.audit.log = MagicMock()

        # CSV with one good row and one row missing mstar_id
        csv_content = "SecId,DayEndNAV,DayEndNAVDate\nF001,100.00,2026-03-26\n,200.00,2026-03-25"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            f.flush()
            result = service.ingest_nav_feed(f.name)

        assert result.status == "PARTIAL"
        assert result.parsed_rows == 1
        assert result.total_rows == 2
        assert len(result.errors) > 0
        os.unlink(f.name)

    def test_empty_csv_status(self) -> None:
        db = MagicMock()
        service = IngestionService(db)
        service.repo.create_ingestion_log = MagicMock()
        service.audit.log = MagicMock()

        csv_content = "SecId,DayEndNAV,DayEndNAVDate\n"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            f.flush()
            result = service.ingest_nav_feed(f.name)

        assert result.status == "EMPTY"
        assert result.total_rows == 0
        os.unlink(f.name)

    def test_file_not_found(self) -> None:
        db = MagicMock()
        service = IngestionService(db)
        service.repo.create_ingestion_log = MagicMock()
        service.audit.log = MagicMock()

        result = service.ingest_nav_feed("/nonexistent/file.csv")
        assert result.status == "FAILED"
        assert len(result.errors) > 0


class TestIngestAllPending:
    def test_processes_matching_files(self) -> None:
        db = MagicMock()
        service = IngestionService(db)

        # Mock all ingest methods
        service.ingest_nav_feed = MagicMock(
            return_value=IngestionResult(feed_type="nav", status="SUCCESS")
        )
        service.ingest_master_feed = MagicMock(
            return_value=IngestionResult(feed_type="master", status="SUCCESS")
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "nav_2026-03-26.csv").write_text("SecId\nF001")
            (Path(tmpdir) / "master_weekly.csv").write_text("SecId\nF001")
            (Path(tmpdir) / "random.txt").write_text("ignored")

            results = service.ingest_all_pending(tmpdir)

        assert len(results) == 2

    def test_nonexistent_dir(self) -> None:
        db = MagicMock()
        service = IngestionService(db)
        results = service.ingest_all_pending("/nonexistent/dir")
        assert results == []
