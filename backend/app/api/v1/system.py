"""System endpoints: health check, config."""

import time

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.database import check_db_connection
from app.models.schemas.responses import (
    APIResponse,
    HealthResponse,
    Meta,
    SystemConfigResponse,
)

router = APIRouter(prefix="/system", tags=["system"])

_start_time = time.monotonic()


@router.get("/health", response_model=APIResponse[HealthResponse])
def system_health() -> APIResponse[HealthResponse]:
    settings = get_settings()
    db_ok = check_db_connection()
    uptime = time.monotonic() - _start_time

    health = HealthResponse(
        status="ok" if db_ok else "degraded",
        database="connected" if db_ok else "disconnected",
        version=settings.app_version,
        uptime_seconds=round(uptime, 2),
        timestamp=Meta().timestamp,
    )

    return APIResponse(success=True, data=health)


@router.get("/config", response_model=APIResponse[SystemConfigResponse])
def system_config() -> APIResponse[SystemConfigResponse]:
    settings = get_settings()

    config = SystemConfigResponse(
        app_version=settings.app_version,
        app_env=settings.app_env,
        scheduler_enabled=settings.scheduler_enabled,
        feed_csv_dir=settings.feed_csv_dir,
    )

    return APIResponse(success=True, data=config)
