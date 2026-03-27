"""Tests for Audit API endpoints — paginated list, filters, summary, fund-specific."""

import os
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from fastapi.testclient import TestClient


def _mock_audit_entry(**overrides) -> dict:
    defaults = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "actor": "system/ingestion",
        "action": "DATA_INGESTED",
        "entity_type": "ingestion",
        "entity_id": "nav_2026-03-27.csv",
        "details": {"status": "SUCCESS", "total_rows": 1000},
    }
    defaults.update(overrides)
    return defaults


@pytest.fixture
def client() -> TestClient:
    from app.main import app
    return TestClient(app)


class TestAuditList:
    @patch("app.api.v1.audit.AuditRepository")
    def test_paginated_list_default(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.get_paginated.return_value = (
            [_mock_audit_entry()],
            1,
        )
        resp = client.get("/api/v1/audit")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]["items"]) == 1
        assert body["data"]["total"] == 1

    @patch("app.api.v1.audit.AuditRepository")
    def test_filter_by_entity_type(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.get_paginated.return_value = ([], 0)
        resp = client.get("/api/v1/audit?entity_type=ingestion")
        assert resp.status_code == 200
        call_kwargs = mock_cls.return_value.get_paginated.call_args
        assert call_kwargs[1]["entity_type"] == "ingestion"

    @patch("app.api.v1.audit.AuditRepository")
    def test_filter_by_action(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.get_paginated.return_value = ([], 0)
        resp = client.get("/api/v1/audit?action=DATA_INGESTED")
        assert resp.status_code == 200
        call_kwargs = mock_cls.return_value.get_paginated.call_args
        assert call_kwargs[1]["action"] == "DATA_INGESTED"

    @patch("app.api.v1.audit.AuditRepository")
    def test_filter_by_date_range(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.get_paginated.return_value = ([], 0)
        resp = client.get("/api/v1/audit?start_date=2026-03-01&end_date=2026-03-27")
        assert resp.status_code == 200
        call_kwargs = mock_cls.return_value.get_paginated.call_args
        assert call_kwargs[1]["start_date"] is not None
        assert call_kwargs[1]["end_date"] is not None

    @patch("app.api.v1.audit.AuditRepository")
    def test_pagination_params(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.get_paginated.return_value = ([], 0)
        resp = client.get("/api/v1/audit?page=2&page_size=25")
        assert resp.status_code == 200
        call_kwargs = mock_cls.return_value.get_paginated.call_args
        assert call_kwargs[1]["page"] == 2
        assert call_kwargs[1]["page_size"] == 25


class TestAuditSummary:
    @patch("app.api.v1.audit.AuditRepository")
    def test_summary_default_days(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.get_summary.return_value = {
            "by_action": {"DATA_INGESTED": 5},
            "by_actor": {"system/ingestion": 5},
            "total": 5,
            "latest_timestamp": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.get("/api/v1/audit/summary")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "by_action" in body["data"]

    @patch("app.api.v1.audit.AuditRepository")
    def test_summary_custom_days(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.get_summary.return_value = {
            "by_action": {},
            "by_actor": {},
            "total": 0,
            "latest_timestamp": None,
        }
        resp = client.get("/api/v1/audit/summary?days=30")
        assert resp.status_code == 200
        mock_cls.return_value.get_summary.assert_called_once_with(days=30)


class TestAuditFund:
    @patch("app.api.v1.audit.AuditRepository")
    def test_fund_audit_entries(self, mock_cls: MagicMock, client: TestClient) -> None:
        entries = [_mock_audit_entry(entity_id="F0GBR06S2Q")]
        mock_cls.return_value.get_by_entity.return_value = entries
        resp = client.get("/api/v1/audit/fund/F0GBR06S2Q")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) >= 1

    @patch("app.api.v1.audit.AuditRepository")
    def test_fund_audit_empty(self, mock_cls: MagicMock, client: TestClient) -> None:
        mock_cls.return_value.get_by_entity.return_value = []
        resp = client.get("/api/v1/audit/fund/NONEXISTENT")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
