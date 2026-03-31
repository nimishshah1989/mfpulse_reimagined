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
        min_nav_count: int = 0,
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

        # Filter by minimum NAV history depth
        if min_nav_count > 0:
            nav_count_sq = (
                self.db.query(
                    NavDaily.mstar_id.label("mstar_id"),
                    func.count(NavDaily.id).label("nav_count"),
                )
                .filter(NavDaily.nav.isnot(None))
                .group_by(NavDaily.mstar_id)
                .having(func.count(NavDaily.id) >= min_nav_count)
                .subquery("nav_counts")
            )
            query = query.join(nav_count_sq, FundMaster.mstar_id == nav_count_sq.c.mstar_id)

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
        # Sort "Other" categories to the end — user requirement
        def _other_last_key(r):
            name = (r.category_name or "").lower().strip()
            is_other = name == "other" or name.endswith("- other") or name.endswith("- others")
            return (1 if is_other else 0, r.category_name or "")

        return [
            {
                "category_name": r.category_name,
                "broad_category": r.broad_category,
                "fund_count": r.fund_count,
            }
            for r in sorted(rows, key=_other_last_key)
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
        """Latest NAV row for a fund.

        Two Morningstar APIs write to nav_daily:
        - NAV API: writes nav, nav_52wk_high/low (date D)
        - Returns API: writes return_* fields (date D+1, nav=NULL)

        We merge the two most recent rows so the result has both
        the actual NAV value and the latest trailing returns.
        """
        rows = (
            self.db.query(NavDaily)
            .filter(NavDaily.mstar_id == mstar_id)
            .order_by(NavDaily.nav_date.desc())
            .limit(5)
            .all()
        )
        if not rows:
            return None
        return self._merge_nav_rows(rows)

    def get_latest_navs_batch(
        self, mstar_ids: list[str], chunk_size: int = 1000,
    ) -> dict[str, dict]:
        """Latest NAV for multiple funds — merges NAV + Returns rows.

        For each fund, fetches the 2 most recent rows and merges them so
        the result has both the actual NAV value and trailing returns.
        Chunked to avoid large IN clauses.
        """
        if not mstar_ids:
            return {}
        result: dict[str, dict] = {}
        for i in range(0, len(mstar_ids), chunk_size):
            chunk = mstar_ids[i : i + chunk_size]
            # Get the 2 most recent dates per fund
            latest_sub = (
                self.db.query(
                    NavDaily.mstar_id,
                    func.max(NavDaily.nav_date).label("max_date"),
                )
                .filter(NavDaily.mstar_id.in_(chunk))
                .group_by(NavDaily.mstar_id)
                .subquery()
            )
            # Get rows at max_date
            top_rows = (
                self.db.query(NavDaily)
                .join(
                    latest_sub,
                    (NavDaily.mstar_id == latest_sub.c.mstar_id)
                    & (NavDaily.nav_date == latest_sub.c.max_date),
                )
                .all()
            )
            # For funds where top row has nav=NULL, also get the row with nav
            needs_nav: list[str] = []
            top_map: dict[str, NavDaily] = {}
            for r in top_rows:
                top_map[r.mstar_id] = r
                if r.nav is None:
                    needs_nav.append(r.mstar_id)

            nav_map: dict[str, NavDaily] = {}
            if needs_nav:
                # Get the latest row with non-null NAV for each fund
                nav_sub = (
                    self.db.query(
                        NavDaily.mstar_id,
                        func.max(NavDaily.nav_date).label("max_date"),
                    )
                    .filter(
                        NavDaily.mstar_id.in_(needs_nav),
                        NavDaily.nav.isnot(None),
                    )
                    .group_by(NavDaily.mstar_id)
                    .subquery()
                )
                nav_rows = (
                    self.db.query(NavDaily)
                    .join(
                        nav_sub,
                        (NavDaily.mstar_id == nav_sub.c.mstar_id)
                        & (NavDaily.nav_date == nav_sub.c.max_date),
                    )
                    .all()
                )
                for r in nav_rows:
                    nav_map[r.mstar_id] = r

            for mid, top in top_map.items():
                nav_row = nav_map.get(mid)
                if nav_row and top.nav is None:
                    result[mid] = self._merge_two_nav_rows(top, nav_row)
                else:
                    result[mid] = self._nav_to_dict(top)
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
        """Latest trailing returns across all periods.

        Merges the most recent rows to combine NAV + Returns API data.
        """
        rows = (
            self.db.query(NavDaily)
            .filter(NavDaily.mstar_id == mstar_id)
            .order_by(NavDaily.nav_date.desc())
            .limit(5)
            .all()
        )
        if not rows:
            return None
        return self._merge_nav_rows(rows)

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

    # --- Batch queries for universe enrichment ---

    def get_latest_risk_stats_batch(
        self, mstar_ids: list[str], chunk_size: int = 1000,
    ) -> dict[str, dict]:
        """Latest risk stats (key fields only) for multiple funds — single query per chunk."""
        if not mstar_ids:
            return {}
        result: dict[str, dict] = {}
        for i in range(0, len(mstar_ids), chunk_size):
            chunk = mstar_ids[i : i + chunk_size]
            latest_sub = (
                self.db.query(
                    RiskStatsMonthly.mstar_id,
                    func.max(RiskStatsMonthly.as_of_date).label("max_date"),
                )
                .filter(RiskStatsMonthly.mstar_id.in_(chunk))
                .group_by(RiskStatsMonthly.mstar_id)
                .subquery()
            )
            rows = (
                self.db.query(RiskStatsMonthly)
                .join(
                    latest_sub,
                    (RiskStatsMonthly.mstar_id == latest_sub.c.mstar_id)
                    & (RiskStatsMonthly.as_of_date == latest_sub.c.max_date),
                )
                .all()
            )
            for rs in rows:
                result[rs.mstar_id] = {
                    "sharpe_3y": rs.sharpe_3y,
                    "alpha_3y": rs.alpha_3y,
                    "beta_3y": rs.beta_3y,
                    "sortino_3y": rs.sortino_3y,
                    "max_drawdown_3y": rs.max_drawdown_3y,
                    "capture_up_3y": rs.capture_up_3y,
                    "capture_down_3y": rs.capture_down_3y,
                    "info_ratio_3y": rs.info_ratio_3y,
                    "tracking_error_3y": rs.tracking_error_3y,
                    "std_dev_3y": rs.std_dev_3y,
                }
        return result

    def get_latest_ranks_batch(
        self, mstar_ids: list[str], chunk_size: int = 1000,
    ) -> dict[str, dict]:
        """Latest quartile ranks for multiple funds — single query per chunk."""
        if not mstar_ids:
            return {}
        result: dict[str, dict] = {}
        for i in range(0, len(mstar_ids), chunk_size):
            chunk = mstar_ids[i : i + chunk_size]
            latest_sub = (
                self.db.query(
                    RankMonthly.mstar_id,
                    func.max(RankMonthly.as_of_date).label("max_date"),
                )
                .filter(RankMonthly.mstar_id.in_(chunk))
                .group_by(RankMonthly.mstar_id)
                .subquery()
            )
            rows = (
                self.db.query(RankMonthly)
                .join(
                    latest_sub,
                    (RankMonthly.mstar_id == latest_sub.c.mstar_id)
                    & (RankMonthly.as_of_date == latest_sub.c.max_date),
                )
                .all()
            )
            for rank in rows:
                result[rank.mstar_id] = {
                    "quartile_1m": rank.quartile_1m,
                    "quartile_3m": rank.quartile_3m,
                    "quartile_1y": rank.quartile_1y,
                    "quartile_3y": rank.quartile_3y,
                    "quartile_5y": rank.quartile_5y,
                }
        return result

    def get_latest_asset_allocation_batch(
        self, mstar_ids: list[str], chunk_size: int = 1000,
    ) -> dict[str, dict]:
        """Latest asset allocation (market cap split) for multiple funds — single query per chunk."""
        from app.models.db.asset_allocation import FundAssetAllocation

        if not mstar_ids:
            return {}
        result: dict[str, dict] = {}
        for i in range(0, len(mstar_ids), chunk_size):
            chunk = mstar_ids[i : i + chunk_size]
            latest_sub = (
                self.db.query(
                    FundAssetAllocation.mstar_id,
                    func.max(FundAssetAllocation.portfolio_date).label("max_date"),
                )
                .filter(FundAssetAllocation.mstar_id.in_(chunk))
                .group_by(FundAssetAllocation.mstar_id)
                .subquery()
            )
            rows = (
                self.db.query(FundAssetAllocation)
                .join(
                    latest_sub,
                    (FundAssetAllocation.mstar_id == latest_sub.c.mstar_id)
                    & (FundAssetAllocation.portfolio_date == latest_sub.c.max_date),
                )
                .all()
            )
            for alloc in rows:
                result[alloc.mstar_id] = {
                    "india_large_cap_pct": alloc.india_large_cap_pct,
                    "india_mid_cap_pct": alloc.india_mid_cap_pct,
                    "india_small_cap_pct": alloc.india_small_cap_pct,
                }
        return result

    def get_nav_history_batch(
        self,
        mstar_ids: list[str],
        start_date: Optional[date] = None,
    ) -> dict[str, list[dict]]:
        """NAV time series for multiple funds — for comparison charts.

        Returns dict keyed by mstar_id with list of {nav_date, nav} dicts
        in ascending date order.
        """
        if not mstar_ids:
            return {}
        query = (
            self.db.query(
                NavDaily.mstar_id,
                NavDaily.nav_date,
                NavDaily.nav,
            )
            .filter(
                NavDaily.mstar_id.in_(mstar_ids),
                NavDaily.nav.isnot(None),
            )
        )
        if start_date:
            query = query.filter(NavDaily.nav_date >= start_date)
        query = query.order_by(NavDaily.mstar_id, NavDaily.nav_date.asc())
        rows = query.all()

        result: dict[str, list[dict]] = {mid: [] for mid in mstar_ids}
        for r in rows:
            result[r.mstar_id].append({
                "nav_date": r.nav_date,
                "nav": r.nav,
            })
        return result

    def get_risk_stats_history_batch(
        self,
        mstar_ids: list[str],
        limit: int = 12,
    ) -> dict[str, list[dict]]:
        """Monthly risk stats history for multiple funds.

        Returns dict keyed by mstar_id with list of {as_of_date, std_dev_1y} dicts
        in descending date order, limited to `limit` rows per fund.
        """
        if not mstar_ids:
            return {}
        from sqlalchemy import and_

        # Use a window function to rank rows per fund
        from sqlalchemy import over as sa_over

        # Simpler approach: query all recent rows and slice in Python
        rows = (
            self.db.query(
                RiskStatsMonthly.mstar_id,
                RiskStatsMonthly.as_of_date,
                RiskStatsMonthly.std_dev_1y,
            )
            .filter(RiskStatsMonthly.mstar_id.in_(mstar_ids))
            .order_by(
                RiskStatsMonthly.mstar_id,
                RiskStatsMonthly.as_of_date.desc(),
            )
            .all()
        )

        result: dict[str, list[dict]] = {mid: [] for mid in mstar_ids}
        for r in rows:
            entries = result[r.mstar_id]
            if len(entries) < limit:
                entries.append({
                    "as_of_date": r.as_of_date,
                    "std_dev_1y": r.std_dev_1y,
                })
        return result

    # --- Peer Comparison ---

    def get_category_peers(
        self,
        category_name: str,
        exclude_mstar_id: Optional[str] = None,
        limit: int = 50,
        purchase_mode: Optional[int] = None,
    ) -> list[dict]:
        """Funds in same SEBI category, ordered by AUM (most relevant peers first).

        Filters to same purchase_mode (Direct/Regular) when provided.
        Limits per-AMC to 5 funds to ensure diversity.
        """
        from app.models.db.lens_scores import FundLensScores
        from app.models.db.holdings import FundHoldingsSnapshot

        # Subquery: latest AUM per fund from holdings snapshots
        latest_aum_sub = (
            self.db.query(
                FundHoldingsSnapshot.mstar_id,
                func.max(FundHoldingsSnapshot.portfolio_date).label("max_date"),
            )
            .group_by(FundHoldingsSnapshot.mstar_id)
            .subquery()
        )
        aum_sub = (
            self.db.query(
                FundHoldingsSnapshot.mstar_id,
                FundHoldingsSnapshot.aum,
            )
            .join(
                latest_aum_sub,
                (FundHoldingsSnapshot.mstar_id == latest_aum_sub.c.mstar_id)
                & (FundHoldingsSnapshot.portfolio_date == latest_aum_sub.c.max_date),
            )
            .subquery()
        )

        query = (
            self.db.query(FundMaster, aum_sub.c.aum.label("latest_aum"))
            .outerjoin(aum_sub, FundMaster.mstar_id == aum_sub.c.mstar_id)
            .filter(FundMaster.category_name == category_name)
            .filter(FundMaster.is_eligible.is_(True))
        )
        if exclude_mstar_id:
            query = query.filter(FundMaster.mstar_id != exclude_mstar_id)
        if purchase_mode is not None:
            query = query.filter(FundMaster.purchase_mode == purchase_mode)

        # Order by AUM descending (biggest/most relevant funds first), nulls last
        all_funds = (
            query.order_by(aum_sub.c.aum.desc().nullslast(), FundMaster.fund_name)
            .limit(limit * 3)  # Fetch extra to allow AMC diversity filtering
            .all()
        )

        # Diversify: max 5 funds per AMC to avoid one AMC dominating the peer list
        MAX_PER_AMC = 5
        amc_counts: dict[str, int] = {}
        funds = []
        for row in all_funds:
            fund = row[0] if isinstance(row, tuple) else row
            amc = fund.amc_name or "Unknown"
            if amc_counts.get(amc, 0) >= MAX_PER_AMC:
                continue
            amc_counts[amc] = amc_counts.get(amc, 0) + 1
            funds.append((fund, row[1] if isinstance(row, tuple) else None))
            if len(funds) >= limit:
                break

        if not funds:
            return []

        # Batch fetch latest NAVs
        mstar_ids = [f.mstar_id for f, _aum in funds]
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
        for f, latest_aum in funds:
            nav = nav_map.get(f.mstar_id, {})
            lens = lens_map.get(f.mstar_id)
            result.append({
                "mstar_id": f.mstar_id,
                "fund_name": f.fund_name,
                "legal_name": f.legal_name,
                "amc_name": f.amc_name,
                "category_name": f.category_name,
                "net_expense_ratio": f.net_expense_ratio,
                "aum": str(latest_aum) if latest_aum else None,
                "purchase_mode": _PURCHASE_MODE_MAP.get(f.purchase_mode, "Unknown"),
                "dividend_type": "IDCW" if _IDCW_PATTERN.search(f.fund_name or "") else "Growth",
                "return_1y": nav.get("return_1y"),
                "return_3y": nav.get("return_3y"),
                "return_5y": nav.get("return_5y"),
                "return_score": lens.return_score if lens else None,
                "risk_score": lens.risk_score if lens else None,
                "consistency_score": lens.consistency_score if lens else None,
                "alpha_score": lens.alpha_score if lens else None,
                "efficiency_score": lens.efficiency_score if lens else None,
                "resilience_score": lens.resilience_score if lens else None,
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
            # Cumulative returns
            "cumulative_return_3y": nav.cumulative_return_3y,
            "cumulative_return_5y": nav.cumulative_return_5y,
            "cumulative_return_10y": nav.cumulative_return_10y,
            # 52-week range
            "nav_52wk_high": nav.nav_52wk_high,
            "nav_52wk_low": nav.nav_52wk_low,
            # Calendar year returns
            "calendar_year_return_1y": nav.calendar_year_return_1y,
            "calendar_year_return_2y": nav.calendar_year_return_2y,
            "calendar_year_return_3y": nav.calendar_year_return_3y,
            "calendar_year_return_4y": nav.calendar_year_return_4y,
            "calendar_year_return_5y": nav.calendar_year_return_5y,
            "calendar_year_return_6y": nav.calendar_year_return_6y,
            "calendar_year_return_7y": nav.calendar_year_return_7y,
            "calendar_year_return_8y": nav.calendar_year_return_8y,
            "calendar_year_return_9y": nav.calendar_year_return_9y,
            "calendar_year_return_10y": nav.calendar_year_return_10y,
        }

    @staticmethod
    def _merge_two_nav_rows(returns_row: NavDaily, nav_row: NavDaily) -> dict:
        """Merge a Returns-API row (has returns, nav=NULL) with a NAV-API row (has nav)."""
        d = FundRepository._nav_to_dict(returns_row)
        # Fill in NAV-specific fields from the nav row
        d["nav"] = nav_row.nav
        d["nav_change"] = nav_row.nav_change or d.get("nav_change")
        d["nav_52wk_high"] = nav_row.nav_52wk_high or d.get("nav_52wk_high")
        d["nav_52wk_low"] = nav_row.nav_52wk_low or d.get("nav_52wk_low")
        # Use the returns row's date as the primary date
        return d

    @classmethod
    def _merge_nav_rows(cls, rows: list[NavDaily]) -> dict:
        """Merge up to 5 most recent nav_daily rows to get both NAV + Returns.

        Returns-API rows have return_* but nav=NULL.
        NAV-API rows have nav + nav_52wk_* but return_*=NULL.
        We pick the newest row as base and fill in missing fields from older rows.
        """
        base = cls._nav_to_dict(rows[0])
        for row in rows[1:]:
            if base["nav"] is not None and base["return_1y"] is not None:
                break  # already have both NAV and returns
            d = cls._nav_to_dict(row)
            for key, val in d.items():
                if key == "nav_date":
                    continue  # keep the newest date
                if base.get(key) is None and val is not None:
                    base[key] = val
        return base

    @staticmethod
    def _risk_stats_to_dict(rs: RiskStatsMonthly) -> dict:
        return {
            "as_of_date": rs.as_of_date,
            # Sharpe
            "sharpe_1y": rs.sharpe_1y,
            "sharpe_3y": rs.sharpe_3y,
            "sharpe_5y": rs.sharpe_5y,
            # Alpha
            "alpha_3y": rs.alpha_3y,
            "alpha_5y": rs.alpha_5y,
            "alpha_10y": rs.alpha_10y,
            # Beta
            "beta_3y": rs.beta_3y,
            "beta_5y": rs.beta_5y,
            "beta_10y": rs.beta_10y,
            # Standard Deviation
            "std_dev_1y": rs.std_dev_1y,
            "std_dev_3y": rs.std_dev_3y,
            "std_dev_5y": rs.std_dev_5y,
            # Sortino
            "sortino_1y": rs.sortino_1y,
            "sortino_3y": rs.sortino_3y,
            "sortino_5y": rs.sortino_5y,
            # Max Drawdown
            "max_drawdown_1y": rs.max_drawdown_1y,
            "max_drawdown_3y": rs.max_drawdown_3y,
            "max_drawdown_5y": rs.max_drawdown_5y,
            # Treynor
            "treynor_1y": rs.treynor_1y,
            "treynor_3y": rs.treynor_3y,
            "treynor_5y": rs.treynor_5y,
            "treynor_10y": rs.treynor_10y,
            # Information Ratio
            "info_ratio_1y": rs.info_ratio_1y,
            "info_ratio_3y": rs.info_ratio_3y,
            "info_ratio_5y": rs.info_ratio_5y,
            "info_ratio_10y": rs.info_ratio_10y,
            # Tracking Error
            "tracking_error_1y": rs.tracking_error_1y,
            "tracking_error_3y": rs.tracking_error_3y,
            "tracking_error_5y": rs.tracking_error_5y,
            "tracking_error_10y": rs.tracking_error_10y,
            # Capture Ratios
            "capture_up_1y": rs.capture_up_1y,
            "capture_up_3y": rs.capture_up_3y,
            "capture_up_5y": rs.capture_up_5y,
            "capture_up_10y": rs.capture_up_10y,
            "capture_down_1y": rs.capture_down_1y,
            "capture_down_3y": rs.capture_down_3y,
            "capture_down_5y": rs.capture_down_5y,
            # Correlation
            "correlation_1y": rs.correlation_1y,
            "correlation_3y": rs.correlation_3y,
            "correlation_5y": rs.correlation_5y,
            # R-Squared
            "r_squared_1y": rs.r_squared_1y,
            "r_squared_3y": rs.r_squared_3y,
            "r_squared_5y": rs.r_squared_5y,
            # Kurtosis
            "kurtosis_1y": rs.kurtosis_1y,
            "kurtosis_3y": rs.kurtosis_3y,
            "kurtosis_5y": rs.kurtosis_5y,
            # Skewness
            "skewness_1y": rs.skewness_1y,
            "skewness_3y": rs.skewness_3y,
            "skewness_5y": rs.skewness_5y,
            # Mean
            "mean_1y": rs.mean_1y,
            "mean_3y": rs.mean_3y,
            "mean_5y": rs.mean_5y,
            # Category comparison (from Extended Risk Stats API)
            "cat_sharpe_1y": rs.cat_sharpe_1y,
            "cat_sharpe_3y": rs.cat_sharpe_3y,
            "cat_sharpe_5y": rs.cat_sharpe_5y,
            "cat_sharpe_10y": rs.cat_sharpe_10y,
            "cat_std_dev_1y": rs.cat_std_dev_1y,
            "cat_std_dev_3y": rs.cat_std_dev_3y,
            "cat_std_dev_5y": rs.cat_std_dev_5y,
            "cat_std_dev_10y": rs.cat_std_dev_10y,
            "cat_alpha_1y": rs.cat_alpha_1y,
            "cat_alpha_3y": rs.cat_alpha_3y,
            "cat_alpha_5y": rs.cat_alpha_5y,
            "cat_alpha_10y": rs.cat_alpha_10y,
            "cat_beta_1y": rs.cat_beta_1y,
            "cat_beta_3y": rs.cat_beta_3y,
            "cat_beta_5y": rs.cat_beta_5y,
            "cat_beta_10y": rs.cat_beta_10y,
            "cat_r_squared_1y": rs.cat_r_squared_1y,
            "cat_r_squared_3y": rs.cat_r_squared_3y,
            "cat_r_squared_5y": rs.cat_r_squared_5y,
            "cat_r_squared_10y": rs.cat_r_squared_10y,
            "cat_sortino_1y": rs.cat_sortino_1y,
            "cat_sortino_3y": rs.cat_sortino_3y,
            "cat_sortino_5y": rs.cat_sortino_5y,
            "cat_sortino_10y": rs.cat_sortino_10y,
            "cat_kurtosis_1y": rs.cat_kurtosis_1y,
            "cat_kurtosis_3y": rs.cat_kurtosis_3y,
            "cat_kurtosis_5y": rs.cat_kurtosis_5y,
            "cat_kurtosis_10y": rs.cat_kurtosis_10y,
            "cat_skewness_1y": rs.cat_skewness_1y,
            "cat_skewness_3y": rs.cat_skewness_3y,
            "cat_skewness_5y": rs.cat_skewness_5y,
            "cat_skewness_10y": rs.cat_skewness_10y,
            "cat_capture_up_1y": rs.cat_capture_up_1y,
            "cat_capture_up_3y": rs.cat_capture_up_3y,
            "cat_capture_up_5y": rs.cat_capture_up_5y,
            "cat_capture_up_10y": rs.cat_capture_up_10y,
            "cat_capture_down_1y": rs.cat_capture_down_1y,
            "cat_capture_down_3y": rs.cat_capture_down_3y,
            "cat_capture_down_5y": rs.cat_capture_down_5y,
            "cat_capture_down_10y": rs.cat_capture_down_10y,
            "cat_correlation_1y": rs.cat_correlation_1y,
            "cat_correlation_3y": rs.cat_correlation_3y,
            "cat_correlation_5y": rs.cat_correlation_5y,
            "cat_correlation_10y": rs.cat_correlation_10y,
            "cat_info_ratio_1y": rs.cat_info_ratio_1y,
            "cat_info_ratio_3y": rs.cat_info_ratio_3y,
            "cat_info_ratio_5y": rs.cat_info_ratio_5y,
            "cat_info_ratio_10y": rs.cat_info_ratio_10y,
            "cat_tracking_error_1y": rs.cat_tracking_error_1y,
            "cat_tracking_error_3y": rs.cat_tracking_error_3y,
            "cat_tracking_error_5y": rs.cat_tracking_error_5y,
            "cat_tracking_error_10y": rs.cat_tracking_error_10y,
            "cat_treynor_1y": rs.cat_treynor_1y,
            "cat_treynor_3y": rs.cat_treynor_3y,
            "cat_treynor_5y": rs.cat_treynor_5y,
            "cat_treynor_10y": rs.cat_treynor_10y,
            # Category trailing returns
            "cat_return_1y": rs.cat_return_1y,
            "cat_return_3y": rs.cat_return_3y,
            "cat_return_5y": rs.cat_return_5y,
            "cat_return_10y": rs.cat_return_10y,
            # TTR trailing returns (redundant copy from extended API)
            "ttr_return_1y": rs.ttr_return_1y,
            "ttr_return_3y": rs.ttr_return_3y,
            "ttr_return_5y": rs.ttr_return_5y,
            "ttr_return_10y": rs.ttr_return_10y,
        }

    @staticmethod
    def _rank_to_dict(rank: RankMonthly) -> dict:
        return {
            "as_of_date": rank.as_of_date,
            # Quartile ranks (all periods)
            "quartile_1m": rank.quartile_1m,
            "quartile_3m": rank.quartile_3m,
            "quartile_6m": rank.quartile_6m,
            "quartile_1y": rank.quartile_1y,
            "quartile_2y": rank.quartile_2y,
            "quartile_3y": rank.quartile_3y,
            "quartile_4y": rank.quartile_4y,
            "quartile_5y": rank.quartile_5y,
            "quartile_7y": rank.quartile_7y,
            "quartile_10y": rank.quartile_10y,
            # Absolute ranks (all periods)
            "abs_rank_1m": rank.abs_rank_1m,
            "abs_rank_3m": rank.abs_rank_3m,
            "abs_rank_6m": rank.abs_rank_6m,
            "abs_rank_ytd": rank.abs_rank_ytd,
            "abs_rank_1y": rank.abs_rank_1y,
            "abs_rank_2y": rank.abs_rank_2y,
            "abs_rank_3y": rank.abs_rank_3y,
            "abs_rank_4y": rank.abs_rank_4y,
            "abs_rank_5y": rank.abs_rank_5y,
            "abs_rank_7y": rank.abs_rank_7y,
            "abs_rank_10y": rank.abs_rank_10y,
            # Calendar year percentiles
            "cal_year_pctile_ytd": rank.cal_year_pctile_ytd,
            "cal_year_pctile_1y": rank.cal_year_pctile_1y,
            "cal_year_pctile_2y": rank.cal_year_pctile_2y,
            "cal_year_pctile_3y": rank.cal_year_pctile_3y,
            "cal_year_pctile_4y": rank.cal_year_pctile_4y,
            "cal_year_pctile_5y": rank.cal_year_pctile_5y,
            "cal_year_pctile_6y": rank.cal_year_pctile_6y,
            "cal_year_pctile_7y": rank.cal_year_pctile_7y,
            "cal_year_pctile_8y": rank.cal_year_pctile_8y,
            "cal_year_pctile_9y": rank.cal_year_pctile_9y,
            "cal_year_pctile_10y": rank.cal_year_pctile_10y,
        }
