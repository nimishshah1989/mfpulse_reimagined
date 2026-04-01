"""Read operations for portfolio holdings data."""

import re
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.db.holdings import FundHoldingsSnapshot, FundHoldingDetail
from app.models.db.sector_exposure import FundSectorExposure
from app.models.db.asset_allocation import FundAssetAllocation
from app.models.db.credit_quality import FundCreditQuality


class HoldingsRepository:
    """Read operations for portfolio holdings data."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_latest_snapshot(self, mstar_id: str) -> Optional[dict]:
        """Latest portfolio snapshot (AUM, PE, PB, style box, etc.).

        Prefers the newest snapshot with non-null AUM (newer empty snapshots
        may exist from partial ingestion runs).
        """
        # Try newest with AUM first
        snap = (
            self.db.query(FundHoldingsSnapshot)
            .filter(
                FundHoldingsSnapshot.mstar_id == mstar_id,
                FundHoldingsSnapshot.aum.isnot(None),
            )
            .order_by(FundHoldingsSnapshot.portfolio_date.desc())
            .first()
        )
        if snap is None:
            # Fall back to newest regardless
            snap = (
                self.db.query(FundHoldingsSnapshot)
                .filter(FundHoldingsSnapshot.mstar_id == mstar_id)
                .order_by(FundHoldingsSnapshot.portfolio_date.desc())
                .first()
            )
        if snap is None:
            return None
        return self._snapshot_to_dict(snap)

    def get_latest_snapshots_batch(
        self, mstar_ids: list[str], chunk_size: int = 1000,
    ) -> dict[str, dict]:
        """Latest holdings snapshot (with AUM) for multiple funds.

        Prefers the newest snapshot that has non-null AUM. Falls back to the
        absolute newest snapshot if no AUM-bearing row exists. Chunked to
        avoid large IN clauses.
        """
        if not mstar_ids:
            return {}
        result: dict[str, dict] = {}
        for i in range(0, len(mstar_ids), chunk_size):
            chunk = mstar_ids[i : i + chunk_size]
            # First pass: latest snapshot WITH AUM data
            latest_aum_sub = (
                self.db.query(
                    FundHoldingsSnapshot.mstar_id,
                    func.max(FundHoldingsSnapshot.portfolio_date).label("max_date"),
                )
                .filter(
                    FundHoldingsSnapshot.mstar_id.in_(chunk),
                    FundHoldingsSnapshot.aum.isnot(None),
                )
                .group_by(FundHoldingsSnapshot.mstar_id)
                .subquery()
            )
            rows = (
                self.db.query(FundHoldingsSnapshot)
                .join(
                    latest_aum_sub,
                    (FundHoldingsSnapshot.mstar_id == latest_aum_sub.c.mstar_id)
                    & (FundHoldingsSnapshot.portfolio_date == latest_aum_sub.c.max_date),
                )
                .all()
            )
            for r in rows:
                result[r.mstar_id] = self._snapshot_to_dict(r)

            # Second pass: funds in this chunk not yet found (no AUM rows)
            missing = [mid for mid in chunk if mid not in result]
            if missing:
                fallback_sub = (
                    self.db.query(
                        FundHoldingsSnapshot.mstar_id,
                        func.max(FundHoldingsSnapshot.portfolio_date).label("max_date"),
                    )
                    .filter(FundHoldingsSnapshot.mstar_id.in_(missing))
                    .group_by(FundHoldingsSnapshot.mstar_id)
                    .subquery()
                )
                fallback_rows = (
                    self.db.query(FundHoldingsSnapshot)
                    .join(
                        fallback_sub,
                        (FundHoldingsSnapshot.mstar_id == fallback_sub.c.mstar_id)
                        & (FundHoldingsSnapshot.portfolio_date == fallback_sub.c.max_date),
                    )
                    .all()
                )
                for r in fallback_rows:
                    result[r.mstar_id] = self._snapshot_to_dict(r)
        return result

    def get_top_holdings(self, mstar_id: str, limit: int = 10) -> list[dict]:
        """Top N holdings by weight for latest portfolio date, deduplicated by name."""
        snap = (
            self.db.query(FundHoldingsSnapshot)
            .filter(FundHoldingsSnapshot.mstar_id == mstar_id)
            .order_by(FundHoldingsSnapshot.portfolio_date.desc())
            .first()
        )
        if snap is None:
            return []
        # Fetch more than needed to allow dedup headroom
        holdings = (
            self.db.query(FundHoldingDetail)
            .filter(FundHoldingDetail.snapshot_id == snap.id)
            .order_by(FundHoldingDetail.weighting_pct.desc().nulls_last())
            .limit(limit * 3)
            .all()
        )
        # Deduplicate by normalized holding_name (strip Ltd/Limited/Ltd., case-insensitive)
        # Keep the one with highest weighting_pct per normalized name
        seen: dict[str, FundHoldingDetail] = {}
        for h in holdings:
            raw = h.holding_name or ""
            norm = re.sub(r"\s*(Ltd\.?|Limited)\s*$", "", raw, flags=re.IGNORECASE).strip().lower()
            existing = seen.get(norm)
            if existing is None:
                seen[norm] = h
            else:
                cur_wt = h.weighting_pct or Decimal("0")
                ex_wt = existing.weighting_pct or Decimal("0")
                if cur_wt > ex_wt:
                    seen[norm] = h
        deduped = sorted(seen.values(), key=lambda x: x.weighting_pct or Decimal("0"), reverse=True)
        return [self._holding_to_dict(h) for h in deduped[:limit]]

    def get_all_holdings(self, mstar_id: str) -> list[dict]:
        """All holdings for latest portfolio date."""
        snap = (
            self.db.query(FundHoldingsSnapshot)
            .filter(FundHoldingsSnapshot.mstar_id == mstar_id)
            .order_by(FundHoldingsSnapshot.portfolio_date.desc())
            .first()
        )
        if snap is None:
            return []
        holdings = (
            self.db.query(FundHoldingDetail)
            .filter(FundHoldingDetail.snapshot_id == snap.id)
            .order_by(FundHoldingDetail.weighting_pct.desc().nulls_last())
            .all()
        )
        return [self._holding_to_dict(h) for h in holdings]

    def get_sector_exposure(self, mstar_id: str) -> list[dict]:
        """Latest sector allocation (11 Morningstar sectors)."""
        rows = (
            self.db.query(FundSectorExposure)
            .filter(FundSectorExposure.mstar_id == mstar_id)
            .order_by(FundSectorExposure.portfolio_date.desc())
            .all()
        )
        if not rows:
            return []
        # Only return the latest date's data
        latest_date = rows[0].portfolio_date
        return [
            {"sector_name": r.sector_name, "net_pct": r.net_pct}
            for r in rows
            if r.portfolio_date == latest_date
        ]

    def get_sector_exposure_history(
        self,
        mstar_id: str,
        limit: int = 12,
    ) -> list[dict]:
        """Monthly sector exposure history for drift analysis."""
        rows = (
            self.db.query(FundSectorExposure)
            .filter(FundSectorExposure.mstar_id == mstar_id)
            .order_by(FundSectorExposure.portfolio_date.desc())
            .limit(limit * 11)  # ~11 sectors per date
            .all()
        )
        return [
            {
                "portfolio_date": r.portfolio_date,
                "sector_name": r.sector_name,
                "net_pct": r.net_pct,
            }
            for r in rows
        ]

    def get_asset_allocation(self, mstar_id: str) -> Optional[dict]:
        """Latest asset allocation (equity/bond/cash/other + market cap split)."""
        alloc = (
            self.db.query(FundAssetAllocation)
            .filter(FundAssetAllocation.mstar_id == mstar_id)
            .order_by(FundAssetAllocation.portfolio_date.desc())
            .first()
        )
        if alloc is None:
            return None
        return {
            "portfolio_date": alloc.portfolio_date,
            "equity_net": alloc.equity_net,
            "bond_net": alloc.bond_net,
            "cash_net": alloc.cash_net,
            "other_net": alloc.other_net,
            "india_large_cap_pct": alloc.india_large_cap_pct,
            "india_mid_cap_pct": alloc.india_mid_cap_pct,
            "india_small_cap_pct": alloc.india_small_cap_pct,
        }

    def get_credit_quality(self, mstar_id: str) -> Optional[dict]:
        """Latest credit quality breakdown (for debt funds)."""
        cq = (
            self.db.query(FundCreditQuality)
            .filter(FundCreditQuality.mstar_id == mstar_id)
            .order_by(FundCreditQuality.portfolio_date.desc())
            .first()
        )
        if cq is None:
            return None
        return {
            "portfolio_date": cq.portfolio_date,
            "aaa_pct": cq.aaa_pct,
            "aa_pct": cq.aa_pct,
            "a_pct": cq.a_pct,
            "bbb_pct": cq.bbb_pct,
            "bb_pct": cq.bb_pct,
            "b_pct": cq.b_pct,
            "below_b_pct": cq.below_b_pct,
            "not_rated_pct": cq.not_rated_pct,
        }

    # --- Overlap Analysis ---

    def get_holdings_for_overlap(
        self,
        mstar_ids: list[str],
    ) -> dict[str, list[dict]]:
        """Returns holdings for multiple funds keyed by mstar_id."""
        result: dict[str, list[dict]] = {}
        for mstar_id in mstar_ids:
            result[mstar_id] = self.get_all_holdings(mstar_id)
        return result

    def compute_overlap(
        self,
        mstar_ids: list[str],
    ) -> dict:
        """
        Given 2-5 fund mstar_ids, compute:
        - overlap_matrix: pairwise overlap % between each pair
        - common_holdings: holdings appearing in 2+ funds with combined weight
        - effective_allocation: aggregated sector/market cap if held equally
        """
        if len(mstar_ids) < 2:
            raise ValidationError(
                "Overlap analysis requires at least 2 funds",
                details={"count": len(mstar_ids)},
            )
        if len(mstar_ids) > 5:
            raise ValidationError(
                "Overlap analysis supports at most 5 funds",
                details={"count": len(mstar_ids)},
            )

        holdings_by_fund = self.get_holdings_for_overlap(mstar_ids)

        # Build ISIN → fund → weight mapping
        isin_map: dict[str, dict[str, Decimal]] = defaultdict(dict)
        for fund_id, holdings in holdings_by_fund.items():
            for h in holdings:
                isin = h.get("isin")
                if isin:
                    isin_map[isin][fund_id] = h.get("weighting_pct") or Decimal("0")

        # Pairwise overlap: sum of min weights for shared ISINs
        overlap_matrix: dict[str, dict[str, Decimal]] = {}
        for i, fund_a in enumerate(mstar_ids):
            overlap_matrix[fund_a] = {}
            for fund_b in mstar_ids[i + 1:]:
                shared_weight = Decimal("0")
                for isin, fund_weights in isin_map.items():
                    if fund_a in fund_weights and fund_b in fund_weights:
                        shared_weight += min(
                            fund_weights[fund_a], fund_weights[fund_b],
                        )
                overlap_matrix[fund_a][fund_b] = shared_weight
                overlap_matrix.setdefault(fund_b, {})[fund_a] = shared_weight

        # Common holdings: ISINs in 2+ funds
        common_holdings: list[dict] = []
        for isin, fund_weights in isin_map.items():
            if len(fund_weights) >= 2:
                # Get the name from any fund that has it
                name = ""
                for fund_id, holdings in holdings_by_fund.items():
                    for h in holdings:
                        if h.get("isin") == isin:
                            name = h.get("holding_name", "")
                            break
                    if name:
                        break
                avg_weight = sum(fund_weights.values()) / len(fund_weights)
                common_holdings.append({
                    "isin": isin,
                    "holding_name": name,
                    "fund_count": len(fund_weights),
                    "weights": dict(fund_weights),
                    "combined_avg_weight": avg_weight.quantize(
                        Decimal("0.0001"), rounding=ROUND_HALF_UP,
                    ),
                })
        common_holdings.sort(
            key=lambda x: x["combined_avg_weight"], reverse=True,
        )

        # Effective sector allocation (equal-weight across funds)
        sector_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
        n_funds = Decimal(str(len(mstar_ids)))
        for fund_id in mstar_ids:
            sectors = self._get_sectors_for_fund(fund_id)
            for s in sectors:
                pct = s.get("net_pct") or Decimal("0")
                sector_totals[s["sector_name"]] += pct / n_funds
        effective_sectors = [
            {
                "sector_name": k,
                "net_pct": v.quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP,
                ),
            }
            for k, v in sorted(sector_totals.items(), key=lambda x: -x[1])
        ]

        return {
            "funds_analyzed": mstar_ids,
            "overlap_matrix": overlap_matrix,
            "common_holdings": common_holdings,
            "effective_sector_allocation": effective_sectors,
            "effective_market_cap": None,
        }

    def _get_sectors_for_fund(self, mstar_id: str) -> list[dict]:
        """Get latest sector exposure for a single fund."""
        return self.get_sector_exposure(mstar_id)

    # --- Private helpers ---

    @staticmethod
    def _snapshot_to_dict(snap: FundHoldingsSnapshot) -> dict:
        return {
            "portfolio_date": snap.portfolio_date,
            "num_holdings": snap.num_holdings,
            "num_equity": snap.num_equity,
            "num_bond": snap.num_bond,
            "equity_style_box": snap.equity_style_box,
            "bond_style_box": snap.bond_style_box,
            "aum": snap.aum,
            "avg_market_cap": snap.avg_market_cap,
            "pe_ratio": snap.pe_ratio,
            "pb_ratio": snap.pb_ratio,
            "pc_ratio": snap.pc_ratio,
            "ps_ratio": snap.ps_ratio,
            "roe_ttm": snap.roe_ttm,
            "roa_ttm": snap.roa_ttm,
            "net_margin_ttm": snap.net_margin_ttm,
            "ytm": snap.ytm,
            "avg_eff_maturity": snap.avg_eff_maturity,
            "modified_duration": snap.modified_duration,
            "avg_credit_quality": snap.avg_credit_quality,
            "prospective_div_yield": snap.prospective_div_yield,
            "turnover_ratio": snap.turnover_ratio,
            "est_fund_net_flow": snap.est_fund_net_flow,
            "est_fund_net_flow_ytd": str(snap.est_fund_net_flow_ytd) if snap.est_fund_net_flow_ytd is not None else None,
        }

    @staticmethod
    def _holding_to_dict(h: FundHoldingDetail) -> dict:
        return {
            "holding_name": h.holding_name,
            "isin": h.isin,
            "holding_type": h.holding_type,
            "weighting_pct": h.weighting_pct,
            "num_shares": h.num_shares,
            "market_value": h.market_value,
            "global_sector": h.global_sector,
            "country": h.country,
            "currency": h.currency,
            "coupon": h.coupon,
            "maturity_date": h.maturity_date,
            "credit_quality": h.credit_quality,
            "share_change": h.share_change,
            "ticker": h.ticker,
            "global_industry": h.global_industry,
            "holding_ytd_return": str(h.holding_ytd_return) if h.holding_ytd_return is not None else None,
            "first_bought_date": str(h.first_bought_date) if h.first_bought_date else None,
        }
