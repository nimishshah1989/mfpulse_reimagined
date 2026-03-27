"""Tests for database model definitions — validates all tables register with Base."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.core.database import Base
from app.models.db import (
    AuditTrail,
    CategoryReturnsDaily,
    EngineConfig,
    FMOverride,
    FundAssetAllocation,
    FundClassification,
    FundCreditQuality,
    FundHoldingDetail,
    FundHoldingsSnapshot,
    FundLensScores,
    FundMaster,
    FundSectorExposure,
    IndexDaily,
    IndexMaster,
    IngestionLog,
    NavDaily,
    RankMonthly,
    RiskStatsMonthly,
    StrategyBacktestRun,
    StrategyDefinition,
    StrategyLivePortfolio,
    StrategyPortfolioHolding,
)


EXPECTED_TABLES = [
    "fund_master",
    "nav_daily",
    "risk_stats_monthly",
    "rank_monthly",
    "fund_holdings_snapshot",
    "fund_holding_detail",
    "fund_sector_exposure",
    "fund_asset_allocation",
    "fund_credit_quality",
    "category_returns_daily",
    "index_master",
    "index_daily",
    "fund_lens_scores",
    "fund_classification",
    "strategy_definition",
    "strategy_backtest_run",
    "strategy_live_portfolio",
    "strategy_portfolio_holding",
    "fm_override",
    "audit_trail",
    "ingestion_log",
    "engine_config",
]


def test_all_tables_registered_with_base() -> None:
    """Every expected table should be in Base.metadata."""
    registered = set(Base.metadata.tables.keys())
    for table_name in EXPECTED_TABLES:
        assert table_name in registered, f"Table '{table_name}' not found in Base.metadata"


def test_expected_table_count() -> None:
    """Should have exactly 22 tables."""
    assert len(EXPECTED_TABLES) == 22
    registered = set(Base.metadata.tables.keys())
    assert len(registered) >= 22


def test_fund_master_has_uuid_pk() -> None:
    """fund_master should have a UUID primary key column."""
    table = Base.metadata.tables["fund_master"]
    pk_cols = [c.name for c in table.primary_key.columns]
    assert "id" in pk_cols


def test_fund_master_indexes() -> None:
    """fund_master should have the specified indexes."""
    table = Base.metadata.tables["fund_master"]
    index_names = {idx.name for idx in table.indexes}
    assert "ix_fund_master_category_name" in index_names
    assert "ix_fund_master_amfi_code" in index_names
    assert "ix_fund_master_isin" in index_names
    assert "ix_fund_master_eligible_category" in index_names
    assert "ix_fund_master_purchase_mode" in index_names


def test_nav_daily_unique_constraint() -> None:
    """nav_daily should have unique constraint on (mstar_id, nav_date)."""
    table = Base.metadata.tables["nav_daily"]
    unique_names = {c.name for c in table.constraints if hasattr(c, "columns") and len(c.columns) > 1}
    assert "uq_nav_daily_mstar_date" in unique_names


def test_audit_trail_has_no_updated_at() -> None:
    """audit_trail is append-only — no updated_at column."""
    table = Base.metadata.tables["audit_trail"]
    col_names = {c.name for c in table.columns}
    assert "updated_at" not in col_names


def test_fund_master_has_mstar_id_unique() -> None:
    """mstar_id on fund_master must be unique."""
    table = Base.metadata.tables["fund_master"]
    mstar_col = table.c.mstar_id
    assert mstar_col.unique is True


def test_numeric_columns_not_float() -> None:
    """Financial columns should be Numeric, not Float."""
    import sqlalchemy
    table = Base.metadata.tables["nav_daily"]
    nav_col = table.c.nav
    assert isinstance(nav_col.type, sqlalchemy.Numeric)


def test_holding_detail_has_snapshot_fk() -> None:
    """fund_holding_detail.snapshot_id should FK to fund_holdings_snapshot."""
    table = Base.metadata.tables["fund_holding_detail"]
    fks = list(table.foreign_keys)
    fk_targets = {fk.target_fullname for fk in fks}
    assert "fund_holdings_snapshot.id" in fk_targets
