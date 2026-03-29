"""Fund read API endpoints — enriched with lens scores and classifications."""

import time
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas.responses import APIResponse, Meta
from app.services.fund_service import FundService
from app.repositories.lens_repo import LensRepository
from app.repositories.override_repo import OverrideRepository

router = APIRouter(prefix="/funds", tags=["funds"])

# In-memory cache for universe data (refreshes every 10 minutes)
_universe_cache: dict = {"data": None, "ts": 0}
_UNIVERSE_CACHE_TTL = 600  # seconds

LENS_SORT_FIELDS = {
    "return_score", "risk_score", "consistency_score",
    "alpha_score", "efficiency_score", "resilience_score",
}

LENS_TIER_FILTERS = {
    "return_class", "risk_class", "consistency_class",
    "alpha_class", "efficiency_class", "resilience_class",
}


@router.get("/universe")
def get_universe_data(db: Session = Depends(get_db)) -> dict:
    """Single-query bulk endpoint for Universe Explorer — all active funds with lens scores.

    Response is cached in-memory for 10 minutes to avoid repeated 14s DB queries.
    """
    now = time.time()
    if _universe_cache["data"] is not None and (now - _universe_cache["ts"]) < _UNIVERSE_CACHE_TTL:
        data = _universe_cache["data"]
    else:
        service = FundService(db)
        data = service.get_universe_data()
        _universe_cache["data"] = data
        _universe_cache["ts"] = now
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp, "count": len(data)},
        "error": None,
    }


@router.get("")
def list_funds(
    category: Optional[str] = None,
    broad_category: Optional[str] = None,
    amc: Optional[str] = None,
    search: Optional[str] = None,
    purchase_mode: int = 1,
    sort_by: str = "fund_name",
    sort_dir: str = "asc",
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    # Lens score filters
    min_return_score: Optional[float] = None,
    min_risk_score: Optional[float] = None,
    min_consistency_score: Optional[float] = None,
    min_alpha_score: Optional[float] = None,
    min_efficiency_score: Optional[float] = None,
    min_resilience_score: Optional[float] = None,
    # Tier filters
    return_class: Optional[str] = None,
    risk_class: Optional[str] = None,
    consistency_class: Optional[str] = None,
    alpha_class: Optional[str] = None,
    efficiency_class: Optional[str] = None,
    resilience_class: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict:
    """List funds with filters, search, sort, pagination — enriched with lens scores."""
    service = FundService(db)
    lens_repo = LensRepository(db)

    # If sorting by lens field, delegate to lens-aware query
    if sort_by in LENS_SORT_FIELDS:
        scores, total = lens_repo.get_all_scores(
            category=category,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        return {
            "success": True,
            "data": scores,
            "meta": {"timestamp": Meta().timestamp, "count": total},
            "error": None,
        }

    funds, total = service.list_funds(
        category=category,
        broad_category=broad_category,
        amc=amc,
        search=search,
        purchase_mode=purchase_mode,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )

    # Enrich with lens scores
    enriched = _enrich_with_lens(funds, lens_repo)

    # Apply lens score filters
    score_filters = {
        "return_score": min_return_score,
        "risk_score": min_risk_score,
        "consistency_score": min_consistency_score,
        "alpha_score": min_alpha_score,
        "efficiency_score": min_efficiency_score,
        "resilience_score": min_resilience_score,
    }
    tier_filters = {
        "return_class": return_class,
        "risk_class": risk_class,
        "consistency_class": consistency_class,
        "alpha_class": alpha_class,
        "efficiency_class": efficiency_class,
        "resilience_class": resilience_class,
    }

    filtered = _apply_lens_filters(enriched, score_filters, tier_filters)

    return {
        "success": True,
        "data": filtered,
        "meta": {"timestamp": Meta().timestamp, "count": total},
        "error": None,
    }


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)) -> dict:
    """All SEBI categories with fund counts and avg returns."""
    service = FundService(db)
    categories = service.get_categories_heatmap()
    return {
        "success": True,
        "data": categories,
        "meta": {"timestamp": Meta().timestamp, "count": len(categories)},
        "error": None,
    }


@router.get("/amcs")
def list_amcs(db: Session = Depends(get_db)) -> dict:
    """All AMCs with fund counts."""
    service = FundService(db)
    amcs = service.fund_repo.get_amcs()
    return {
        "success": True,
        "data": amcs,
        "meta": {"timestamp": Meta().timestamp, "count": len(amcs)},
        "error": None,
    }


@router.post("/search/natural")
def natural_language_search(
    body: dict,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
) -> dict:
    """Rule-based NL query parser — backend authoritative version."""
    from app.services.nl_search_service import NLSearchService

    query_text = body.get("query", "")
    svc = NLSearchService(db)
    result = svc.search(query_text, limit=limit)
    return {
        "success": True,
        "data": result,
        "meta": {"timestamp": Meta().timestamp, "count": result["count"]},
        "error": None,
    }


@router.get("/{mstar_id}/intelligence")
def get_fund_intelligence(mstar_id: str, db: Session = Depends(get_db)) -> dict:
    """3 intelligence cards: Regime Signal, Better Alternatives, SIP Intelligence."""
    from app.services.fund_intelligence import FundIntelligenceService

    svc = FundIntelligenceService(db)
    data = svc.get_intelligence(mstar_id)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/{mstar_id}/asset-allocation")
def get_asset_allocation(
    mstar_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Latest asset allocation (equity/bond/cash/other + market cap split)."""
    from app.repositories.holdings_repo import HoldingsRepository

    holdings_repo = HoldingsRepository(db)
    data = holdings_repo.get_asset_allocation(mstar_id)
    if data is None:
        return {
            "success": True,
            "data": None,
            "meta": {"timestamp": Meta().timestamp},
            "error": None,
        }
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/{mstar_id}/narrative")
def get_fund_narrative(
    mstar_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """AI-generated intelligence brief for a fund."""
    from app.services.narrative_service import NarrativeService

    narrative_svc = NarrativeService(db)
    narrative = narrative_svc.get_narrative(mstar_id)
    return {
        "success": True,
        "data": {"narrative": narrative},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/{mstar_id}")
def get_fund_detail(mstar_id: str, db: Session = Depends(get_db)) -> dict:
    """Full deep-dive for one fund — includes lens scores and active FM overrides."""
    service = FundService(db)
    lens_repo = LensRepository(db)
    override_repo = OverrideRepository(db)

    detail = service.get_fund_detail(mstar_id)

    # Enrich with lens scores + classification
    detail["lens_scores"] = lens_repo.get_latest_scores(mstar_id)
    detail["lens_classification"] = lens_repo.get_latest_classification(mstar_id)
    detail["active_overrides"] = override_repo.get_overrides_for_fund(mstar_id)

    # Category average lens scores (median across same SEBI category)
    category_name = detail.get("fund", {}).get("category_name")
    if category_name:
        detail["category_avg_lens_scores"] = lens_repo.get_category_median_scores(
            category_name,
        )
    else:
        detail["category_avg_lens_scores"] = None

    return {
        "success": True,
        "data": detail,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/{mstar_id}/nav")
def get_nav_history(
    mstar_id: str,
    period: str = "1y",
    db: Session = Depends(get_db),
) -> dict:
    """NAV time series for charting."""
    service = FundService(db)
    data = service.get_nav_chart_data(mstar_id, period=period)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp, "count": len(data)},
        "error": None,
    }


@router.get("/{mstar_id}/risk")
def get_risk_history(
    mstar_id: str,
    limit: int = 12,
    db: Session = Depends(get_db),
) -> dict:
    """Monthly risk stats history."""
    service = FundService(db)
    data = service.get_risk_history(mstar_id, limit=limit)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp, "count": len(data)},
        "error": None,
    }


@router.get("/{mstar_id}/holdings")
def get_holdings(
    mstar_id: str,
    top: Optional[int] = None,
    db: Session = Depends(get_db),
) -> dict:
    """Fund holdings with sector and weight."""
    service = FundService(db)
    data = service.get_holdings(mstar_id, top=top)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp, "count": len(data)},
        "error": None,
    }


@router.get("/{mstar_id}/sectors")
def get_sector_exposure(
    mstar_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Sector allocation breakdown."""
    service = FundService(db)
    data = service.get_sector_exposure(mstar_id)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp, "count": len(data)},
        "error": None,
    }


@router.get("/{mstar_id}/peers")
def get_peers(
    mstar_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Peer comparison within same SEBI category."""
    service = FundService(db)
    data = service.get_peer_comparison(mstar_id)
    return {
        "success": True,
        "data": data,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


# --- Private helpers for lens enrichment ---


def _enrich_with_lens(funds: list[dict], lens_repo: LensRepository) -> list[dict]:
    """Enrich fund summaries with lens scores and classifications."""
    mstar_ids = [f["mstar_id"] for f in funds]
    if not mstar_ids:
        return funds

    # Bulk fetch lens scores and classifications — single query each instead of N+1
    scores_map = lens_repo.get_all_scores_batch(mstar_ids)
    class_map = lens_repo.get_all_classifications_batch(mstar_ids)

    enriched = []
    for fund in funds:
        mid = fund["mstar_id"]
        scores = scores_map.get(mid, {})
        cls = class_map.get(mid, {})
        enriched_fund = {
            **fund,
            "return_score": scores.get("return_score"),
            "risk_score": scores.get("risk_score"),
            "consistency_score": scores.get("consistency_score"),
            "alpha_score": scores.get("alpha_score"),
            "efficiency_score": scores.get("efficiency_score"),
            "resilience_score": scores.get("resilience_score"),
            "return_class": cls.get("return_class"),
            "risk_class": cls.get("risk_class"),
            "consistency_class": cls.get("consistency_class"),
            "alpha_class": cls.get("alpha_class"),
            "efficiency_class": cls.get("efficiency_class"),
            "resilience_class": cls.get("resilience_class"),
            "headline_tag": cls.get("headline_tag"),
        }
        enriched.append(enriched_fund)
    return enriched


def _apply_lens_filters(
    funds: list[dict],
    score_filters: dict[str, Optional[float]],
    tier_filters: dict[str, Optional[str]],
) -> list[dict]:
    """Filter funds by minimum lens scores and tier classifications."""
    result = funds
    for field, min_val in score_filters.items():
        if min_val is not None:
            result = [
                f for f in result
                if f.get(field) is not None and float(f[field]) >= min_val
            ]
    for field, tier_val in tier_filters.items():
        if tier_val is not None:
            result = [
                f for f in result
                if f.get(field) == tier_val
            ]
    return result
