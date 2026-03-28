"""MF Pulse Engine — FastAPI application."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.api.v1.router import api_v1_router
from app.core.config import get_settings
from app.core.database import check_db_connection
from app.core.exceptions import MFPulseError

logger = logging.getLogger("mf_pulse")

settings = get_settings()


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
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
        except Exception as e:
            logger.error("Failed to start scheduler: %s", e)

    yield

    # Stop scheduler on shutdown
    if scheduler:
        scheduler.stop()
        logger.info("Job scheduler stopped")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(MFPulseError)
async def mfpulse_error_handler(request: Request, exc: MFPulseError) -> JSONResponse:
    status_map = {
        "NOT_FOUND": 404,
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
    db_ok = check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "version": settings.app_version,
    }


# Static frontend serving via middleware.
# Middleware intercepts BEFORE routing but we explicitly skip /api paths,
# so API routes always work. Non-API paths get served from web/out/.
_frontend_dir = Path("web/out")
if _frontend_dir.is_dir():

    class FrontendMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next) -> Response:
            path = request.url.path

            # Let API, docs, and health through to FastAPI
            if path.startswith(("/api/", "/health", "/docs", "/redoc", "/openapi")):
                return await call_next(request)

            clean = path.strip("/")

            # Exact file (favicon.ico, robots.txt)
            if clean:
                file_path = _frontend_dir / clean
                if file_path.is_file():
                    return FileResponse(str(file_path))

            # _next assets
            if clean.startswith("_next/"):
                asset = _frontend_dir / clean
                if asset.is_file():
                    return FileResponse(str(asset))
                return JSONResponse(status_code=404, content={"error": "Asset not found"})

            # Page directory (/fund360 -> /fund360/index.html)
            if clean:
                page_index = _frontend_dir / clean / "index.html"
                if page_index.is_file():
                    return FileResponse(str(page_index))

            # Root or SPA fallback
            root_index = _frontend_dir / "index.html"
            if root_index.is_file():
                return FileResponse(str(root_index))

            return await call_next(request)

    app.add_middleware(FrontendMiddleware)
