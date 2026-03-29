"""Sector rotation computation from Morningstar holdings data."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from app.models.db.sector_exposure import FundSectorExposure
from app.models.db.sector_rotation import SectorRotationHistory

logger = logging.getLogger(__name__)

MORNINGSTAR_SECTORS = [
    "Basic Materials", "Communication Services", "Consumer Cyclical",
    "Consumer Defensive", "Energy", "Financial Services", "Healthcare",
    "Industrials", "Real Estate", "Technology", "Utilities",
]


class SectorRotationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def compute_current(self) -> list[dict]:
        """Compute current sector rotation from latest holdings and store in history."""
        # Get the latest portfolio_date in fund_sector_exposure
        latest_date = self.db.query(func.max(FundSectorExposure.portfolio_date)).scalar()
        if not latest_date:
            logger.warning("No sector exposure data found")
            return []

        return self._compute_for_date(latest_date)

    def compute_for_date(self, target_date: date) -> list[dict]:
        """Compute sector rotation for a specific date."""
        return self._compute_for_date(target_date)

    def _compute_for_date(self, target_date: date) -> list[dict]:
        """Core computation for a specific snapshot date."""
        # Get sector weights for the target date
        current_weights = self._get_sector_weights(target_date)
        if not current_weights:
            logger.warning("No sector weights for date %s", target_date)
            return []

        # Get previous snapshots for momentum calculation
        prev_1m_date = target_date - timedelta(days=35)
        prev_3m_date = target_date - timedelta(days=100)

        prev_1m_weights = self._get_sector_weights_nearest(prev_1m_date)
        prev_3m_weights = self._get_sector_weights_nearest(prev_3m_date)

        # Compute RS score: weight relative to equal-weight baseline (100/11 ≈ 9.09%)
        equal_weight = Decimal("9.0909")

        results = []
        for sector in MORNINGSTAR_SECTORS:
            cur = current_weights.get(sector, {})
            avg_wt = cur.get("avg_weight", Decimal("0"))
            fund_ct = cur.get("fund_count", 0)

            # Momentum
            prev_1m_wt = prev_1m_weights.get(sector, {}).get("avg_weight", avg_wt)
            prev_3m_wt = prev_3m_weights.get(sector, {}).get("avg_weight", avg_wt)
            mom_1m = avg_wt - prev_1m_wt
            mom_3m = avg_wt - prev_3m_wt

            # RS score: (actual_weight / equal_weight) * 50, clamped 0-100
            rs = min(Decimal("100"), max(Decimal("0"),
                (avg_wt / equal_weight * Decimal("50")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            )) if avg_wt > 0 else Decimal("0")

            # Quadrant: based on RS (above/below 50) and momentum (positive/negative)
            quadrant = self._assign_quadrant(rs, mom_1m)

            entry = SectorRotationHistory(
                sector_name=sector,
                snapshot_date=target_date,
                avg_weight_pct=avg_wt.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP),
                momentum_1m=mom_1m.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP),
                momentum_3m=mom_3m.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP),
                rs_score=rs,
                quadrant=quadrant,
                fund_count=fund_ct,
            )

            # Upsert
            existing = self.db.query(SectorRotationHistory).filter(
                and_(
                    SectorRotationHistory.sector_name == sector,
                    SectorRotationHistory.snapshot_date == target_date,
                )
            ).first()

            if existing:
                existing.avg_weight_pct = entry.avg_weight_pct
                existing.momentum_1m = entry.momentum_1m
                existing.momentum_3m = entry.momentum_3m
                existing.rs_score = entry.rs_score
                existing.quadrant = entry.quadrant
                existing.fund_count = entry.fund_count
            else:
                self.db.add(entry)

            results.append({
                "sector_name": sector,
                "snapshot_date": str(target_date),
                "avg_weight_pct": float(avg_wt),
                "momentum_1m": float(mom_1m),
                "momentum_3m": float(mom_3m),
                "rs_score": float(rs),
                "quadrant": quadrant,
                "fund_count": fund_ct,
            })

        self.db.commit()
        logger.info("Computed sector rotation for %s: %d sectors", target_date, len(results))
        return results

    def get_current_rotation(self) -> list[dict]:
        """Get the latest computed sector rotation."""
        latest_date = self.db.query(
            func.max(SectorRotationHistory.snapshot_date)
        ).scalar()

        if not latest_date:
            return []

        rows = self.db.query(SectorRotationHistory).filter(
            SectorRotationHistory.snapshot_date == latest_date
        ).order_by(SectorRotationHistory.rs_score.desc()).all()

        return [self._row_to_dict(r) for r in rows]

    def get_history(self, months: int = 6) -> list[dict]:
        """Get sector rotation history for the last N months."""
        cutoff = date.today() - timedelta(days=months * 31)
        rows = self.db.query(SectorRotationHistory).filter(
            SectorRotationHistory.snapshot_date >= cutoff
        ).order_by(
            SectorRotationHistory.snapshot_date.desc(),
            SectorRotationHistory.rs_score.desc(),
        ).all()

        return [self._row_to_dict(r) for r in rows]

    def get_fund_exposure_by_sector(self, sector_name: str, limit: int = 20) -> list[dict]:
        """Get top funds by allocation to a specific sector."""
        latest_date = self.db.query(
            func.max(FundSectorExposure.portfolio_date)
        ).scalar()
        if not latest_date:
            return []

        rows = (
            self.db.query(FundSectorExposure)
            .filter(
                and_(
                    FundSectorExposure.sector_name == sector_name,
                    FundSectorExposure.portfolio_date == latest_date,
                    FundSectorExposure.net_pct.isnot(None),
                )
            )
            .order_by(FundSectorExposure.net_pct.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "mstar_id": r.mstar_id,
                "sector_name": r.sector_name,
                "net_pct": float(r.net_pct) if r.net_pct else 0,
                "portfolio_date": str(r.portfolio_date),
            }
            for r in rows
        ]

    def _get_sector_weights(self, target_date: date) -> dict:
        """Get average sector weights for a specific date."""
        rows = (
            self.db.query(
                FundSectorExposure.sector_name,
                func.avg(FundSectorExposure.net_pct).label("avg_weight"),
                func.count(FundSectorExposure.mstar_id.distinct()).label("fund_count"),
            )
            .filter(FundSectorExposure.portfolio_date == target_date)
            .filter(FundSectorExposure.net_pct.isnot(None))
            .filter(FundSectorExposure.sector_name.in_(MORNINGSTAR_SECTORS))
            .group_by(FundSectorExposure.sector_name)
            .all()
        )

        return {
            r.sector_name: {
                "avg_weight": Decimal(str(r.avg_weight)) if r.avg_weight else Decimal("0"),
                "fund_count": r.fund_count or 0,
            }
            for r in rows
        }

    def _get_sector_weights_nearest(self, target_date: date) -> dict:
        """Get sector weights for the nearest date to target (within 15 days)."""
        nearest_date = (
            self.db.query(FundSectorExposure.portfolio_date)
            .filter(
                FundSectorExposure.portfolio_date.between(
                    target_date - timedelta(days=15),
                    target_date + timedelta(days=15),
                )
            )
            .order_by(
                func.abs(
                    func.extract("epoch", FundSectorExposure.portfolio_date) -
                    func.extract("epoch", func.cast(target_date, FundSectorExposure.portfolio_date.type))
                )
            )
            .limit(1)
            .scalar()
        )

        if nearest_date:
            return self._get_sector_weights(nearest_date)
        return {}

    @staticmethod
    def _assign_quadrant(rs_score: Decimal, momentum_1m: Decimal) -> str:
        """Assign sector to quadrant based on RS score and momentum."""
        strong_rs = rs_score >= 50
        positive_momentum = momentum_1m > 0

        if strong_rs and positive_momentum:
            return "Leading"
        if strong_rs and not positive_momentum:
            return "Weakening"
        if not strong_rs and positive_momentum:
            return "Improving"
        return "Lagging"

    @staticmethod
    def _row_to_dict(row: SectorRotationHistory) -> dict:
        return {
            "sector_name": row.sector_name,
            "snapshot_date": str(row.snapshot_date),
            "avg_weight_pct": float(row.avg_weight_pct) if row.avg_weight_pct else 0,
            "momentum_1m": float(row.momentum_1m) if row.momentum_1m else 0,
            "momentum_3m": float(row.momentum_3m) if row.momentum_3m else 0,
            "rs_score": float(row.rs_score) if row.rs_score else 0,
            "quadrant": row.quadrant or "Lagging",
            "fund_count": row.fund_count or 0,
        }
