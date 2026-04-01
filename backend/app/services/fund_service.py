"""Fund data service — orchestrates queries across repositories."""

import re
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.repositories.fund_repo import FundRepository
from app.repositories.holdings_repo import HoldingsRepository


PURCHASE_MODE_MAP = {1: "Regular", 2: "Direct"}

_IDCW_PATTERN = re.compile(r"\b(IDCW|Dividend)\b", re.IGNORECASE)
_SEGREGATED_PATTERN = re.compile(r"Segregated", re.IGNORECASE)

# Maps frontend broad_category param → DB broad_category value
BROAD_CATEGORY_MAP = {
    "equity": "Equity",
    "debt": "Fixed Income",
    "hybrid": "Allocation",
}

# AUM in DB is raw (rupees). 1 crore = 10,000,000
AUM_CRORE_MULTIPLIER = Decimal("10000000")


def derive_dividend_type(fund_name: str) -> str:
    """Derive dividend type from fund name. IDCW/Dividend → 'IDCW', else → 'Growth'."""
    if _IDCW_PATTERN.search(fund_name):
        return "IDCW"
    return "Growth"


VALID_PERIODS = {"1m", "3m", "6m", "1y", "3y", "5y", "max", "since_inception"}

PERIOD_DAYS = {
    "1m": 31,
    "3m": 92,
    "6m": 183,
    "1y": 365,
    "3y": 1095,
    "5y": 1825,
}


class FundService:
    """Orchestrates fund data queries across repositories."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.fund_repo = FundRepository(db)
        self.holdings_repo = HoldingsRepository(db)

    def list_funds(
        self,
        category: Optional[str] = None,
        broad_category: Optional[str] = None,
        amc: Optional[str] = None,
        search: Optional[str] = None,
        purchase_mode: Optional[int] = 1,
        sort_by: str = "fund_name",
        sort_dir: str = "asc",
        limit: int = 100,
        offset: int = 0,
        min_nav_count: int = 0,
    ) -> tuple[list[dict], int]:
        """List funds with compact FundSummary including latest NAV."""
        funds, total = self.fund_repo.get_all_funds(
            category=category,
            broad_category=broad_category,
            amc=amc,
            search=search,
            purchase_mode=purchase_mode,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
            min_nav_count=min_nav_count,
        )
        # Batch fetch latest NAVs — single query instead of N+1
        mstar_ids = [f.mstar_id for f in funds]
        nav_map = self.fund_repo.get_latest_navs_batch(mstar_ids)
        summaries = [
            self._to_fund_summary(fund, nav_map.get(fund.mstar_id))
            for fund in funds
        ]
        return summaries, total

    def get_fund_detail(self, mstar_id: str) -> dict:
        """Full deep-dive for one fund — all data sources assembled."""
        fund = self.fund_repo.get_fund_by_mstar_id(mstar_id)
        if fund is None:
            raise NotFoundError(
                f"Fund {mstar_id} not found",
                details={"mstar_id": mstar_id},
            )

        latest_nav = self.fund_repo.get_latest_nav(mstar_id)
        returns = self.fund_repo.get_trailing_returns(mstar_id)
        risk_stats = self.fund_repo.get_latest_risk_stats(mstar_id)
        ranks = self.fund_repo.get_latest_ranks(mstar_id)
        snapshot = self.holdings_repo.get_latest_snapshot(mstar_id)
        top_holdings = self.holdings_repo.get_top_holdings(mstar_id)
        sector_exposure = self.holdings_repo.get_sector_exposure(mstar_id)
        asset_allocation = self.holdings_repo.get_asset_allocation(mstar_id)
        credit_quality = self.holdings_repo.get_credit_quality(mstar_id)

        peers = self.fund_repo.get_category_peers(
            fund.category_name,
            exclude_mstar_id=mstar_id,
            purchase_mode=1,  # Regular funds only — platform-wide policy
        )

        # Look up category average returns (category_code == category_name)
        cat_returns = self.fund_repo.get_category_returns(fund.category_name)

        return {
            "fund": self._to_fund_summary(fund, latest_nav),
            "indian_risk_level": fund.indian_risk_level,
            "primary_benchmark": fund.primary_benchmark,
            "investment_strategy": fund.investment_strategy,
            "investment_philosophy": fund.investment_philosophy,
            "managers": fund.managers,
            "turnover_ratio": fund.turnover_ratio,
            "gross_expense_ratio": getattr(fund, "gross_expense_ratio", None),
            "sip_available": getattr(fund, "sip_available", None),
            "lock_in_period": getattr(fund, "lock_in_period", None),
            "is_etf": getattr(fund, "is_etf", None),
            "is_index_fund": getattr(fund, "is_index_fund", None),
            "previous_fund_name": getattr(fund, "previous_fund_name", None),
            "distribution_status": getattr(fund, "distribution_status", None),
            "closed_to_investors": getattr(fund, "closed_to_investors", None),
            "returns": returns,
            "risk_stats": risk_stats,
            "ranks": ranks,
            "portfolio": snapshot,
            "top_holdings": top_holdings,
            "sector_exposure": sector_exposure,
            "asset_allocation": asset_allocation,
            "credit_quality": credit_quality,
            "category_avg_returns": cat_returns,
            "category_fund_count": len(peers),
        }

    def get_nav_chart_data(
        self, mstar_id: str, period: str = "1y",
    ) -> list[dict]:
        """NAV time series for charting with period-based filtering."""
        if period not in VALID_PERIODS:
            raise ValidationError(
                f"Invalid period '{period}'. "
                f"Valid: {', '.join(sorted(VALID_PERIODS))}",
                details={"period": period},
            )

        start_date = None
        if period not in ("max", "since_inception"):
            days = PERIOD_DAYS[period]
            start_date = date.today() - timedelta(days=days)

        # First, try rows with real NAV values only
        rows = self.fund_repo.get_nav_history(
            mstar_id, start_date=start_date, nav_only=True,
        )

        # If too few real NAV rows, fall back to all rows + synthesis
        if len(rows) < 30:
            rows = self.fund_repo.get_nav_history(
                mstar_id, start_date=start_date,
            )
            if rows:
                null_count = sum(1 for r in rows if r.get("nav") is None)
                if null_count > len(rows) * 0.5:
                    rows = self._synthesize_nav(rows)

        return [
            {
                "date": r["nav_date"],
                "nav": r["nav"],
                "return_1d": r.get("return_1d"),
            }
            for r in rows
        ]

    def get_categories_heatmap(self) -> list[dict]:
        """All categories with fund counts — drives the heatmap."""
        return self.fund_repo.get_categories()

    def get_peer_comparison(self, mstar_id: str) -> dict:
        """Fund vs category peers with percentile position."""
        fund = self.fund_repo.get_fund_by_mstar_id(mstar_id)
        if fund is None:
            raise NotFoundError(
                f"Fund {mstar_id} not found",
                details={"mstar_id": mstar_id},
            )

        fund_returns = self.fund_repo.get_trailing_returns(mstar_id)
        peers = self.fund_repo.get_category_peers(
            fund.category_name,
            exclude_mstar_id=mstar_id,
            purchase_mode=fund.purchase_mode,
        )

        fund_return_1y = (
            fund_returns.get("return_1y") if fund_returns else None
        )

        # Compute category avg and percentile
        category_avg_1y = None
        percentile_1y = None
        if peers and fund_return_1y is not None:
            peer_returns = [
                p.get("return_1y") for p in peers
                if p.get("return_1y") is not None
            ]
            if peer_returns:
                category_avg_1y = str(
                    (sum(Decimal(str(r)) for r in peer_returns) / len(peer_returns))
                    .quantize(Decimal("0.00001"), rounding=ROUND_HALF_UP)
                )
                all_returns = peer_returns + [fund_return_1y]
                all_returns_sorted = sorted(all_returns)
                rank = all_returns_sorted.index(fund_return_1y) + 1
                percentile_1y = int(rank / len(all_returns_sorted) * 100)

        return {
            "fund_mstar_id": mstar_id,
            "category_name": fund.category_name,
            "peer_count": len(peers),
            "fund_return_1y": fund_return_1y,
            "category_avg_1y": category_avg_1y,
            "fund_percentile_1y": percentile_1y,
            "peers": peers,
        }

    def get_overlap_analysis(self, mstar_ids: list[str]) -> dict:
        """Overlap analysis for 2-5 funds."""
        return self.holdings_repo.compute_overlap(mstar_ids)

    def get_holdings(
        self, mstar_id: str, top: Optional[int] = None,
    ) -> list[dict]:
        """Fund holdings — top N or all."""
        if top:
            return self.holdings_repo.get_top_holdings(mstar_id, limit=top)
        return self.holdings_repo.get_all_holdings(mstar_id)

    def get_sector_exposure(self, mstar_id: str) -> list[dict]:
        """Sector allocation breakdown."""
        return self.holdings_repo.get_sector_exposure(mstar_id)

    def get_universe_data(
        self,
        broad_category: Optional[str] = None,
        min_aum: Optional[float] = None,
        min_age_years: Optional[int] = None,
    ) -> list[dict]:
        """Bulk data for Universe Explorer — active funds (AUM > 0) with lens + returns.

        Always filters: purchase_mode=1 (Regular), excludes IDCW/Dividend and
        Segregated portfolio funds. Optional filters for broad_category, min_aum,
        and min_age_years.

        Includes risk stats, quartile ranks, and asset allocation for
        Screener and Analytics sections.
        """
        from app.repositories.lens_repo import LensRepository

        # Map frontend broad_category param to DB value
        db_broad_category = None
        if broad_category and broad_category.lower() != "all":
            db_broad_category = BROAD_CATEGORY_MAP.get(
                broad_category.lower(), broad_category,
            )

        funds, _ = self.fund_repo.get_all_funds(
            purchase_mode=1,  # Regular funds only — platform-wide policy
            broad_category=db_broad_category,
            eligible_only=True,
            limit=50000,
            offset=0,
        )

        # Hard-filter: exclude IDCW/Dividend and Segregated portfolio funds
        funds = [
            f for f in funds
            if not _IDCW_PATTERN.search(f.fund_name or f.legal_name or "")
            and not _SEGREGATED_PATTERN.search(f.fund_name or f.legal_name or "")
        ]

        # Filter by minimum fund age (inception_date)
        if min_age_years is not None and min_age_years > 0:
            cutoff_date = date.today() - timedelta(days=min_age_years * 365)
            funds = [
                f for f in funds
                if getattr(f, "inception_date", None) is not None
                and f.inception_date <= cutoff_date
            ]

        mstar_ids = [f.mstar_id for f in funds]

        # Batch fetch latest holdings snapshots first — filter to funds with AUM > 0
        snapshot_map = self.holdings_repo.get_latest_snapshots_batch(mstar_ids)
        active_funds = [f for f in funds if snapshot_map.get(f.mstar_id, {}).get("aum")]

        # Filter by minimum AUM (param is in crores, DB is in raw rupees)
        if min_aum is not None and min_aum > 0:
            min_aum_raw = float(Decimal(str(min_aum)) * AUM_CRORE_MULTIPLIER)
            active_funds = [
                f for f in active_funds
                if float(snapshot_map.get(f.mstar_id, {}).get("aum", 0)) >= min_aum_raw
            ]

        active_ids = [f.mstar_id for f in active_funds]

        nav_map = self.fund_repo.get_latest_navs_batch(active_ids)

        lens_repo = LensRepository(self.db)
        all_scores = lens_repo.get_all_scores_batch(active_ids)
        all_classes = lens_repo.get_all_classifications_batch(active_ids)

        # Batch fetch risk stats, ranks, and asset allocation
        risk_map = self.fund_repo.get_latest_risk_stats_batch(active_ids)
        ranks_map = self.fund_repo.get_latest_ranks_batch(active_ids)
        alloc_map = self.fund_repo.get_latest_asset_allocation_batch(active_ids)

        # Filter to funds with minimum data quality: must have at least return_score OR 1Y return
        quality_funds = []
        for f in active_funds:
            mid = f.mstar_id
            has_score = all_scores.get(mid, {}).get("return_score") is not None
            has_return = nav_map.get(mid, {}).get("return_1y") is not None
            if has_score or has_return:
                quality_funds.append(f)

        result = []
        for fund in quality_funds:
            mid = fund.mstar_id
            nav = nav_map.get(mid, {})
            scores = all_scores.get(mid, {})
            cls = all_classes.get(mid, {})
            snap = snapshot_map.get(mid, {})
            risk = risk_map.get(mid, {})
            ranks = ranks_map.get(mid, {})
            alloc = alloc_map.get(mid, {})
            raw_mode = getattr(fund, "purchase_mode", None)
            fund_name = fund.fund_name or fund.legal_name or ""
            result.append({
                "mstar_id": mid,
                "fund_name": fund.fund_name,
                "legal_name": fund.legal_name,
                "amc_name": fund.amc_name,
                "category_name": fund.category_name,
                "broad_category": getattr(fund, "broad_category", None),
                "inception_date": getattr(fund, "inception_date", None),
                "purchase_mode": PURCHASE_MODE_MAP.get(raw_mode, "Unknown"),
                "dividend_type": derive_dividend_type(fund_name),
                "net_expense_ratio": getattr(fund, "net_expense_ratio", None),
                "indian_risk_level": getattr(fund, "indian_risk_level", None),
                "latest_nav": nav.get("nav"),
                "nav_52wk_high": nav.get("nav_52wk_high"),
                "nav_52wk_low": nav.get("nav_52wk_low"),
                "return_1d": nav.get("return_1d"),
                "return_1m": nav.get("return_1m"),
                "return_3m": nav.get("return_3m"),
                "return_6m": nav.get("return_6m"),
                "return_ytd": nav.get("return_ytd"),
                "return_1y": nav.get("return_1y"),
                "return_3y": nav.get("return_3y"),
                "return_5y": nav.get("return_5y"),
                "return_since_inception": nav.get("return_since_inception"),
                "aum": snap.get("aum"),
                "equity_style_box": snap.get("equity_style_box"),
                "avg_market_cap": snap.get("avg_market_cap"),
                "pe_ratio": snap.get("pe_ratio"),
                "pb_ratio": snap.get("pb_ratio"),
                "prospective_div_yield": snap.get("prospective_div_yield"),
                "turnover_ratio": snap.get("turnover_ratio"),
                # Risk stats (key 3Y metrics)
                "sharpe_3y": risk.get("sharpe_3y"),
                "alpha_3y": risk.get("alpha_3y"),
                "beta_3y": risk.get("beta_3y"),
                "sortino_3y": risk.get("sortino_3y"),
                "max_drawdown_3y": risk.get("max_drawdown_3y"),
                "capture_up_3y": risk.get("capture_up_3y"),
                "capture_down_3y": risk.get("capture_down_3y"),
                "info_ratio_3y": risk.get("info_ratio_3y"),
                "tracking_error_3y": risk.get("tracking_error_3y"),
                "std_dev_3y": risk.get("std_dev_3y"),
                # Quartile ranks
                "quartile_1m": ranks.get("quartile_1m"),
                "quartile_3m": ranks.get("quartile_3m"),
                "quartile_1y": ranks.get("quartile_1y"),
                "quartile_3y": ranks.get("quartile_3y"),
                "quartile_5y": ranks.get("quartile_5y"),
                # Asset allocation (market cap split)
                "india_large_cap_pct": alloc.get("india_large_cap_pct"),
                "india_mid_cap_pct": alloc.get("india_mid_cap_pct"),
                "india_small_cap_pct": alloc.get("india_small_cap_pct"),
                # Lens scores
                "return_score": scores.get("return_score"),
                "risk_score": scores.get("risk_score"),
                "consistency_score": scores.get("consistency_score"),
                "alpha_score": scores.get("alpha_score"),
                "efficiency_score": scores.get("efficiency_score"),
                "resilience_score": scores.get("resilience_score"),
                "return_class": cls.get("return_class"),
                "risk_class": cls.get("risk_class"),
                "consistency_class": cls.get("consistency_class"),
                "alpha_class": cls.get("alpha_class"),
                "efficiency_class": cls.get("efficiency_class"),
                "resilience_class": cls.get("resilience_class"),
                "headline_tag": cls.get("headline_tag"),
            })
        return result

    def get_risk_history(
        self, mstar_id: str, limit: int = 12,
    ) -> list[dict]:
        """Monthly risk stats history."""
        return self.fund_repo.get_risk_stats_history(mstar_id, limit=limit)

    def compare_nav_history(
        self, mstar_ids: list[str], period: str = "3y",
    ) -> dict:
        """Multi-fund NAV comparison normalized to base 100 from first common date.

        Returns fund NAV series and fund names for charting.
        """
        if len(mstar_ids) > 5:
            raise ValidationError(
                "NAV comparison supports at most 5 funds",
                details={"count": len(mstar_ids)},
            )
        if period not in VALID_PERIODS:
            raise ValidationError(
                f"Invalid period '{period}'. Valid: {', '.join(sorted(VALID_PERIODS))}",
                details={"period": period},
            )

        start_date = None
        if period not in ("max", "since_inception"):
            days = PERIOD_DAYS[period]
            start_date = date.today() - timedelta(days=days)

        # Batch fetch NAV history for all funds
        nav_histories = self.fund_repo.get_nav_history_batch(
            mstar_ids, start_date=start_date,
        )

        # Synthesize NAV for funds where most rows have null nav
        for mid, rows in nav_histories.items():
            if rows:
                null_count = sum(1 for r in rows if r.get("nav") is None)
                if null_count > len(rows) * 0.5:
                    nav_histories[mid] = self._synthesize_nav(rows)

        # Find first common date across all funds that have data (with non-null NAVs)
        funds_with_data = [
            mid for mid in mstar_ids
            if nav_histories.get(mid) and any(r.get("nav") is not None for r in nav_histories[mid])
        ]
        if not funds_with_data:
            return {"funds": [], "benchmark": None}

        # Find the latest start date across all funds (first common date)
        first_dates = [
            nav_histories[mid][0]["nav_date"]
            for mid in funds_with_data
        ]
        common_start = max(first_dates)

        # Fetch fund names
        fund_names: dict[str, str] = {}
        for mid in funds_with_data:
            fund = self.fund_repo.get_fund_by_mstar_id(mid)
            fund_names[mid] = fund.fund_name if fund else mid

        funds_result = []
        for mid in funds_with_data:
            series = nav_histories[mid]
            # Filter to common start date onwards, only rows with nav data
            filtered = [
                r for r in series
                if r["nav_date"] >= common_start and r.get("nav") is not None
            ]
            if not filtered:
                continue

            # Normalize to base 100
            base_nav = Decimal(str(filtered[0]["nav"]))
            if base_nav == 0:
                continue

            normalized = []
            for r in filtered:
                nav_val = Decimal(str(r["nav"]))
                norm_val = (nav_val / base_nav * Decimal("100")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP,
                )
                normalized.append({
                    "date": str(r["nav_date"]),
                    "value": float(norm_val),
                })

            funds_result.append({
                "mstar_id": mid,
                "fund_name": fund_names.get(mid, mid),
                "data": normalized,
            })

        return {"funds": funds_result, "benchmark": None}

    def compare_risk_history(
        self, mstar_ids: list[str], limit: int = 12,
    ) -> dict:
        """Multi-fund rolling risk (std_dev_1y) comparison over time.

        Returns monthly std_dev_1y for each fund.
        """
        if len(mstar_ids) > 5:
            raise ValidationError(
                "Risk comparison supports at most 5 funds",
                details={"count": len(mstar_ids)},
            )

        risk_histories = self.fund_repo.get_risk_stats_history_batch(
            mstar_ids, limit=limit,
        )

        # Fetch fund names
        fund_names: dict[str, str] = {}
        for mid in mstar_ids:
            fund = self.fund_repo.get_fund_by_mstar_id(mid)
            fund_names[mid] = fund.fund_name if fund else mid

        funds_result = []
        for mid in mstar_ids:
            entries = risk_histories.get(mid, [])
            funds_result.append({
                "mstar_id": mid,
                "fund_name": fund_names.get(mid, mid),
                "data": [
                    {
                        "date": str(e["as_of_date"]),
                        "value": float(e["std_dev_1y"]) if e["std_dev_1y"] is not None else None,
                    }
                    for e in entries
                    if e.get("std_dev_1y") is not None
                ],
            })

        return {"funds": funds_result}

    def list_category_funds(
        self,
        category_name: str,
        sort_by: str = "fund_name",
        sort_dir: str = "desc",
        limit: int = 50,
    ) -> tuple[list[dict], int]:
        """All funds in a category sorted by performance."""
        funds, total = self.fund_repo.get_all_funds(
            category=category_name,
            purchase_mode=1,  # Regular funds only — platform-wide policy
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
        )
        # Batch fetch latest NAVs — single query instead of N+1
        mstar_ids = [f.mstar_id for f in funds]
        nav_map = self.fund_repo.get_latest_navs_batch(mstar_ids)
        summaries = [
            self._to_fund_summary(fund, nav_map.get(fund.mstar_id))
            for fund in funds
        ]
        return summaries, total

    def get_category_returns(self, category_name: str) -> Optional[dict]:
        """Category average returns — category_code == category_name in our data."""
        return self.fund_repo.get_category_returns(category_name)

    # --- Private helpers ---

    @staticmethod
    def _synthesize_nav(rows: list[dict]) -> list[dict]:
        """Synthesize NAV from cumulative daily returns when nav is NULL.

        Starts at 100 and compounds daily returns chronologically.
        Rows come in desc order from repo, so reverse for compounding.
        """
        # Work chronologically (oldest first)
        chronological = list(reversed(rows))
        synthetic = Decimal("100")
        for r in chronological:
            ret = r.get("return_1d")
            if ret is not None:
                synthetic = synthetic * (1 + Decimal(str(ret)) / 100)
            r["nav"] = str(synthetic.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))
        # Restore desc order
        return list(reversed(chronological))

    @staticmethod
    def _to_fund_summary(fund: object, latest_nav: Optional[dict]) -> dict:
        raw_mode = getattr(fund, "purchase_mode", None)
        fund_name = fund.fund_name or getattr(fund, "legal_name", "") or ""
        return {
            "mstar_id": fund.mstar_id,
            "fund_name": fund.fund_name,
            "legal_name": fund.legal_name,
            "amc_name": fund.amc_name,
            "category_name": fund.category_name,
            "broad_category": getattr(fund, "broad_category", None),
            "inception_date": getattr(fund, "inception_date", None),
            "isin": getattr(fund, "isin", None),
            "amfi_code": getattr(fund, "amfi_code", None),
            "purchase_mode": PURCHASE_MODE_MAP.get(raw_mode, "Unknown"),
            "dividend_type": derive_dividend_type(fund_name),
            "net_expense_ratio": getattr(fund, "net_expense_ratio", None),
            "gross_expense_ratio": getattr(fund, "gross_expense_ratio", None),
            "indian_risk_level": getattr(fund, "indian_risk_level", None),
            "sip_available": getattr(fund, "sip_available", None),
            "is_etf": getattr(fund, "is_etf", None),
            "is_index_fund": getattr(fund, "is_index_fund", None),
            "lock_in_period": getattr(fund, "lock_in_period", None),
            "latest_nav": latest_nav.get("nav") if latest_nav else None,
            "latest_nav_date": latest_nav.get("nav_date") if latest_nav else None,
            "nav_52wk_high": latest_nav.get("nav_52wk_high") if latest_nav else None,
            "nav_52wk_low": latest_nav.get("nav_52wk_low") if latest_nav else None,
            "return_1d": latest_nav.get("return_1d") if latest_nav else None,
            "return_1w": latest_nav.get("return_1w") if latest_nav else None,
            "return_1m": latest_nav.get("return_1m") if latest_nav else None,
            "return_3m": latest_nav.get("return_3m") if latest_nav else None,
            "return_6m": latest_nav.get("return_6m") if latest_nav else None,
            "return_ytd": latest_nav.get("return_ytd") if latest_nav else None,
            "return_1y": latest_nav.get("return_1y") if latest_nav else None,
            "return_3y": latest_nav.get("return_3y") if latest_nav else None,
            "return_5y": latest_nav.get("return_5y") if latest_nav else None,
            "return_since_inception": latest_nav.get("return_since_inception") if latest_nav else None,
        }
