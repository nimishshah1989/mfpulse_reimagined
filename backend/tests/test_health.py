"""Tests for health endpoints."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_health_endpoint_returns_200() -> None:
    """GET /health should return 200 with status, database, version."""
    with patch("app.main.check_db_connection", return_value=True):
        response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert "version" in data


def test_root_health_degraded_when_db_down() -> None:
    """GET /health should report degraded when DB is unreachable."""
    with patch("app.main.check_db_connection", return_value=False):
        response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["database"] == "disconnected"


def test_system_health_endpoint() -> None:
    """GET /api/v1/system/health should return API envelope with health data."""
    with patch("app.api.v1.system.check_db_connection", return_value=True):
        response = client.get("/api/v1/system/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert body["data"]["database"] == "connected"
    assert "uptime_seconds" in body["data"]


def test_system_config_endpoint() -> None:
    """GET /api/v1/system/config should return non-sensitive config."""
    response = client.get("/api/v1/system/config")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["app_version"] == "0.1.0"
    assert "database_url" not in body["data"]
    assert "morningstar" not in str(body["data"]).lower()
