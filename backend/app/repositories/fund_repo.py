"""Read operations for fund data. All queries name columns explicitly."""

import re
from datetime import date
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, aliased

from app.models.db.fund_master import FundMaster
from app.models.db.nav_daily import NavDaily
from app.models.db.risk_stats import RiskStatsMonthly
from app.models.db.rank_monthly import RankMonthly
from app.models.db.category_returns import CategoryReturnsDaily

_PURCHASE_MODE_MAP = {1: "Regular", 2: "Direct"}
_IDCW_PATTERN = re.compile(r"\b(IDCW|Dividend)\b", re.IGNORECASE)


class FundRepository:
    """Read operations for fund data. All queries name columns explicitly."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # --- Fund Master ---

    def get_all_funds(
        self,
        category: Optional[str] = None,
        broad_category: Optional[str] = None,
        amc: Optional[str] = None,
        search: Optional[str] = None,
        purchase_mode: Optional[int] = 1,
        eligible_only: bool = True,
        limit: int = 100,
        offset: int = 0,
        sort_by: str = "fund_name",
        sort_dir: str = "asc",
    ) -> tuple[list[FundMaster], int]:
        """Returns (funds, total_count) for pagination."""
        query = self.db.query(FundMaster)

        if eligible_only:
            query = query.filter(FundMaster.is_eligible.is_(True))
        if category:
            query = query.filter(FundMaster.category_name == category)
        if broad_category:
            query = query.filter(FundMaster.broad_category == broad_category)
        if amc:
            query = query.filter(FundMaster.amc_name == amc)
        if purchase_mode is not None:
            query = query.filter(FundMaster.purchase_mode == purchase_mode)
        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    FundMaster.fund_name.ilike(pattern),
                    FundMaster.legal_name.ilike(pattern),
                )
            )

        total = query.count()

        # Sorting
        sort_col = getattr(FundMaster, sort_by, FundMaster.fund_name)
        if sort_dir == "desc":
            query = query.order_by(sort_col.desc())
        else:
            query = query.order_by(sort_col.asc())

        funds = query.offset(offset).limit(limit).all()
        return funds, total

    def get_fund_by_mstar_id(self, mstar_id: str) -> Optional[FundMaster]:
        return (
            self.db.query(FundMaster)
            .filter(FundMaster.mstar_id == mstar_id)
            .first()
        )

    def get_fund_by_isin(self, isin: str) -> Optional[FundMaster]:
        return (
            self.db.query(FundMaster)
            .filter(FundMaster.isin == isin)
            .first()
        )

    def get_fund_by_amfi_code(self, amfi_code: str) -> Optional[FundMaster]:
        return (
            self.db.query(FundMaster)
            .filter(FundMaster.amfi_code == amfi_code)
            .first()
        )

    def get_categories(self) -> list[dict]:
        """Returns all distinct categories with fund counts."""
        rows = (
            self.db.query(
                FundMaster.category_name,
                FundMaster.broad_category,
                func.count(FundMaster.mstar_id).label("fund_count"),
            )
            .filter(FundMaster.is_eligible.is_(True))
            .group_by(FundMaster.category_name, FundMaster.broad_category)
            .order_by(FundMaster.category_name)
            .all()
        )
        return [
            {
                "category_name": r.category_name,
                "broad_category": r.broad_category,
                "fund_count": r.fund_count,
            }
            for r in rows
        ]

    def get_amcs(self) -> list[dict]:
        """Returns all distinct AMCs with fund counts."""
        rows = (
            self.db.query(
                FundMaster.amc_name,
                func.count(FundMaster.mstar_id).label("fund_count"),
            )
            .filter(FundMaster.is_eligible.is_(True))
            .group_by(FundMaster.amc_name)
            .order_by(FundMaster.amc_name)
            .all()
        )
        return [
            {"amc_name": r.amc_name, "fund_count": r.fund_count}
            for r in rows
        ]

    # --- NAV & Returns ---

    def get_latest_nav(self, mstar_id: str) -> Optional[dict]:
        """Latest NAV row for a fund."""
        nav = (
            self.db.query(NavDaily)
            .filter(NavDaily.mstar_id == mstar_id)
            .order_by(NavDaily.nav_date.desc())
            .first()
        )
        if nav is None:
            return None
        return self._nav_to_dict(nav)

    def get_latest_navs_batch(
        self, mstar_ids: list[str], chunk_size: int = 1000,
    ) -> dict[str, dict]:
        """Latest NAV for multiple funds — chunked to avoid large IN clauses."""
        if not mstar_ids:
            return {}
        result: dict[str, dict] = {}
        for i in range(0, len(mstar_ids), chunk_size):
            chunk = mstar_ids[i : i + chunk_size]
            latest_sub = (
                self.db.query(
                    NavDaily.mstar_id,
                    func.max(NavDaily.nav_date).label("max_date"),
                )
                .filter(NavDaily.mstar_id.in_(chunk))
                .group_by(NavDaily.mstar_id)
                .subquery()
            )
            rows = (
                self.db.query(NavDaily)
                .join(
                    latest_sub,
                    (NavDaily.mstar_id == latest_sub.c.mstar_id)
                    & (NavDaily.nav_date == latest_sub.c.max_date),
                )
                .all()
            )
            for r in rows:
                result[r.mstar_id] = self._nav_to_dict(r)
        return result

    def get_nav_history(
        self,
        mstar_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: Optional[int] = None,
    ) -> list[dict]:
        """NAV time series for charting."""
        query = (
            self.db.query(NavDaily)
            .filter(NavDaily.mstar_id == mstar_id)
        )
        if start_date:
            query = query.filter(NavDaily.nav_date >= start_date)
        if end_date:
            query = query.filter(NavDaily.nav_date <= end_date)
        query = query.order_by(NavDaily.nav_date.desc())
        if limit:
            query = query.limit(limit)
        rows = query.all()
        return [self._nav_to_dict(r) for r in rows]

    def get_trailing_returns(self, mstar_id: str) -> Optional[dict]:
        """Latest trailing returns across all periods."""
        nav = (
            self.db.query(NavDaily)
            .filter(NavDaily.mstar_id == mstar_id)
            .order_by(NavDaily.nav_date.desc())
            .first()
        )
        if nav is None:
            return None
        return self._nav_to_dict(nav)

    # --- Risk Stats ---

    def get_latest_risk_stats(self, mstar_id: str) -> Optional[dict]:
        """Latest risk ratios for a fund."""
        rs = (
            self.db.query(RiskStatsMonthly)
            .filter(RiskStatsMonthly.mstar_id == mstar_id)
            .order_by(RiskStatsMonthly.as_of_date.desc())
            .first()
        )
        if rs is None:
            return None
        return self._risk_stats_to_dict(rs)

    def get_risk_stats_history(
        self,
        mstar_id: str,
        limit: int = 12,
    ) -> list[dict]:
        """Monthly risk stats history."""
        rows = (
            self.db.query(RiskStatsMonthly)
            .filter(RiskStatsMonthly.mstar_id == mstar_id)
            .order_by(RiskStatsMonthly.as_of_date.desc())
            .limit(limit)
            .all()
        )
        return [self._risk_stats_to_dict(r) for r in rows]

    # --- Ranks ---

    def get_latest_ranks(self, mstar_id: str) -> Optional[dict]:
        """Latest quartile and absolute ranks."""
        rank = (
            self.db.query(RankMonthly)
            .filter(RankMonthly.mstar_id == mstar_id)
            .order_by(RankMonthly.as_of_date.desc())
            .first()
        )
        if rank is None:
            return None
        return self._rank_to_dict(rank)

    # --- Category Returns ---

    def get_category_returns(self, category_code: str) -> Optional[dict]:
        """Latest category average returns."""
        cat = (
            self.db.query(CategoryReturnsDaily)
            .filter(CategoryReturnsDaily.category_code == category_code)
            .order_by(CategoryReturnsDaily.as_of_date.desc())
            .first()
        )
        if cat is None:
            return None
        return {
            "category_code": cat.category_code,
            "as_of_date": cat.as_of_date,
            "cat_return_2y": cat.cat_return_2y,
            "cat_return_3y": cat.cat_return_3y,
            "cat_return_4y": cat.cat_return_4y,
            "cat_return_5y": cat.cat_return_5y,
            "cat_return_7y": cat.cat_return_7y,
            "cat_return_10y": cat.cat_return_10y,
            "cat_cumulative_2y": cat.cat_cumulative_2y,
            "cat_cumulative_3y": cat.cat_cumulative_3y,
            "cat_cumulative_4y": cat.cat_cumulative_4y,
            "cat_cumulative_5y": cat.cat_cumulative_5y,
            "cat_cumulative_7y": cat.cat_cumulative_7y,
            "cat_cumulative_10y": cat.cat_cumulative_10y,
        }

    # --- Peer Comparison ---

    def get_category_peers(
        self,
        category_name: str,
        exclude_mstar_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        """All funds in the same SEBI category with latest NAV returns + lens scores."""
        from app.models.db.lens_scores import FundLensScores

        query = (
            self.db.query(FundMaster)
            .filter(FundMaster.category_name == category_name)
            .filter(FundMaster.is_eligible.is_(True))
        )
        if exclude_mstar_id:
            query = query.filter(FundMaster.mstar_id != exclude_mstar_id)
        funds = query.order_by(FundMaster.fund_name).limit(limit).all()

        if not funds:
            return []

        # Batch fetch latest NAVs
        mstar_ids = [f.mstar_id for f in funds]
        nav_map = self.get_latest_navs_batch(mstar_ids)

        # Batch fetch latest lens scores
        latest_lens_sub = (
            self.db.query(
                FundLensScores.mstar_id,
                func.max(FundLensScores.computed_date).label("max_date"),
            )
            .filter(FundLensScores.mstar_id.in_(mstar_ids))
            .group_by(FundLensScores.mstar_id)
            .subquery()
        )
        lens_rows = (
            self.db.query(FundLensScores)
            .join(
                latest_lens_sub,
                (FundLensScores.mstar_id == latest_lens_sub.c.mstar_id)
                & (FundLensScores.computed_date == latest_lens_sub.c.max_date),
            )
            .all()
        )
        lens_map: dict[str, FundLensScores] = {r.mstar_id: r for r in lens_rows}

        result = []
        for f in funds:
            nav = nav_map.get(f.mstar_id, {})
            lens = lens_map.get(f.mstar_id)
            result.append({
                "mstar_id": f.mstar_id,
                "fund_name": f.fund_name,
                "legal_name": f.legal_name,
                "amc_name": f.amc_name,
                "category_name": f.category_name,
                "net_expense_ratio": f.net_expense_ratio,
                "purchase_mode": _PURCHASE_MODE_MAP.get(f.purchase_mode, "Unknown"),
                "dividend_type": "IDCW" if _IDCW_PATTERN.search(f.fund_name or "") else "Growth",
                "return_1y": nav.get("return_1y"),
                "return_score": lens.return_score if lens else None,
                "risk_score": lens.risk_score if lens else None,
                "alpha_score": lens.alpha_score if lens else None,
            })
        return result

    # --- Private helpers ---

    @staticmethod
    def _nav_to_dict(nav: NavDaily) -> dict:
        return {
            "nav_date": nav.nav_date,
            "nav": nav.nav,
            "nav_change": nav.nav_change,
            "return_1d": nav.return_1d,
            "return_1w": nav.return_1w,
            "return_1m": nav.return_1m,
            "return_3m": nav.return_3m,
            "return_6m": nav.return_6m,
            "return_ytd": nav.return_ytd,
            "return_1y": nav.return_1y,
            "return_2y": nav.return_2y,
            "return_3y": nav.return_3y,
            "return_4y": nav.return_4y,
            "return_5y": nav.return_5y,
            "return_7y": nav.return_7y,
            "return_10y": nav.return_10y,
            "return_15y": nav.return_15y,
            "return_20y": nav.return_20y,
            "return_since_inception": nav.return_since_inception,
        }

    @staticmethod
    def _risk_stats_to_dict(rs: RiskStatsMonthly) -> dict:
        return {
            "as_of_date": rs.as_of_date,
            "sharpe_1y": rs.sharpe_1y,
            "sharpe_3y": rs.sharpe_3y,
            "sharpe_5y": rs.sharpe_5y,
            "alpha_3y": rs.alpha_3y,
            "alpha_5y": rs.alpha_5y,
            "alpha_10y": rs.alpha_10y,
            "beta_3y": rs.beta_3y,
            "beta_5y": rs.beta_5y,
            "beta_10y": rs.beta_10y,
            "std_dev_1y": rs.std_dev_1y,
            "std_dev_3y": rs.std_dev_3y,
            "std_dev_5y": rs.std_dev_5y,
            "sortino_1y": rs.sortino_1y,
            "sortino_3y": rs.sortino_3y,
            "sortino_5y": rs.sortino_5y,
            "max_drawdown_1y": rs.max_drawdown_1y,
            "max_drawdown_3y": rs.max_drawdown_3y,
            "max_drawdown_5y": rs.max_drawdown_5y,
            "capture_up_1y": rs.capture_up_1y,
            "capture_up_3y": rs.capture_up_3y,
            "capture_up_5y": rs.capture_up_5y,
            "capture_down_1y": rs.capture_down_1y,
            "capture_down_3y": rs.capture_down_3y,
            "capture_down_5y": rs.capture_down_5y,
        }

    @staticmethod
    def _rank_to_dict(rank: RankMonthly) -> dict:
        return {
            "as_of_date": rank.as_of_date,
            "quartile_1m": rank.quartile_1m,
            "quartile_3m": rank.quartile_3m,
            "quartile_6m": rank.quartile_6m,
            "quartile_1y": rank.quartile_1y,
            "quartile_3y": rank.quartile_3y,
            "quartile_5y": rank.quartile_5y,
            "abs_rank_1y": rank.abs_rank_1y,
            "abs_rank_3y": rank.abs_rank_3y,
            "abs_rank_5y": rank.abs_rank_5y,
        }
