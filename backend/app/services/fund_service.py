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
        )

        return {
            "fund": self._to_fund_summary(fund, latest_nav),
            "indian_risk_level": fund.indian_risk_level,
            "primary_benchmark": fund.primary_benchmark,
            "investment_strategy": fund.investment_strategy,
            "managers": fund.managers,
            "returns": returns,
            "risk_stats": risk_stats,
            "ranks": ranks,
            "portfolio": snapshot,
            "top_holdings": top_holdings,
            "sector_exposure": sector_exposure,
            "asset_allocation": asset_allocation,
            "credit_quality": credit_quality,
            "category_avg_returns": None,
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

        rows = self.fund_repo.get_nav_history(
            mstar_id, start_date=start_date,
        )

        # Synthesize NAV from cumulative daily returns when nav column is NULL
        needs_synthesis = rows and rows[0].get("nav") is None
        if needs_synthesis:
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
            fund.category_name, exclude_mstar_id=mstar_id,
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

    def get_universe_data(self) -> list[dict]:
        """Bulk data for Universe Explorer — all eligible Regular funds with lens + returns."""
        from app.repositories.lens_repo import LensRepository

        funds, _ = self.fund_repo.get_all_funds(
            purchase_mode=None,
            eligible_only=True,
            limit=50000,
            offset=0,
        )
        mstar_ids = [f.mstar_id for f in funds]
        nav_map = self.fund_repo.get_latest_navs_batch(mstar_ids)

        lens_repo = LensRepository(self.db)
        # Batch fetch all latest lens scores
        all_scores = lens_repo.get_all_scores_batch(mstar_ids)
        all_classes = lens_repo.get_all_classifications_batch(mstar_ids)

        # Batch fetch latest holdings snapshots (AUM, style box, avg_market_cap)
        snapshot_map = self.holdings_repo.get_latest_snapshots_batch(mstar_ids)

        result = []
        for fund in funds:
            mid = fund.mstar_id
            nav = nav_map.get(mid, {})
            scores = all_scores.get(mid, {})
            cls = all_classes.get(mid, {})
            snap = snapshot_map.get(mid, {})
            raw_mode = getattr(fund, "purchase_mode", None)
            fund_name = fund.fund_name or fund.legal_name or ""
            result.append({
                "mstar_id": mid,
                "fund_name": fund.fund_name,
                "amc_name": fund.amc_name,
                "category_name": fund.category_name,
                "broad_category": getattr(fund, "broad_category", None),
                "purchase_mode": PURCHASE_MODE_MAP.get(raw_mode, "Unknown"),
                "dividend_type": derive_dividend_type(fund_name),
                "return_1y": nav.get("return_1y"),
                "return_3y": nav.get("return_3y"),
                "return_5y": nav.get("return_5y"),
                "net_expense_ratio": getattr(fund, "net_expense_ratio", None),
                "latest_nav": nav.get("nav"),
                "aum": snap.get("aum"),
                "equity_style_box": snap.get("equity_style_box"),
                "avg_market_cap": snap.get("avg_market_cap"),
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
            purchase_mode=None,
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
        """Category average returns — look up by category name in returns table."""
        # Category returns are keyed by category_code, not name
        # This is a best-effort lookup — may need category_code mapping
        return None

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
            "latest_nav": latest_nav.get("nav") if latest_nav else None,
            "latest_nav_date": latest_nav.get("nav_date") if latest_nav else None,
            "return_1y": latest_nav.get("return_1y") if latest_nav else None,
            "return_3y": latest_nav.get("return_3y") if latest_nav else None,
            "return_5y": latest_nav.get("return_5y") if latest_nav else None,
        }
