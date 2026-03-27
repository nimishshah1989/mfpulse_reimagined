"""Import all models so Alembic and init_db() see them."""

from app.models.db.fund_master import FundMaster
from app.models.db.nav_daily import NavDaily
from app.models.db.risk_stats import RiskStatsMonthly
from app.models.db.rank_monthly import RankMonthly
from app.models.db.holdings import FundHoldingsSnapshot, FundHoldingDetail
from app.models.db.sector_exposure import FundSectorExposure
from app.models.db.asset_allocation import FundAssetAllocation
from app.models.db.credit_quality import FundCreditQuality
from app.models.db.category_returns import CategoryReturnsDaily
from app.models.db.index_data import IndexMaster, IndexDaily
from app.models.db.lens_scores import FundLensScores, FundClassification
from app.models.db.strategy import (
    StrategyDefinition,
    StrategyBacktestRun,
    StrategyLivePortfolio,
    StrategyPortfolioHolding,
)
from app.models.db.overrides import FMOverride
from app.models.db.system import AuditTrail, IngestionLog, EngineConfig

__all__ = [
    "FundMaster",
    "NavDaily",
    "RiskStatsMonthly",
    "RankMonthly",
    "FundHoldingsSnapshot",
    "FundHoldingDetail",
    "FundSectorExposure",
    "FundAssetAllocation",
    "FundCreditQuality",
    "CategoryReturnsDaily",
    "IndexMaster",
    "IndexDaily",
    "FundLensScores",
    "FundClassification",
    "StrategyDefinition",
    "StrategyBacktestRun",
    "StrategyLivePortfolio",
    "StrategyPortfolioHolding",
    "FMOverride",
    "AuditTrail",
    "IngestionLog",
    "EngineConfig",
]
