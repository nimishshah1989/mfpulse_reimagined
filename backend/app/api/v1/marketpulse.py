"""API endpoints that proxy MarketPulse data."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.config import get_settings
from app.models.schemas.responses import APIResponse, ErrorDetail
from app.services.marketpulse_client import MarketPulseClient

router = APIRouter(prefix="/market", tags=["market"])


def _get_client() -> MarketPulseClient:
    settings = get_settings()
    return MarketPulseClient(
        base_url=settings.marketpulse_base_url,
        timeout=settings.marketpulse_timeout_seconds,
    )


@router.get("/breadth")
def get_breadth(lookback: str = Query(default="1y")) -> APIResponse:
    """Get breadth indicators from MarketPulse."""
    client = _get_client()
    data = client.get_breadth_history(lookback=lookback)
    if data is None:
        return APIResponse(
            success=False,
            error=ErrorDetail(
                code="MARKETPULSE_UNAVAILABLE",
                message="MarketPulse breadth data unavailable",
            ),
        )
    return APIResponse(data=data)


@router.get("/sentiment")
def get_sentiment() -> APIResponse:
    """Get sentiment composite from MarketPulse."""
    client = _get_client()
    data = client.get_sentiment()
    if data is None:
        return APIResponse(
            success=False,
            error=ErrorDetail(
                code="MARKETPULSE_UNAVAILABLE",
                message="MarketPulse sentiment data unavailable",
            ),
        )
    return APIResponse(data=data)


@router.get("/sectors")
def get_sectors(period: str = Query(default="3M")) -> APIResponse:
    """Get sector RS scores from MarketPulse."""
    client = _get_client()
    data = client.get_sector_scores(period=period)
    if data is None:
        return APIResponse(
            success=False,
            error=ErrorDetail(
                code="MARKETPULSE_UNAVAILABLE",
                message="MarketPulse sector data unavailable",
            ),
        )
    return APIResponse(data=data)


@router.get("/nifty")
def get_nifty() -> APIResponse:
    """Get NIFTY index data with period returns from MarketPulse."""
    settings = get_settings()
    # Use shorter timeout for nifty — these endpoints may not exist
    client = MarketPulseClient(
        base_url=settings.marketpulse_base_url,
        timeout=min(settings.marketpulse_timeout_seconds, 5),
    )

    indices_data = client.get_indices()
    returns_data = client.get_indices_latest()

    if indices_data is None and returns_data is None:
        return APIResponse(
            success=False,
            error=ErrorDetail(
                code="MARKETPULSE_UNAVAILABLE",
                message="MarketPulse index data unavailable",
            ),
        )

    # Extract NIFTY object from indices response
    nifty = None
    if indices_data:
        # Handle both list and dict responses
        if isinstance(indices_data, list):
            for idx in indices_data:
                if isinstance(idx, dict) and "NIFTY" in (idx.get("name", "") or "").upper():
                    nifty = idx
                    break
        elif isinstance(indices_data, dict):
            nifty = indices_data.get("NIFTY") or indices_data.get("nifty") or indices_data

    # Build all_indices map keyed by normalized name (e.g. BANKNIFTY, NIFTYIT)
    all_indices = {}
    if indices_data:
        if isinstance(indices_data, list):
            for idx in indices_data:
                if isinstance(idx, dict):
                    name = (idx.get("name") or idx.get("symbol") or "").upper().replace(" ", "").replace("_", "")
                    if name:
                        all_indices[name] = idx
        elif isinstance(indices_data, dict):
            for key, val in indices_data.items():
                norm = key.upper().replace(" ", "").replace("_", "")
                all_indices[norm] = val if isinstance(val, dict) else {"value": val}

    combined = {
        "index": nifty,
        "returns": returns_data,
        "all_indices": all_indices,
    }
    return APIResponse(data=combined)


@router.get("/regime")
def get_market_regime() -> APIResponse:
    """Get current market regime + leading sectors from MarketPulse."""
    client = _get_client()
    data = client.get_market_picks()
    if data is None:
        return APIResponse(
            success=False,
            error=ErrorDetail(
                code="MARKETPULSE_UNAVAILABLE",
                message="MarketPulse regime data unavailable",
            ),
        )
    return APIResponse(data=data)
