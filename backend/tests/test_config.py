"""Tests for config loading and validation."""

import os

import pytest


def test_settings_loads_from_env() -> None:
    """Settings should load DATABASE_URL from environment."""
    os.environ["DATABASE_URL"] = "postgresql://fie:test@localhost:5432/mf_pulse"

    # Clear lru_cache to force reload
    from app.core.config import get_settings
    get_settings.cache_clear()

    settings = get_settings()
    assert settings.database_url == "postgresql://fie:test@localhost:5432/mf_pulse"
    assert settings.app_name == "MF Pulse Engine"
    assert settings.app_version == "0.1.0"

    # Reset
    get_settings.cache_clear()


def test_settings_missing_database_url_raises() -> None:
    """Settings must fail loudly when DATABASE_URL is missing."""
    from app.core.config import get_settings
    get_settings.cache_clear()

    # Remove DATABASE_URL
    original = os.environ.pop("DATABASE_URL", None)
    try:
        from pydantic import ValidationError as PydanticValidationError
        with pytest.raises(PydanticValidationError):
            # Force fresh construction bypassing cache
            from app.core.config import Settings
            Settings(_env_file=None)
    finally:
        if original is not None:
            os.environ["DATABASE_URL"] = original
        get_settings.cache_clear()


def test_cors_origin_list() -> None:
    """CORS origins should parse comma-separated string into list."""
    os.environ["DATABASE_URL"] = "postgresql://fie:test@localhost:5432/mf_pulse"

    from app.core.config import get_settings
    get_settings.cache_clear()

    settings = get_settings()
    origins = settings.cors_origin_list
    assert isinstance(origins, list)
    assert len(origins) >= 1

    get_settings.cache_clear()
