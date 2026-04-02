"""Central v1 router — mounts all sub-routers.

Admin-only routers (mutation endpoints) get require_admin_key as a
router-level dependency so every POST/PUT/DELETE is protected.
Read-only routers (categories, dashboard, etc.) are left open.
"""

from fastapi import APIRouter, Depends

from app.core.auth import require_admin_key

from app.api.v1.system import router as system_router
from app.api.v1.ingestion import router as ingestion_router
from app.api.v1.marketpulse import router as marketpulse_router
from app.api.v1.funds import router as funds_router
from app.api.v1.categories import router as categories_router
from app.api.v1.holdings import router as holdings_router
from app.api.v1.lens import router as lens_router
from app.api.v1.simulation import router as simulation_router
from app.api.v1.strategies import router as strategies_router
from app.api.v1.overrides import router as overrides_router
from app.api.v1.audit import router as audit_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.fetch import router as fetch_router
from app.api.v1.backfill import router as backfill_router
from app.api.v1.claude import router as claude_router
from app.api.v1.sectors import router as sectors_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.portfolio_analytics import router as portfolio_analytics_router

_admin = [Depends(require_admin_key)]

api_v1_router = APIRouter(prefix="/api/v1")

# Read-only routers — no auth required
api_v1_router.include_router(system_router)
api_v1_router.include_router(categories_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(portfolio_analytics_router)

# Mixed routers — contain both reads and mutations.
# Auth is applied per-endpoint inside each router file.
api_v1_router.include_router(funds_router)
api_v1_router.include_router(holdings_router)
api_v1_router.include_router(lens_router)
api_v1_router.include_router(marketpulse_router)
api_v1_router.include_router(sectors_router)
api_v1_router.include_router(simulation_router)
api_v1_router.include_router(claude_router)

# Admin-only routers — every endpoint requires admin key
api_v1_router.include_router(ingestion_router, dependencies=_admin)
api_v1_router.include_router(fetch_router, dependencies=_admin)
api_v1_router.include_router(backfill_router, dependencies=_admin)
api_v1_router.include_router(strategies_router, dependencies=_admin)
api_v1_router.include_router(overrides_router, dependencies=_admin)
api_v1_router.include_router(jobs_router, dependencies=_admin)
api_v1_router.include_router(audit_router, dependencies=_admin)
