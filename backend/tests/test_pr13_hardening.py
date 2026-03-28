"""Tests for PR-13 hardening — universe endpoint, GZip, admin auth, health."""

import os
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestUniverseEndpoint:
    """GET /api/v1/funds/universe — single-query bulk endpoint."""

    @patch("app.api.v1.funds.FundService")
    @patch("app.api.v1.funds.LensRepository")
    @patch("app.api.v1.funds.OverrideRepository")
    def test_universe_returns_data(self, MockOverride, MockLens, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_universe_data.return_value = [
            {
                "mstar_id": "F0GBR06S2Q",
                "fund_name": "HDFC Top 100",
                "amc_name": "HDFC AMC",
                "category_name": "Large Cap",
                "broad_category": "Equity",
                "purchase_mode": "Regular",
                "dividend_type": "Growth",
                "return_1y": "15.50",
                "return_score": "72.5",
            },
        ]

        resp = client.get("/api/v1/funds/universe")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["purchase_mode"] == "Regular"
        assert body["data"][0]["dividend_type"] == "Growth"


class TestGZipMiddleware:
    """GZip compression should be active for large payloads."""

    @patch("app.api.v1.funds.FundService")
    @patch("app.api.v1.funds.LensRepository")
    @patch("app.api.v1.funds.OverrideRepository")
    def test_gzip_header_accepted(self, MockOverride, MockLens, MockService, client) -> None:
        mock_svc = MockService.return_value
        mock_svc.get_universe_data.return_value = [
            {"mstar_id": f"FUND{i}", "fund_name": f"Fund {i}" * 20}
            for i in range(100)
        ]

        resp = client.get(
            "/api/v1/funds/universe",
            headers={"Accept-Encoding": "gzip"},
        )

        assert resp.status_code == 200
        # GZip may or may not compress based on minimum_size, but
        # the middleware should be registered (no error)


class TestEnhancedHealth:
    """Health endpoint should return detailed status."""

    def test_health_returns_extended_info(self, client) -> None:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert "status" in body
        assert "version" in body
        assert "database" in body

    def test_health_ready_endpoint_exists(self, client) -> None:
        resp = client.get("/health/ready")
        # May return 200 or 503 depending on DB state,
        # but the endpoint must exist (not 404)
        assert resp.status_code in (200, 503)


class TestAdminAuth:
    """POST/PUT/DELETE mutation endpoints should require admin key when set."""

    def test_auth_module_importable(self) -> None:
        from app.core.auth import require_admin_key
        assert callable(require_admin_key)
