"""Tests for /api/v1/ingestion/fetch endpoints."""

import os
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from fastapi.testclient import TestClient

from app.services.morningstar_fetcher import FetchResult


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


def _make_result(api_name: str, status: str = "success", fund_count: int = 100) -> FetchResult:
    r = FetchResult(api_name)
    r.status = status
    r.fund_count = fund_count
    r.mapped_fields = 500
    r.unmapped_fields = 10
    r.duration_ms = 1500
    return r


class TestFetchFull:
    @patch("app.api.v1.fetch.MorningstarFetcher")
    def test_post_full_returns_results(self, mock_cls, client) -> None:
        """POST /fetch/full → returns results array."""
        mock_fetcher = MagicMock()
        mock_fetcher.fetch_all.return_value = [
            _make_result("Identifier Data"),
            _make_result("Nav Data"),
        ]
        mock_cls.return_value = mock_fetcher

        resp = client.post("/api/v1/ingestion/fetch/full")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]["results"]) == 2


class TestFetchNav:
    @patch("app.api.v1.fetch.MorningstarFetcher")
    def test_post_nav_returns_2_results(self, mock_cls, client) -> None:
        """POST /fetch/nav → returns results for 2 APIs."""
        mock_fetcher = MagicMock()
        mock_fetcher.fetch_nav_only.return_value = [
            _make_result("Nav Data"),
            _make_result("Return Data"),
        ]
        mock_cls.return_value = mock_fetcher

        resp = client.post("/api/v1/ingestion/fetch/nav")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]["results"]) == 2


class TestFetchSingle:
    @patch("app.api.v1.fetch.MorningstarFetcher")
    def test_post_single_nav(self, mock_cls, client) -> None:
        """POST /fetch/single/nav → returns result for 1 API."""
        mock_fetcher = MagicMock()
        mock_fetcher.fetch_single_api.return_value = _make_result("Nav Data")
        mock_cls.return_value = mock_fetcher

        resp = client.post("/api/v1/ingestion/fetch/single/nav")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["api_name"] == "Nav Data"

    def test_post_single_invalid_name(self, client) -> None:
        """POST /fetch/single/invalid → 400."""
        resp = client.post("/api/v1/ingestion/fetch/single/invalid_api")
        assert resp.status_code == 400


class TestFetchStatus:
    @patch("app.api.v1.fetch.AuditRepository")
    def test_get_status(self, mock_repo_cls, client) -> None:
        """GET /fetch/status → returns last fetch from audit."""
        mock_repo = MagicMock()
        mock_repo.get_recent.return_value = []
        mock_repo_cls.return_value = mock_repo

        resp = client.get("/api/v1/ingestion/fetch/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
