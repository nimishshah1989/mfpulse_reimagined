"""Central v1 router — mounts all sub-routers."""

from fastapi import APIRouter

from app.api.v1.system import router as system_router
from app.api.v1.ingestion import router as ingestion_router
from app.api.v1.marketpulse import router as marketpulse_router
from app.api.v1.funds import router as funds_router
from app.api.v1.categories import router as categories_router
from app.api.v1.holdings import router as holdings_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(system_router)
api_v1_router.include_router(ingestion_router)
api_v1_router.include_router(marketpulse_router)
api_v1_router.include_router(funds_router)
api_v1_router.include_router(categories_router)
api_v1_router.include_router(holdings_router)
