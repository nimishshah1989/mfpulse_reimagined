"""Pure computation functions for portfolio analytics — no DB, no HTTP."""

from __future__ import annotations

import math
from decimal import Decimal, ROUND_HALF_UP

# Decimal constants
_ZERO = Decimal("0")
_HUNDRED = Decimal("100")
_Q2 = Decimal("0.01")
_Q4 = Decimal("0.0001")

# Lens score column names
LENS_NAMES = [
    "return_score",
    "risk_score",
    "consistency_score",
    "alpha_score",
    "efficiency_score",
    "resilience_score",
]

# Classification tier column names
TIER_NAMES = [
    "return_tier",
    "risk_tier",
    "consistency_tier",
    "alpha_tier",
    "efficiency_tier",
    "resilience_tier",
]


def safe_decimal(value: object) -> Decimal:
    """Convert a value to Decimal safely, returning zero for None/invalid."""
    if value is None:
        return _ZERO
    try:
        return Decimal(str(value))
    except Exception:
        return _ZERO


def cosine_similarity(vec_a: list[Decimal], vec_b: list[Decimal]) -> Decimal:
    """Compute cosine similarity between two Decimal vectors."""
    if len(vec_a) != len(vec_b) or len(vec_a) == 0:
        return _ZERO
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = sum(a * a for a in vec_a)
    mag_b = sum(b * b for b in vec_b)
    if mag_a == _ZERO or mag_b == _ZERO:
        return _ZERO
    denominator = Decimal(str(math.sqrt(float(mag_a) * float(mag_b))))
    if denominator == _ZERO:
        return _ZERO
    return (dot / denominator).quantize(_Q4, rounding=ROUND_HALF_UP)


def enrich_holdings(
    holdings: list[dict],
    fund_meta: dict[str, dict],
    nav_data: dict[str, dict],
    lens_scores: dict[str, dict],
    classifications: dict[str, dict],
    risk_stats: dict[str, dict],
) -> list[dict]:
    """Enrich each holding with fund metadata, NAV, lens, classification, risk."""
    enriched = []
    for h in holdings:
        mid = h["mstar_id"]
        entry = {
            **h,
            "fund_meta": fund_meta.get(mid, {}),
            "nav_data": nav_data.get(mid, {}),
            "lens_scores": lens_scores.get(mid, {}),
            "classification": classifications.get(mid, {}),
            "risk_stats": risk_stats.get(mid, {}),
        }
        enriched.append(entry)
    return enriched


def compute_blended_sectors(
    holdings: list[dict],
    sector_exposures: dict[str, dict[str, Decimal]],
) -> dict[str, str]:
    """Compute weighted-average sector exposure across portfolio."""
    all_sectors: dict[str, Decimal] = {}
    total_weight = _ZERO

    for h in holdings:
        weight = safe_decimal(h.get("weight_pct"))
        if weight == _ZERO:
            continue
        total_weight += weight
        fund_sectors = sector_exposures.get(h["mstar_id"], {})
        for sector, pct in fund_sectors.items():
            current = all_sectors.get(sector, _ZERO)
            all_sectors[sector] = current + weight * pct

    if total_weight == _ZERO:
        return {}

    return {
        sector: str((value / total_weight).quantize(_Q2, rounding=ROUND_HALF_UP))
        for sector, value in sorted(all_sectors.items(), key=lambda x: x[1], reverse=True)
    }


def compute_market_cap_split(
    holdings: list[dict],
    asset_allocations: dict[str, dict],
) -> dict[str, str]:
    """Compute weighted-average market cap split."""
    large = _ZERO
    mid = _ZERO
    small = _ZERO
    total_weight = _ZERO

    for h in holdings:
        weight = safe_decimal(h.get("weight_pct"))
        if weight == _ZERO:
            continue
        alloc = asset_allocations.get(h["mstar_id"], {})
        if not alloc:
            continue
        total_weight += weight
        large += weight * safe_decimal(alloc.get("india_large_cap_pct"))
        mid += weight * safe_decimal(alloc.get("india_mid_cap_pct"))
        small += weight * safe_decimal(alloc.get("india_small_cap_pct"))

    if total_weight == _ZERO:
        return {"large_cap_pct": "0", "mid_cap_pct": "0", "small_cap_pct": "0"}

    return {
        "large_cap_pct": str((large / total_weight).quantize(_Q2, rounding=ROUND_HALF_UP)),
        "mid_cap_pct": str((mid / total_weight).quantize(_Q2, rounding=ROUND_HALF_UP)),
        "small_cap_pct": str((small / total_weight).quantize(_Q2, rounding=ROUND_HALF_UP)),
    }


def compute_weighted_lens(
    holdings: list[dict],
    lens_scores: dict[str, dict],
) -> dict[str, str]:
    """Compute weighted-average lens scores across the portfolio."""
    totals: dict[str, Decimal] = {name: _ZERO for name in LENS_NAMES}
    total_weight = _ZERO

    for h in holdings:
        weight = safe_decimal(h.get("weight_pct"))
        if weight == _ZERO:
            continue
        scores = lens_scores.get(h["mstar_id"])
        if not scores:
            continue
        total_weight += weight
        for name in LENS_NAMES:
            totals[name] += weight * safe_decimal(scores.get(name))

    if total_weight == _ZERO:
        return {name: "0" for name in LENS_NAMES}

    return {
        name: str((totals[name] / total_weight).quantize(_Q2, rounding=ROUND_HALF_UP))
        for name in LENS_NAMES
    }


def compute_return_contributions(
    holdings: list[dict],
    nav_data: dict[str, dict],
) -> list[dict]:
    """Compute return contribution per holding."""
    portfolio_return = _ZERO
    for h in holdings:
        weight = safe_decimal(h.get("weight_pct"))
        fund_nav = nav_data.get(h["mstar_id"], {})
        ret_1y = safe_decimal(fund_nav.get("return_1y"))
        portfolio_return += weight * ret_1y / _HUNDRED

    contributions = []
    for h in holdings:
        weight = safe_decimal(h.get("weight_pct"))
        fund_nav = nav_data.get(h["mstar_id"], {})
        ret_1y = safe_decimal(fund_nav.get("return_1y"))
        weighted_ret = weight * ret_1y / _HUNDRED

        if portfolio_return != _ZERO:
            contribution_pct = (weighted_ret / portfolio_return * _HUNDRED).quantize(
                _Q2, rounding=ROUND_HALF_UP
            )
        else:
            contribution_pct = _ZERO

        contributions.append({
            "mstar_id": h["mstar_id"],
            "weight_pct": str(weight),
            "return_1y": str(ret_1y),
            "contribution_pct": str(contribution_pct),
        })
    return contributions


def compute_risk_contributions(
    holdings: list[dict],
    risk_stats: dict[str, dict],
) -> list[dict]:
    """Compute risk contribution per holding."""
    portfolio_std = _ZERO
    for h in holdings:
        weight = safe_decimal(h.get("weight_pct"))
        stats = risk_stats.get(h["mstar_id"], {})
        std_dev = safe_decimal(stats.get("std_dev_3y"))
        portfolio_std += weight * std_dev / _HUNDRED

    contributions = []
    for h in holdings:
        weight = safe_decimal(h.get("weight_pct"))
        stats = risk_stats.get(h["mstar_id"], {})
        std_dev = safe_decimal(stats.get("std_dev_3y"))
        weighted_std = weight * std_dev / _HUNDRED

        if portfolio_std != _ZERO:
            contribution_pct = (weighted_std / portfolio_std * _HUNDRED).quantize(
                _Q2, rounding=ROUND_HALF_UP
            )
        else:
            contribution_pct = _ZERO

        contributions.append({
            "mstar_id": h["mstar_id"],
            "weight_pct": str(weight),
            "std_dev_3y": str(std_dev),
            "contribution_pct": str(contribution_pct),
        })
    return contributions


def build_risk_profile(
    holdings: list[dict],
    risk_stats: dict[str, dict],
) -> dict:
    """Build aggregated risk profile: portfolio metrics vs category average."""
    metric_names = [
        "sharpe_3y", "alpha_3y", "std_dev_3y",
        "max_drawdown_3y", "sortino_3y", "beta_3y",
        "capture_up_3y", "capture_down_3y",
    ]
    cat_metric_names = [
        "cat_sharpe_3y", "cat_alpha_3y", "cat_std_dev_3y", "cat_max_drawdown_3y",
    ]

    portfolio_metrics: dict[str, Decimal] = {m: _ZERO for m in metric_names}
    benchmark_metrics: dict[str, Decimal] = {m: _ZERO for m in cat_metric_names}
    total_weight = _ZERO

    for h in holdings:
        weight = safe_decimal(h.get("weight_pct"))
        if weight == _ZERO:
            continue
        stats = risk_stats.get(h["mstar_id"], {})
        if not stats:
            continue
        total_weight += weight
        for m in metric_names:
            portfolio_metrics[m] += weight * safe_decimal(stats.get(m))
        for m in cat_metric_names:
            benchmark_metrics[m] += weight * safe_decimal(stats.get(m))

    if total_weight != _ZERO:
        portfolio_metrics = {
            m: str((v / total_weight).quantize(_Q2, rounding=ROUND_HALF_UP))
            for m, v in portfolio_metrics.items()
        }
        benchmark_metrics = {
            m: str((v / total_weight).quantize(_Q2, rounding=ROUND_HALF_UP))
            for m, v in benchmark_metrics.items()
        }
    else:
        portfolio_metrics = {m: "0" for m in metric_names}
        benchmark_metrics = {m: "0" for m in cat_metric_names}

    return {
        "portfolio": portfolio_metrics,
        "benchmark": benchmark_metrics,
    }


def empty_analytics(portfolio: dict) -> dict:
    """Return empty analytics structure when portfolio has no holdings."""
    return {
        "portfolio": portfolio,
        "holdings": [],
        "blended_sectors": {},
        "market_cap_split": {"large_cap_pct": "0", "mid_cap_pct": "0", "small_cap_pct": "0"},
        "weighted_lens_scores": {name: "0" for name in LENS_NAMES},
        "return_contributions": [],
        "risk_contributions": [],
        "risk_profile": {
            "portfolio": {},
            "benchmark": {},
        },
        "similar_funds": [],
        "change_trail": [],
    }
