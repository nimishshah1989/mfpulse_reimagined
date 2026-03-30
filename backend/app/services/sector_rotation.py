"""Sector rotation computation from Morningstar holdings data."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from statistics import stdev
from typing import Optional

from sqlalchemy import func, and_, text
from sqlalchemy.orm import Session

from app.models.db.fund_master import FundMaster
from app.models.db.holdings import FundHoldingsSnapshot
from app.models.db.nav_daily import NavDaily
from app.models.db.sector_exposure import FundSectorExposure
from app.models.db.sector_rotation import SectorRotationHistory
from app.models.db.lens_scores import FundLensScores

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
        latest_date = self.db.query(func.max(FundSectorExposure.portfolio_date)).scalar()
        if not latest_date:
            logger.warning("No sector exposure data found")
            return []

        return self._compute_for_date(latest_date)

    def compute_for_date(self, target_date: date) -> list[dict]:
        """Compute sector rotation for a specific date."""
        return self._compute_for_date(target_date)

    def backfill_history(self, months: int = 6) -> list[dict]:
        """Backfill sector rotation for all distinct portfolio dates in the last N months."""
        cutoff = date.today() - timedelta(days=months * 31)
        dates = (
            self.db.query(FundSectorExposure.portfolio_date)
            .filter(FundSectorExposure.portfolio_date >= cutoff)
            .distinct()
            .order_by(FundSectorExposure.portfolio_date.asc())
            .all()
        )
        all_results = []
        for (d,) in dates:
            results = self._compute_for_date(d)
            all_results.extend(results)
        logger.info("Backfilled sector rotation for %d dates", len(dates))
        return all_results

    def _compute_for_date(self, target_date: date) -> list[dict]:
        """Core computation for a specific snapshot date.

        RS Score = (sector_weighted_return - avg_all_sectors_return) / std_dev
        normalized to 0-100 scale. Uses AUM-weighted sector returns from
        fund_sector_exposure × nav_daily.return_1y.

        Momentum = change in RS score between snapshots (not weight change).
        """
        # Get AUM-weighted sector returns
        sector_returns = self._get_sector_weighted_returns(target_date)

        # Get sector weights for fund count
        current_weights = self._get_sector_weights(target_date)
        if not current_weights:
            logger.warning("No sector weights for date %s", target_date)
            return []

        # Compute RS score: relative performance approach
        all_returns = [
            sector_returns.get(s, {}).get("weighted_return", Decimal("0"))
            for s in MORNINGSTAR_SECTORS
        ]
        all_returns_float = [float(r) for r in all_returns]
        avg_return = sum(all_returns_float) / max(len(all_returns_float), 1)
        std_return = stdev(all_returns_float) if len(all_returns_float) > 1 else Decimal("1")
        std_return = max(std_return, 0.01)  # avoid division by zero

        # Compute RS scores for all sectors first
        rs_scores: dict[str, Decimal] = {}
        for sector in MORNINGSTAR_SECTORS:
            sec_ret = sector_returns.get(sector, {})
            weighted_ret = sec_ret.get("weighted_return", Decimal("0"))
            raw_rs = (float(weighted_ret) - avg_return) / std_return
            rs = max(Decimal("0"), min(Decimal("100"),
                Decimal(str(50 + raw_rs * 16.67)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            ))
            rs_scores[sector] = rs

        # Get previous RS scores for momentum (RS score change, not weight change)
        prev_1m_rs = self._get_previous_rs_scores(target_date, months_back=1)
        prev_3m_rs = self._get_previous_rs_scores(target_date, months_back=3)

        results = []
        for sector in MORNINGSTAR_SECTORS:
            cur = current_weights.get(sector, {})
            avg_wt = cur.get("avg_weight", Decimal("0"))
            fund_ct = cur.get("fund_count", 0)

            rs = rs_scores[sector]

            # Momentum = RS score change (meaningful for quadrant assignment)
            prev_1m_val = prev_1m_rs.get(sector, rs)  # default to current if no history
            prev_3m_val = prev_3m_rs.get(sector, rs)
            mom_1m = rs - prev_1m_val
            mom_3m = rs - prev_3m_val

            sec_ret = sector_returns.get(sector, {})
            weighted_ret = sec_ret.get("weighted_return", Decimal("0"))
            total_aum = sec_ret.get("total_aum", Decimal("0"))

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
                weighted_return=weighted_ret.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP),
                total_aum_exposed=total_aum.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
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
                existing.weighted_return = entry.weighted_return
                existing.total_aum_exposed = entry.total_aum_exposed
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
                "weighted_return": float(weighted_ret),
                "total_aum_exposed": float(total_aum),
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

    def get_sector_drill_down(
        self,
        sector_name: str,
        min_pct: float = 5.0,
        limit: int = 50,
    ) -> list[dict]:
        """Get funds with >= min_pct exposure to a sector, enriched with lens + returns."""
        latest_date = self.db.query(
            func.max(FundSectorExposure.portfolio_date)
        ).scalar()
        if not latest_date:
            return []

        # Get latest lens scores date
        latest_lens_date = self.db.query(
            func.max(FundLensScores.computed_date)
        ).scalar()

        # Get latest nav date for returns
        latest_nav_sub = (
            self.db.query(
                NavDaily.mstar_id,
                func.max(NavDaily.nav_date).label("max_date"),
            )
            .group_by(NavDaily.mstar_id)
            .subquery()
        )

        # Main query: sector exposure >= threshold
        exposures = (
            self.db.query(
                FundSectorExposure.mstar_id,
                FundSectorExposure.net_pct,
            )
            .filter(
                FundSectorExposure.sector_name == sector_name,
                FundSectorExposure.portfolio_date == latest_date,
                FundSectorExposure.net_pct >= Decimal(str(min_pct)),
            )
            .order_by(FundSectorExposure.net_pct.desc())
            .limit(limit)
            .all()
        )

        if not exposures:
            return []

        mstar_ids = [e.mstar_id for e in exposures]
        exposure_map = {e.mstar_id: float(e.net_pct) for e in exposures}

        # Batch fetch fund master
        funds = (
            self.db.query(FundMaster)
            .filter(FundMaster.mstar_id.in_(mstar_ids))
            .all()
        )
        fund_map = {f.mstar_id: f for f in funds}

        # Batch fetch lens scores
        lens_map: dict[str, FundLensScores] = {}
        if latest_lens_date:
            lens_rows = (
                self.db.query(FundLensScores)
                .filter(
                    FundLensScores.mstar_id.in_(mstar_ids),
                    FundLensScores.computed_date == latest_lens_date,
                )
                .all()
            )
            lens_map = {r.mstar_id: r for r in lens_rows}

        # Batch fetch latest returns
        nav_rows = (
            self.db.query(NavDaily)
            .join(
                latest_nav_sub,
                (NavDaily.mstar_id == latest_nav_sub.c.mstar_id)
                & (NavDaily.nav_date == latest_nav_sub.c.max_date),
            )
            .filter(NavDaily.mstar_id.in_(mstar_ids))
            .all()
        )
        nav_map = {r.mstar_id: r for r in nav_rows}

        # Batch fetch AUM
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
        aum_map = {r.mstar_id: r.aum for r in aum_rows}

        result = []
        for mid in mstar_ids:
            fund = fund_map.get(mid)
            if not fund:
                continue
            lens = lens_map.get(mid)
            nav = nav_map.get(mid)
            aum = aum_map.get(mid)

            result.append({
                "mstar_id": mid,
                "fund_name": fund.fund_name,
                "category_name": fund.category_name,
                "amc_name": fund.amc_name,
                "sector_exposure_pct": exposure_map.get(mid, 0),
                "return_1y": float(nav.return_1y) if nav and nav.return_1y else None,
                "return_3y": float(nav.return_3y) if nav and nav.return_3y else None,
                "aum": float(aum) if aum else None,
                "return_score": float(lens.return_score) if lens and lens.return_score else None,
                "risk_score": float(lens.risk_score) if lens and lens.risk_score else None,
                "alpha_score": float(lens.alpha_score) if lens and lens.alpha_score else None,
                "consistency_score": float(lens.consistency_score) if lens and lens.consistency_score else None,
                "efficiency_score": float(lens.efficiency_score) if lens and lens.efficiency_score else None,
                "resilience_score": float(lens.resilience_score) if lens and lens.resilience_score else None,
            })

        return result

    def get_fund_exposure_matrix(self, limit: int = 20) -> list[dict]:
        """Top N funds by AUM with all 11 sector exposures + 1Y return.

        Uses each fund's own latest sector exposure date (not a global latest)
        because AUM snapshots and sector exposure snapshots may be on different dates.
        """
        # Get top funds by AUM
        aum_sub = (
            self.db.query(
                FundHoldingsSnapshot.mstar_id,
                func.max(FundHoldingsSnapshot.portfolio_date).label("max_date"),
            )
            .filter(FundHoldingsSnapshot.aum.isnot(None))
            .group_by(FundHoldingsSnapshot.mstar_id)
            .subquery()
        )
        top_funds = (
            self.db.query(
                FundHoldingsSnapshot.mstar_id,
                FundHoldingsSnapshot.aum,
            )
            .join(
                aum_sub,
                (FundHoldingsSnapshot.mstar_id == aum_sub.c.mstar_id)
                & (FundHoldingsSnapshot.portfolio_date == aum_sub.c.max_date),
            )
            .order_by(FundHoldingsSnapshot.aum.desc())
            .limit(limit)
            .all()
        )

        if not top_funds:
            return []

        mstar_ids = [f.mstar_id for f in top_funds]
        aum_map = {f.mstar_id: float(f.aum) for f in top_funds}

        # Fetch fund names
        funds = (
            self.db.query(FundMaster.mstar_id, FundMaster.fund_name, FundMaster.category_name)
            .filter(FundMaster.mstar_id.in_(mstar_ids))
            .all()
        )
        name_map = {f.mstar_id: {"fund_name": f.fund_name, "category_name": f.category_name} for f in funds}

        # Get each fund's latest sector exposure date (not global latest)
        expo_date_sub = (
            self.db.query(
                FundSectorExposure.mstar_id,
                func.max(FundSectorExposure.portfolio_date).label("max_date"),
            )
            .filter(FundSectorExposure.mstar_id.in_(mstar_ids))
            .group_by(FundSectorExposure.mstar_id)
            .subquery()
        )

        # Fetch all sector exposures using each fund's own latest date
        exposures = (
            self.db.query(FundSectorExposure)
            .join(
                expo_date_sub,
                (FundSectorExposure.mstar_id == expo_date_sub.c.mstar_id)
                & (FundSectorExposure.portfolio_date == expo_date_sub.c.max_date),
            )
            .all()
        )
        # Build map: mstar_id -> {sector_name: net_pct}
        expo_map: dict[str, dict[str, float]] = {}
        for e in exposures:
            if e.mstar_id not in expo_map:
                expo_map[e.mstar_id] = {}
            expo_map[e.mstar_id][e.sector_name] = float(e.net_pct) if e.net_pct else 0

        # Fetch 1Y returns
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
        return_map = {r.mstar_id: float(r.return_1y) if r.return_1y else None for r in nav_rows}

        result = []
        for mid in mstar_ids:
            info = name_map.get(mid, {})
            sectors = expo_map.get(mid, {})
            result.append({
                "mstar_id": mid,
                "fund_name": info.get("fund_name"),
                "category_name": info.get("category_name"),
                "aum": aum_map.get(mid),
                "return_1y": return_map.get(mid),
                "sectors": {s: sectors.get(s, 0) for s in MORNINGSTAR_SECTORS},
            })

        return result

    def _get_sector_weighted_returns(self, target_date: date) -> dict:
        """Compute AUM-weighted sector returns using sector exposure × fund 1Y return."""
        # Get all sector exposures for the date
        exposures = (
            self.db.query(
                FundSectorExposure.mstar_id,
                FundSectorExposure.sector_name,
                FundSectorExposure.net_pct,
            )
            .filter(
                FundSectorExposure.portfolio_date == target_date,
                FundSectorExposure.net_pct.isnot(None),
                FundSectorExposure.sector_name.in_(MORNINGSTAR_SECTORS),
            )
            .all()
        )

        if not exposures:
            return {}

        mstar_ids = list({e.mstar_id for e in exposures})

        # Get latest AUM per fund
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
        aum_map = {r.mstar_id: Decimal(str(r.aum)) for r in aum_rows if r.aum}

        # Get latest 1Y returns
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
            .filter(NavDaily.return_1y.isnot(None))
            .all()
        )
        return_map = {r.mstar_id: Decimal(str(r.return_1y)) for r in nav_rows}

        # Compute AUM-weighted return per sector
        sector_data: dict[str, dict] = {}
        for e in exposures:
            aum = aum_map.get(e.mstar_id, Decimal("0"))
            ret = return_map.get(e.mstar_id)
            if aum <= 0 or ret is None:
                continue

            sector = e.sector_name
            if sector not in sector_data:
                sector_data[sector] = {
                    "total_aum_weight": Decimal("0"),
                    "weighted_return_sum": Decimal("0"),
                    "total_aum": Decimal("0"),
                }

            # Weight = AUM × sector_exposure_pct / 100
            weight = aum * Decimal(str(e.net_pct)) / Decimal("100")
            sector_data[sector]["total_aum_weight"] += weight
            sector_data[sector]["weighted_return_sum"] += weight * ret
            sector_data[sector]["total_aum"] += weight

        result = {}
        for sector, data in sector_data.items():
            total_weight = data["total_aum_weight"]
            if total_weight > 0:
                weighted_ret = data["weighted_return_sum"] / total_weight
            else:
                weighted_ret = Decimal("0")
            result[sector] = {
                "weighted_return": weighted_ret,
                "total_aum": data["total_aum"],
            }

        return result

    def _get_previous_rs_scores(self, target_date: date, months_back: int = 1) -> dict:
        """Get RS scores from a previous snapshot for momentum calculation."""
        ideal_date = target_date - timedelta(days=months_back * 30)
        cutoff_low = target_date - timedelta(days=months_back * 50)
        row = (
            self.db.query(SectorRotationHistory.snapshot_date)
            .filter(
                SectorRotationHistory.snapshot_date >= cutoff_low,
                SectorRotationHistory.snapshot_date < target_date,
            )
            .order_by(
                func.abs(
                    func.extract(
                        "epoch",
                        SectorRotationHistory.snapshot_date - ideal_date,
                    )
                )
            )
            .limit(1)
            .first()
        )
        if not row:
            return {}

        prev_date = row[0]
        rows = (
            self.db.query(
                SectorRotationHistory.sector_name,
                SectorRotationHistory.rs_score,
            )
            .filter(SectorRotationHistory.snapshot_date == prev_date)
            .all()
        )
        return {
            r.sector_name: Decimal(str(r.rs_score)) if r.rs_score else Decimal("50")
            for r in rows
        }

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
            .filter(FundSectorExposure.net_pct >= 5)
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
            "weighted_return": float(row.weighted_return) if row.weighted_return else 0,
            "total_aum_exposed": float(row.total_aum_exposed) if row.total_aum_exposed else 0,
        }
