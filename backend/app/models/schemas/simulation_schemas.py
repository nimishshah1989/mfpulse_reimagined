"""Pydantic schemas for simulation request/response."""

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class SignalConditionSchema(BaseModel):
    signal_name: str
    operator: str = Field(pattern=r"^(BELOW|ABOVE|CROSSES_BELOW|CROSSES_ABOVE)$")
    threshold: float


class SignalRuleSchema(BaseModel):
    name: str
    conditions: list[SignalConditionSchema]
    logic: str = Field(default="AND", pattern=r"^(AND|OR)$")
    multiplier: float = Field(default=1.0, gt=0, le=10)
    cooloff_days: int = Field(default=30, ge=1, le=365)


class SimulationRequest(BaseModel):
    mstar_id: str
    mode: str = Field(default="SIP", pattern=r"^(SIP|SIP_SIGNAL|LUMPSUM|HYBRID)$")
    sip_amount: Decimal = Decimal("10000")
    sip_day: int = Field(default=5, ge=1, le=31)
    lumpsum_amount: Optional[Decimal] = None
    lumpsum_deploy_pct: Decimal = Field(default=Decimal("100"), ge=Decimal("1"), le=Decimal("100"))
    lumpsum_per_trigger: Optional[Decimal] = Field(default=None, ge=Decimal("0"), description="Flat amount to deploy per trigger event. Overrides lumpsum_deploy_pct when set.")
    start_date: date
    end_date: Optional[date] = None
    signal_rules: Optional[list[SignalRuleSchema]] = None
    benchmark_index: str = "NIFTY 50 TRI"


class CompareRequest(BaseModel):
    mstar_id: str
    sip_amount: Decimal
    start_date: date
    end_date: Optional[date] = None
    signal_rules: Optional[list[SignalRuleSchema]] = None


class SimulationSummaryResponse(BaseModel):
    """Compact simulation result for API response."""

    mode: str
    total_invested: Decimal
    final_value: Decimal
    absolute_return_pct: Decimal
    xirr_pct: Optional[Decimal] = None
    cagr_pct: Optional[Decimal] = None
    max_drawdown_pct: Decimal
    sharpe_ratio: Optional[Decimal] = None
    sortino_ratio: Optional[Decimal] = None
    num_sips: int
    num_topups: int
    topup_invested: Decimal
    signal_hit_rate_3m: Optional[Decimal] = None
    signal_hit_rate_6m: Optional[Decimal] = None
    signal_hit_rate_12m: Optional[Decimal] = None
    capital_efficiency: Optional[Decimal] = None
    benchmark_cagr_pct: Optional[Decimal] = None
    alpha_vs_benchmark: Optional[Decimal] = None
    fund_name: str = ""
    mstar_id: str = ""
    simulation_hash: str = ""
    compute_time_ms: int = 0


class CashflowEventSchema(BaseModel):
    date: date
    amount: Decimal
    nav: Decimal
    units: Decimal
    event_type: str
    trigger: str


class DailySnapshotSchema(BaseModel):
    date: date
    nav: Decimal
    cumulative_units: Decimal
    cumulative_invested: Decimal
    portfolio_value: Decimal
    benchmark_value: Optional[Decimal] = None


class SimulationDetailResponse(BaseModel):
    """Full simulation result with time series for charting."""

    summary: SimulationSummaryResponse
    daily_timeline: list[DailySnapshotSchema]
    cashflow_events: list[CashflowEventSchema]
    rolling_1y_xirr: list[dict]
    monthly_returns: list[dict]


class ValidateRulesRequest(BaseModel):
    rules: list[SignalRuleSchema]
