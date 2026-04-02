"""Admin authentication dependency for mutation endpoints."""

import logging

from fastapi import Request

from app.core.config import get_settings
from app.core.exceptions import MFPulseError

logger = logging.getLogger(__name__)


def require_admin_key(request: Request) -> None:
    """Require X-Admin-Key header for mutation endpoints.

    In production (app_env != "development"), ADMIN_API_KEY must be set.
    In development, auth is skipped if the key is empty.
    """
    settings = get_settings()
    key = settings.admin_api_key
    if not key:
        if settings.app_env != "development":
            raise MFPulseError(
                message="Server misconfiguration: admin auth not available",
                code="INTERNAL_ERROR",
            )
        return  # Disabled in dev
    if request.headers.get("X-Admin-Key") != key:
        raise MFPulseError(
            message="Invalid or missing admin key",
            code="UNAUTHORIZED",
        )


def validate_admin_key_configured() -> None:
    """Called at startup. Refuses to start in production without ADMIN_API_KEY."""
    settings = get_settings()
    if settings.app_env != "development" and not settings.admin_api_key:
        raise RuntimeError(
            "ADMIN_API_KEY must be set in production. "
            "Set APP_ENV=development to disable auth for local dev."
        )
