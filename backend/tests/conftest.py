"""Shared test fixtures."""

import os

import pytest
from fastapi.testclient import TestClient

# Set test database URL before any app imports
os.environ["DATABASE_URL"] = "postgresql://fie:changeme@localhost:5432/mf_pulse"


@pytest.fixture
def client() -> TestClient:
    from app.main import app
    return TestClient(app)
