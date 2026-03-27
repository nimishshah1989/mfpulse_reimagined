"""Tests for strategy and override Pydantic schemas — validation rules."""

import os
from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.models.schemas.strategy_schemas import (
    CreateOverrideRequest,
    CreateStrategyRequest,
    BacktestRequest,
    DeployRequest,
    UpdateStrategyRequest,
)


class TestCreateStrategyRequest:
    def test_valid_request(self) -> None:
        req = CreateStrategyRequest(name="Test", created_by="nimish")
        assert req.name == "Test"
        assert req.strategy_type == "MODEL_PORTFOLIO"

    def test_name_too_short(self) -> None:
        with pytest.raises(ValidationError):
            CreateStrategyRequest(name="A", created_by="nimish")

    def test_invalid_strategy_type(self) -> None:
        with pytest.raises(ValidationError):
            CreateStrategyRequest(name="Test", strategy_type="INVALID", created_by="nimish")

    def test_all_valid_types(self) -> None:
        for t in ["MODEL_PORTFOLIO", "THEMATIC", "TACTICAL", "CUSTOM"]:
            req = CreateStrategyRequest(name="Test", strategy_type=t, created_by="nimish")
            assert req.strategy_type == t


class TestBacktestRequest:
    def test_valid_request(self) -> None:
        req = BacktestRequest(start_date=date(2021, 1, 1))
        assert req.mode == "SIP"
        assert req.initial_investment == Decimal("1000000")

    def test_invalid_mode(self) -> None:
        with pytest.raises(ValidationError):
            BacktestRequest(start_date=date(2021, 1, 1), mode="INVALID")


class TestDeployRequest:
    def test_valid_request(self) -> None:
        req = DeployRequest(portfolio_name="Test Portfolio")
        assert req.portfolio_name == "Test Portfolio"

    def test_name_too_short(self) -> None:
        with pytest.raises(ValidationError):
            DeployRequest(portfolio_name="A")


class TestCreateOverrideRequest:
    def test_valid_request(self) -> None:
        req = CreateOverrideRequest(
            created_by="nimish",
            override_type="FUND_BOOST",
            target_id="F0GBR06S2Q",
            direction="POSITIVE",
            magnitude=3,
            rationale="Strong fundamentals and improving earnings trajectory",
            expires_at=date(2026, 6, 30),
        )
        assert req.override_type == "FUND_BOOST"

    def test_invalid_override_type(self) -> None:
        with pytest.raises(ValidationError):
            CreateOverrideRequest(
                created_by="nimish",
                override_type="INVALID",
                target_id="F0GBR06S2Q",
                direction="POSITIVE",
                magnitude=3,
                rationale="Strong fundamentals and improving earnings trajectory",
                expires_at=date(2026, 6, 30),
            )

    def test_invalid_direction(self) -> None:
        with pytest.raises(ValidationError):
            CreateOverrideRequest(
                created_by="nimish",
                override_type="FUND_BOOST",
                target_id="F0GBR06S2Q",
                direction="UP",
                magnitude=3,
                rationale="Strong fundamentals and improving earnings trajectory",
                expires_at=date(2026, 6, 30),
            )

    def test_magnitude_too_low(self) -> None:
        with pytest.raises(ValidationError):
            CreateOverrideRequest(
                created_by="nimish",
                override_type="FUND_BOOST",
                target_id="F0GBR06S2Q",
                direction="POSITIVE",
                magnitude=0,
                rationale="Strong fundamentals and improving earnings trajectory",
                expires_at=date(2026, 6, 30),
            )

    def test_magnitude_too_high(self) -> None:
        with pytest.raises(ValidationError):
            CreateOverrideRequest(
                created_by="nimish",
                override_type="FUND_BOOST",
                target_id="F0GBR06S2Q",
                direction="POSITIVE",
                magnitude=6,
                rationale="Strong fundamentals and improving earnings trajectory",
                expires_at=date(2026, 6, 30),
            )

    def test_rationale_too_short(self) -> None:
        with pytest.raises(ValidationError):
            CreateOverrideRequest(
                created_by="nimish",
                override_type="FUND_BOOST",
                target_id="F0GBR06S2Q",
                direction="POSITIVE",
                magnitude=3,
                rationale="Short",
                expires_at=date(2026, 6, 30),
            )

    def test_all_valid_types(self) -> None:
        for t in ["FUND_BOOST", "FUND_SUPPRESS", "CATEGORY_TILT", "SECTOR_VIEW"]:
            req = CreateOverrideRequest(
                created_by="nimish",
                override_type=t,
                target_id="target",
                direction="POSITIVE",
                magnitude=3,
                rationale="Valid rationale that is long enough for validation",
                expires_at=date(2026, 6, 30),
            )
            assert req.override_type == t

    def test_all_valid_directions(self) -> None:
        for d in ["POSITIVE", "NEGATIVE", "NEUTRAL"]:
            req = CreateOverrideRequest(
                created_by="nimish",
                override_type="FUND_BOOST",
                target_id="target",
                direction=d,
                magnitude=3,
                rationale="Valid rationale that is long enough for validation",
                expires_at=date(2026, 6, 30),
            )
            assert req.direction == d
