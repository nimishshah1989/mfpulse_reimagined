"""Tests for config loading and validation."""

import pytest


def test_settings_loads_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings should load DATABASE_URL from environment."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://fie:test@localhost:5432/mf_pulse")

    from app.core.config import get_settings, clear_all_config_caches
    clear_all_config_caches()

    settings = get_settings()
    assert settings.database_url == "postgresql://fie:test@localhost:5432/mf_pulse"
    assert settings.app_name == "MF Pulse Engine"
    assert settings.app_version == "0.1.0"

    clear_all_config_caches()


def test_settings_missing_database_url_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings must fail loudly when DATABASE_URL is missing."""
    monkeypatch.delenv("DATABASE_URL", raising=False)

    from app.core.config import clear_all_config_caches
    clear_all_config_caches()

    from pydantic import ValidationError as PydanticValidationError
    with pytest.raises(PydanticValidationError):
        from app.core.config import Settings
        Settings(_env_file=None)

    clear_all_config_caches()


def test_cors_origin_list(monkeypatch: pytest.MonkeyPatch) -> None:
    """CORS origins should parse comma-separated string into list."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://fie:test@localhost:5432/mf_pulse")

    from app.core.config import get_settings, clear_all_config_caches
    clear_all_config_caches()

    settings = get_settings()
    origins = settings.cors_origin_list
    assert isinstance(origins, list)
    assert len(origins) >= 1

    clear_all_config_caches()


def test_morningstar_config_cache_clears_with_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """Morningstar config caches should invalidate when settings change."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://fie:test@localhost:5432/mf_pulse")

    from app.core.config import clear_all_config_caches
    from app.core.morningstar_config import _build_apis

    clear_all_config_caches()
    apis1 = _build_apis()

    monkeypatch.setenv("MORNINGSTAR_HASH_IDENTIFIER", "test_changed_hash")
    clear_all_config_caches()
    apis2 = _build_apis()

    assert apis1[0][0].hash != apis2[0][0].hash
    clear_all_config_caches()
