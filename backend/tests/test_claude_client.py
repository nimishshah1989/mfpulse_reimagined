"""Tests for Claude client service — validates caching, fallbacks, and JSON parsing."""

import json
from unittest.mock import patch, MagicMock

import pytest

from app.services.claude_client import (
    _cache_get,
    _cache_set,
    _CACHE,
    generate_morning_briefing,
    generate_fund_verdict,
    generate_simulation_explainer,
    generate_strategy_insights,
    generate_sector_playbook,
    generate_regime_actions,
    parse_strategy_query,
    get_usage_stats,
)


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear cache between tests."""
    _CACHE.clear()
    yield
    _CACHE.clear()


class TestCaching:
    def test_cache_set_and_get(self):
        _cache_set("test_key", "test_value", 3600)
        assert _cache_get("test_key") == "test_value"

    def test_cache_miss(self):
        assert _cache_get("nonexistent") is None

    def test_cache_expired(self):
        _cache_set("expired", "old_value", -1)  # Already expired
        assert _cache_get("expired") is None


class TestMorningBriefing:
    @patch("app.services.claude_client._call_claude", return_value=None)
    def test_fallback_on_api_failure(self, mock_claude):
        result = generate_morning_briefing({
            "regime": "BULL",
            "nifty_value": "22500",
            "nifty_change_pct": "+0.5",
        })
        assert "BULL" in result
        assert "22500" in result

    @patch("app.services.claude_client._call_claude")
    def test_returns_ai_text(self, mock_claude):
        mock_claude.return_value = "Markets are bullish. Consider SIPs."
        result = generate_morning_briefing({"regime": "BULL"})
        assert result == "Markets are bullish. Consider SIPs."

    @patch("app.services.claude_client._call_claude")
    def test_caches_result(self, mock_claude):
        mock_claude.return_value = "Cached briefing"
        generate_morning_briefing({"regime": "BULL"})
        # Second call should use cache, not API
        mock_claude.return_value = "New briefing"
        result = generate_morning_briefing({"regime": "BULL"})
        assert result == "Cached briefing"
        assert mock_claude.call_count == 1


class TestFundVerdict:
    @patch("app.services.claude_client._call_claude", return_value=None)
    def test_fallback_to_headline(self, mock_claude):
        result = generate_fund_verdict({
            "mstar_id": "F0GBR06S2Q",
            "headline_tag": "Consistent alpha generator",
        })
        assert result == "Consistent alpha generator"

    @patch("app.services.claude_client._call_claude")
    def test_returns_ai_verdict(self, mock_claude):
        mock_claude.return_value = "Strong performer, ideal for core allocation."
        result = generate_fund_verdict({"mstar_id": "F0GBR06S2Q"})
        assert "Strong performer" in result


class TestSimulationExplainer:
    @patch("app.services.claude_client._call_claude", return_value=None)
    def test_fallback(self, mock_claude):
        result = generate_simulation_explainer({
            "best_mode": "SIP_SIGNAL",
            "modes": {},
        })
        assert "SIP_SIGNAL" in result

    @patch("app.services.claude_client._call_claude")
    def test_returns_explanation(self, mock_claude):
        mock_claude.return_value = "SIP+Signals won because dips were bought."
        result = generate_simulation_explainer({
            "fund_name": "HDFC Flexi Cap",
            "best_mode": "SIP_SIGNAL",
            "modes": {"SIP": {"xirr": 12}, "SIP_SIGNAL": {"xirr": 15}},
        })
        assert "dips" in result


class TestStrategyInsights:
    @patch("app.services.claude_client._call_claude", return_value=None)
    def test_empty_on_failure(self, mock_claude):
        result = generate_strategy_insights({"funds": []})
        assert result == []

    @patch("app.services.claude_client._call_claude")
    def test_parses_json_array(self, mock_claude):
        mock_claude.return_value = json.dumps([
            {"type": "positive", "title": "Alpha Edge", "text": "Good alpha."},
        ])
        result = generate_strategy_insights({"id": "test"})
        assert len(result) == 1
        assert result[0]["title"] == "Alpha Edge"


class TestSectorPlaybook:
    @patch("app.services.claude_client._call_claude", return_value=None)
    def test_fallback(self, mock_claude):
        result = generate_sector_playbook({"sectors": []})
        assert "sector" in result.lower() or "rotation" in result.lower()


class TestRegimeActions:
    @patch("app.services.claude_client._call_claude")
    def test_parses_json_array(self, mock_claude):
        mock_claude.return_value = json.dumps([
            {"title": "Buy dips", "description": "Deploy on corrections.", "action_type": "positive"},
        ])
        result = generate_regime_actions({"regime": "BULL"})
        assert len(result) == 1
        assert result[0]["title"] == "Buy dips"


class TestNLParser:
    @patch("app.services.claude_client._call_claude")
    def test_parses_json_object(self, mock_claude):
        mock_claude.return_value = json.dumps({
            "category": "Large Cap",
            "min_alpha_score": 70,
            "limit": 5,
        })
        result = parse_strategy_query("Top 5 large cap funds with alpha above 70")
        assert result["category"] == "Large Cap"
        assert result["min_alpha_score"] == 70

    def test_empty_query(self):
        result = parse_strategy_query("")
        assert result == {}


class TestUsageStats:
    def test_returns_dict(self):
        stats = get_usage_stats()
        assert "total_calls" in stats
        assert "estimated_cost_usd" in stats
        assert "model" in stats
        assert "feature_breakdown" in stats
