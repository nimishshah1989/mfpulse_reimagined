"""Centralized Claude API client for all AI-powered features.

Uses Haiku 4.5 for cost-efficiency (~$0.25/1M input, $1.25/1M output).
All methods include in-memory caching + fallback templates.
Estimated cost: ~$1.50/month at moderate usage.
"""

import logging
import time
from typing import Optional

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ── In-memory cache ──────────────────────────────────────────────────────────
_CACHE: dict[str, tuple[str, float]] = {}

# Track usage for admin dashboard
_USAGE_LOG: list[dict] = []

MODEL = "claude-haiku-4-5-20251001"
API_URL = "https://api.anthropic.com/v1/messages"


def _get_api_key() -> str:
    return get_settings().anthropic_api_key


def _cache_get(key: str) -> Optional[str]:
    cached = _CACHE.get(key)
    if cached and time.monotonic() < cached[1]:
        return cached[0]
    return None


def _cache_set(key: str, value: str, ttl: int) -> None:
    _CACHE[key] = (value, time.monotonic() + ttl)


def _call_claude(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 400,
    timeout: float = 15.0,
) -> Optional[str]:
    """Call Claude Haiku API. Returns text or None on failure."""
    api_key = _get_api_key()
    if not api_key:
        return None

    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(
                API_URL,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": MODEL,
                    "max_tokens": max_tokens,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
            )
            if response.status_code == 200:
                data = response.json()
                text = data["content"][0]["text"]
                # Log usage
                usage = data.get("usage", {})
                _USAGE_LOG.append({
                    "time": time.time(),
                    "input_tokens": usage.get("input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0),
                    "feature": "unknown",
                })
                return text
            logger.warning(
                "Claude API %d: %s", response.status_code, response.text[:200]
            )
            return None
    except httpx.TimeoutException:
        logger.warning("Claude API timeout")
        return None
    except Exception as e:
        logger.warning("Claude API error: %s", e)
        return None


# ── Feature 1: Morning Briefing ──────────────────────────────────────────────

BRIEFING_SYSTEM = (
    "You are MF Pulse's market intelligence system. Generate a concise morning "
    "briefing for an Indian mutual fund manager. Be specific with numbers. "
    "Format: 3-4 sentences covering market regime, key signals, and actionable takeaway. "
    "Use Indian market terminology (Nifty, Sensex, FII/DII, breadth). No markdown."
)


def generate_morning_briefing(market_data: dict) -> str:
    """Generate AI morning briefing from market signals.

    Args:
        market_data: Dict with keys: regime, nifty_value, nifty_change_pct,
                     sentiment_score, breadth_advance_pct, leading_sectors,
                     universe_stats
    """
    cache_key = f"briefing:{market_data.get('regime', '')}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    prompt = (
        f"Market Regime: {market_data.get('regime', 'N/A')}\n"
        f"Nifty 50: {market_data.get('nifty_value', 'N/A')} "
        f"({market_data.get('nifty_change_pct', 'N/A')}%)\n"
        f"Sentiment Score: {market_data.get('sentiment_score', 'N/A')}/100\n"
        f"Breadth: {market_data.get('breadth_advance_pct', 'N/A')}% advancing\n"
        f"Leading Sectors: {market_data.get('leading_sectors', 'N/A')}\n"
        f"Universe: {market_data.get('universe_stats', 'N/A')}\n"
        f"\nGenerate today's morning briefing."
    )

    result = _call_claude(BRIEFING_SYSTEM, prompt, max_tokens=250)
    if result:
        _log_feature("morning_briefing")
        _cache_set(cache_key, result, 3600)  # 1 hour
        return result

    # Fallback
    regime = market_data.get("regime", "Neutral")
    return (
        f"Market is in {regime} regime. "
        f"Nifty at {market_data.get('nifty_value', '--')} "
        f"({market_data.get('nifty_change_pct', '--')}%). "
        "Check sector rotation and breadth signals for positioning."
    )


# ── Feature 2: Strategy Insights ─────────────────────────────────────────────

STRATEGY_SYSTEM = (
    "You are MF Pulse's strategy intelligence engine. Analyze the mutual fund "
    "portfolio and generate 3-4 actionable insights. Each insight should have a "
    "clear title and 1-2 sentence explanation. Focus on: alpha generation, "
    "risk concentration, sector tilt, rebalancing needs. Be specific with numbers. "
    "Return as JSON array: [{\"type\": \"positive|warning|neutral|info\", "
    "\"title\": \"...\", \"text\": \"...\"}]"
)


def generate_strategy_insights(strategy_data: dict) -> list[dict]:
    """Generate AI insights for a strategy portfolio.

    Args:
        strategy_data: Dict with keys: name, funds (list with scores),
                       total_aum, xirr, sector_exposure, overlap_pct
    """
    cache_key = f"strategy_insights:{strategy_data.get('id', '')}"
    cached = _cache_get(cache_key)
    if cached:
        import json
        try:
            return json.loads(cached)
        except Exception:
            pass

    funds_summary = []
    for f in (strategy_data.get("funds") or [])[:8]:
        funds_summary.append(
            f"{f.get('fund_name', '?')} "
            f"(Return={f.get('return_score', '?')}, "
            f"Alpha={f.get('alpha_score', '?')}, "
            f"Risk={f.get('risk_score', '?')})"
        )

    prompt = (
        f"Strategy: {strategy_data.get('name', 'Unnamed')}\n"
        f"Total AUM: {strategy_data.get('total_aum', 'N/A')}\n"
        f"XIRR: {strategy_data.get('xirr', 'N/A')}%\n"
        f"Funds:\n" + "\n".join(f"  - {fs}" for fs in funds_summary) + "\n"
        f"Sector Exposure: {strategy_data.get('sector_exposure', 'N/A')}\n"
        f"Holdings Overlap: {strategy_data.get('overlap_pct', 'N/A')}%\n"
        f"\nGenerate strategy insights as JSON array."
    )

    result = _call_claude(STRATEGY_SYSTEM, prompt, max_tokens=500)
    if result:
        import json
        _log_feature("strategy_insights")
        # Parse JSON from response (may have surrounding text)
        try:
            # Find JSON array in response
            start = result.index("[")
            end = result.rindex("]") + 1
            insights = json.loads(result[start:end])
            _cache_set(cache_key, json.dumps(insights), 3600)
            return insights
        except (ValueError, json.JSONDecodeError):
            logger.warning("Failed to parse strategy insights JSON")

    return []


# ── Feature 3: Simulation Explainer ──────────────────────────────────────────

SIMULATION_SYSTEM = (
    "You are MF Pulse's simulation analyst. Explain simulation results to a "
    "fund manager in 2-3 clear sentences. Compare the modes (SIP, SIP+Signals, "
    "Lumpsum, Hybrid) and explain WHY one outperformed. Use specific numbers. "
    "Focus on: signal hit rate, capital efficiency, timing impact. No markdown."
)


def generate_simulation_explainer(sim_results: dict) -> str:
    """Generate AI explanation for simulation comparison results.

    Args:
        sim_results: Dict with keys: fund_name, period, best_mode,
                     modes (dict of mode -> {xirr, cagr, max_drawdown, total_value})
    """
    cache_key = f"sim_explain:{sim_results.get('fund_name', '')}:{sim_results.get('period', '')}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    modes_str = ""
    for mode, data in (sim_results.get("modes") or {}).items():
        modes_str += (
            f"  {mode}: XIRR={data.get('xirr', '?')}%, "
            f"Value=₹{data.get('total_value', '?')}, "
            f"MaxDD={data.get('max_drawdown', '?')}%\n"
        )

    prompt = (
        f"Fund: {sim_results.get('fund_name', 'Unknown')}\n"
        f"Period: {sim_results.get('period', 'N/A')}\n"
        f"Best Mode: {sim_results.get('best_mode', 'N/A')}\n"
        f"Results:\n{modes_str}"
        f"Signal Hit Rate: {sim_results.get('signal_hit_rate', 'N/A')}%\n"
        f"\nExplain why {sim_results.get('best_mode', 'the best mode')} won."
    )

    result = _call_claude(SIMULATION_SYSTEM, prompt, max_tokens=250)
    if result:
        _log_feature("simulation_explainer")
        _cache_set(cache_key, result, 7200)  # 2 hours
        return result

    best = sim_results.get("best_mode", "SIP+Signals")
    return f"{best} outperformed other modes in this simulation period."


# ── Feature 4: Sector Playbook ───────────────────────────────────────────────

SECTOR_SYSTEM = (
    "You are MF Pulse's sector rotation analyst. Given the current sector "
    "quadrant positions (Leading/Improving/Weakening/Lagging), generate a "
    "2-3 sentence rotation playbook. Be specific about which sectors to "
    "overweight/underweight and why. Reference RS scores. No markdown."
)


def generate_sector_playbook(sector_data: dict) -> str:
    """Generate AI sector rotation playbook.

    Args:
        sector_data: Dict with keys: regime, sectors (list of {name, quadrant, rs_score})
    """
    cache_key = f"sector_playbook:{sector_data.get('regime', '')}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    sectors_str = "\n".join(
        f"  {s.get('name', '?')}: {s.get('quadrant', '?')} (RS={s.get('rs_score', '?')})"
        for s in (sector_data.get("sectors") or [])[:12]
    )

    prompt = (
        f"Market Regime: {sector_data.get('regime', 'N/A')}\n"
        f"Sectors:\n{sectors_str}\n"
        f"\nGenerate the sector rotation playbook."
    )

    result = _call_claude(SECTOR_SYSTEM, prompt, max_tokens=200)
    if result:
        _log_feature("sector_playbook")
        _cache_set(cache_key, result, 3600)
        return result

    return "Review sector RS scores and quadrant positions for rotation opportunities."


# ── Feature 5: Regime Actions ────────────────────────────────────────────────

REGIME_SYSTEM = (
    "You are MF Pulse's regime-aware advisor. Given the current market regime "
    "and fund universe stats, suggest exactly 3 actionable recommendations. "
    "Return as JSON array: [{\"title\": \"...\", \"description\": \"...\", "
    "\"action_type\": \"positive|warning|neutral\"}]. "
    "Be specific to Indian mutual funds. Each description is 1 sentence."
)


def generate_regime_actions(regime_data: dict) -> list[dict]:
    """Generate regime-aware action recommendations.

    Args:
        regime_data: Dict with keys: regime, sentiment_score, breadth,
                     top_category, avoid_count
    """
    cache_key = f"regime_actions:{regime_data.get('regime', '')}"
    cached = _cache_get(cache_key)
    if cached:
        import json
        try:
            return json.loads(cached)
        except Exception:
            pass

    prompt = (
        f"Market Regime: {regime_data.get('regime', 'N/A')}\n"
        f"Sentiment: {regime_data.get('sentiment_score', 'N/A')}/100\n"
        f"Breadth: {regime_data.get('breadth', 'N/A')}\n"
        f"Top Performing Category: {regime_data.get('top_category', 'N/A')}\n"
        f"Avoid Zone Funds: {regime_data.get('avoid_count', 'N/A')}\n"
        f"\nGenerate 3 regime-specific actions as JSON array."
    )

    result = _call_claude(REGIME_SYSTEM, prompt, max_tokens=400)
    if result:
        import json
        _log_feature("regime_actions")
        try:
            start = result.index("[")
            end = result.rindex("]") + 1
            actions = json.loads(result[start:end])
            _cache_set(cache_key, json.dumps(actions), 3600)
            return actions
        except (ValueError, json.JSONDecodeError):
            logger.warning("Failed to parse regime actions JSON")

    return []


# ── Feature 6: Fund Verdict ──────────────────────────────────────────────────

VERDICT_SYSTEM = (
    "You are MF Pulse's fund analyst. Generate a one-line verdict (max 15 words) "
    "for this fund based on its lens scores and classification. Be direct and "
    "actionable. Examples: 'Strong alpha generator with low risk — ideal for "
    "core allocation.' or 'Expensive underperformer — consider switching to "
    "direct plan.' No markdown, no bullet points."
)


def generate_fund_verdict(fund_data: dict) -> str:
    """Generate a one-line AI verdict for a fund.

    Args:
        fund_data: Dict with keys: fund_name, category, return_score, risk_score,
                   alpha_score, consistency_score, efficiency_score, headline_tag
    """
    cache_key = f"verdict:{fund_data.get('mstar_id', '')}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    prompt = (
        f"Fund: {fund_data.get('fund_name', 'Unknown')} ({fund_data.get('category', '')})\n"
        f"Scores: Return={fund_data.get('return_score', '?')}/100, "
        f"Risk={fund_data.get('risk_score', '?')}/100, "
        f"Alpha={fund_data.get('alpha_score', '?')}/100, "
        f"Consistency={fund_data.get('consistency_score', '?')}/100, "
        f"Efficiency={fund_data.get('efficiency_score', '?')}/100\n"
        f"Current Tag: {fund_data.get('headline_tag', 'N/A')}\n"
        f"\nGenerate a one-line verdict."
    )

    result = _call_claude(VERDICT_SYSTEM, prompt, max_tokens=60)
    if result:
        _log_feature("fund_verdict")
        _cache_set(cache_key, result.strip(), 86400)  # 24 hours
        return result.strip()

    return fund_data.get("headline_tag", "")


# ── Feature 7: Strategy NL Parser ────────────────────────────────────────────

NL_PARSER_SYSTEM = (
    "You are MF Pulse's query parser. Convert a natural-language fund search "
    "query into structured filter criteria. Return ONLY a JSON object with these "
    "optional keys: category (string), min_return_score (number 0-100), "
    "min_alpha_score (number 0-100), min_risk_score (number 0-100), "
    "min_consistency_score (number 0-100), max_expense_ratio (number), "
    "broad_category (Equity|Debt|Hybrid), amc (string), "
    "sort_by (return_score|alpha_score|risk_score), limit (number). "
    "Only include keys that the query specifies. Return raw JSON, no markdown."
)


def parse_strategy_query(query: str) -> dict:
    """Parse a natural-language strategy query into filter criteria.

    Args:
        query: Natural language like "Top 5 large cap funds with alpha above 70"

    Returns:
        Dict of filter criteria
    """
    if not query or len(query) < 5:
        return {}

    cache_key = f"nl_parse:{query[:100]}"
    cached = _cache_get(cache_key)
    if cached:
        import json
        try:
            return json.loads(cached)
        except Exception:
            pass

    result = _call_claude(NL_PARSER_SYSTEM, query, max_tokens=200)
    if result:
        import json
        _log_feature("nl_parser")
        try:
            # Find JSON object in response
            start = result.index("{")
            end = result.rindex("}") + 1
            parsed = json.loads(result[start:end])
            _cache_set(cache_key, json.dumps(parsed), 1800)  # 30 min
            return parsed
        except (ValueError, json.JSONDecodeError):
            logger.warning("Failed to parse NL query result")

    return {}


# ── Usage tracking ───────────────────────────────────────────────────────────

def _log_feature(feature: str) -> None:
    """Tag the most recent usage log entry with its feature name."""
    if _USAGE_LOG:
        _USAGE_LOG[-1]["feature"] = feature


def get_usage_stats() -> dict:
    """Return usage statistics for the admin dashboard."""
    import time as _time
    now = _time.time()
    month_start = now - (30 * 86400)

    monthly = [u for u in _USAGE_LOG if u["time"] > month_start]
    total_input = sum(u.get("input_tokens", 0) for u in monthly)
    total_output = sum(u.get("output_tokens", 0) for u in monthly)

    # Haiku pricing: $0.80/1M input, $4.00/1M output
    cost_input = (total_input / 1_000_000) * 0.80
    cost_output = (total_output / 1_000_000) * 4.00
    total_cost = cost_input + cost_output

    # Feature breakdown
    feature_counts: dict[str, int] = {}
    feature_tokens: dict[str, int] = {}
    for u in monthly:
        feat = u.get("feature", "unknown")
        feature_counts[feat] = feature_counts.get(feat, 0) + 1
        feature_tokens[feat] = feature_tokens.get(feat, 0) + u.get("input_tokens", 0) + u.get("output_tokens", 0)

    return {
        "total_calls": len(monthly),
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "estimated_cost_usd": round(total_cost, 4),
        "model": MODEL,
        "feature_breakdown": [
            {"feature": k, "calls": feature_counts[k], "tokens": feature_tokens.get(k, 0)}
            for k in sorted(feature_counts.keys())
        ],
        "cache_entries": len(_CACHE),
    }
