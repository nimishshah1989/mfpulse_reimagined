"""Tests for fund archetypes endpoint."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

ARCHETYPE_NAMES = [
    "All-Rounder", "Alpha but Fragile", "Defensive Anchor",
    "Consistent Compounder", "High Return High Risk", "Efficient Mid-Tier",
    "Watch", "Turnaround Potential", "Trouble Zone",
]


def test_archetypes_returns_list():
    resp = client.get("/api/v1/dashboard/archetypes")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)
    assert len(body["data"]) == 9


def test_archetype_shape():
    resp = client.get("/api/v1/dashboard/archetypes")
    data = resp.json()["data"]
    for item in data:
        assert "archetype_id" in item
        assert "name" in item
        assert "count" in item
        assert "percentage" in item
        assert "lens_pattern" in item
        assert len(item["lens_pattern"]) == 6
        assert "description" in item


def test_archetype_names_match():
    resp = client.get("/api/v1/dashboard/archetypes")
    names = [d["name"] for d in resp.json()["data"]]
    for expected in ARCHETYPE_NAMES:
        assert expected in names


# --- Unit tests for _classify_archetype (no DB needed) ---

from unittest.mock import MagicMock
from app.services.dashboard_service import _classify_archetype


def _mock_classification(**kwargs):
    """Create a mock FundClassification with given tier values."""
    m = MagicMock()
    defaults = {
        "return_class": "AVERAGE", "risk_class": "MODERATE",
        "consistency_class": "MIXED", "alpha_class": "NEUTRAL",
        "efficiency_class": "FAIR", "resilience_class": "FRAGILE",
    }
    defaults.update(kwargs)
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


def _mock_scores():
    return MagicMock()


def test_classify_all_rounder():
    c = _mock_classification(
        return_class="LEADER", risk_class="LOW_RISK",
        consistency_class="ROCK_SOLID", alpha_class="ALPHA_MACHINE",
        efficiency_class="LEAN", resilience_class="FORTRESS",
    )
    assert _classify_archetype(c, _mock_scores()) == "all-rounder"


def test_classify_trouble_zone():
    c = _mock_classification(
        return_class="WEAK", risk_class="HIGH_RISK",
        consistency_class="ERRATIC", alpha_class="NEGATIVE",
        efficiency_class="EXPENSIVE", resilience_class="VULNERABLE",
    )
    assert _classify_archetype(c, _mock_scores()) == "trouble"


def test_classify_compounder_not_swallowed_by_defensive():
    """Regression: compounder must be checked before defensive."""
    c = _mock_classification(
        return_class="STRONG", risk_class="LOW_RISK",
        consistency_class="ROCK_SOLID", alpha_class="NEUTRAL",
        efficiency_class="EXPENSIVE", resilience_class="STURDY",
    )
    assert _classify_archetype(c, _mock_scores()) == "compounder"


def test_classify_defensive():
    c = _mock_classification(
        return_class="AVERAGE", risk_class="LOW_RISK",
        consistency_class="MIXED", alpha_class="NEUTRAL",
        efficiency_class="FAIR", resilience_class="FORTRESS",
    )
    assert _classify_archetype(c, _mock_scores()) == "defensive"


def test_classify_watch():
    c = _mock_classification(
        return_class="AVERAGE", risk_class="LOW_RISK",
        consistency_class="MIXED", alpha_class="NEGATIVE",
        efficiency_class="EXPENSIVE", resilience_class="STURDY",
    )
    assert _classify_archetype(c, _mock_scores()) == "watch"


def test_classify_mid_tier_default():
    c = _mock_classification()  # all defaults: AVERAGE, MODERATE, MIXED, NEUTRAL, FAIR, FRAGILE
    assert _classify_archetype(c, _mock_scores()) == "mid-tier"
