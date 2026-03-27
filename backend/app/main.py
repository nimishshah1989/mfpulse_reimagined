"""MF Pulse Engine — FastAPI application."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
    yield


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


# Static frontend serving (Sprint 3)
try:
    app.mount("/", StaticFiles(directory="web/out", html=True), name="frontend")
except Exception:
    pass  # No frontend build yet — that's fine
