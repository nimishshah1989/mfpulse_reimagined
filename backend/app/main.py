"""MF Pulse Engine — FastAPI application."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

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


# Static frontend serving — mounted AFTER all API routes
# Uses a sub-application so it never intercepts /api/* or /health
_frontend_dir = Path("web/out")
if _frontend_dir.is_dir():
    # Create a separate FastAPI app for frontend so it doesn't interfere
    _frontend_app = FastAPI()

    # Serve Next.js static assets
    _next_dir = _frontend_dir / "_next"
    if _next_dir.is_dir():
        _frontend_app.mount("/_next", StaticFiles(directory=str(_next_dir)), name="next_assets")

    @_frontend_app.get("/{full_path:path}")
    async def _serve_page(full_path: str):
        # Exact file (favicon.ico, etc.)
        file_path = _frontend_dir / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # Page directory (e.g. /fund360 -> /fund360/index.html)
        page_index = _frontend_dir / full_path / "index.html"
        if page_index.is_file():
            return FileResponse(str(page_index))
        # .html extension
        html_path = _frontend_dir / f"{full_path}.html"
        if html_path.is_file():
            return FileResponse(str(html_path))
        # SPA fallback
        root_index = _frontend_dir / "index.html"
        if root_index.is_file():
            return FileResponse(str(root_index))
        return JSONResponse(status_code=404, content={"error": "Not found"})

    # Mount at root — but as a sub-app, it only handles requests that
    # don't match any route in the main app (API routes take priority)
    app.mount("/", _frontend_app)
