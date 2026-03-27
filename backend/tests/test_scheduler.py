"""Tests for JobScheduler — start/stop, _run_with_audit, job stubs."""

import os
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.jobs.scheduler import JobScheduler


@pytest.fixture
def mock_session_factory():
    """Returns a callable that produces mock sessions."""
    session = MagicMock()
    factory = MagicMock(return_value=session)
    return factory


@pytest.fixture
def scheduler(mock_session_factory):
    return JobScheduler(mock_session_factory)


class TestStartStop:
    def test_start_registers_jobs(self, scheduler: JobScheduler) -> None:
        scheduler.start()
        assert scheduler._scheduler is not None
        assert scheduler._scheduler.running is True
        scheduler.stop()

    def test_stop_shuts_down(self, scheduler: JobScheduler) -> None:
        scheduler.start()
        scheduler.stop()
        assert scheduler._scheduler.running is False

    def test_double_start_is_safe(self, scheduler: JobScheduler) -> None:
        scheduler.start()
        scheduler.start()  # should not raise
        scheduler.stop()

    def test_stop_without_start_is_safe(self, scheduler: JobScheduler) -> None:
        scheduler.stop()  # should not raise


class TestRunWithAudit:
    def test_success_logs_start_and_completion(self, scheduler: JobScheduler) -> None:
        mock_func = MagicMock()
        session = scheduler._db_session_factory()
        scheduler._run_with_audit("test_job", mock_func)
        mock_func.assert_called_once()
        # audit log is called: once for start, once for completion
        audit_calls = session.add.call_args_list
        assert len(audit_calls) >= 2

    def test_failure_logs_start_and_error(self, scheduler: JobScheduler) -> None:
        mock_func = MagicMock(side_effect=RuntimeError("boom"))
        session = scheduler._db_session_factory()
        # Should NOT raise
        scheduler._run_with_audit("test_job", mock_func)
        mock_func.assert_called_once()
        # Should still have committed (audit entries)
        assert session.commit.called

    def test_never_raises(self, scheduler: JobScheduler) -> None:
        mock_func = MagicMock(side_effect=Exception("total failure"))
        # Must not raise
        scheduler._run_with_audit("test_job", mock_func)


class TestJobStubs:
    @patch("app.services.ingestion_service.IngestionService")
    def test_job_process_nav_feeds_no_dir(self, mock_ingestion_cls, scheduler):
        """When feed dir doesn't exist, job completes without error."""
        mock_svc = MagicMock()
        mock_svc.ingest_all_pending.return_value = []
        mock_ingestion_cls.return_value = mock_svc
        # Should not raise even if dir doesn't exist
        scheduler._run_with_audit("nav_feeds", scheduler.job_process_nav_feeds)

    @patch("app.services.ingestion_service.IngestionService")
    def test_job_process_master_feed_no_dir(self, mock_ingestion_cls, scheduler):
        mock_svc = MagicMock()
        mock_svc.ingest_all_pending.return_value = []
        mock_ingestion_cls.return_value = mock_svc
        scheduler._run_with_audit("master_feed", scheduler.job_process_master_feed)

    @patch("app.services.lens_service.LensService")
    def test_job_recompute_lens_scores(self, mock_lens_cls, scheduler):
        mock_svc = MagicMock()
        mock_svc.compute_all_categories.return_value = {"funds_scored": 10}
        mock_lens_cls.return_value = mock_svc
        scheduler._run_with_audit("lens_recompute", scheduler.job_recompute_lens_scores)

    @patch("app.services.override_service.OverrideService")
    def test_job_expire_overrides(self, mock_override_cls, scheduler):
        mock_svc = MagicMock()
        mock_svc.expire_stale_overrides.return_value = 3
        mock_override_cls.return_value = mock_svc
        scheduler._run_with_audit("expire_overrides", scheduler.job_expire_overrides)

    @patch("app.services.marketpulse_client.MarketPulseClient")
    def test_job_sync_marketpulse(self, mock_mp_cls, scheduler):
        mock_client = MagicMock()
        mock_client.get_breadth_history.return_value = {"data": []}
        mock_client.get_sentiment.return_value = {"score": 50}
        mock_client.get_sector_scores.return_value = []
        mock_mp_cls.return_value = mock_client
        scheduler._run_with_audit("marketpulse_sync", scheduler.job_sync_marketpulse)
