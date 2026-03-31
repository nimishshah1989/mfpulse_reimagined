"""System endpoints: health check, config, ops scorecard."""

import time

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import check_db_connection, get_db
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


@router.get("/ops-scorecard")
def ops_scorecard(db: Session = Depends(get_db)) -> dict:
    """Ops scoring endpoint — quality, architecture, security, operational metrics.

    Returns real computed metrics for ops.jslwealth.in integration.
    """
    settings = get_settings()
    uptime = time.monotonic() - _start_time
    db_ok = check_db_connection()

    # Data quality metrics
    try:
        fund_count = db.execute(text("SELECT count(*) FROM fund_master WHERE is_eligible = true")).scalar() or 0
        lens_count = db.execute(text("SELECT count(DISTINCT mstar_id) FROM fund_lens_scores")).scalar() or 0
        nav_count = db.execute(text("SELECT count(DISTINCT mstar_id) FROM nav_daily")).scalar() or 0
        risk_count = db.execute(text("SELECT count(DISTINCT mstar_id) FROM risk_stats_monthly")).scalar() or 0
        cache_count = db.execute(text("SELECT count(*) FROM kv_cache")).scalar() or 0
        aum_count = db.execute(text("SELECT count(*) FROM fund_master WHERE latest_aum IS NOT NULL")).scalar() or 0
    except Exception:
        fund_count = nav_count = lens_count = risk_count = cache_count = aum_count = 0

    lens_coverage = round((lens_count / max(fund_count, 1)) * 100, 1)
    nav_coverage = round((nav_count / max(fund_count, 1)) * 100, 1)
    risk_coverage = round((risk_count / max(fund_count, 1)) * 100, 1)
    aum_coverage = round((aum_count / max(fund_count, 1)) * 100, 1)

    # Quality score: data coverage + cache health
    quality_score = round((lens_coverage * 0.3 + nav_coverage * 0.3 + risk_coverage * 0.2 + aum_coverage * 0.2), 1)

    # Architecture score: caching layer, filter system, file structure
    arch_items = [
        cache_count > 0,        # KV cache populated
        aum_count > 0,          # AUM denormalized
        db_ok,                  # Database connected
        uptime > 60,            # Stable uptime
    ]
    architecture_score = round((sum(arch_items) / len(arch_items)) * 100, 1)

    # Security score: basic checks
    security_items = [
        bool(settings.cors_origins),          # CORS configured
        not settings.anthropic_api_key.startswith("sk-ant") if settings.anthropic_api_key else True,  # Not using test key pattern
        settings.app_env != "development",    # Not dev mode in prod
    ]
    security_score = round((sum(security_items) / max(len(security_items), 1)) * 100, 1)

    # Operational score: uptime + database health
    operational_score = 100.0 if db_ok and uptime > 300 else 50.0

    return {
        "success": True,
        "data": {
            "quality_score": quality_score,
            "architecture_score": architecture_score,
            "security_score": security_score,
            "operational_score": operational_score,
            "details": {
                "fund_count": fund_count,
                "lens_coverage_pct": lens_coverage,
                "nav_coverage_pct": nav_coverage,
                "risk_coverage_pct": risk_coverage,
                "aum_coverage_pct": aum_coverage,
                "cache_entries": cache_count,
                "uptime_seconds": round(uptime, 0),
                "database": "connected" if db_ok else "disconnected",
                "version": settings.app_version,
            },
        },
        "meta": {"timestamp": Meta().timestamp},
        "error": None,
    }
