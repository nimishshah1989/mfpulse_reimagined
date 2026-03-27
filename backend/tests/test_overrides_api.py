"""Tests for Override API endpoints — validation and CRUD."""

import os
import uuid
from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from fastapi.testclient import TestClient


def _mock_override(**overrides) -> dict:
    defaults = {
        "id": str(uuid.uuid4()),
        "created_by": "nimish",
        "override_type": "FUND_BOOST",
        "target_id": "F0GBR06S2Q",
        "direction": "POSITIVE",
        "magnitude": 3,
        "rationale": "Strong fundamentals and earnings momentum in recent quarter",
        "expires_at": "2026-06-30",
        "is_active": True,
        "created_at": str(datetime.now(timezone.utc)),
    }
    defaults.update(overrides)
    return defaults


@pytest.fixture
def client() -> TestClient:
    from app.main import app
    return TestClient(app)


class TestCreateOverride:
    @patch("app.api.v1.overrides.OverrideService")
    def test_create_success(self, mock_cls: MagicMock, client: TestClient) -> None:
        override = _mock_override()
        mock_cls.return_value.create_override.return_value = override
        resp = client.post("/api/v1/overrides", json={
            "created_by": "nimish",
            "override_type": "FUND_BOOST",
            "target_id": "F0GBR06S2Q",
            "direction": "POSITIVE",
            "magnitude": 3,
            "rationale": "Strong fundamentals and earnings momentum in recent quarter",
            "expires_at": "2026-06-30",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["override_type"] == "FUND_BOOST"


class TestValidation:
    def test_missing_rationale_422(self, client: TestClient) -> None:
        resp = client.post("/api/v1/overrides", json={
            "created_by": "nimish",
            "override_type": "FUND_BOOST",
            "target_id": "F0GBR06S2Q",
            "direction": "POSITIVE",
            "magnitude": 3,
            "expires_at": "2026-06-30",
        })
        assert resp.status_code == 422

    def test_short_rationale_422(self, client: TestClient) -> None:
        resp = client.post("/api/v1/overrides", json={
            "created_by": "nimish",
            "override_type": "FUND_BOOST",
            "target_id": "F0GBR06S2Q",
            "direction": "POSITIVE",
            "magnitude": 3,
            "rationale": "Too short",
            "expires_at": "2026-06-30",
        })
        assert resp.status_code == 422

    def test_magnitude_zero_422(self, client: TestClient) -> None:
        resp = client.post("/api/v1/overrides", json={
            "created_by": "nimish",
            "override_type": "FUND_BOOST",
            "target_id": "F0GBR06S2Q",
            "direction": "POSITIVE",
            "magnitude": 0,
            "rationale": "Strong fundamentals and earnings momentum in recent quarter",
            "expires_at": "2026-06-30",
        })
        assert resp.status_code == 422

    def test_magnitude_six_422(self, client: TestClient) -> None:
        resp = client.post("/api/v1/overrides", json={
            "created_by": "nimish",
            "override_type": "FUND_BOOST",
            "target_id": "F0GBR06S2Q",
            "direction": "POSITIVE",
            "magnitude": 6,
            "rationale": "Strong fundamentals and earnings momentum in recent quarter",
            "expires_at": "2026-06-30",
        })
        assert resp.status_code == 422

    def test_invalid_override_type_422(self, client: TestClient) -> None:
        resp = client.post("/api/v1/overrides", json={
            "created_by": "nimish",
            "override_type": "INVALID_TYPE",
            "target_id": "F0GBR06S2Q",
            "direction": "POSITIVE",
            "magnitude": 3,
            "rationale": "Strong fundamentals and earnings momentum in recent quarter",
            "expires_at": "2026-06-30",
        })
        assert resp.status_code == 422

    def test_invalid_direction_422(self, client: TestClient) -> None:
        resp = client.post("/api/v1/overrides", json={
            "created_by": "nimish",
            "override_type": "FUND_BOOST",
            "target_id": "F0GBR06S2Q",
            "direction": "INVALID",
            "magnitude": 3,
            "rationale": "Strong fundamentals and earnings momentum in recent quarter",
            "expires_at": "2026-06-30",
        })
        assert resp.status_code == 422


class TestListOverrides:
    @patch("app.api.v1.overrides.OverrideService")
    def test_list_overrides(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.list_overrides.return_value = [_mock_override()]
        resp = client.get("/api/v1/overrides")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1


class TestGetOverride:
    @patch("app.api.v1.overrides.OverrideService")
    def test_get_by_id(self, mock_cls: MagicMock, client: TestClient) -> None:
        override = _mock_override()
        mock_cls.return_value.get_override.return_value = override
        resp = client.get(f"/api/v1/overrides/{override['id']}")
        assert resp.status_code == 200


class TestDeactivateOverride:
    @patch("app.api.v1.overrides.OverrideService")
    def test_deactivate(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.deactivate_override.return_value = True
        oid = str(uuid.uuid4())
        resp = client.delete(f"/api/v1/overrides/{oid}")
        assert resp.status_code == 200
        assert resp.json()["data"]["deactivated"] is True


class TestFundOverrides:
    @patch("app.api.v1.overrides.OverrideService")
    def test_get_by_fund(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.get_overrides_for_fund.return_value = [_mock_override()]
        resp = client.get("/api/v1/overrides/fund/F0GBR06S2Q")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1


class TestExpireStale:
    @patch("app.api.v1.overrides.OverrideService")
    def test_expire_stale(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.expire_stale_overrides.return_value = 2
        resp = client.post("/api/v1/overrides/expire-stale")
        assert resp.status_code == 200
        assert resp.json()["data"]["expired_count"] == 2
