"""Data freshness queries across all data tables."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.db.nav_daily import NavDaily
from app.models.db.risk_stats import RiskStatsMonthly
from app.models.db.rank_monthly import RankMonthly
from app.models.db.holdings import FundHoldingsSnapshot
from app.models.db.category_returns import CategoryReturnsDaily
from app.models.db.fund_master import FundMaster
from app.models.db.lens_scores import FundLensScores
from app.models.db.sector_exposure import FundSectorExposure


class FreshnessRepository:
    """Queries to check data freshness across all tables."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_latest_dates(self) -> dict[str, Optional[str]]:
        """Returns {table_name: latest_date_string} for each data table."""
        result: dict[str, Optional[str]] = {}

        queries = {
            "fund_master": (FundMaster, FundMaster.updated_at),
            "nav_daily": (NavDaily, NavDaily.nav_date),
            "risk_stats_monthly": (RiskStatsMonthly, RiskStatsMonthly.as_of_date),
            "rank_monthly": (RankMonthly, RankMonthly.as_of_date),
            "fund_holdings_snapshot": (FundHoldingsSnapshot, FundHoldingsSnapshot.portfolio_date),
            "category_returns_daily": (CategoryReturnsDaily, CategoryReturnsDaily.as_of_date),
            "fund_lens_scores": (FundLensScores, FundLensScores.computed_date),
            "fund_sector_exposure": (FundSectorExposure, FundSectorExposure.portfolio_date),
        }

        for table_name, (model, date_col) in queries.items():
            row = self.db.query(func.max(date_col)).scalar()
            result[table_name] = str(row) if row else None

        return result

    def get_fund_count(self) -> int:
        """Count of active, eligible funds in fund_master."""
        return (
            self.db.query(func.count(FundMaster.id))
            .filter(FundMaster.is_active.is_(True), FundMaster.is_eligible.is_(True))
            .scalar()
            or 0
        )

    def get_nav_coverage(self) -> dict:
        """Returns {total_funds, funds_with_nav_today, latest_nav_date}."""
        total = self.db.query(func.count(FundMaster.id)).filter(
            FundMaster.is_active.is_(True),
        ).scalar() or 0

        latest_date = self.db.query(func.max(NavDaily.nav_date)).scalar()

        funds_with_latest = 0
        if latest_date:
            funds_with_latest = (
                self.db.query(func.count(func.distinct(NavDaily.mstar_id)))
                .filter(NavDaily.nav_date == latest_date)
                .scalar()
                or 0
            )

        return {
            "total_funds": total,
            "funds_with_nav_latest": funds_with_latest,
            "latest_nav_date": str(latest_date) if latest_date else None,
        }
