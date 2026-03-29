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
