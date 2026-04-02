"""Tests for Jobs API — trigger and status endpoints."""

import os
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from app.main import app
    return TestClient(app)


class TestTriggerJob:
    @patch("app.api.v1.jobs.get_scheduler")
    def test_trigger_valid_job(self, mock_get_sched: MagicMock, client: TestClient) -> None:
        mock_sched = MagicMock()
        mock_sched.trigger_job.return_value = True
        mock_get_sched.return_value = mock_sched
        resp = client.post("/api/v1/jobs/trigger/nav_feeds")
        assert resp.status_code == 202
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["job_name"] == "nav_feeds"

    @patch("app.api.v1.jobs.get_scheduler")
    def test_trigger_invalid_job_400(self, mock_get_sched: MagicMock, client: TestClient) -> None:
        mock_sched = MagicMock()
        mock_sched.trigger_job.return_value = False
        mock_get_sched.return_value = mock_sched
        resp = client.post("/api/v1/jobs/trigger/nonexistent_job")
        assert resp.status_code == 400

    @patch("app.api.v1.jobs.get_scheduler")
    def test_trigger_no_scheduler(self, mock_get_sched: MagicMock, client: TestClient) -> None:
        mock_get_sched.return_value = None
        resp = client.post("/api/v1/jobs/trigger/nav_feeds")
        assert resp.status_code == 503


class TestJobStatus:
    @patch("app.api.v1.jobs.get_scheduler")
    def test_job_status_returns_all_jobs(self, mock_get_sched: MagicMock, client: TestClient) -> None:
        mock_sched = MagicMock()
        mock_sched.get_job_status.return_value = [
            {
                "job_name": "nav_feeds",
                "schedule": "Daily 9:30 PM IST",
                "next_run": "2026-03-28T16:00:00Z",
                "last_status": "SUCCESS",
            },
        ]
        mock_get_sched.return_value = mock_sched
        resp = client.get("/api/v1/jobs/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) >= 1
        assert body["data"][0]["job_name"] == "nav_feeds"

    @patch("app.api.v1.jobs.get_scheduler")
    def test_job_status_no_scheduler(self, mock_get_sched: MagicMock, client: TestClient) -> None:
        mock_get_sched.return_value = None
        resp = client.get("/api/v1/jobs/status")
        assert resp.status_code == 503
