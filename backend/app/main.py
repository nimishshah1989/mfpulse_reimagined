"""MF Pulse Engine — FastAPI application."""

import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.api.v1.router import api_v1_router
from app.core.auth import validate_admin_key_configured
from app.core.config import get_settings
from app.core.database import check_db_connection
from app.core.exceptions import MFPulseError

logger = logging.getLogger("mf_pulse")

settings = get_settings()


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    # Fail fast if production is missing ADMIN_API_KEY
    validate_admin_key_configured()

    db_ok = check_db_connection()
    logger.info(
        "MF Pulse Engine starting",
        extra={
            "version": settings.app_version,
            "environment": settings.app_env,
            "database": "connected" if db_ok else "DISCONNECTED",
        },
    )

    # Start scheduler if enabled
    scheduler = None
    if settings.scheduler_enabled:
        try:
            from app.core.database import SessionLocal
            from app.jobs.scheduler import JobScheduler
            from app.api.v1.jobs import set_scheduler

            scheduler = JobScheduler(SessionLocal)
            scheduler.start()
            set_scheduler(scheduler)
            logger.info("Job scheduler started")

            # Prime MarketPulse cache on startup (background, non-blocking)
            import threading
            def _prime_mp_cache():
                try:
                    from app.services.marketpulse_client import MarketPulseClient
                    db_session = SessionLocal()
                    try:
                        client = MarketPulseClient(
                            base_url=settings.marketpulse_base_url,
                            timeout=min(settings.marketpulse_timeout_seconds, 10),
                            db=db_session,
                        )
                        results = client.sync_all()
                        ok = sum(1 for v in results.values() if v)
                        logger.info("Startup MP cache prime: %d/%d endpoints cached", ok, len(results))
                    finally:
                        db_session.close()
                except Exception as e:
                    logger.warning("Startup MP cache prime failed (non-fatal): %s", e)
            threading.Thread(target=_prime_mp_cache, daemon=True).start()
        except Exception as e:
            logger.error("Failed to start scheduler: %s", e)

    yield

    # Stop scheduler on shutdown
    if scheduler:
        scheduler.stop()
        logger.info("Job scheduler stopped")


_is_dev = settings.app_env == "development"

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if _is_dev else None,
    redoc_url="/redoc" if _is_dev else None,
    openapi_url="/openapi.json" if _is_dev else None,
    lifespan=lifespan,
)

# CORS — tightened from allow-all to specific methods/headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID", "X-Admin-Key"],
)

# GZip compression for responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if not request.url.path.startswith("/api/"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data:; "
                "connect-src 'self' https://api.anthropic.com"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)


# Request logging middleware
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())[:8]
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 1)
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        response.headers["X-Request-ID"] = request_id
        return response


app.add_middleware(RequestLoggingMiddleware)


# Cache-Control middleware for GET endpoints
class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        if request.method == "GET" and response.status_code == 200:
            path = request.url.path
            if path.startswith("/api/v1/market/"):
                response.headers["Cache-Control"] = "public, max-age=3600"  # 1h — DB-cached data
            elif path.startswith("/api/v1/"):
                response.headers["Cache-Control"] = "public, max-age=300"
        return response


app.add_middleware(CacheControlMiddleware)


# Global exception handler
@app.exception_handler(MFPulseError)
async def mfpulse_error_handler(request: Request, exc: MFPulseError) -> JSONResponse:
    status_map = {
        "NOT_FOUND": 404,
        "UNAUTHORIZED": 401,
        "VALIDATION_ERROR": 422,
        "INGESTION_ERROR": 502,
        "MORNINGSTAR_ERROR": 502,
        "MARKETPULSE_ERROR": 502,
        "ENGINE_ERROR": 500,
        "INTERNAL_ERROR": 500,
    }
    status_code = status_map.get(exc.code, 500)

    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
        },
    )


# Mount API router
app.include_router(api_v1_router)


# Root health endpoint (outside /api/v1)
@app.get("/health")
def health() -> dict:
    from app.core.database import SessionLocal
    db_ok = check_db_connection()
    result = {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "version": settings.app_version,
        "fund_count": 0,
        "latest_nav_date": None,
        "lens_score_count": 0,
    }
    if db_ok:
        try:
            from sqlalchemy import text
            db = SessionLocal()
            try:
                row = db.execute(text(
                    "SELECT count(*) FROM fund_master WHERE is_eligible = true"
                )).scalar()
                result["fund_count"] = row or 0
                nav_date = db.execute(text(
                    "SELECT max(nav_date) FROM nav_daily"
                )).scalar()
                result["latest_nav_date"] = str(nav_date) if nav_date else None
                lens_count = db.execute(text(
                    "SELECT count(*) FROM fund_lens_scores"
                )).scalar()
                result["lens_score_count"] = lens_count or 0
            finally:
                db.close()
        except Exception:
            pass
    return result


@app.get("/health/ready")
def health_ready() -> JSONResponse:
    """Returns 200 only when system has sufficient data to serve requests."""
    from app.core.database import SessionLocal
    db_ok = check_db_connection()
    if not db_ok:
        return JSONResponse(
            status_code=503,
            content={"ready": False, "reason": "database disconnected"},
        )
    try:
        from sqlalchemy import text
        db = SessionLocal()
        try:
            fund_count = db.execute(text(
                "SELECT count(*) FROM fund_master WHERE is_eligible = true"
            )).scalar() or 0
            lens_count = db.execute(text(
                "SELECT count(*) FROM fund_lens_scores"
            )).scalar() or 0
        finally:
            db.close()
        if fund_count < 1000:
            return JSONResponse(
                status_code=503,
                content={"ready": False, "reason": f"insufficient funds: {fund_count}"},
            )
        if lens_count == 0:
            return JSONResponse(
                status_code=503,
                content={"ready": False, "reason": "no lens scores computed"},
            )
        return JSONResponse(
            status_code=200,
            content={"ready": True, "fund_count": fund_count, "lens_count": lens_count},
        )
    except Exception:
        logger.exception("health/ready check failed")
        return JSONResponse(
            status_code=503,
            content={"ready": False, "reason": "internal error during readiness check"},
        )


# Static frontend serving via middleware.
# Middleware intercepts BEFORE routing but we explicitly skip /api paths,
# so API routes always work. Non-API paths get served from web/out/.
_frontend_dir = Path("web/out")
if _frontend_dir.is_dir():

    _resolved_frontend = _frontend_dir.resolve()

    def _safe_resolve(child_path: Path) -> Path | None:
        """Resolve a path and return it only if it stays inside _frontend_dir."""
        resolved = child_path.resolve()
        if resolved.is_relative_to(_resolved_frontend):
            return resolved
        return None

    class FrontendMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next) -> Response:
            path = request.url.path

            # Let API, docs, and health through to FastAPI
            if path.startswith(("/api/", "/health", "/docs", "/redoc", "/openapi")):
                return await call_next(request)

            clean = path.strip("/")

            # Reject any path component that tries to escape
            if ".." in clean:
                return JSONResponse(status_code=400, content={"error": "Invalid path"})

            # Exact file (favicon.ico, robots.txt)
            if clean:
                file_path = _frontend_dir / clean
                safe = _safe_resolve(file_path)
                if safe and safe.is_file():
                    return FileResponse(str(safe))

            # _next assets
            if clean.startswith("_next/"):
                asset = _frontend_dir / clean
                safe = _safe_resolve(asset)
                if safe and safe.is_file():
                    return FileResponse(str(safe))
                return JSONResponse(status_code=404, content={"error": "Asset not found"})

            # /fund/<id> → serve fund360 page (client-side routing)
            if clean.startswith("fund/") and not clean.startswith("fund360"):
                fund360_page = _frontend_dir / "fund360" / "index.html"
                if fund360_page.is_file():
                    return FileResponse(str(fund360_page))

            # /portfolio/<id> → serve portfolio/[id] page (client-side routing)
            if clean.startswith("portfolio/") and clean != "portfolio":
                portfolio_page = _frontend_dir / "portfolio" / "[id]" / "index.html"
                if portfolio_page.is_file():
                    return FileResponse(str(portfolio_page))

            # Page directory (/fund360 -> /fund360/index.html)
            if clean:
                page_index = _frontend_dir / clean / "index.html"
                safe = _safe_resolve(page_index)
                if safe and safe.is_file():
                    return FileResponse(str(safe))

            # Root or SPA fallback
            root_index = _frontend_dir / "index.html"
            if root_index.is_file():
                return FileResponse(str(root_index))

            # Nothing matched — return 404 page if it exists, else JSON 404
            not_found_page = _frontend_dir / "404" / "index.html"
            if not_found_page.is_file():
                return FileResponse(str(not_found_page), status_code=404)
            return JSONResponse(
                status_code=404,
                content={"success": False, "data": None, "error": {"code": "NOT_FOUND", "message": "Page not found"}},
            )

    app.add_middleware(FrontendMiddleware)


# Catch-all for unhandled exceptions — return proper JSON, never a bare 500
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {},
            },
        },
    )
