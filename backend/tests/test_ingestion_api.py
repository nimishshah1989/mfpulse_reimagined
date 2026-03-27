"""Tests for ingestion and marketpulse API endpoints."""

import io
import os
from unittest.mock import patch, MagicMock

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from fastapi.testclient import TestClient

from app.services.ingestion_service import IngestionResult
from app.repositories.ingestion_repo import UpsertResult


@pytest.fixture
def api_client() -> TestClient:
    from app.main import app
    return TestClient(app)


class TestUploadFeed:
    @patch("app.api.v1.ingestion.IngestionService")
    @patch("app.api.v1.ingestion.get_settings")
    @patch("app.api.v1.ingestion.get_db")
    def test_upload_nav_csv(self, mock_get_db: MagicMock, mock_get_settings: MagicMock, mock_svc_cls: MagicMock, api_client: TestClient) -> None:
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            mock_settings = MagicMock()
            mock_settings.feed_csv_dir = tmpdir
            mock_get_settings.return_value = mock_settings

            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])

            mock_svc = MagicMock()
            mock_svc.ingest_nav_feed.return_value = IngestionResult(
                feed_type="nav",
                source_file="test.csv",
                status="SUCCESS",
                total_rows=5,
                parsed_rows=5,
                inserted=5,
                updated=0,
                failed=0,
                duration_ms=100,
            )
            mock_svc_cls.return_value = mock_svc

            csv_content = b"SecId,DayEndNAV,DayEndNAVDate\nF001,100.00,2026-03-26"
            response = api_client.post(
                "/api/v1/ingestion/upload/nav",
                files={"file": ("test_nav.csv", io.BytesIO(csv_content), "text/csv")},
            )

            assert response.status_code == 200
            body = response.json()
            assert body["success"] is True
            assert body["data"]["status"] == "SUCCESS"
            assert body["data"]["inserted"] == 5

    def test_invalid_feed_type_returns_error(self, api_client: TestClient) -> None:
        csv_content = b"SecId\nF001"
        response = api_client.post(
            "/api/v1/ingestion/upload/invalid_type",
            files={"file": ("test.csv", io.BytesIO(csv_content), "text/csv")},
        )
        # Should be 422 (VALIDATION_ERROR maps to 422)
        assert response.status_code == 422
        body = response.json()
        assert body["success"] is False
        assert "invalid" in body["error"]["message"].lower()


class TestDataFreshness:
    @patch("app.api.v1.ingestion.FreshnessRepository")
    @patch("app.api.v1.ingestion.get_db")
    def test_returns_dates(self, mock_get_db: MagicMock, mock_repo_cls: MagicMock, api_client: TestClient) -> None:
        mock_db = MagicMock()
        mock_get_db.return_value = iter([mock_db])

        mock_repo = MagicMock()
        mock_repo.get_latest_dates.return_value = {
            "nav_daily": "2026-03-26",
            "risk_stats_monthly": "2026-02-28",
        }
        mock_repo.get_fund_count.return_value = 1500
        mock_repo.get_nav_coverage.return_value = {
            "total_funds": 1500,
            "funds_with_nav_latest": 1200,
            "latest_nav_date": "2026-03-26",
        }
        mock_repo_cls.return_value = mock_repo

        response = api_client.get("/api/v1/ingestion/data-freshness")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "latest_dates" in body["data"]
        assert body["data"]["fund_count"] == 1500


class TestMarketPulseEndpoints:
    @patch("app.api.v1.marketpulse._get_client")
    def test_breadth_success(self, mock_get_client: MagicMock, api_client: TestClient) -> None:
        mock_client = MagicMock()
        mock_client.get_breadth_history.return_value = {"breadth_21ema": 55.2}
        mock_get_client.return_value = mock_client

        response = api_client.get("/api/v1/market/breadth")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["breadth_21ema"] == 55.2

    @patch("app.api.v1.marketpulse._get_client")
    def test_breadth_unavailable(self, mock_get_client: MagicMock, api_client: TestClient) -> None:
        mock_client = MagicMock()
        mock_client.get_breadth_history.return_value = None
        mock_get_client.return_value = mock_client

        response = api_client.get("/api/v1/market/breadth")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is False
        assert body["error"]["code"] == "MARKETPULSE_UNAVAILABLE"

    @patch("app.api.v1.marketpulse._get_client")
    def test_sentiment(self, mock_get_client: MagicMock, api_client: TestClient) -> None:
        mock_client = MagicMock()
        mock_client.get_sentiment.return_value = {"composite": 0.72}
        mock_get_client.return_value = mock_client

        response = api_client.get("/api/v1/market/sentiment")
        assert response.status_code == 200
        assert response.json()["data"]["composite"] == 0.72

    @patch("app.api.v1.marketpulse._get_client")
    def test_sectors(self, mock_get_client: MagicMock, api_client: TestClient) -> None:
        mock_client = MagicMock()
        mock_client.get_sector_scores.return_value = [{"sector": "Tech", "rs": 88}]
        mock_get_client.return_value = mock_client

        response = api_client.get("/api/v1/market/sectors")
        assert response.status_code == 200
        assert response.json()["data"][0]["sector"] == "Tech"

    @patch("app.api.v1.marketpulse._get_client")
    def test_regime(self, mock_get_client: MagicMock, api_client: TestClient) -> None:
        mock_client = MagicMock()
        mock_client.get_market_picks.return_value = {"regime": "BULLISH"}
        mock_get_client.return_value = mock_client

        response = api_client.get("/api/v1/market/regime")
        assert response.status_code == 200
        assert response.json()["data"]["regime"] == "BULLISH"
