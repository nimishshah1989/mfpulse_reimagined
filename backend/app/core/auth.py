"""Admin authentication dependency for mutation endpoints."""

from fastapi import Request

from app.core.config import get_settings
from app.core.exceptions import MFPulseError


def require_admin_key(request: Request) -> None:
    """Require X-Admin-Key header for mutation endpoints.

    Disabled when ADMIN_API_KEY env var is empty (dev mode).
    """
    settings = get_settings()
    key = getattr(settings, "admin_api_key", "")
    if not key:
        return  # Disabled in dev
    if request.headers.get("X-Admin-Key") != key:
        raise MFPulseError(
            message="Invalid or missing admin key",
            code="UNAUTHORIZED",
        )
