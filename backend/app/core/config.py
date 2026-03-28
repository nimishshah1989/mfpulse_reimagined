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

    # MarketPulse bridge
    marketpulse_base_url: str = "http://localhost:8000"
    marketpulse_timeout_seconds: int = 30

    # Data feeds
    feed_csv_dir: str = "/app/data_feeds"

    # Anthropic (Claude API for narrative generation)
    anthropic_api_key: str = ""

    # Admin
    admin_api_key: str = ""

    # Scheduler
    scheduler_enabled: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
