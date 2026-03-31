"""Portfolio analytics service — orchestrates data fetching and computation."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.repositories.audit_repo import AuditRepository
from app.repositories.strategy_repo import StrategyRepository
from app.services.portfolio_computations import (
    LENS_NAMES,
    TIER_NAMES,
    safe_decimal,
    cosine_similarity,
    enrich_holdings,
    compute_blended_sectors,
    compute_market_cap_split,
    compute_weighted_lens,
    compute_return_contributions,
    compute_risk_contributions,
    build_risk_profile,
    empty_analytics,
)


class PortfolioAnalyticsService:
    """Computes comprehensive analytics for a deployed portfolio."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.strategy_repo = StrategyRepository(db)
        self.audit_repo = AuditRepository(db)

    def get_analytics(self, portfolio_id: str) -> dict:
        """Build full analytics for a portfolio. Returns structured dict."""
        portfolio = self.strategy_repo.get_live_portfolio(portfolio_id)
        if portfolio is None:
            raise NotFoundError(
                f"Portfolio {portfolio_id} not found",
                details={"portfolio_id": portfolio_id},
            )
        holdings = self.strategy_repo.get_holdings(portfolio_id)
        if not holdings:
            return empty_analytics(portfolio)

        mstar_ids = [h["mstar_id"] for h in holdings]

        # Fetch all fund data in bulk
        fund_meta = self._fetch_fund_meta(mstar_ids)
        nav_data = self._fetch_nav_data(mstar_ids)
        lens_scores = self._fetch_lens_scores(mstar_ids)
        classifications = self._fetch_classifications(mstar_ids)
        sector_exposures = self._fetch_sector_exposures(mstar_ids)
        asset_allocations = self._fetch_asset_allocations(mstar_ids)
        risk_stats = self._fetch_risk_stats(mstar_ids)

        # Compute all analytics via pure functions
        enriched = enrich_holdings(
            holdings, fund_meta, nav_data, lens_scores, classifications, risk_stats,
        )
        blended_sectors = compute_blended_sectors(holdings, sector_exposures)
        similar_funds = self._find_similar_funds(blended_sectors, sector_exposures, mstar_ids)
        change_trail = self.audit_repo.get_by_entity(portfolio_id, limit=20)

        return {
            "portfolio": portfolio,
            "holdings": enriched,
            "blended_sectors": blended_sectors,
            "market_cap_split": compute_market_cap_split(holdings, asset_allocations),
            "weighted_lens_scores": compute_weighted_lens(holdings, lens_scores),
            "return_contributions": compute_return_contributions(holdings, nav_data),
            "risk_contributions": compute_risk_contributions(holdings, risk_stats),
            "risk_profile": build_risk_profile(holdings, risk_stats),
            "similar_funds": similar_funds,
            "change_trail": change_trail,
        }

    # ---- Data Fetchers (parameterized queries) ----

    def _fetch_fund_meta(self, mstar_ids: list[str]) -> dict[str, dict]:
        """Fetch fund_name, category_name, amc_name from fund_master."""
        if not mstar_ids:
            return {}
        result = self.db.execute(
            text(
                "SELECT mstar_id, fund_name, category_name, amc_name "
                "FROM fund_master WHERE mstar_id = ANY(:ids)"
            ),
            {"ids": mstar_ids},
        )
        return {
            row.mstar_id: {
                "fund_name": row.fund_name,
                "category_name": row.category_name,
                "amc_name": row.amc_name,
            }
            for row in result
        }

    def _fetch_nav_data(self, mstar_ids: list[str]) -> dict[str, dict]:
        """Fetch latest NAV + returns from nav_daily."""
        if not mstar_ids:
            return {}
        result = self.db.execute(
            text(
                "SELECT DISTINCT ON (mstar_id) mstar_id, nav, return_1y, return_3y "
                "FROM nav_daily WHERE mstar_id = ANY(:ids) "
                "ORDER BY mstar_id, nav_date DESC"
            ),
            {"ids": mstar_ids},
        )
        return {
            row.mstar_id: {
                "nav": safe_decimal(row.nav),
                "return_1y": safe_decimal(row.return_1y),
                "return_3y": safe_decimal(row.return_3y),
            }
            for row in result
        }

    def _fetch_lens_scores(self, mstar_ids: list[str]) -> dict[str, dict]:
        """Fetch 6 lens scores from fund_lens_scores."""
        if not mstar_ids:
            return {}
        cols = ", ".join(LENS_NAMES)
        result = self.db.execute(
            text(
                f"SELECT mstar_id, {cols} FROM fund_lens_scores "
                f"WHERE mstar_id = ANY(:ids)"
            ),
            {"ids": mstar_ids},
        )
        return {
            row.mstar_id: {name: safe_decimal(getattr(row, name)) for name in LENS_NAMES}
            for row in result
        }

    def _fetch_classifications(self, mstar_ids: list[str]) -> dict[str, dict]:
        """Fetch tier classifications + headline_tag from fund_classification."""
        if not mstar_ids:
            return {}
        cols = ", ".join(TIER_NAMES + ["headline_tag"])
        result = self.db.execute(
            text(
                f"SELECT mstar_id, {cols} FROM fund_classification "
                f"WHERE mstar_id = ANY(:ids)"
            ),
            {"ids": mstar_ids},
        )
        return {
            row.mstar_id: {
                **{name: getattr(row, name) for name in TIER_NAMES},
                "headline_tag": row.headline_tag,
            }
            for row in result
        }

    def _fetch_sector_exposures(self, mstar_ids: list[str]) -> dict[str, dict[str, Decimal]]:
        """Fetch sector exposure per fund."""
        if not mstar_ids:
            return {}
        result = self.db.execute(
            text(
                "SELECT mstar_id, sector_name, net_pct "
                "FROM fund_sector_exposure WHERE mstar_id = ANY(:ids)"
            ),
            {"ids": mstar_ids},
        )
        exposures: dict[str, dict[str, Decimal]] = {}
        for row in result:
            sectors = exposures.setdefault(row.mstar_id, {})
            sectors[row.sector_name] = safe_decimal(row.net_pct)
        return exposures

    def _fetch_asset_allocations(self, mstar_ids: list[str]) -> dict[str, dict]:
        """Fetch asset allocation and market cap data."""
        if not mstar_ids:
            return {}
        result = self.db.execute(
            text(
                "SELECT mstar_id, equity_net, bond_net, "
                "india_large_cap_pct, india_mid_cap_pct, india_small_cap_pct "
                "FROM fund_asset_allocation WHERE mstar_id = ANY(:ids)"
            ),
            {"ids": mstar_ids},
        )
        return {
            row.mstar_id: {
                "equity_net": safe_decimal(row.equity_net),
                "bond_net": safe_decimal(row.bond_net),
                "india_large_cap_pct": safe_decimal(row.india_large_cap_pct),
                "india_mid_cap_pct": safe_decimal(row.india_mid_cap_pct),
                "india_small_cap_pct": safe_decimal(row.india_small_cap_pct),
            }
            for row in result
        }

    def _fetch_risk_stats(self, mstar_ids: list[str]) -> dict[str, dict]:
        """Fetch risk stats from risk_stats_monthly."""
        if not mstar_ids:
            return {}
        result = self.db.execute(
            text(
                "SELECT DISTINCT ON (mstar_id) mstar_id, "
                "sharpe_3y, alpha_3y, std_dev_3y, max_drawdown_3y, "
                "sortino_3y, beta_3y, capture_up_3y, capture_down_3y, "
                "cat_sharpe_3y, cat_alpha_3y, cat_std_dev_3y, cat_max_drawdown_3y "
                "FROM risk_stats_monthly WHERE mstar_id = ANY(:ids) "
                "ORDER BY mstar_id, as_of_date DESC"
            ),
            {"ids": mstar_ids},
        )
        return {
            row.mstar_id: {
                "sharpe_3y": safe_decimal(row.sharpe_3y),
                "alpha_3y": safe_decimal(row.alpha_3y),
                "std_dev_3y": safe_decimal(row.std_dev_3y),
                "max_drawdown_3y": safe_decimal(row.max_drawdown_3y),
                "sortino_3y": safe_decimal(row.sortino_3y),
                "beta_3y": safe_decimal(row.beta_3y),
                "capture_up_3y": safe_decimal(row.capture_up_3y),
                "capture_down_3y": safe_decimal(row.capture_down_3y),
                "cat_sharpe_3y": safe_decimal(row.cat_sharpe_3y),
                "cat_alpha_3y": safe_decimal(row.cat_alpha_3y),
                "cat_std_dev_3y": safe_decimal(row.cat_std_dev_3y),
                "cat_max_drawdown_3y": safe_decimal(row.cat_max_drawdown_3y),
            }
            for row in result
        }

    # ---- Similar Funds (requires DB) ----

    def _find_similar_funds(
        self,
        blended_sectors: dict[str, str],
        sector_exposures: dict[str, dict[str, Decimal]],
        exclude_mstar_ids: list[str],
    ) -> list[dict]:
        """Find top 3 funds most similar to portfolio by sector cosine similarity."""
        if not blended_sectors:
            return []

        sector_order = list(blended_sectors.keys())
        portfolio_vec = [safe_decimal(blended_sectors[s]) for s in sector_order]

        result = self.db.execute(
            text(
                "SELECT DISTINCT mstar_id FROM fund_sector_exposure "
                "WHERE mstar_id != ALL(:ids) LIMIT 500"
            ),
            {"ids": exclude_mstar_ids},
        )
        candidate_ids = [row.mstar_id for row in result]
        if not candidate_ids:
            return []

        candidate_sectors = self._fetch_sector_exposures(candidate_ids)

        similarities: list[tuple[str, Decimal]] = []
        for mid, sectors in candidate_sectors.items():
            fund_vec = [safe_decimal(sectors.get(s)) for s in sector_order]
            sim = cosine_similarity(portfolio_vec, fund_vec)
            similarities.append((mid, sim))

        similarities.sort(key=lambda x: x[1], reverse=True)
        top_3 = similarities[:3]

        top_ids = [mid for mid, _ in top_3]
        if not top_ids:
            return []
        meta = self._fetch_fund_meta(top_ids)

        return [
            {
                "mstar_id": mid,
                "similarity": str(sim),
                "fund_name": meta.get(mid, {}).get("fund_name"),
                "category_name": meta.get(mid, {}).get("category_name"),
            }
            for mid, sim in top_3
        ]
