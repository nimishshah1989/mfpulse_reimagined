"""Tests for OverrideService — FM override CRUD with audit trail."""

import os
import uuid
from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.core.exceptions import NotFoundError
from app.services.override_service import OverrideService


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


class TestCreateOverride:
    def test_creates_with_audit_trail(self) -> None:
        db = MagicMock()
        service = OverrideService(db)
        override = _mock_override()
        service.override_repo.create_override = MagicMock(return_value=override)
        service.audit_repo.log = MagicMock(return_value=uuid.uuid4())

        data = {
            "created_by": "nimish",
            "override_type": "FUND_BOOST",
            "target_id": "F0GBR06S2Q",
            "direction": "POSITIVE",
            "magnitude": 3,
            "rationale": "Strong fundamentals and earnings momentum in recent quarter",
            "expires_at": date(2026, 6, 30),
        }
        result = service.create_override(data)

        assert result["override_type"] == "FUND_BOOST"
        service.audit_repo.log.assert_called_once()
        call_kwargs = service.audit_repo.log.call_args
        assert "OVERRIDE_CREATE" in str(call_kwargs)
        db.commit.assert_called_once()


class TestListOverrides:
    def test_lists_with_filters(self) -> None:
        db = MagicMock()
        service = OverrideService(db)
        overrides = [_mock_override(), _mock_override(override_type="FUND_SUPPRESS")]
        service.override_repo.list_overrides = MagicMock(return_value=overrides)

        result = service.list_overrides(active_only=True)
        assert len(result) == 2


class TestGetOverride:
    def test_returns_override(self) -> None:
        db = MagicMock()
        service = OverrideService(db)
        override = _mock_override()
        service.override_repo.get_override = MagicMock(return_value=override)

        result = service.get_override(override["id"])
        assert result["override_type"] == "FUND_BOOST"

    def test_raises_not_found(self) -> None:
        db = MagicMock()
        service = OverrideService(db)
        service.override_repo.get_override = MagicMock(return_value=None)

        with pytest.raises(NotFoundError):
            service.get_override(str(uuid.uuid4()))


class TestDeactivateOverride:
    def test_deactivates_with_audit(self) -> None:
        db = MagicMock()
        service = OverrideService(db)
        override = _mock_override()
        service.override_repo.get_override = MagicMock(return_value=override)
        service.override_repo.deactivate_override = MagicMock(return_value=True)
        service.audit_repo.log = MagicMock(return_value=uuid.uuid4())

        result = service.deactivate_override(override["id"])
        assert result is True
        service.audit_repo.log.assert_called_once()
        call_kwargs = service.audit_repo.log.call_args
        assert "OVERRIDE_DEACTIVATE" in str(call_kwargs)
        db.commit.assert_called_once()

    def test_raises_not_found(self) -> None:
        db = MagicMock()
        service = OverrideService(db)
        service.override_repo.get_override = MagicMock(return_value=None)

        with pytest.raises(NotFoundError):
            service.deactivate_override(str(uuid.uuid4()))


class TestExpireStale:
    def test_expires_with_audit_when_count_positive(self) -> None:
        db = MagicMock()
        service = OverrideService(db)
        service.override_repo.expire_stale_overrides = MagicMock(return_value=3)
        service.audit_repo.log = MagicMock(return_value=uuid.uuid4())

        count = service.expire_stale_overrides()
        assert count == 3
        service.audit_repo.log.assert_called_once()
        db.commit.assert_called_once()

    def test_no_audit_when_count_zero(self) -> None:
        db = MagicMock()
        service = OverrideService(db)
        service.override_repo.expire_stale_overrides = MagicMock(return_value=0)
        service.audit_repo.log = MagicMock()

        count = service.expire_stale_overrides()
        assert count == 0
        service.audit_repo.log.assert_not_called()
        db.commit.assert_called_once()


class TestFundOverrides:
    def test_get_overrides_for_fund(self) -> None:
        db = MagicMock()
        service = OverrideService(db)
        overrides = [_mock_override()]
        service.override_repo.get_overrides_for_fund = MagicMock(return_value=overrides)

        result = service.get_overrides_for_fund("F0GBR06S2Q")
        assert len(result) == 1


class TestCategoryOverrides:
    def test_get_overrides_for_category(self) -> None:
        db = MagicMock()
        service = OverrideService(db)
        overrides = [_mock_override(override_type="CATEGORY_TILT", target_id="Large Cap")]
        service.override_repo.get_overrides_for_category = MagicMock(return_value=overrides)

        result = service.get_overrides_for_category("Large Cap")
        assert len(result) == 1
