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


def _safe_float(val: Optional[Decimal]) -> float:
    """Safely convert Decimal/None to float for comparison."""
    if val is None:
        return 0.0
    return float(val)
