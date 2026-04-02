"""
Six-Lens Classification Engine

Each lens is a percentile rank (0-100) within the fund's SEBI category.
Higher = better for ALL lenses (Risk lens inverts so low-risk funds score high).
Then classified into 4 tiers per lens.

The engine receives pre-loaded data dicts. It never touches the database.
"""

from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional


# --- Tier Thresholds (configurable via engine_config) ---
TIER_THRESHOLDS = {
    "TIER_1": Decimal("75"),   # Top quartile
    "TIER_2": Decimal("50"),   # Above median
    "TIER_3": Decimal("25"),   # Below median
    # Below TIER_3 = TIER_4
}

# --- Tier Labels Per Lens ---
TIER_LABELS = {
    "return":      ["LEADER", "STRONG", "AVERAGE", "WEAK"],
    "risk":        ["LOW_RISK", "MODERATE", "ELEVATED", "HIGH_RISK"],
    "consistency": ["ROCK_SOLID", "CONSISTENT", "MIXED", "ERRATIC"],
    "alpha":       ["ALPHA_MACHINE", "POSITIVE", "NEUTRAL", "NEGATIVE"],
    "efficiency":  ["LEAN", "FAIR", "EXPENSIVE", "BLOATED"],
    "resilience":  ["FORTRESS", "STURDY", "FRAGILE", "VULNERABLE"],
}

# --- Headline Phrases ---
_HEADLINE_PHRASES = {
    "LEADER": "strong returns",
    "WEAK": "weak returns",
    "LOW_RISK": "low risk",
    "HIGH_RISK": "elevated risk",
    "ROCK_SOLID": "rock-solid consistency",
    "ERRATIC": "erratic performance",
    "ALPHA_MACHINE": "alpha generator",
    "NEGATIVE": "negative alpha",
    "LEAN": "cost-efficient",
    "BLOATED": "expensive fees",
    "FORTRESS": "fortress-level resilience",
    "VULNERABLE": "fragile in downturns",
    "STRONG": "above-average returns",
    "MODERATE": "moderate risk",
    "CONSISTENT": "consistent performer",
    "MIXED": "mixed consistency",
    "POSITIVE": "positive alpha",
    "NEUTRAL": "benchmark-like alpha",
    "FAIR": "fair cost structure",
    "EXPENSIVE": "higher fees",
    "STURDY": "sturdy resilience",
    "FRAGILE": "fragile in stress",
}

ENGINE_VERSION = "1.0.0"

# --- Return Lens Weights ---
_RETURN_WEIGHTS = {
    "return_1y": Decimal("0.20"),
    "return_3y": Decimal("0.35"),
    "return_5y": Decimal("0.45"),
}


@dataclass
class LensResult:
    """Result for one fund across all six lenses."""
    mstar_id: str
    category_name: str
    return_score: Optional[Decimal]
    risk_score: Optional[Decimal]
    consistency_score: Optional[Decimal]
    alpha_score: Optional[Decimal]
    efficiency_score: Optional[Decimal]
    resilience_score: Optional[Decimal]
    return_class: Optional[str]
    risk_class: Optional[str]
    consistency_class: Optional[str]
    alpha_class: Optional[str]
    efficiency_class: Optional[str]
    resilience_class: Optional[str]
    headline_tag: str
    data_completeness_pct: Decimal
    available_horizons: int
    engine_version: str = ENGINE_VERSION


class LensEngine:
    """
    Computes six-lens classification for all funds within a single SEBI category.
    Call compute_category() once per category with all funds' data pre-loaded.
    """

    def compute_category(
        self,
        category_name: str,
        fund_ids: list[str],
        latest_returns: dict[str, dict],
        risk_stats: dict[str, dict],
        ranks: dict[str, dict],
        fund_master: dict[str, dict],
        calendar_year_returns: dict[str, dict],
        category_avg_returns: dict,
    ) -> list[LensResult]:
        """
        Compute all six lenses for every fund in a category.
        Returns one LensResult per fund.
        """
        return_scores = self._compute_return_lens(fund_ids, latest_returns)
        risk_scores = self._compute_risk_lens(fund_ids, risk_stats)
        consistency_scores = self._compute_consistency_lens(fund_ids, ranks, risk_stats)
        alpha_scores = self._compute_alpha_lens(
            fund_ids, risk_stats, latest_returns, category_avg_returns,
        )
        efficiency_scores = self._compute_efficiency_lens(
            fund_ids, latest_returns, fund_master,
        )
        resilience_scores = self._compute_resilience_lens(
            fund_ids, risk_stats, calendar_year_returns,
        )

        results: list[LensResult] = []
        for fid in fund_ids:
            completeness, horizons = self._compute_data_completeness(
                fid, latest_returns, risk_stats, ranks,
            )
            result = LensResult(
                mstar_id=fid,
                category_name=category_name,
                return_score=return_scores.get(fid),
                risk_score=risk_scores.get(fid),
                consistency_score=consistency_scores.get(fid),
                alpha_score=alpha_scores.get(fid),
                efficiency_score=efficiency_scores.get(fid),
                resilience_score=resilience_scores.get(fid),
                return_class=self._classify_tier(return_scores.get(fid), "return"),
                risk_class=self._classify_tier(risk_scores.get(fid), "risk"),
                consistency_class=self._classify_tier(consistency_scores.get(fid), "consistency"),
                alpha_class=self._classify_tier(alpha_scores.get(fid), "alpha"),
                efficiency_class=self._classify_tier(efficiency_scores.get(fid), "efficiency"),
                resilience_class=self._classify_tier(resilience_scores.get(fid), "resilience"),
                headline_tag="",
                data_completeness_pct=completeness,
                available_horizons=horizons,
            )
            result.headline_tag = self._generate_headline(result)
            results.append(result)

        return results

    # --- Individual Lens Computations ---

    def _compute_return_lens(
        self,
        fund_ids: list[str],
        latest_returns: dict[str, dict],
    ) -> dict[str, Optional[Decimal]]:
        """
        RETURN LENS: Does it make money?

        Inputs: Return_1Y (weight 20%), Return_3Y (weight 35%), Return_5Y (weight 45%)
        Method:
          1. For each fund, compute weighted return: 0.20*R1Y + 0.35*R3Y + 0.45*R5Y
          2. If a horizon is missing, redistribute weight proportionally
          3. Rank all funds in category by weighted return
          4. Convert rank to percentile (0-100)
        """
        weighted: dict[str, Optional[Decimal]] = {}
        for fid in fund_ids:
            data = latest_returns.get(fid, {})
            horizons = {
                k: data.get(k)
                for k in _RETURN_WEIGHTS
                if data.get(k) is not None
            }
            if not horizons:
                weighted[fid] = None
                continue
            total_weight = sum(_RETURN_WEIGHTS[k] for k in horizons)
            score = sum(
                _RETURN_WEIGHTS[k] * v / total_weight
                for k, v in horizons.items()
            )
            weighted[fid] = score.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        return self._percentile_rank(weighted, higher_is_better=True)

    def _compute_risk_lens(
        self,
        fund_ids: list[str],
        risk_stats: dict[str, dict],
    ) -> dict[str, Optional[Decimal]]:
        """
        RISK LENS: How bumpy is the ride?

        Inputs: StdDev_3Y, MaxDrawdown_3Y, Beta_3Y, Downside_Capture_3Y (equal weight)
        All metrics are "lower is better" so we invert the ranking.
        """
        # For most risk metrics, lower value = lower risk = better → higher_is_better=False
        # For max_drawdown (negative), less negative = better → higher_is_better=True
        metrics = [
            ("std_dev_3y", False),
            ("max_drawdown_3y", True),   # Negative values: -5 > -25, less negative = better
            ("beta_3y", False),
            ("capture_down_3y", False),
        ]
        percentile_per_metric: list[dict[str, Optional[Decimal]]] = []

        for metric, higher_better in metrics:
            raw: dict[str, Optional[Decimal]] = {}
            for fid in fund_ids:
                val = risk_stats.get(fid, {}).get(metric)
                raw[fid] = val
            ranked = self._percentile_rank(raw, higher_is_better=higher_better)
            percentile_per_metric.append(ranked)

        result: dict[str, Optional[Decimal]] = {}
        for fid in fund_ids:
            vals = [pm[fid] for pm in percentile_per_metric if pm.get(fid) is not None]
            if not vals:
                result[fid] = None
            else:
                avg = sum(vals) / len(vals)
                result[fid] = avg.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        return result

    def _compute_consistency_lens(
        self,
        fund_ids: list[str],
        ranks: dict[str, dict],
        risk_stats: dict[str, dict],
    ) -> dict[str, Optional[Decimal]]:
        """
        CONSISTENCY LENS: Can you count on it?

        Final = 40% quartile + 30% calendar + 30% sortino
        """
        quartile_keys = ["quartile_1y", "quartile_3y", "quartile_5y"]
        cal_year_keys = [
            f"cal_year_pctile_{p}y" for p in range(1, 11)
        ]

        # Quartile consistency: % of periods in Q1 or Q2
        quartile_raw: dict[str, Optional[Decimal]] = {}
        for fid in fund_ids:
            rank_data = ranks.get(fid, {})
            periods = [(rank_data.get(k)) for k in quartile_keys if rank_data.get(k) is not None]
            if not periods:
                quartile_raw[fid] = None
            else:
                in_top_half = sum(1 for q in periods if q <= 2)
                quartile_raw[fid] = Decimal(str(in_top_half * 100)) / Decimal(str(len(periods)))

        # Calendar year consistency: % of years in top half (pctile <= 50)
        cal_raw: dict[str, Optional[Decimal]] = {}
        for fid in fund_ids:
            rank_data = ranks.get(fid, {})
            years = [rank_data.get(k) for k in cal_year_keys if rank_data.get(k) is not None]
            if not years:
                cal_raw[fid] = None
            else:
                in_top_half = sum(1 for p in years if p <= 50)
                cal_raw[fid] = Decimal(str(in_top_half * 100)) / Decimal(str(len(years)))

        # Sortino percentile within category
        sortino_raw: dict[str, Optional[Decimal]] = {}
        for fid in fund_ids:
            sortino_raw[fid] = risk_stats.get(fid, {}).get("sortino_3y")
        sortino_pctile = self._percentile_rank(sortino_raw, higher_is_better=True)

        # Rank the raw consistency scores
        quartile_pctile = self._percentile_rank(quartile_raw, higher_is_better=True)
        cal_pctile = self._percentile_rank(cal_raw, higher_is_better=True)

        result: dict[str, Optional[Decimal]] = {}
        for fid in fund_ids:
            components: list[tuple[Decimal, Optional[Decimal]]] = [
                (Decimal("0.40"), quartile_pctile.get(fid)),
                (Decimal("0.30"), cal_pctile.get(fid)),
                (Decimal("0.30"), sortino_pctile.get(fid)),
            ]
            available = [(w, v) for w, v in components if v is not None]
            if not available:
                result[fid] = None
            else:
                total_w = sum(w for w, _ in available)
                score = sum(w * v / total_w for w, v in available)
                result[fid] = score.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        return result

    def _compute_alpha_lens(
        self,
        fund_ids: list[str],
        risk_stats: dict[str, dict],
        latest_returns: dict[str, dict],
        category_avg_returns: dict,
    ) -> dict[str, Optional[Decimal]]:
        """
        ALPHA LENS: Is the manager adding value?

        Metrics: alpha_3y, alpha_5y, info_ratio_3y, info_ratio_5y, excess_3y, excess_5y
        Weight: 5Y metrics × 60%, 3Y metrics × 40%
        """
        # Compute excess returns vs category average
        excess_3y: dict[str, Optional[Decimal]] = {}
        excess_5y: dict[str, Optional[Decimal]] = {}
        cat_3y = category_avg_returns.get("return_3y")
        cat_5y = category_avg_returns.get("return_5y")

        for fid in fund_ids:
            r = latest_returns.get(fid, {})
            f3 = r.get("return_3y")
            f5 = r.get("return_5y")
            excess_3y[fid] = (f3 - cat_3y) if (f3 is not None and cat_3y is not None) else None
            excess_5y[fid] = (f5 - cat_5y) if (f5 is not None and cat_5y is not None) else None

        # Extract raw metric dicts
        alpha_3y_raw = {fid: risk_stats.get(fid, {}).get("alpha_3y") for fid in fund_ids}
        alpha_5y_raw = {fid: risk_stats.get(fid, {}).get("alpha_5y") for fid in fund_ids}
        ir_3y_raw = {fid: risk_stats.get(fid, {}).get("info_ratio_3y") for fid in fund_ids}
        ir_5y_raw = {fid: risk_stats.get(fid, {}).get("info_ratio_5y") for fid in fund_ids}

        # Percentile rank each
        alpha_3y_pct = self._percentile_rank(alpha_3y_raw, higher_is_better=True)
        alpha_5y_pct = self._percentile_rank(alpha_5y_raw, higher_is_better=True)
        ir_3y_pct = self._percentile_rank(ir_3y_raw, higher_is_better=True)
        ir_5y_pct = self._percentile_rank(ir_5y_raw, higher_is_better=True)
        excess_3y_pct = self._percentile_rank(excess_3y, higher_is_better=True)
        excess_5y_pct = self._percentile_rank(excess_5y, higher_is_better=True)

        # 3Y metrics (weight 40% total → ~13.33% each)
        # 5Y metrics (weight 60% total → 20% each)
        result: dict[str, Optional[Decimal]] = {}
        for fid in fund_ids:
            components_3y: list[Optional[Decimal]] = [
                alpha_3y_pct.get(fid), ir_3y_pct.get(fid), excess_3y_pct.get(fid),
            ]
            components_5y: list[Optional[Decimal]] = [
                alpha_5y_pct.get(fid), ir_5y_pct.get(fid), excess_5y_pct.get(fid),
            ]

            valid_3y = [v for v in components_3y if v is not None]
            valid_5y = [v for v in components_5y if v is not None]

            if not valid_3y and not valid_5y:
                result[fid] = None
                continue

            avg_3y = sum(valid_3y) / len(valid_3y) if valid_3y else None
            avg_5y = sum(valid_5y) / len(valid_5y) if valid_5y else None

            if avg_3y is not None and avg_5y is not None:
                score = Decimal("0.40") * avg_3y + Decimal("0.60") * avg_5y
            elif avg_5y is not None:
                score = avg_5y
            else:
                score = avg_3y  # type: ignore[assignment]

            result[fid] = score.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        return result

    def _compute_efficiency_lens(
        self,
        fund_ids: list[str],
        latest_returns: dict[str, dict],
        fund_master: dict[str, dict],
    ) -> dict[str, Optional[Decimal]]:
        """
        EFFICIENCY LENS: Is it worth the cost?

        Final = 40% expense + 20% turnover + 40% return-per-expense
        Expense and turnover are inverted (lower = better).
        """
        expense_raw: dict[str, Optional[Decimal]] = {}
        turnover_raw: dict[str, Optional[Decimal]] = {}
        rpe_raw: dict[str, Optional[Decimal]] = {}

        for fid in fund_ids:
            fm = fund_master.get(fid, {})
            ret = latest_returns.get(fid, {})
            expense = fm.get("net_expense_ratio")
            turnover = fm.get("turnover_ratio")
            r3y = ret.get("return_3y")

            expense_raw[fid] = expense
            turnover_raw[fid] = turnover

            if r3y is not None and expense is not None and expense > 0:
                rpe_raw[fid] = (r3y / expense).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP,
                )
            else:
                rpe_raw[fid] = None

        expense_pct = self._percentile_rank(expense_raw, higher_is_better=False)
        turnover_pct = self._percentile_rank(turnover_raw, higher_is_better=False)
        rpe_pct = self._percentile_rank(rpe_raw, higher_is_better=True)

        result: dict[str, Optional[Decimal]] = {}
        for fid in fund_ids:
            components: list[tuple[Decimal, Optional[Decimal]]] = [
                (Decimal("0.40"), expense_pct.get(fid)),
                (Decimal("0.20"), turnover_pct.get(fid)),
                (Decimal("0.40"), rpe_pct.get(fid)),
            ]
            available = [(w, v) for w, v in components if v is not None]
            if not available:
                result[fid] = None
            else:
                total_w = sum(w for w, _ in available)
                score = sum(w * v / total_w for w, v in available)
                result[fid] = score.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        return result

    @staticmethod
    def _first_available(rs: dict, *keys) -> Optional[Decimal]:
        """Return the first non-None value from a dict for the given keys."""
        for k in keys:
            v = rs.get(k)
            if v is not None:
                return v
        return None

    def _compute_resilience_lens(
        self,
        fund_ids: list[str],
        risk_stats: dict[str, dict],
        calendar_year_returns: dict[str, dict],
    ) -> dict[str, Optional[Decimal]]:
        """
        RESILIENCE LENS: How does it behave in bad markets?

        Metrics: MaxDrawdown (inv), DownsideCapture (inv),
                 Up/Down ratio (higher=better), worst CY return (higher=better).
        Equal weight across available metrics.

        Uses fallback chain: 3Y → 5Y → 10Y for each metric since
        Morningstar only returns MaxDrawdown and CaptureRatio at 10Y tenor.
        """
        dd_raw: dict[str, Optional[Decimal]] = {}
        dc_raw: dict[str, Optional[Decimal]] = {}
        ud_ratio_raw: dict[str, Optional[Decimal]] = {}
        worst_cy_raw: dict[str, Optional[Decimal]] = {}

        cal_year_keys = [f"calendar_year_return_{p}y" for p in range(1, 11)]

        for fid in fund_ids:
            rs = risk_stats.get(fid, {})
            # Fallback chain: prefer 3Y, then 5Y, then 10Y, then 1Y
            dd_raw[fid] = self._first_available(
                rs, "max_drawdown_3y", "max_drawdown_5y", "max_drawdown_10y",
                "max_drawdown_1y",
            )
            dc_raw[fid] = self._first_available(
                rs, "capture_down_3y", "capture_down_5y", "capture_down_10y",
                "capture_down_1y",
            )

            # Up/Down capture ratio — same fallback chain
            cup = self._first_available(
                rs, "capture_up_3y", "capture_up_5y", "capture_up_10y",
                "capture_up_1y",
            )
            cdn = self._first_available(
                rs, "capture_down_3y", "capture_down_5y", "capture_down_10y",
                "capture_down_1y",
            )
            if cup is not None and cdn is not None and cdn != 0:
                ud_ratio_raw[fid] = (cup / cdn).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP,
                )
            else:
                ud_ratio_raw[fid] = None

            cy = calendar_year_returns.get(fid, {})
            cy_vals = [cy.get(k) for k in cal_year_keys if cy.get(k) is not None]
            if cy_vals:
                worst_cy_raw[fid] = min(cy_vals)
            else:
                # Use max_drawdown as proxy for worst year when no CY data
                worst_cy_raw[fid] = dd_raw[fid]

        dd_pct = self._percentile_rank(dd_raw, higher_is_better=True)  # Negative values: -5 > -25, less negative = better
        dc_pct = self._percentile_rank(dc_raw, higher_is_better=False)
        ud_pct = self._percentile_rank(ud_ratio_raw, higher_is_better=True)
        worst_pct = self._percentile_rank(worst_cy_raw, higher_is_better=True)

        all_metrics = [dd_pct, dc_pct, ud_pct, worst_pct]

        result: dict[str, Optional[Decimal]] = {}
        for fid in fund_ids:
            vals = [m[fid] for m in all_metrics if m.get(fid) is not None]
            if not vals:
                result[fid] = None
            else:
                avg = sum(vals) / len(vals)
                result[fid] = avg.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        return result

    # --- Utility Methods ---

    def _percentile_rank(
        self,
        values: dict[str, Optional[Decimal]],
        higher_is_better: bool = True,
    ) -> dict[str, Optional[Decimal]]:
        """
        Convert raw values to percentile ranks (0-100) within the group.
        None values get None rank. Uses competition ranking.
        """
        valid = {k: v for k, v in values.items() if v is not None}
        result: dict[str, Optional[Decimal]] = {}

        if not valid:
            return {k: None for k in values}

        n = len(valid)
        if n == 1:
            for k in values:
                result[k] = Decimal("50") if values[k] is not None else None
            return result

        sorted_items = sorted(valid.items(), key=lambda x: x[1])
        if not higher_is_better:
            sorted_items = list(reversed(sorted_items))

        # Assign ranks with tie handling (average rank)
        rank_map: dict[str, Decimal] = {}
        i = 0
        while i < n:
            j = i
            while j < n and sorted_items[j][1] == sorted_items[i][1]:
                j += 1
            avg_rank = Decimal(str(i + j - 1)) / Decimal("2")
            for k in range(i, j):
                rank_map[sorted_items[k][0]] = avg_rank
            i = j

        for k in values:
            if values[k] is None:
                result[k] = None
            else:
                pctile = (rank_map[k] / Decimal(str(n - 1))) * Decimal("100")
                result[k] = pctile.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        return result

    def _classify_tier(
        self,
        score: Optional[Decimal],
        lens_name: str,
    ) -> Optional[str]:
        """Map a 0-100 percentile score to a tier label."""
        if score is None:
            return None
        labels = TIER_LABELS[lens_name]
        if score >= TIER_THRESHOLDS["TIER_1"]:
            return labels[0]
        if score >= TIER_THRESHOLDS["TIER_2"]:
            return labels[1]
        if score >= TIER_THRESHOLDS["TIER_3"]:
            return labels[2]
        return labels[3]

    def _generate_headline(self, result: LensResult) -> str:
        """
        Generate a human-readable headline from the top lens classifications.

        Logic:
          1. Collect all non-None classifications with their distance from 50
          2. Pick the 2-3 most distinctive (furthest from average)
          3. Combine into natural language
        """
        lens_data: list[tuple[str, Decimal, str]] = []
        for lens_name, score, cls in [
            ("return", result.return_score, result.return_class),
            ("risk", result.risk_score, result.risk_class),
            ("consistency", result.consistency_score, result.consistency_class),
            ("alpha", result.alpha_score, result.alpha_class),
            ("efficiency", result.efficiency_score, result.efficiency_class),
            ("resilience", result.resilience_score, result.resilience_class),
        ]:
            if score is not None and cls is not None:
                distance = abs(score - Decimal("50"))
                lens_data.append((cls, distance, lens_name))

        if not lens_data:
            return "Insufficient data for classification"

        # Sort by distance from 50 (most distinctive first)
        lens_data.sort(key=lambda x: x[1], reverse=True)
        top = lens_data[:3]

        phrases = []
        for cls, _, _ in top:
            phrase = _HEADLINE_PHRASES.get(cls)
            if phrase:
                phrases.append(phrase)

        if not phrases:
            return "Moderate across all dimensions"

        if len(phrases) == 1:
            return phrases[0].capitalize()
        if len(phrases) == 2:
            return f"{phrases[0].capitalize()} with {phrases[1]}"
        return f"{phrases[0].capitalize()} with {phrases[1]} and {phrases[2]}"

    def _compute_data_completeness(
        self,
        mstar_id: str,
        latest_returns: dict,
        risk_stats: dict,
        ranks: dict,
    ) -> tuple[Decimal, int]:
        """
        Compute what % of expected data points are available.
        Returns (completeness_pct, available_horizons).
        """
        ret = latest_returns.get(mstar_id, {})
        rs = risk_stats.get(mstar_id, {})
        rk = ranks.get(mstar_id, {})

        # Key data points we expect
        expected_keys = [
            # Returns
            "return_1y", "return_3y", "return_5y",
            # Risk stats
            "std_dev_3y", "max_drawdown_3y", "beta_3y", "capture_down_3y",
            "sortino_3y", "alpha_3y", "alpha_5y",
            # Ranks
            "quartile_1y", "quartile_3y", "quartile_5y",
        ]

        present = 0
        for key in expected_keys:
            # Use explicit None checks — Decimal("0") is a valid data point
            val = ret.get(key)
            if val is None:
                val = rs.get(key)
            if val is None:
                val = rk.get(key)
            if val is not None:
                present += 1

        total = len(expected_keys)
        pct = (Decimal(str(present)) / Decimal(str(total)) * Decimal("100")).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP,
        ) if total > 0 else Decimal("0")

        # Available horizons: count distinct return periods
        horizons = 0
        if ret.get("return_1y") is not None:
            horizons += 1
        if ret.get("return_3y") is not None:
            horizons += 1
        if ret.get("return_5y") is not None:
            horizons += 1

        return pct, horizons
