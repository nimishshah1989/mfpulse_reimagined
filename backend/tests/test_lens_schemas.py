"""Tests for lens_schemas — verify each Pydantic model instantiates correctly."""

import os
from datetime import date
from decimal import Decimal

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.models.schemas.lens_schemas import (
    ComputeResult,
    LensDistribution,
    LensScoreResponse,
)


class TestLensScoreResponse:
    def test_full_instantiation(self) -> None:
        resp = LensScoreResponse(
            mstar_id="F0GBR06S2Q",
            fund_name="HDFC Top 100 Fund",
            category_name="Large Cap",
            return_score=Decimal("85.5"),
            risk_score=Decimal("60.0"),
            consistency_score=Decimal("72.3"),
            alpha_score=Decimal("68.1"),
            efficiency_score=Decimal("90.0"),
            resilience_score=Decimal("55.0"),
            return_class="LEADER",
            risk_class="MODERATE",
            consistency_class="CONSISTENT",
            alpha_class="POSITIVE",
            efficiency_class="LEAN",
            resilience_class="STURDY",
            headline_tag="Consistent alpha generator with lean expense structure",
            data_completeness_pct=Decimal("100"),
            computed_date=date(2026, 3, 1),
        )
        assert resp.mstar_id == "F0GBR06S2Q"
        assert resp.return_score == Decimal("85.5")
        assert resp.return_class == "LEADER"
        assert resp.computed_date == date(2026, 3, 1)

    def test_minimal_instantiation(self) -> None:
        resp = LensScoreResponse(
            mstar_id="F001",
            category_name="Mid Cap",
        )
        assert resp.mstar_id == "F001"
        assert resp.fund_name is None
        assert resp.return_score is None
        assert resp.return_class is None

    def test_json_serialization(self) -> None:
        resp = LensScoreResponse(
            mstar_id="F001",
            category_name="Large Cap",
            return_score=Decimal("75"),
        )
        data = resp.model_dump()
        assert data["mstar_id"] == "F001"
        assert data["return_score"] == Decimal("75")


class TestLensDistribution:
    def test_instantiation(self) -> None:
        dist = LensDistribution(
            category_name="Large Cap",
            distribution={
                "return": {"LEADER": 10, "STRONG": 20, "AVERAGE": 15, "WEAK": 5},
                "risk": {"LOW_RISK": 8, "MODERATE": 22, "ELEVATED": 12, "HIGH_RISK": 8},
            },
            total_funds=50,
        )
        assert dist.category_name == "Large Cap"
        assert dist.total_funds == 50
        assert dist.distribution["return"]["LEADER"] == 10

    def test_without_category(self) -> None:
        dist = LensDistribution(
            distribution={"return": {}},
            total_funds=0,
        )
        assert dist.category_name is None
        assert dist.total_funds == 0


class TestComputeResult:
    def test_instantiation(self) -> None:
        result = ComputeResult(
            categories_processed=15,
            funds_scored=450,
            duration_ms=12500,
            errors=[],
        )
        assert result.categories_processed == 15
        assert result.funds_scored == 450
        assert result.duration_ms == 12500
        assert result.errors == []

    def test_with_errors(self) -> None:
        result = ComputeResult(
            categories_processed=15,
            funds_scored=400,
            duration_ms=15000,
            errors=["Sectoral Fund: missing risk stats", "ELSS: no ranks data"],
        )
        assert len(result.errors) == 2
        assert "Sectoral Fund" in result.errors[0]
