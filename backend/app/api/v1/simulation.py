"""Simulation API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ValidationError
from app.engines.signal_engine import DEFAULT_RULES, SignalCondition, SignalRule
from app.engines.simulation_engine import SimulationParams
from app.models.schemas.responses import Meta
from app.models.schemas.simulation_schemas import (
    CompareRequest,
    SimulationRequest,
    ValidateRulesRequest,
)
from app.services.simulation_service import SimulationService

router = APIRouter(prefix="/simulate", tags=["simulation"])

VALID_MODES = {"SIP", "SIP_SIGNAL", "LUMPSUM", "HYBRID"}
VALID_OPERATORS = {"BELOW", "ABOVE", "CROSSES_BELOW", "CROSSES_ABOVE"}


def _to_signal_rules(schemas: Optional[list] = None) -> Optional[list[SignalRule]]:
    """Convert request schema signal rules to engine dataclasses."""
    if not schemas:
        return None
    rules: list[SignalRule] = []
    for s in schemas:
        conditions = [
            SignalCondition(
                signal_name=c.signal_name,
                operator=c.operator,
                threshold=c.threshold,
            )
            for c in s.conditions
        ]
        rules.append(
            SignalRule(
                name=s.name,
                conditions=conditions,
                logic=s.logic,
                multiplier=s.multiplier,
                cooloff_days=s.cooloff_days,
            )
        )
    return rules


def _result_to_dict(result) -> dict:
    """Convert SimulationResult to API response dict."""
    return {
        "summary": {
            "mode": result.mode,
            "total_invested": result.total_invested,
            "final_value": result.final_value,
            "absolute_return_pct": result.absolute_return_pct,
            "xirr_pct": result.xirr_pct,
            "cagr_pct": result.cagr_pct,
            "max_drawdown_pct": result.max_drawdown_pct,
            "sharpe_ratio": result.sharpe_ratio,
            "sortino_ratio": result.sortino_ratio,
            "num_sips": result.num_sips,
            "num_topups": result.num_topups,
            "topup_invested": result.topup_invested,
            "signal_hit_rate_3m": result.signal_hit_rate_3m,
            "signal_hit_rate_6m": result.signal_hit_rate_6m,
            "signal_hit_rate_12m": result.signal_hit_rate_12m,
            "capital_efficiency": result.capital_efficiency,
            "benchmark_cagr_pct": result.benchmark_cagr_pct,
            "alpha_vs_benchmark": result.alpha_vs_benchmark,
            "fund_name": result.fund_name,
            "mstar_id": result.mstar_id,
            "simulation_hash": result.simulation_hash,
            "compute_time_ms": result.compute_time_ms,
        },
        "daily_timeline": [
            {
                "date": s.date.isoformat(),
                "nav": s.nav,
                "cumulative_units": s.cumulative_units,
                "cumulative_invested": s.cumulative_invested,
                "portfolio_value": s.portfolio_value,
                "benchmark_value": s.benchmark_value,
            }
            for s in result.daily_timeline
        ],
        "cashflow_events": [
            {
                "date": ce.date.isoformat(),
                "amount": ce.amount,
                "nav": ce.nav,
                "units": ce.units,
                "event_type": ce.event_type,
                "trigger": ce.trigger,
            }
            for ce in result.cashflow_events
        ],
        "rolling_1y_xirr": result.rolling_1y_xirr,
        "monthly_returns": result.monthly_returns,
    }


@router.post("")
def run_simulation(
    request: SimulationRequest,
    db: Session = Depends(get_db),
) -> dict:
    """
    Run a simulation for one fund.
    Returns full SimulationResult with time series.
    """
    params = SimulationParams(
        mode=request.mode,
        sip_amount=request.sip_amount,
        sip_day=request.sip_day,
        lumpsum_amount=request.lumpsum_amount or request.sip_amount,
        lumpsum_deploy_pct=request.lumpsum_deploy_pct,
        lumpsum_per_trigger=request.lumpsum_per_trigger,
        start_date=request.start_date,
        end_date=request.end_date,
        benchmark_index=request.benchmark_index,
    )
    signal_rules = _to_signal_rules(request.signal_rules)

    service = SimulationService(db)
    result = service.run_simulation(request.mstar_id, params, signal_rules)

    return {
        "success": True,
        "data": _result_to_dict(result),
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.post("/compare")
def compare_modes(
    request: CompareRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Compare all 4 investment modes for one fund."""
    signal_rules = _to_signal_rules(request.signal_rules)

    service = SimulationService(db)
    results = service.compare_modes(
        mstar_id=request.mstar_id,
        sip_amount=request.sip_amount,
        start_date=request.start_date,
        end_date=request.end_date,
        signal_rules=signal_rules,
    )

    return {
        "success": True,
        "data": {key: _result_to_dict(val) for key, val in results.items()},
        "meta": {"timestamp": Meta().timestamp, "count": len(results)},
        "error": None,
    }


@router.get("/rules/defaults")
def get_default_rules() -> dict:
    """Returns the default signal rules (for the frontend rule builder UI)."""
    rules = [
        {
            "name": r.name,
            "conditions": [
                {
                    "signal_name": c.signal_name,
                    "operator": c.operator,
                    "threshold": c.threshold,
                }
                for c in r.conditions
            ],
            "logic": r.logic,
            "multiplier": r.multiplier,
            "cooloff_days": r.cooloff_days,
        }
        for r in DEFAULT_RULES
    ]
    return {
        "success": True,
        "data": rules,
        "meta": {"timestamp": Meta().timestamp, "count": len(rules)},
        "error": None,
    }


@router.post("/validate-rules")
def validate_rules(request: ValidateRulesRequest) -> dict:
    """Validate a set of signal rules without running a simulation."""
    errors: list[str] = []
    for i, rule in enumerate(request.rules):
        if not rule.conditions:
            errors.append(f"Rule {i} '{rule.name}': must have at least one condition")
        for j, cond in enumerate(rule.conditions):
            if cond.operator not in VALID_OPERATORS:
                errors.append(
                    f"Rule {i} condition {j}: invalid operator '{cond.operator}'"
                )

    if errors:
        raise ValidationError(
            "Signal rule validation failed",
            details={"errors": errors},
        )

    return {
        "success": True,
        "data": {"valid": True, "rule_count": len(request.rules)},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }
