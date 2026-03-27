"""Pydantic schemas for lens score responses."""

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class LensScoreResponse(BaseModel):
    mstar_id: str
    fund_name: Optional[str] = None
    category_name: str
    return_score: Optional[Decimal] = None
    risk_score: Optional[Decimal] = None
    consistency_score: Optional[Decimal] = None
    alpha_score: Optional[Decimal] = None
    efficiency_score: Optional[Decimal] = None
    resilience_score: Optional[Decimal] = None
    return_class: Optional[str] = None
    risk_class: Optional[str] = None
    consistency_class: Optional[str] = None
    alpha_class: Optional[str] = None
    efficiency_class: Optional[str] = None
    resilience_class: Optional[str] = None
    headline_tag: Optional[str] = None
    data_completeness_pct: Optional[Decimal] = None
    computed_date: Optional[date] = None


class LensDistribution(BaseModel):
    category_name: Optional[str] = None
    distribution: dict
    total_funds: int


class ComputeResult(BaseModel):
    categories_processed: int
    funds_scored: int
    duration_ms: int
    errors: list[str]
