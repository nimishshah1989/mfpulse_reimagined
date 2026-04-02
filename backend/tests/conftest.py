"""Shared test fixtures."""

import os

# Set before any app imports — modules like app.core.database read settings at import time.
# setdefault so an explicit env var (e.g. in CI) takes precedence.
os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _ensure_test_db_url(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pin DATABASE_URL per-test via monkeypatch (auto-reverts after each test)."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")


@pytest.fixture
def client() -> TestClient:
    from app.core.config import clear_all_config_caches
    clear_all_config_caches()
    from app.main import app
    return TestClient(app)
