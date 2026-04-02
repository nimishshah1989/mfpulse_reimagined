"""Shared test fixtures."""

import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _ensure_test_db_url(monkeypatch: pytest.MonkeyPatch) -> None:
    """Set DATABASE_URL for every test via monkeypatch (auto-reverts after each test)."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")


@pytest.fixture
def client() -> TestClient:
    from app.core.config import clear_all_config_caches
    clear_all_config_caches()
    from app.main import app
    return TestClient(app)
