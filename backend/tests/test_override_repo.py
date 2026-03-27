"""Tests for OverrideRepository — FM override CRUD."""

import os
import uuid
from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.models.db.overrides import FMOverride
from app.repositories.override_repo import OverrideRepository


def _make_override(**overrides) -> FMOverride:
    defaults = {
        "id": uuid.uuid4(),
        "created_by": "nimish",
        "override_type": "FUND_BOOST",
        "target_id": "F0GBR06S2Q",
        "direction": "POSITIVE",
        "magnitude": 3,
        "rationale": "Strong Q4 earnings and improving fundamentals across all metrics",
        "expires_at": date(2026, 6, 30),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    obj = FMOverride()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


class TestCreateOverride:
    def test_creates_and_returns_dict(self) -> None:
        db = MagicMock()
        repo = OverrideRepository(db)
        data = {
            "created_by": "nimish",
            "override_type": "FUND_BOOST",
            "target_id": "F0GBR06S2Q",
            "direction": "POSITIVE",
            "magnitude": 4,
            "rationale": "Strong fundamentals and earnings momentum in recent quarter",
            "expires_at": date(2026, 6, 30),
        }
        result = repo.create_override(data)
        db.add.assert_called_once()
        db.flush.assert_called_once()
        assert result["override_type"] == "FUND_BOOST"
        assert result["is_active"] is True

    def test_creates_category_tilt(self) -> None:
        db = MagicMock()
        repo = OverrideRepository(db)
        data = {
            "created_by": "nimish",
            "override_type": "CATEGORY_TILT",
            "target_id": "Large Cap",
            "direction": "POSITIVE",
            "magnitude": 2,
            "rationale": "Large caps are undervalued relative to mid and small caps",
            "expires_at": date(2026, 9, 30),
        }
        result = repo.create_override(data)
        assert result["override_type"] == "CATEGORY_TILT"


class TestListOverrides:
    def test_list_active_only(self) -> None:
        o1 = _make_override()
        o2 = _make_override(override_type="FUND_SUPPRESS")
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [o1, o2]
        repo = OverrideRepository(db)
        result = repo.list_overrides(active_only=True)
        assert len(result) == 2

    def test_filter_by_type(self) -> None:
        o1 = _make_override(override_type="FUND_BOOST")
        db = MagicMock()
        chain = db.query.return_value.filter.return_value
        chain.filter.return_value.order_by.return_value.all.return_value = [o1]
        repo = OverrideRepository(db)
        result = repo.list_overrides(active_only=True, override_type="FUND_BOOST")
        assert len(result) == 1

    def test_list_includes_inactive(self) -> None:
        o1 = _make_override(is_active=False)
        db = MagicMock()
        db.query.return_value.order_by.return_value.all.return_value = [o1]
        repo = OverrideRepository(db)
        result = repo.list_overrides(active_only=False)
        assert len(result) == 1


class TestGetOverride:
    def test_returns_dict_when_found(self) -> None:
        override = _make_override()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = override
        repo = OverrideRepository(db)
        result = repo.get_override(str(override.id))
        assert result is not None
        assert result["override_type"] == "FUND_BOOST"

    def test_returns_none_when_not_found(self) -> None:
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        repo = OverrideRepository(db)
        assert repo.get_override(str(uuid.uuid4())) is None


class TestDeactivateOverride:
    def test_deactivates_existing(self) -> None:
        override = _make_override()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = override
        repo = OverrideRepository(db)
        assert repo.deactivate_override(str(override.id)) is True
        assert override.is_active is False

    def test_returns_false_when_not_found(self) -> None:
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        repo = OverrideRepository(db)
        assert repo.deactivate_override(str(uuid.uuid4())) is False


class TestFundSpecificOverrides:
    def test_get_overrides_for_fund(self) -> None:
        o1 = _make_override(target_id="F0GBR06S2Q", override_type="FUND_BOOST")
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [o1]
        repo = OverrideRepository(db)
        result = repo.get_overrides_for_fund("F0GBR06S2Q")
        assert len(result) == 1
        assert result[0]["target_id"] == "F0GBR06S2Q"


class TestCategoryOverrides:
    def test_get_overrides_for_category(self) -> None:
        o1 = _make_override(target_id="Large Cap", override_type="CATEGORY_TILT")
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [o1]
        repo = OverrideRepository(db)
        result = repo.get_overrides_for_category("Large Cap")
        assert len(result) == 1


class TestExpireStale:
    def test_expires_past_overrides(self) -> None:
        o1 = _make_override(expires_at=date(2025, 1, 1), is_active=True)
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [o1]
        repo = OverrideRepository(db)
        count = repo.expire_stale_overrides()
        assert count == 1
        assert o1.is_active is False

    def test_returns_zero_when_none_stale(self) -> None:
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        repo = OverrideRepository(db)
        assert repo.expire_stale_overrides() == 0
