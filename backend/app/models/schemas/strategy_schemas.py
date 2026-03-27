"""Pydantic schemas for strategy model, FM overrides, and lens-fund integration."""

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# --- Strategy Schemas ---


class StrategyFundAllocation(BaseModel):
    """Single fund allocation within a strategy."""

    mstar_id: str
    weight_pct: Decimal = Field(ge=Decimal("0"), le=Decimal("100"))


class CreateStrategyRequest(BaseModel):
    """Request to create a new strategy definition."""

    name: str = Field(min_length=2, max_length=200)
    description: Optional[str] = None
    strategy_type: str = Field(
        default="MODEL_PORTFOLIO",
        pattern=r"^(MODEL_PORTFOLIO|THEMATIC|TACTICAL|CUSTOM)$",
    )
    config: dict = Field(default_factory=dict)
    created_by: str = Field(min_length=1, max_length=100)


class UpdateStrategyRequest(BaseModel):
    """Request to update a strategy definition."""

    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = None
    strategy_type: Optional[str] = Field(
        default=None,
        pattern=r"^(MODEL_PORTFOLIO|THEMATIC|TACTICAL|CUSTOM)$",
    )
    config: Optional[dict] = None


class BacktestRequest(BaseModel):
    """Request to run a backtest for a strategy."""

    start_date: date
    end_date: Optional[date] = None
    initial_investment: Decimal = Field(default=Decimal("1000000"), gt=Decimal("0"))
    mode: str = Field(default="SIP", pattern=r"^(SIP|SIP_SIGNAL|LUMPSUM|HYBRID)$")
    sip_amount: Optional[Decimal] = None
    params: Optional[dict] = None


class DeployRequest(BaseModel):
    """Request to deploy a strategy as a live portfolio."""

    portfolio_name: str = Field(min_length=2, max_length=200)
    inception_date: Optional[date] = None
    initial_aum: Optional[Decimal] = Field(default=None, gt=Decimal("0"))
    holdings: list[StrategyFundAllocation] = Field(default_factory=list)


class StrategyResponse(BaseModel):
    """Strategy definition response."""

    id: str
    name: str
    description: Optional[str] = None
    strategy_type: Optional[str] = None
    config: dict = Field(default_factory=dict)
    created_by: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class BacktestRunResponse(BaseModel):
    """Backtest run result."""

    id: str
    strategy_id: str
    run_date: str
    mode: Optional[str] = None
    initial_investment: Optional[Decimal] = None
    final_value: Optional[Decimal] = None
    cagr: Optional[Decimal] = None
    xirr: Optional[Decimal] = None
    max_drawdown: Optional[Decimal] = None
    sharpe: Optional[Decimal] = None
    benchmark_cagr: Optional[Decimal] = None
    alpha_vs_benchmark: Optional[Decimal] = None


class PortfolioResponse(BaseModel):
    """Live portfolio response."""

    id: str
    strategy_id: str
    name: Optional[str] = None
    inception_date: Optional[str] = None
    current_nav: Optional[Decimal] = None
    current_aum: Optional[Decimal] = None
    is_active: bool = True
    holdings: list[dict] = Field(default_factory=list)


# --- Override Schemas ---

VALID_OVERRIDE_TYPES = {"FUND_BOOST", "FUND_SUPPRESS", "CATEGORY_TILT", "SECTOR_VIEW"}
VALID_DIRECTIONS = {"POSITIVE", "NEGATIVE", "NEUTRAL"}


class CreateOverrideRequest(BaseModel):
    """Request to create an FM override."""

    created_by: str = Field(min_length=1, max_length=100)
    override_type: str
    target_id: str = Field(min_length=1, max_length=200)
    direction: str
    magnitude: int = Field(ge=1, le=5)
    rationale: str = Field(min_length=10)
    expires_at: date

    @field_validator("override_type")
    @classmethod
    def validate_override_type(cls, v: str) -> str:
        if v not in VALID_OVERRIDE_TYPES:
            raise ValueError(
                f"Invalid override_type '{v}'. "
                f"Valid: {', '.join(sorted(VALID_OVERRIDE_TYPES))}"
            )
        return v

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v: str) -> str:
        if v not in VALID_DIRECTIONS:
            raise ValueError(
                f"Invalid direction '{v}'. "
                f"Valid: {', '.join(sorted(VALID_DIRECTIONS))}"
            )
        return v


class OverrideResponse(BaseModel):
    """FM override response."""

    id: str
    created_by: str
    override_type: str
    target_id: str
    direction: str
    magnitude: Optional[int] = None
    rationale: str
    expires_at: str
    is_active: bool = True
    created_at: Optional[str] = None


# --- Fund Lens Integration Schemas ---


class FundWithLensResponse(BaseModel):
    """Fund summary enriched with lens scores."""

    mstar_id: str
    fund_name: str
    category_name: Optional[str] = None
    amc_name: Optional[str] = None
    latest_nav: Optional[Decimal] = None
    return_1y: Optional[Decimal] = None
    return_3y: Optional[Decimal] = None
    return_5y: Optional[Decimal] = None
    # Lens scores
    return_score: Optional[Decimal] = None
    risk_score: Optional[Decimal] = None
    consistency_score: Optional[Decimal] = None
    alpha_score: Optional[Decimal] = None
    efficiency_score: Optional[Decimal] = None
    resilience_score: Optional[Decimal] = None
    # Classifications
    return_class: Optional[str] = None
    risk_class: Optional[str] = None
    consistency_class: Optional[str] = None
    alpha_class: Optional[str] = None
    efficiency_class: Optional[str] = None
    resilience_class: Optional[str] = None
    headline_tag: Optional[str] = None
