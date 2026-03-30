"""Claude AI endpoints — morning briefing, strategy insights, simulation explainer, etc."""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models.schemas.responses import APIResponse, Meta
from app.services.claude_client import (
    generate_morning_briefing,
    generate_strategy_insights,
    generate_simulation_explainer,
    generate_sector_playbook,
    generate_regime_actions,
    generate_fund_verdict,
    parse_strategy_query,
    generate_weekly_intelligence,
    get_usage_stats,
)
from app.services.marketpulse_client import MarketPulseClient

router = APIRouter(prefix="/claude", tags=["claude-ai"])


# ── Request schemas ──────────────────────────────────────────────────────────

class SimExplainerRequest(BaseModel):
    fund_name: str
    period: str = "5Y"
    best_mode: str
    signal_hit_rate: Optional[float] = None
    modes: dict  # mode_name -> {xirr, cagr, max_drawdown, total_value}


class StrategyInsightsRequest(BaseModel):
    id: Optional[str] = None
    name: str = "Unnamed"
    funds: list[dict] = []
    total_aum: Optional[str] = None
    xirr: Optional[float] = None
    sector_exposure: Optional[str] = None
    overlap_pct: Optional[float] = None


class NLQueryRequest(BaseModel):
    query: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/briefing")
def get_morning_briefing() -> dict:
    """AI-generated morning market briefing using live MarketPulse data."""
    settings = get_settings()
    mp = MarketPulseClient(
        base_url=settings.marketpulse_base_url,
        timeout=10,
    )

    # Gather market data
    picks = mp.get_market_picks() or {}
    sentiment = mp.get_sentiment() or {}
    sectors = mp.get_sector_scores() or []
    indices = mp.get_indices() or {}

    # Extract nifty
    nifty = indices.get("NIFTY 50") or indices.get("nifty_50") or {}
    if isinstance(nifty, dict):
        nifty_val = nifty.get("current_price") or nifty.get("value", "N/A")
        nifty_chg = nifty.get("change_pct", "N/A")
    else:
        nifty_val = "N/A"
        nifty_chg = "N/A"

    # Leading sectors
    leading = [
        s.get("name", s.get("sector_name", "?"))
        for s in (sectors[:3] if isinstance(sectors, list) else [])
        if s.get("quadrant", "").upper() in ("LEADING", "IMPROVING")
    ]

    market_data = {
        "regime": picks.get("regime") or picks.get("market_regime", "N/A"),
        "nifty_value": nifty_val,
        "nifty_change_pct": nifty_chg,
        "sentiment_score": sentiment.get("composite_score", sentiment.get("score", "N/A")),
        "breadth_advance_pct": sentiment.get("breadth_advance_pct", "N/A"),
        "leading_sectors": ", ".join(leading[:3]) or "N/A",
        "universe_stats": "13,000+ funds tracked",
    }

    briefing = generate_morning_briefing(market_data)

    return {
        "success": True,
        "data": {"briefing": briefing, "market_data": market_data},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.post("/strategy-insights")
def get_strategy_insights(req: StrategyInsightsRequest) -> dict:
    """AI-generated insights for a strategy portfolio."""
    insights = generate_strategy_insights(req.model_dump())
    return {
        "success": True,
        "data": {"insights": insights},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.post("/simulation-explainer")
def get_simulation_explainer(req: SimExplainerRequest) -> dict:
    """AI explanation of simulation comparison results."""
    explanation = generate_simulation_explainer(req.model_dump())
    return {
        "success": True,
        "data": {"explanation": explanation},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/sector-playbook")
def get_sector_playbook() -> dict:
    """AI-generated sector rotation playbook from live data."""
    settings = get_settings()
    mp = MarketPulseClient(
        base_url=settings.marketpulse_base_url,
        timeout=10,
    )

    picks = mp.get_market_picks() or {}
    sectors = mp.get_sector_scores() or []

    sector_list = []
    if isinstance(sectors, list):
        for s in sectors[:12]:
            sector_list.append({
                "name": s.get("name") or s.get("sector_name", "?"),
                "quadrant": s.get("quadrant", "?"),
                "rs_score": s.get("rs_score", 0),
            })

    sector_data = {
        "regime": picks.get("regime") or picks.get("market_regime", "N/A"),
        "sectors": sector_list,
    }

    playbook = generate_sector_playbook(sector_data)

    return {
        "success": True,
        "data": {"playbook": playbook, "sectors": sector_list},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/regime-actions")
def get_regime_actions() -> dict:
    """AI-generated regime-specific action recommendations."""
    settings = get_settings()
    mp = MarketPulseClient(
        base_url=settings.marketpulse_base_url,
        timeout=10,
    )

    picks = mp.get_market_picks() or {}
    sentiment = mp.get_sentiment() or {}

    regime_data = {
        "regime": picks.get("regime") or picks.get("market_regime", "N/A"),
        "sentiment_score": sentiment.get("composite_score", sentiment.get("score", "N/A")),
        "breadth": sentiment.get("breadth_advance_pct", "N/A"),
        "top_category": "Large Cap",  # Could be computed from universe data
        "avoid_count": 0,
    }

    actions = generate_regime_actions(regime_data)

    return {
        "success": True,
        "data": {"actions": actions, "regime": regime_data.get("regime")},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/fund-verdict/{mstar_id}")
def get_fund_verdict(mstar_id: str, db: Session = Depends(get_db)) -> dict:
    """AI one-line verdict for a specific fund."""
    from app.repositories.fund_repo import FundRepository
    from app.repositories.lens_repo import LensRepository

    fund_repo = FundRepository(db)
    lens_repo = LensRepository(db)

    fund = fund_repo.get_fund_by_mstar_id(mstar_id)
    if fund is None:
        return {
            "success": False,
            "data": None,
            "error": {"code": "NOT_FOUND", "message": "Fund not found"},
        }

    scores = lens_repo.get_latest_scores(mstar_id) or {}
    classification = lens_repo.get_latest_classification(mstar_id) or {}

    fund_data = {
        "mstar_id": mstar_id,
        "fund_name": fund.fund_name or fund.legal_name or "",
        "category": fund.category_name or "",
        "return_score": scores.get("return_score", "N/A"),
        "risk_score": scores.get("risk_score", "N/A"),
        "alpha_score": scores.get("alpha_score", "N/A"),
        "consistency_score": scores.get("consistency_score", "N/A"),
        "efficiency_score": scores.get("efficiency_score", "N/A"),
        "headline_tag": classification.get("headline_tag", ""),
    }

    verdict = generate_fund_verdict(fund_data)

    return {
        "success": True,
        "data": {"verdict": verdict, "mstar_id": mstar_id},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.post("/parse-query")
def parse_nl_query(req: NLQueryRequest) -> dict:
    """Parse natural-language fund query into structured filter criteria."""
    criteria = parse_strategy_query(req.query)
    return {
        "success": True,
        "data": {"criteria": criteria, "original_query": req.query},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/weekly-intelligence")
def get_weekly_intelligence(db: Session = Depends(get_db)) -> dict:
    """AI-generated weekly intelligence: 10 actionable insights combining
    market sentiment, sector rotation, and fund universe data."""
    from app.repositories.fund_repo import FundRepository
    from decimal import Decimal

    settings = get_settings()
    mp = MarketPulseClient(
        base_url=settings.marketpulse_base_url,
        timeout=10,
    )

    # Gather market data
    picks = mp.get_market_picks() or {}
    sentiment = mp.get_sentiment() or {}
    sectors = mp.get_sector_scores() or []

    # Leading/lagging sectors
    leading = []
    lagging = []
    if isinstance(sectors, list):
        for s in sectors:
            quad = (s.get("quadrant") or "").upper()
            name = s.get("name") or s.get("sector_name", "?")
            rs = s.get("rs_score", 0)
            entry = f"{name} (RS={rs})"
            if quad in ("LEADING", "IMPROVING"):
                leading.append(entry)
            elif quad in ("LAGGING", "WEAKENING"):
                lagging.append(entry)

    # Fund universe summary — compute category-level aggregates
    fund_repo = FundRepository(db)
    all_funds = fund_repo.get_all_funds(
        min_aum=Decimal("100000000"),  # 10 Cr in raw rupees
    )

    cat_stats: dict = {}
    for f in all_funds:
        cat = getattr(f, "category_name", None) or getattr(f, "broad_category", None)
        if not cat:
            continue
        if cat not in cat_stats:
            cat_stats[cat] = {"returns": [], "count": 0}
        cat_stats[cat]["count"] += 1
        r1y = getattr(f, "return_1y", None)
        if r1y is not None:
            try:
                cat_stats[cat]["returns"].append(float(r1y))
            except (ValueError, TypeError):
                pass

    cat_avgs = []
    for cat, data in cat_stats.items():
        if data["returns"]:
            avg_r = sum(data["returns"]) / len(data["returns"])
            cat_avgs.append((cat, avg_r, data["count"]))

    cat_avgs.sort(key=lambda x: x[1], reverse=True)
    top_cats = "\n".join(f"  {c[0]}: {c[1]:.1f}% (n={c[2]})" for c in cat_avgs[:5])
    worst_cats = "\n".join(f"  {c[0]}: {c[1]:.1f}% (n={c[2]})" for c in cat_avgs[-5:])

    total_funds = len(all_funds)
    positive = sum(1 for c in cat_avgs if c[1] > 0)

    context = {
        "regime": picks.get("regime") or picks.get("market_regime", "N/A"),
        "sentiment_score": sentiment.get("composite_score", sentiment.get("score", "N/A")),
        "breadth": sentiment.get("breadth_advance_pct", "N/A"),
        "leading_sectors": ", ".join(leading[:5]) or "N/A",
        "lagging_sectors": ", ".join(lagging[:5]) or "N/A",
        "top_categories": top_cats or "N/A",
        "worst_categories": worst_cats or "N/A",
        "universe_summary": (
            f"{total_funds} funds tracked. "
            f"{positive}/{len(cat_avgs)} categories with positive avg 1Y returns."
        ),
    }

    points = generate_weekly_intelligence(context)

    # Enrich each point with matching fund recommendations from the universe
    # This happens server-side so Claude doesn't need to know fund names
    for point in points:
        fund_type = (point.get("fund_type") or "").lower()
        matching = []
        for f in all_funds:
            cat = (getattr(f, "category_name", "") or "").lower()
            if fund_type and fund_type in cat:
                r1y = getattr(f, "return_1y", None)
                alpha = getattr(f, "alpha_score", None)
                matching.append({
                    "mstar_id": getattr(f, "mstar_id", ""),
                    "fund_name": getattr(f, "fund_name", "") or getattr(f, "legal_name", ""),
                    "return_1y": float(r1y) if r1y is not None else None,
                    "alpha_score": float(alpha) if alpha is not None else None,
                    "aum": float(getattr(f, "aum", 0) or 0),
                })
        # Sort by alpha_score desc, take top 3
        matching.sort(key=lambda x: x.get("alpha_score") or 0, reverse=True)
        point["recommended_funds"] = matching[:3]

    return {
        "success": True,
        "data": {"points": points, "context": context},
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }


@router.get("/usage")
def get_claude_usage() -> dict:
    """Claude API usage statistics for admin dashboard."""
    stats = get_usage_stats()
    return {
        "success": True,
        "data": stats,
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }
