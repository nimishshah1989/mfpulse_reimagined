"""Pydantic response schemas for fund endpoints."""

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class FundSummary(BaseModel):
    """Fund list view — compact."""

    mstar_id: str
    fund_name: Optional[str] = None
    legal_name: str
    amc_name: Optional[str] = None
    category_name: str
    broad_category: Optional[str] = None
    inception_date: Optional[date] = None
    isin: Optional[str] = None
    amfi_code: Optional[str] = None
    purchase_mode: Optional[int] = None
    net_expense_ratio: Optional[Decimal] = None
    # Latest data (joined from nav_daily)
    latest_nav: Optional[Decimal] = None
    latest_nav_date: Optional[date] = None
    return_1y: Optional[Decimal] = None
    return_3y: Optional[Decimal] = None
    return_5y: Optional[Decimal] = None


class FundDetail(BaseModel):
    """Full fund deep-dive — everything we know."""

    # Master data
    fund: FundSummary
    # Risk profile
    indian_risk_level: Optional[str] = None
    primary_benchmark: Optional[str] = None
    investment_strategy: Optional[str] = None
    managers: Optional[str] = None
    # Latest returns (all periods)
    returns: Optional[dict] = None
    # Latest risk stats
    risk_stats: Optional[dict] = None
    # Latest ranks
    ranks: Optional[dict] = None
    # Portfolio snapshot
    portfolio: Optional[dict] = None
    # Top holdings
    top_holdings: list[dict] = []
    # Sector exposure
    sector_exposure: list[dict] = []
    # Asset allocation
    asset_allocation: Optional[dict] = None
    # Credit quality (if applicable)
    credit_quality: Optional[dict] = None
    # Category comparison
    category_avg_returns: Optional[dict] = None
    # Peer rank context
    category_fund_count: Optional[int] = None


class CategorySummary(BaseModel):
    """Category heatmap entry."""

    category_name: str
    broad_category: Optional[str] = None
    fund_count: int
    avg_return_1y: Optional[Decimal] = None
    avg_return_3y: Optional[Decimal] = None
    avg_return_5y: Optional[Decimal] = None


class NAVPoint(BaseModel):
    """Single NAV data point for charting."""

    date: date
    nav: Decimal
    return_1d: Optional[Decimal] = None


class OverlapRequest(BaseModel):
    """Request body for overlap analysis."""

    mstar_ids: list[str]


class OverlapResult(BaseModel):
    """Result of overlap analysis."""

    funds_analyzed: list[str]
    overlap_matrix: dict
    common_holdings: list[dict]
    effective_sector_allocation: list[dict]
    effective_market_cap: Optional[dict] = None


class PeerComparison(BaseModel):
    """Fund vs category peers."""

    fund_mstar_id: str
    category_name: str
    peer_count: int
    fund_return_1y: Optional[Decimal] = None
    category_avg_1y: Optional[Decimal] = None
    fund_percentile_1y: Optional[int] = None
    peers: list[dict] = []
