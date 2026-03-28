"""Tests for backfill API endpoints."""

import os
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestBackfillNavTrigger:
    @patch("app.api.v1.backfill.NAVBackfillService")
    @patch("app.api.v1.backfill.get_db")
    def test_trigger_backfill_returns_immediately(
        self, mock_get_db: MagicMock, mock_service_cls: MagicMock, client: TestClient
    ) -> None:
        """POST /backfill/nav should return immediately (background thread)."""
        mock_db = MagicMock()
        mock_get_db.return_value = iter([mock_db])
        mock_service = MagicMock()
        mock_service_cls.return_value = mock_service

        response = client.post("/api/v1/backfill/nav?start_date=2024-01-01")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "started" in data["data"]["status"].lower() or "launched" in data["data"]["status"].lower()


class TestBackfillStatus:
    @patch("app.api.v1.backfill.backfill_progress")
    def test_backfill_status_endpoint(self, mock_progress: MagicMock, client: TestClient) -> None:
        """GET /backfill/nav/status should return progress info."""
        mock_progress.get_status.return_value = {
            "total_funds": 100,
            "completed": 50,
            "failed": 2,
            "running": True,
            "total_navs_inserted": 25000,
        }

        response = client.get("/api/v1/backfill/nav/status")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["total_funds"] == 100
        assert data["data"]["completed"] == 50


class TestBackfillSingleFund:
    @patch("app.api.v1.backfill.NAVBackfillService")
    @patch("app.api.v1.backfill.get_db")
    def test_backfill_single_fund_endpoint(
        self, mock_get_db: MagicMock, mock_service_cls: MagicMock, client: TestClient
    ) -> None:
        """POST /backfill/nav/single/{mstar_id} should backfill one fund synchronously."""
        mock_db = MagicMock()
        mock_get_db.return_value = iter([mock_db])
        mock_service = MagicMock()
        mock_service_cls.return_value = mock_service
        mock_service.backfill_fund.return_value = 2500

        response = client.post(
            "/api/v1/backfill/nav/single/F00000VSLQ?start_date=2024-01-01"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["nav_count"] == 2500
        assert data["data"]["mstar_id"] == "F00000VSLQ"
