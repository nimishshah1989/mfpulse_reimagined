"""NL search execution service — runs parsed filters against the DB.

Uses NL parser from nl_search_parser.py for query understanding.
Auto-relaxes filters when zero results are found.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session

from app.models.db.fund_master import FundMaster
from app.models.db.lens_scores import FundLensScores, FundClassification
from app.services.nl_search_parser import parse_nl_query

logger = logging.getLogger(__name__)

# Map broad category markers to actual DB broad_category values
BROAD_MAP = {
    "_BROAD_DEBT": "Fixed Income",
    "_BROAD_HYBRID": "Allocation",
    "_BROAD_EQUITY": "Equity",
}


class NLSearchService:
    """Executes NL search queries against fund database."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def search(self, query: str, limit: int = 50, min_nav_count: int = 0) -> dict:
        """Parse NL query and return matching funds with auto-relaxation."""
        parsed = parse_nl_query(query)
        funds = self._execute(parsed, limit=limit)

        result: dict = {
            "parsed": parsed,
            "funds": funds,
            "count": len(funds),
        }

        # Auto-relax: if zero results and multiple filters, try dropping filters
        if len(funds) == 0 and parsed and not parsed.get("text_search"):
            relaxed = self._try_relaxed_search(parsed, limit=limit)
            if relaxed:
                result["relaxed"] = relaxed

        return result

    def _try_relaxed_search(self, parsed: dict, limit: int = 50) -> Optional[dict]:
        """Progressively relax filters to find near-miss results."""
        for relaxed_parsed, description in _build_relaxation_strategies(parsed):
            funds = self._execute(relaxed_parsed, limit=limit)
            if funds:
                return {
                    "description": description,
                    "parsed": relaxed_parsed,
                    "funds": funds,
                    "count": len(funds),
                }
        return None

    def _execute(self, parsed: Optional[dict], limit: int = 50) -> list[dict]:
        """Execute parsed filters against DB."""
        if not parsed:
            return []

        latest_lens = self.db.query(
            func.max(FundLensScores.computed_date)
        ).scalar()
        latest_class = self.db.query(
            func.max(FundClassification.computed_date)
        ).scalar()

        if not latest_lens:
            return []

        query = (
            self.db.query(
                FundMaster.mstar_id,
                FundMaster.fund_name,
                FundMaster.category_name,
                FundMaster.amc_name,
                FundLensScores.return_score,
                FundLensScores.risk_score,
                FundLensScores.alpha_score,
                FundLensScores.consistency_score,
                FundLensScores.efficiency_score,
                FundLensScores.resilience_score,
            )
            .join(FundLensScores, FundMaster.mstar_id == FundLensScores.mstar_id)
            .filter(
                FundMaster.purchase_mode == 1,
                FundLensScores.computed_date == latest_lens,
                ~FundMaster.fund_name.ilike('%IDCW%'),
                ~FundMaster.fund_name.ilike('%Segregated%'),
            )
        )

        query = _apply_filters(self.db, query, parsed, latest_class)

        # Sort by composite quality
        composite = (
            func.coalesce(FundLensScores.return_score, 0)
            + func.coalesce(FundLensScores.risk_score, 0)
            + func.coalesce(FundLensScores.consistency_score, 0)
            + func.coalesce(FundLensScores.alpha_score, 0)
            + func.coalesce(FundLensScores.efficiency_score, 0)
            + func.coalesce(FundLensScores.resilience_score, 0)
        )
        if parsed.get("sort_by"):
            sort_col = getattr(FundLensScores, parsed["sort_by"], None)
            if sort_col:
                query = query.order_by(sort_col.desc().nulls_last())
            else:
                query = query.order_by(composite.desc())
        else:
            query = query.order_by(composite.desc())

        rows = query.limit(limit).all()
        return [_row_to_dict(r) for r in rows]


def _row_to_dict(r) -> dict:
    """Convert a query row to a serializable dict."""
    return {
        "mstar_id": r.mstar_id,
        "fund_name": r.fund_name,
        "category_name": r.category_name,
        "amc_name": r.amc_name,
        "return_score": str(r.return_score) if r.return_score is not None else None,
        "risk_score": str(r.risk_score) if r.risk_score is not None else None,
        "alpha_score": str(r.alpha_score) if r.alpha_score is not None else None,
        "consistency_score": str(r.consistency_score) if r.consistency_score is not None else None,
        "efficiency_score": str(r.efficiency_score) if r.efficiency_score is not None else None,
        "resilience_score": str(r.resilience_score) if r.resilience_score is not None else None,
        "nav_count": 0,
    }


def _apply_filters(db: Session, query, parsed: dict, latest_class) -> object:
    """Apply all parsed filters to the SQLAlchemy query."""
    if parsed.get("text_search"):
        txt = parsed["text_search"]
        words = [w for w in txt.split() if len(w) >= 2]
        for w in words:
            escaped = w.replace('%', r'\%').replace('_', r'\_')
            query = query.filter(
                FundMaster.fund_name.ilike(f"%{escaped}%", escape='\\')
            )

    # Sector filter — fund holdings exposure > 5%
    if parsed["sectors"]:
        from app.models.db.sector_exposure import FundSectorExposure
        sector_sq = (
            db.query(FundSectorExposure.mstar_id)
            .filter(
                FundSectorExposure.sector_name.in_(parsed["sectors"]),
                FundSectorExposure.net_pct > 5,
            )
            .distinct()
            .subquery()
        )
        query = query.filter(
            FundMaster.mstar_id.in_(db.query(sector_sq.c.mstar_id))
        )

    # Sector exposure percentage filters (e.g., "technology > 30%")
    if parsed.get("sector_exposure_filters"):
        from app.models.db.sector_exposure import FundSectorExposure
        for sef in parsed["sector_exposure_filters"]:
            exposure_sq = db.query(FundSectorExposure.mstar_id).filter(
                FundSectorExposure.sector_name == sef["sector"]
            )
            if sef["operator"] == "gt":
                exposure_sq = exposure_sq.filter(
                    FundSectorExposure.net_pct >= sef["value"]
                )
            else:
                exposure_sq = exposure_sq.filter(
                    FundSectorExposure.net_pct <= sef["value"]
                )
            exposure_sq = exposure_sq.distinct().subquery()
            query = query.filter(
                FundMaster.mstar_id.in_(db.query(exposure_sq.c.mstar_id))
            )

    # Category filter
    broad_cats = [c for c in parsed["categories"] if c.startswith("_BROAD_")]
    real_cats = [c for c in parsed["categories"] if not c.startswith("_BROAD_")]

    if broad_cats:
        broad_values = [BROAD_MAP[bc] for bc in broad_cats if bc in BROAD_MAP]
        if broad_values:
            query = query.filter(FundMaster.broad_category.in_(broad_values))

    if real_cats:
        cat_conditions = [
            FundMaster.category_name.ilike(f"%{c}%") for c in real_cats
        ]
        query = query.filter(or_(*cat_conditions))

    # Tier filters
    if parsed["tier_filters"] and latest_class:
        query = query.join(
            FundClassification,
            and_(
                FundMaster.mstar_id == FundClassification.mstar_id,
                FundClassification.computed_date == latest_class,
            ),
        )
        for tf in parsed["tier_filters"]:
            col = getattr(FundClassification, tf["field"], None)
            if col is not None:
                query = query.filter(col == tf["value"])

    # Numeric filters on lens scores
    for nf in parsed["numeric_filters"]:
        col = getattr(FundLensScores, nf["field"], None)
        if col is not None:
            if nf["operator"] == "gt":
                query = query.filter(col >= Decimal(str(nf["value"])))
            else:
                query = query.filter(col <= Decimal(str(nf["value"])))

    return query


def _build_relaxation_strategies(parsed: dict) -> list[tuple[dict, str]]:
    """Build ordered list of filter relaxation attempts."""
    strategies: list[tuple[dict, str]] = []
    has_cats = bool(parsed.get("categories"))
    has_sector_exp = bool(parsed.get("sector_exposure_filters"))
    has_sectors = bool(parsed.get("sectors"))

    # Strategy 1: drop category, keep sector exposure
    if has_sector_exp and has_cats:
        cat_names = ", ".join(c for c in parsed["categories"] if not c.startswith("_"))
        strategies.append((
            {**parsed, "categories": []},
            f"Showing all funds matching sector exposure (removed {cat_names} filter)",
        ))

    # Strategy 2: halve sector exposure threshold
    if has_sector_exp:
        new_filters = []
        descs = []
        for sef in parsed["sector_exposure_filters"]:
            halved = round(sef["value"] / 2, 1)
            new_filters.append({**sef, "value": halved})
            descs.append(f"{sef['sector']} > {halved}%")
        strategies.append((
            {**parsed, "sector_exposure_filters": new_filters},
            f"Relaxed to {', '.join(descs)}",
        ))

    # Strategy 3: halve threshold + keep category
    if has_sector_exp and has_cats:
        new_filters = []
        for sef in parsed["sector_exposure_filters"]:
            halved = round(sef["value"] / 2, 1)
            new_filters.append({**sef, "value": halved})
        strategies.append((
            {**parsed, "sector_exposure_filters": new_filters},
            f"Relaxed sector threshold to {new_filters[0]['value']}%",
        ))

    # Strategy 4: drop sector filters, keep category
    if (has_sector_exp or has_sectors) and has_cats:
        strategies.append((
            {**parsed, "sectors": [], "sector_exposure_filters": []},
            "Showing category matches (removed sector filter)",
        ))

    return strategies
