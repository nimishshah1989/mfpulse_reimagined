"""Orchestrates six-lens computation across all categories."""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.engines.lens_engine import LensEngine, LensResult
from app.models.db.category_returns import CategoryReturnsDaily
from app.models.db.fund_master import FundMaster
from app.models.db.nav_daily import NavDaily
from app.models.db.rank_monthly import RankMonthly
from app.models.db.risk_stats import RiskStatsMonthly
from app.repositories.audit_repo import AuditRepository
from app.repositories.lens_repo import LensRepository

logger = logging.getLogger(__name__)


class LensService:
    """
    Orchestrates six-lens computation across all categories.
    Loads data -> calls LensEngine -> saves to fund_lens_scores + fund_classification -> audits.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.lens_repo = LensRepository(db)
        self.audit_repo = AuditRepository(db)
        self.engine = LensEngine()

    def compute_all_categories(self) -> dict:
        """
        Run lens computation for every SEBI category.
        Returns summary: { categories_processed, funds_scored, duration_ms, errors }
        """
        start = time.monotonic()
        categories = (
            self.db.query(FundMaster.category_name)
            .filter(FundMaster.is_eligible.is_(True))
            .distinct()
            .all()
        )
        category_names = [c[0] for c in categories]

        total_scored = 0
        errors: list[str] = []

        for cat_name in category_names:
            try:
                result = self.compute_single_category(cat_name)
                total_scored += result["funds_scored"]
            except Exception as e:
                logger.error("Lens computation failed for %s: %s", cat_name, e)
                errors.append(f"{cat_name}: {e!s}")

        duration_ms = int((time.monotonic() - start) * 1000)
        summary = {
            "categories_processed": len(category_names),
            "funds_scored": total_scored,
            "duration_ms": duration_ms,
            "errors": errors,
        }

        self.audit_repo.log(
            actor="lens_engine",
            action="compute_all",
            entity_type="lens_scores",
            entity_id="all_categories",
            details=summary,
        )
        self.db.commit()
        return summary

    def compute_single_category(self, category_name: str) -> dict:
        """
        Run lens computation for one category.
        Returns: { category, funds_scored, results_summary }
        """
        data = self._load_category_data(category_name)
        fund_ids = data["fund_ids"]

        if not fund_ids:
            return {"category": category_name, "funds_scored": 0, "results_summary": {}}

        results = self.engine.compute_category(
            category_name=category_name,
            fund_ids=fund_ids,
            latest_returns=data["latest_returns"],
            risk_stats=data["risk_stats"],
            ranks=data["ranks"],
            fund_master=data["fund_master"],
            calendar_year_returns=data["calendar_year_returns"],
            category_avg_returns=data["category_avg_returns"],
        )

        computed_date = date.today()
        self._save_results(results, computed_date)

        self.audit_repo.log(
            actor="lens_engine",
            action="compute_category",
            entity_type="lens_scores",
            entity_id=category_name,
            details={"funds_scored": len(results), "computed_date": str(computed_date)},
        )
        self.db.commit()

        return {
            "category": category_name,
            "funds_scored": len(results),
            "results_summary": {
                "scored": len([r for r in results if r.return_score is not None]),
                "incomplete": len([r for r in results if r.return_score is None]),
            },
        }

    def compute_single_fund(self, mstar_id: str) -> Optional[LensResult]:
        """
        Compute lenses for a single fund (uses its category peers for ranking).
        Useful for on-demand recomputation after FM override.
        """
        fund = (
            self.db.query(FundMaster)
            .filter(FundMaster.mstar_id == mstar_id)
            .first()
        )
        if fund is None:
            return None

        data = self._load_category_data(fund.category_name)
        if mstar_id not in data["fund_ids"]:
            data["fund_ids"].append(mstar_id)

        results = self.engine.compute_category(
            category_name=fund.category_name,
            fund_ids=data["fund_ids"],
            latest_returns=data["latest_returns"],
            risk_stats=data["risk_stats"],
            ranks=data["ranks"],
            fund_master=data["fund_master"],
            calendar_year_returns=data["calendar_year_returns"],
            category_avg_returns=data["category_avg_returns"],
        )

        target = next((r for r in results if r.mstar_id == mstar_id), None)
        if target:
            computed_date = date.today()
            self._save_results([target], computed_date)
            self.audit_repo.log(
                actor="lens_engine",
                action="compute_single_fund",
                entity_type="lens_scores",
                entity_id=mstar_id,
                details={"category": fund.category_name, "computed_date": str(computed_date)},
            )
            self.db.commit()
        return target

    def _load_category_data(self, category_name: str) -> dict:
        """
        Load all data needed for lens computation for one category.
        All loaded in bulk (one query per table, not per fund).
        """
        # Get eligible fund IDs in this category
        funds = (
            self.db.query(FundMaster)
            .filter(
                FundMaster.category_name == category_name,
                FundMaster.is_eligible.is_(True),
            )
            .all()
        )
        fund_ids = [f.mstar_id for f in funds]
        if not fund_ids:
            return {
                "fund_ids": [],
                "latest_returns": {},
                "risk_stats": {},
                "ranks": {},
                "fund_master": {},
                "calendar_year_returns": {},
                "category_avg_returns": {},
            }

        # Latest NAV per fund that has return data (skip NAV-only rows)
        latest_nav_sub = (
            self.db.query(
                NavDaily.mstar_id,
                func.max(NavDaily.nav_date).label("max_date"),
            )
            .filter(
                NavDaily.mstar_id.in_(fund_ids),
                NavDaily.return_1y.isnot(None) | NavDaily.return_3y.isnot(None),
            )
            .group_by(NavDaily.mstar_id)
            .subquery()
        )
        nav_rows = (
            self.db.query(NavDaily)
            .join(
                latest_nav_sub,
                (NavDaily.mstar_id == latest_nav_sub.c.mstar_id)
                & (NavDaily.nav_date == latest_nav_sub.c.max_date),
            )
            .all()
        )
        latest_returns = {}
        calendar_year_returns = {}
        for nav in nav_rows:
            latest_returns[nav.mstar_id] = {
                "return_1y": nav.return_1y,
                "return_3y": nav.return_3y,
                "return_5y": nav.return_5y,
            }
            calendar_year_returns[nav.mstar_id] = {
                f"calendar_year_return_{i}y": getattr(nav, f"calendar_year_return_{i}y", None)
                for i in range(1, 11)
            }

        # Latest risk stats per fund
        latest_risk_sub = (
            self.db.query(
                RiskStatsMonthly.mstar_id,
                func.max(RiskStatsMonthly.as_of_date).label("max_date"),
            )
            .filter(RiskStatsMonthly.mstar_id.in_(fund_ids))
            .group_by(RiskStatsMonthly.mstar_id)
            .subquery()
        )
        risk_rows = (
            self.db.query(RiskStatsMonthly)
            .join(
                latest_risk_sub,
                (RiskStatsMonthly.mstar_id == latest_risk_sub.c.mstar_id)
                & (RiskStatsMonthly.as_of_date == latest_risk_sub.c.max_date),
            )
            .all()
        )
        risk_stats = {}
        for rs in risk_rows:
            risk_stats[rs.mstar_id] = {
                "std_dev_3y": rs.std_dev_3y,
                "max_drawdown_1y": rs.max_drawdown_1y,
                "max_drawdown_3y": rs.max_drawdown_3y,
                "max_drawdown_5y": rs.max_drawdown_5y,
                "max_drawdown_10y": getattr(rs, "max_drawdown_10y", None),
                "beta_3y": rs.beta_3y,
                "capture_down_1y": rs.capture_down_1y,
                "capture_down_3y": rs.capture_down_3y,
                "capture_down_5y": rs.capture_down_5y,
                "capture_down_10y": getattr(rs, "capture_down_10y", None),
                "capture_up_1y": rs.capture_up_1y,
                "capture_up_3y": rs.capture_up_3y,
                "capture_up_5y": rs.capture_up_5y,
                "capture_up_10y": rs.capture_up_10y,
                "sortino_3y": rs.sortino_3y,
                "alpha_3y": rs.alpha_3y,
                "alpha_5y": rs.alpha_5y,
                "info_ratio_3y": rs.info_ratio_3y,
                "info_ratio_5y": rs.info_ratio_5y,
            }

        # Latest ranks per fund
        latest_rank_sub = (
            self.db.query(
                RankMonthly.mstar_id,
                func.max(RankMonthly.as_of_date).label("max_date"),
            )
            .filter(RankMonthly.mstar_id.in_(fund_ids))
            .group_by(RankMonthly.mstar_id)
            .subquery()
        )
        rank_rows = (
            self.db.query(RankMonthly)
            .join(
                latest_rank_sub,
                (RankMonthly.mstar_id == latest_rank_sub.c.mstar_id)
                & (RankMonthly.as_of_date == latest_rank_sub.c.max_date),
            )
            .all()
        )
        ranks = {}
        for rk in rank_rows:
            ranks[rk.mstar_id] = {
                "quartile_1y": rk.quartile_1y,
                "quartile_3y": rk.quartile_3y,
                "quartile_5y": rk.quartile_5y,
                **{
                    f"cal_year_pctile_{i}y": getattr(rk, f"cal_year_pctile_{i}y", None)
                    for i in range(1, 11)
                },
            }

        # Fund master data
        fund_master = {}
        for f in funds:
            fund_master[f.mstar_id] = {
                "net_expense_ratio": f.net_expense_ratio,
                "turnover_ratio": f.turnover_ratio,
            }

        # Category average returns
        cat_row = (
            self.db.query(CategoryReturnsDaily)
            .filter(CategoryReturnsDaily.category_name == category_name)
            .order_by(CategoryReturnsDaily.as_of_date.desc())
            .first()
        )
        category_avg_returns = {}
        if cat_row:
            category_avg_returns = {
                "return_3y": cat_row.cat_return_3y,
                "return_5y": cat_row.cat_return_5y,
            }

        return {
            "fund_ids": fund_ids,
            "latest_returns": latest_returns,
            "risk_stats": risk_stats,
            "ranks": ranks,
            "fund_master": fund_master,
            "calendar_year_returns": calendar_year_returns,
            "category_avg_returns": category_avg_returns,
        }

    def _save_results(self, results: list[LensResult], computed_date: date) -> None:
        """
        Save lens scores and classifications to DB.
        Uses upsert (ON CONFLICT mstar_id, computed_date).
        """
        score_records = []
        class_records = []

        for r in results:
            score_records.append({
                "mstar_id": r.mstar_id,
                "computed_date": computed_date,
                "category_name": r.category_name,
                "return_score": r.return_score,
                "risk_score": r.risk_score,
                "consistency_score": r.consistency_score,
                "alpha_score": r.alpha_score,
                "efficiency_score": r.efficiency_score,
                "resilience_score": r.resilience_score,
                "data_completeness_pct": r.data_completeness_pct,
                "available_horizons": r.available_horizons,
                "engine_version": r.engine_version,
            })
            class_records.append({
                "mstar_id": r.mstar_id,
                "computed_date": computed_date,
                "return_class": r.return_class,
                "risk_class": r.risk_class,
                "consistency_class": r.consistency_class,
                "alpha_class": r.alpha_class,
                "efficiency_class": r.efficiency_class,
                "resilience_class": r.resilience_class,
                "headline_tag": r.headline_tag,
            })

        self.lens_repo.upsert_lens_scores(score_records)
        self.lens_repo.upsert_classifications(class_records)
