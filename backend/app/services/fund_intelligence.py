"""Fund intelligence — 3 action cards for Fund 360 page."""

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.db.fund_master import FundMaster
from app.models.db.holdings import FundHoldingsSnapshot
from app.models.db.lens_scores import FundLensScores
from app.models.db.nav_daily import NavDaily
from app.models.db.risk_stats import RiskStatsMonthly

logger = logging.getLogger(__name__)


class FundIntelligenceService:
    """Generates 3 intelligence cards for a fund."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_intelligence(self, mstar_id: str) -> dict:
        """Returns 3 cards: regime_signal, better_alternatives, sip_intelligence."""
        fund = self.db.query(FundMaster).filter(FundMaster.mstar_id == mstar_id).first()
        if not fund:
            return {"regime_signal": None, "better_alternatives": None, "sip_intelligence": None}

        regime = self._get_regime_signal(mstar_id)
        alternatives = self._get_better_alternatives(mstar_id, fund.category_name)
        sip = self._get_sip_intelligence(mstar_id)

        return {
            "regime_signal": regime,
            "better_alternatives": alternatives,
            "sip_intelligence": sip,
        }

    def _get_regime_signal(self, mstar_id: str) -> Optional[dict]:
        """Market regime + fund's capture ratios → positioning verdict."""
        # Get fund's capture ratios
        risk = (
            self.db.query(RiskStatsMonthly)
            .filter(RiskStatsMonthly.mstar_id == mstar_id)
            .order_by(RiskStatsMonthly.as_of_date.desc())
            .first()
        )
        if not risk:
            return None

        capture_up = float(risk.capture_up_3y) if risk.capture_up_3y else None
        capture_down = float(risk.capture_down_3y) if risk.capture_down_3y else None

        if capture_up is None or capture_down is None:
            return None

        # Determine positioning
        if capture_up > 100 and capture_down < 100:
            verdict = "Aggressive — captures upside while limiting downside"
            signal = "bullish"
        elif capture_up < 100 and capture_down < 90:
            verdict = "Defensive — protects capital but trails in rallies"
            signal = "defensive"
        elif capture_up > 100 and capture_down > 100:
            verdict = "High-beta — amplifies both gains and losses"
            signal = "volatile"
        else:
            verdict = "Balanced — tracks market with moderate deviation"
            signal = "neutral"

        return {
            "capture_up_3y": capture_up,
            "capture_down_3y": capture_down,
            "verdict": verdict,
            "signal": signal,
        }

    def _get_better_alternatives(self, mstar_id: str, category_name: str) -> Optional[dict]:
        """Top 3 in same category by Sharpe, fund's rank."""
        if not category_name:
            return None

        # Get latest risk stats for all funds in category
        latest_risk_sub = (
            self.db.query(
                RiskStatsMonthly.mstar_id,
                func.max(RiskStatsMonthly.as_of_date).label("max_date"),
            )
            .group_by(RiskStatsMonthly.mstar_id)
            .subquery()
        )

        rows = (
            self.db.query(
                RiskStatsMonthly.mstar_id,
                RiskStatsMonthly.sharpe_3y,
                FundMaster.fund_name,
            )
            .join(
                latest_risk_sub,
                (RiskStatsMonthly.mstar_id == latest_risk_sub.c.mstar_id)
                & (RiskStatsMonthly.as_of_date == latest_risk_sub.c.max_date),
            )
            .join(FundMaster, RiskStatsMonthly.mstar_id == FundMaster.mstar_id)
            .filter(
                FundMaster.category_name == category_name,
                FundMaster.is_eligible.is_(True),
                RiskStatsMonthly.sharpe_3y.isnot(None),
            )
            .order_by(RiskStatsMonthly.sharpe_3y.desc())
            .all()
        )

        if not rows:
            return None

        # Find fund's rank
        fund_rank = None
        for i, r in enumerate(rows):
            if r.mstar_id == mstar_id:
                fund_rank = i + 1
                break

        top_3 = [
            {
                "mstar_id": r.mstar_id,
                "fund_name": r.fund_name,
                "sharpe_3y": float(r.sharpe_3y) if r.sharpe_3y else None,
            }
            for r in rows[:3]
        ]

        return {
            "top_3": top_3,
            "fund_rank": fund_rank,
            "total_in_category": len(rows),
            "category_name": category_name,
        }

    def _get_sip_intelligence(self, mstar_id: str) -> Optional[dict]:
        """Quick 5Y SIP backtest estimate from trailing returns."""
        # Get 5Y return
        latest_nav = (
            self.db.query(NavDaily)
            .filter(NavDaily.mstar_id == mstar_id)
            .order_by(NavDaily.nav_date.desc())
            .limit(5)
            .all()
        )
        if not latest_nav:
            return None

        # Merge to get return_5y
        return_5y = None
        for nav in latest_nav:
            if nav.return_5y is not None:
                return_5y = float(nav.return_5y)
                break

        if return_5y is None:
            return None

        # Simple SIP estimate: 25000/month for 5 years
        monthly_sip = 25000
        months = 60
        invested = monthly_sip * months  # 15,00,000

        # Approximate using CAGR
        monthly_rate = (1 + return_5y / 100) ** (1 / 12) - 1
        if monthly_rate <= 0:
            current_value = invested
        else:
            # Future value of annuity formula
            current_value = monthly_sip * (((1 + monthly_rate) ** months - 1) / monthly_rate)

        # Approximate XIRR = annualized return
        xirr = return_5y

        return {
            "monthly_sip": monthly_sip,
            "period_years": 5,
            "invested": invested,
            "current_value": round(current_value),
            "xirr": round(xirr, 2),
            "gain_pct": round((current_value / invested - 1) * 100, 1) if invested > 0 else 0,
        }
