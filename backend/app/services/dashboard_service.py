"""Dashboard pre-computation — smart buckets from lens classifications."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from app.models.db.fund_master import FundMaster
from app.models.db.holdings import FundHoldingsSnapshot
from app.models.db.lens_scores import FundClassification, FundLensScores
from app.models.db.nav_daily import NavDaily

logger = logging.getLogger(__name__)


class DashboardService:
    """Pre-computes dashboard smart buckets from lens data."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_smart_buckets(self) -> list[dict]:
        """Compute 6 smart buckets from lens classifications."""
        # Get latest lens date
        latest_lens = self.db.query(
            func.max(FundLensScores.computed_date)
        ).scalar()
        latest_class = self.db.query(
            func.max(FundClassification.computed_date)
        ).scalar()

        if not latest_lens or not latest_class:
            return []

        # Fetch all scores + classifications for latest date
        scores = (
            self.db.query(FundLensScores)
            .filter(FundLensScores.computed_date == latest_lens)
            .all()
        )
        classes = (
            self.db.query(FundClassification)
            .filter(FundClassification.computed_date == latest_class)
            .all()
        )

        score_map = {s.mstar_id: s for s in scores}
        class_map = {c.mstar_id: c for c in classes}
        all_mstar_ids = list(set(score_map.keys()) & set(class_map.keys()))

        if not all_mstar_ids:
            return []

        # Fetch fund names + AUM + returns in batch
        fund_info = self._get_fund_info_batch(all_mstar_ids)

        # Define bucket filters
        buckets = [
            {
                "name": "Consistent Alpha",
                "description": "Alpha generators with rock-solid consistency",
                "filter": lambda mid: (
                    class_map.get(mid) and
                    class_map[mid].alpha_class == "ALPHA_MACHINE" and
                    class_map[mid].consistency_class in ("ROCK_SOLID", "CONSISTENT")
                ),
                "sort_key": "alpha_score",
            },
            {
                "name": "Low-Risk Leaders",
                "description": "Top returns with controlled volatility",
                "filter": lambda mid: (
                    score_map.get(mid) and
                    _safe_float(score_map[mid].risk_score) >= 80 and
                    _safe_float(score_map[mid].return_score) >= 60
                ),
                "sort_key": "return_score",
            },
            {
                "name": "High Efficiency",
                "description": "Best returns per rupee of expense",
                "filter": lambda mid: (
                    score_map.get(mid) and
                    _safe_float(score_map[mid].efficiency_score) >= 80 and
                    _safe_float(score_map[mid].return_score) >= 60
                ),
                "sort_key": "efficiency_score",
            },
            {
                "name": "Fortress Funds",
                "description": "Built to weather market storms",
                "filter": lambda mid: (
                    class_map.get(mid) and score_map.get(mid) and
                    class_map[mid].resilience_class in ("FORTRESS", "STURDY") and
                    _safe_float(score_map[mid].consistency_score) >= 60
                ),
                "sort_key": "resilience_score",
            },
            {
                "name": "Turnaround Watch",
                "description": "Improving momentum after weak period",
                "filter": lambda mid: (
                    score_map.get(mid) and
                    _safe_float(score_map[mid].return_score) >= 40 and
                    _safe_float(score_map[mid].return_score) < 65 and
                    _safe_float(score_map[mid].alpha_score) >= 50
                ),
                "sort_key": "alpha_score",
            },
            {
                "name": "Avoid Zone",
                "description": "3+ lenses in weak territory",
                "filter": lambda mid: (
                    score_map.get(mid) and
                    sum(1 for k in ["return_score", "risk_score", "consistency_score",
                                    "alpha_score", "efficiency_score", "resilience_score"]
                        if _safe_float(getattr(score_map[mid], k, None)) < 30) >= 3
                ),
                "sort_key": "return_score",
            },
        ]

        result = []
        for bucket_def in buckets:
            matching = [mid for mid in all_mstar_ids if bucket_def["filter"](mid)]
            # Sort by the designated score
            matching.sort(
                key=lambda mid: _safe_float(getattr(score_map.get(mid), bucket_def["sort_key"], None)),
                reverse=True,
            )

            top_fund = None
            if matching:
                top_mid = matching[0]
                info = fund_info.get(top_mid, {})
                top_fund = {
                    "mstar_id": top_mid,
                    "fund_name": info.get("fund_name"),
                    "return_1y": info.get("return_1y"),
                    "aum": info.get("aum"),
                }

            result.append({
                "name": bucket_def["name"],
                "description": bucket_def["description"],
                "count": len(matching),
                "top_fund": top_fund,
                "filter_params": {"bucket": bucket_def["name"].lower().replace(" ", "_")},
            })

        return result

    def _get_fund_info_batch(self, mstar_ids: list[str]) -> dict[str, dict]:
        """Batch fetch fund name, AUM, 1Y return."""
        if not mstar_ids:
            return {}

        # Fund names
        funds = (
            self.db.query(FundMaster.mstar_id, FundMaster.fund_name)
            .filter(FundMaster.mstar_id.in_(mstar_ids))
            .all()
        )
        result = {f.mstar_id: {"fund_name": f.fund_name} for f in funds}

        # AUM
        aum_sub = (
            self.db.query(
                FundHoldingsSnapshot.mstar_id,
                func.max(FundHoldingsSnapshot.portfolio_date).label("max_date"),
            )
            .filter(
                FundHoldingsSnapshot.mstar_id.in_(mstar_ids),
                FundHoldingsSnapshot.aum.isnot(None),
            )
            .group_by(FundHoldingsSnapshot.mstar_id)
            .subquery()
        )
        aum_rows = (
            self.db.query(FundHoldingsSnapshot.mstar_id, FundHoldingsSnapshot.aum)
            .join(
                aum_sub,
                (FundHoldingsSnapshot.mstar_id == aum_sub.c.mstar_id)
                & (FundHoldingsSnapshot.portfolio_date == aum_sub.c.max_date),
            )
            .all()
        )
        for r in aum_rows:
            if r.mstar_id in result:
                result[r.mstar_id]["aum"] = float(r.aum) if r.aum else None

        # Returns
        latest_nav_sub = (
            self.db.query(
                NavDaily.mstar_id,
                func.max(NavDaily.nav_date).label("max_date"),
            )
            .filter(NavDaily.mstar_id.in_(mstar_ids))
            .group_by(NavDaily.mstar_id)
            .subquery()
        )
        nav_rows = (
            self.db.query(NavDaily.mstar_id, NavDaily.return_1y)
            .join(
                latest_nav_sub,
                (NavDaily.mstar_id == latest_nav_sub.c.mstar_id)
                & (NavDaily.nav_date == latest_nav_sub.c.max_date),
            )
            .all()
        )
        for r in nav_rows:
            if r.mstar_id in result:
                result[r.mstar_id]["return_1y"] = float(r.return_1y) if r.return_1y else None

        return result


    def get_archetypes(self) -> list[dict]:
        """Cluster all funds into 9 archetypes by 6-lens pattern."""
        latest_class = self.db.query(
            func.max(FundClassification.computed_date)
        ).scalar()
        latest_lens = self.db.query(
            func.max(FundLensScores.computed_date)
        ).scalar()
        if not latest_class or not latest_lens:
            return _empty_archetypes()

        classes = {
            c.mstar_id: c
            for c in self.db.query(FundClassification)
            .filter(FundClassification.computed_date == latest_class).all()
        }
        scores = {
            s.mstar_id: s
            for s in self.db.query(FundLensScores)
            .filter(FundLensScores.computed_date == latest_lens).all()
        }
        all_ids = list(set(classes.keys()) & set(scores.keys()))
        total = len(all_ids) or 1

        # Classify each fund
        archetype_counts: dict[str, list[str]] = {a["archetype_id"]: [] for a in ARCHETYPE_DEFS}
        for mid in all_ids:
            c = classes[mid]
            s = scores[mid]
            arch_id = _classify_archetype(c, s)
            archetype_counts[arch_id].append(mid)

        result = []
        for defn in ARCHETYPE_DEFS:
            aid = defn["archetype_id"]
            count = len(archetype_counts[aid])
            result.append({
                **defn,
                "count": count,
                "percentage": round(count / total * 100, 1),
            })
        return result


ARCHETYPE_DEFS = [
    {"archetype_id": "all-rounder", "name": "All-Rounder",
     "lens_pattern": ["LEADER", "LOW_RISK", "ROCK_SOLID", "ALPHA_MACHINE", "LEAN", "FORTRESS"],
     "description": "5+ lenses in top tier. Elite funds across all dimensions."},
    {"archetype_id": "alpha-fragile", "name": "Alpha but Fragile",
     "lens_pattern": ["LEADER", "HIGH_RISK", "MIXED", "ALPHA_MACHINE", "FAIR", "VULNERABLE"],
     "description": "High alpha & return but poor risk control. Great in bull runs, painful in corrections."},
    {"archetype_id": "defensive", "name": "Defensive Anchor",
     "lens_pattern": ["AVERAGE", "LOW_RISK", "CONSISTENT", "NEUTRAL", "FAIR", "FORTRESS"],
     "description": "Low risk, high resilience, moderate returns. Portfolio stabilizers."},
    {"archetype_id": "compounder", "name": "Consistent Compounder",
     "lens_pattern": ["STRONG", "MODERATE", "ROCK_SOLID", "POSITIVE", "LEAN", "STURDY"],
     "description": "Rock-solid consistency with good efficiency. Reliable SIP candidates."},
    {"archetype_id": "high-return-high-risk", "name": "High Return High Risk",
     "lens_pattern": ["LEADER", "HIGH_RISK", "ERRATIC", "POSITIVE", "FAIR", "VULNERABLE"],
     "description": "Strong returns but volatile & erratic. For high-risk-appetite investors only."},
    {"archetype_id": "mid-tier", "name": "Efficient Mid-Tier",
     "lens_pattern": ["AVERAGE", "MODERATE", "MIXED", "NEUTRAL", "FAIR", "FRAGILE"],
     "description": "Average across the board with decent efficiency. The middle of the pack."},
    {"archetype_id": "watch", "name": "Watch",
     "lens_pattern": ["AVERAGE", "LOW_RISK", "MIXED", "NEGATIVE", "EXPENSIVE", "STURDY"],
     "description": "Safe on risk metrics but alpha has eroded. Expensive for what it delivers. Review position."},
    {"archetype_id": "turnaround", "name": "Turnaround Potential",
     "lens_pattern": ["WEAK", "MODERATE", "ERRATIC", "POSITIVE", "FAIR", "FRAGILE"],
     "description": "Weak returns but improving alpha signal. Manager may be turning the corner."},
    {"archetype_id": "trouble", "name": "Trouble Zone",
     "lens_pattern": ["WEAK", "HIGH_RISK", "ERRATIC", "NEGATIVE", "EXPENSIVE", "VULNERABLE"],
     "description": "3+ lenses in weak tier. Underperforming, risky, and inconsistent. Avoid or exit."},
]


def _classify_archetype(c, s) -> str:
    """Classify a fund into one of 9 archetypes based on lens tiers."""
    top_tiers = {"LEADER", "STRONG", "LOW_RISK", "ROCK_SOLID", "CONSISTENT",
                 "ALPHA_MACHINE", "POSITIVE", "LEAN", "FAIR", "FORTRESS", "STURDY"}
    weak_tiers = {"WEAK", "HIGH_RISK", "ERRATIC", "NEGATIVE", "BLOATED",
                  "EXPENSIVE", "VULNERABLE", "FRAGILE"}

    tier_list = [
        getattr(c, "return_class", None) or "AVERAGE",
        getattr(c, "risk_class", None) or "MODERATE",
        getattr(c, "consistency_class", None) or "MIXED",
        getattr(c, "alpha_class", None) or "NEUTRAL",
        getattr(c, "efficiency_class", None) or "FAIR",
        getattr(c, "resilience_class", None) or "FRAGILE",
    ]
    top_count = sum(1 for t in tier_list if t in top_tiers)
    weak_count = sum(1 for t in tier_list if t in weak_tiers)

    ret = tier_list[0]
    risk = tier_list[1]
    cons = tier_list[2]
    alpha = tier_list[3]
    resil = tier_list[5]

    # All-Rounder: 5+ top
    if top_count >= 5:
        return "all-rounder"
    # Trouble Zone: 3+ weak
    if weak_count >= 3:
        return "trouble"
    # Watch: fund has weak alpha despite low risk (eroding value)
    if alpha in ("NEGATIVE",) and risk in ("LOW_RISK", "MODERATE") and ret in ("AVERAGE", "WEAK"):
        return "watch"
    # Alpha but Fragile: strong return/alpha + weak risk/resilience
    if ret in ("LEADER", "STRONG") and alpha in ("ALPHA_MACHINE", "POSITIVE") and resil in ("VULNERABLE", "FRAGILE"):
        return "alpha-fragile"
    # Defensive: low risk + fortress resilience + good return
    if risk in ("LOW_RISK",) and resil in ("FORTRESS", "STURDY") and ret not in ("WEAK",):
        return "defensive"
    # Consistent Compounder: top consistency + good return
    if cons in ("ROCK_SOLID", "CONSISTENT") and ret in ("LEADER", "STRONG"):
        return "compounder"
    # High Return High Risk
    if ret in ("LEADER", "STRONG") and risk in ("HIGH_RISK", "ELEVATED"):
        return "high-return-high-risk"
    # Turnaround: weak return but positive alpha
    if ret in ("WEAK", "AVERAGE") and alpha in ("ALPHA_MACHINE", "POSITIVE"):
        return "turnaround"
    # Default: Mid-Tier
    return "mid-tier"


def _empty_archetypes() -> list[dict]:
    """Return empty archetype list when no data available."""
    return [{**d, "count": 0, "percentage": 0.0} for d in ARCHETYPE_DEFS]


def _safe_float(val: Optional[Decimal]) -> float:
    """Safely convert Decimal/None to float for comparison."""
    if val is None:
        return 0.0
    return float(val)
