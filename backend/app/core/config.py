"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """MF Pulse configuration. Validates all required env vars at startup."""

    # App
    app_name: str = "MF Pulse Engine"
    app_version: str = "0.1.0"
    app_env: str = "development"
    app_port: int = 8000
    log_level: str = "INFO"

    # Database
    database_url: str

    # CORS
    cors_origins: str = "http://localhost:3000,https://mfpulse.jslwealth.in"

    # Morningstar
    morningstar_api_url: str = ""
    morningstar_username: str = ""
    morningstar_password: str = ""
    morningstar_access_code: str = ""
    morningstar_universe_code: str = "hoi7dvf1dvm67w36"
    morningstar_api_base: str = "https://api.morningstar.com/v2/service/mf"
    morningstar_hash_identifier: str = "l308tct18q1h759g"
    morningstar_hash_additional: str = "lhqwwmpfryy07xct"
    morningstar_hash_category: str = "ssjwhtlzv3e4vw1c"
    morningstar_hash_nav: str = "n0fys3tcvprq4375"
    morningstar_hash_returns: str = "fhqbikngn12un6yk"
    morningstar_hash_risk: str = "qmaym0ulfsyb83j7"
    morningstar_hash_ranks: str = "c6ey0lob8683mm5d"
    morningstar_hash_catreturns: str = "msncecvsohvimjkx"
    morningstar_hash_holdings: str = "s4bqvv72rjpelvwf"
    morningstar_hash_portfolio_summary: str = "ryt74bh4koatkf2w"
    morningstar_hash_holdings_detail: str = "fq9mxhk7xeb20f3b"
    morningstar_hash_extended_risk: str = "x7jihr9d49jb9f6d"

    # MarketPulse bridge
    marketpulse_base_url: str = "http://localhost:8000"
    marketpulse_timeout_seconds: int = 30

    # Data feeds
    feed_csv_dir: str = "/app/data_feeds"

    # Anthropic (Claude API for narrative generation)
    anthropic_api_key: str = ""

    # Admin
    admin_api_key: str = ""

    # Simulation
    risk_free_rate_annual: str = "0.06"  # 6% — used for Sharpe/Sortino ratios

    # Scheduler
    scheduler_enabled: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Registry of caches that depend on settings — cleared together
_dependent_caches: list = []


def register_settings_dependent_cache(cache_clear_fn: object) -> None:
    """Register an lru_cache.cache_clear that must reset when settings change."""
    _dependent_caches.append(cache_clear_fn)


def clear_all_config_caches() -> None:
    """Clear get_settings and all caches derived from it (morningstar_config, etc.)."""
    get_settings.cache_clear()
    for fn in _dependent_caches:
        fn()
