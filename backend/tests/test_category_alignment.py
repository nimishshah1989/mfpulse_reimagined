"""Tests for category quadrant alignment endpoint."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_category_alignment_returns_list():
    """Endpoint returns a list of category alignment objects."""
    resp = client.get("/api/v1/sectors/category-alignment")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)


def test_category_alignment_shape():
    """Each item has required fields with correct types."""
    resp = client.get("/api/v1/sectors/category-alignment")
    data = resp.json()["data"]
    if len(data) == 0:
        pytest.skip("No alignment data available")
    item = data[0]
    assert "category_name" in item
    assert "fund_count" in item
    assert "leading_pct" in item
    assert "improving_pct" in item
    assert "weakening_pct" in item
    assert "lagging_pct" in item
    assert "tailwind_pct" in item
    assert "headwind_pct" in item
    # Percentages sum to ~100
    total = item["leading_pct"] + item["improving_pct"] + item["weakening_pct"] + item["lagging_pct"]
    assert 98 <= total <= 102  # Allow small rounding


def test_category_alignment_sorted_by_tailwind():
    """Results are sorted by tailwind_pct descending."""
    resp = client.get("/api/v1/sectors/category-alignment")
    data = resp.json()["data"]
    if len(data) < 2:
        pytest.skip("Not enough data")
    tailwinds = [d["tailwind_pct"] for d in data]
    assert tailwinds == sorted(tailwinds, reverse=True)
