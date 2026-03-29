"""Compute category x sector quadrant alignment from holdings + rotation data."""

from __future__ import annotations

import logging
from collections import defaultdict
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.db.fund_master import FundMaster
from app.models.db.sector_exposure import FundSectorExposure

logger = logging.getLogger(__name__)

# Excluded categories (not investment-relevant)
EXCLUDED_CATEGORIES = {
    "Overnight Fund", "Liquid Fund", "Money Market Fund",
    "Index Fund", "Fund of Funds", "Equity - Other",
}


class CategoryAlignmentService:
    """Computes how much of each category's portfolio is in each sector zone."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_category_alignment(self) -> list[dict]:
        """Return category alignment sorted by tailwind_pct descending."""
        # Step 1: Get current sector quadrants from sector_rotation_history
        quadrant_map = self._get_sector_quadrants()
        if not quadrant_map:
            return []

        # Step 2: Get latest sector exposure for each fund, grouped by category
        alignment = self._compute_alignment(quadrant_map)

        # Step 3: Sort by tailwind descending
        alignment.sort(key=lambda x: x["tailwind_pct"], reverse=True)
        return alignment

    def _get_sector_quadrants(self) -> dict[str, str]:
        """Get sector_name -> quadrant mapping from latest rotation snapshot."""
        rows = self.db.execute(text("""
            SELECT sector_name, quadrant
            FROM sector_rotation_history
            WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM sector_rotation_history)
        """)).fetchall()
        return {r[0]: r[1] for r in rows}

    def _compute_alignment(self, quadrant_map: dict[str, str]) -> list[dict]:
        """Compute per-category exposure across quadrant zones."""
        # Get latest portfolio_date per fund
        latest_sub = (
            self.db.query(
                FundSectorExposure.mstar_id,
                func.max(FundSectorExposure.portfolio_date).label("max_date"),
            )
            .group_by(FundSectorExposure.mstar_id)
            .subquery()
        )

        # Join to get all sector exposures + fund category
        rows = (
            self.db.query(
                FundMaster.category_name,
                FundSectorExposure.sector_name,
                FundSectorExposure.net_pct,
            )
            .join(FundMaster, FundMaster.mstar_id == FundSectorExposure.mstar_id)
            .join(
                latest_sub,
                (FundSectorExposure.mstar_id == latest_sub.c.mstar_id)
                & (FundSectorExposure.portfolio_date == latest_sub.c.max_date),
            )
            .filter(FundMaster.category_name.notin_(EXCLUDED_CATEGORIES))
            .all()
        )

        # Aggregate: category -> { quadrant -> total_pct }
        cat_data: dict[str, dict] = defaultdict(lambda: {
            "Leading": Decimal("0"),
            "Improving": Decimal("0"),
            "Weakening": Decimal("0"),
            "Lagging": Decimal("0"),
            "total": Decimal("0"),
        })

        for cat_name, sector_name, net_pct in rows:
            if not cat_name or not sector_name or net_pct is None:
                continue
            quadrant = quadrant_map.get(sector_name)
            if not quadrant:
                continue
            # Normalize quadrant name (API may return LEADING/Leading/etc)
            q_normalized = quadrant.capitalize()
            if q_normalized not in ("Leading", "Improving", "Weakening", "Lagging"):
                # Handle alternate names: WORSENING -> Weakening
                if q_normalized in ("Worsening",):
                    q_normalized = "Weakening"
                else:
                    continue
            pct = Decimal(str(net_pct))
            cat_data[cat_name][q_normalized] += pct
            cat_data[cat_name]["total"] += pct

        # Count funds per category
        fund_counts = dict(
            self.db.query(FundMaster.category_name, func.count(FundMaster.mstar_id))
            .filter(FundMaster.category_name.notin_(EXCLUDED_CATEGORIES))
            .group_by(FundMaster.category_name)
            .all()
        )

        result = []
        for cat_name, data in cat_data.items():
            total = float(data["total"]) if data["total"] else 1.0
            if total <= 0:
                continue
            leading_pct = round(float(data["Leading"]) / total * 100, 1)
            improving_pct = round(float(data["Improving"]) / total * 100, 1)
            weakening_pct = round(float(data["Weakening"]) / total * 100, 1)
            lagging_pct = round(100.0 - leading_pct - improving_pct - weakening_pct, 1)

            result.append({
                "category_name": cat_name,
                "fund_count": fund_counts.get(cat_name, 0),
                "leading_pct": leading_pct,
                "improving_pct": improving_pct,
                "weakening_pct": weakening_pct,
                "lagging_pct": max(0, lagging_pct),
                "tailwind_pct": round(leading_pct + improving_pct, 1),
                "headwind_pct": round(weakening_pct + max(0, lagging_pct), 1),
            })

        # Only return categories with enough data
        return [r for r in result if r["fund_count"] >= 5]
