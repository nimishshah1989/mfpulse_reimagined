"""Tests for Morningstar CSV → DB column field maps."""

import os
import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.ingestion.field_maps import (
    MASTER_FIELD_MAP,
    MASTER_FIELDS_SKIPPED,
    NAV_FIELD_MAP,
    RISK_STATS_FIELD_MAP,
    RANK_FIELD_MAP,
    HOLDINGS_FIELD_MAP,
    HOLDING_DETAIL_FIELD_MAP,
    SECTOR_EXPOSURE_MAP,
    CATEGORY_RETURNS_FIELD_MAP,
    ASSET_ALLOCATION_MAP,
    CREDIT_QUALITY_MAP,
)
from app.models.db.fund_master import FundMaster
from app.models.db.nav_daily import NavDaily
from app.models.db.risk_stats import RiskStatsMonthly
from app.models.db.rank_monthly import RankMonthly
from app.models.db.holdings import FundHoldingsSnapshot, FundHoldingDetail
from app.models.db.asset_allocation import FundAssetAllocation
from app.models.db.credit_quality import FundCreditQuality
from app.models.db.category_returns import CategoryReturnsDaily


ALL_MAPS = {
    "MASTER_FIELD_MAP": (MASTER_FIELD_MAP, FundMaster),
    "NAV_FIELD_MAP": (NAV_FIELD_MAP, NavDaily),
    "RISK_STATS_FIELD_MAP": (RISK_STATS_FIELD_MAP, RiskStatsMonthly),
    "RANK_FIELD_MAP": (RANK_FIELD_MAP, RankMonthly),
    "HOLDINGS_FIELD_MAP": (HOLDINGS_FIELD_MAP, FundHoldingsSnapshot),
    "HOLDING_DETAIL_FIELD_MAP": (HOLDING_DETAIL_FIELD_MAP, FundHoldingDetail),
    "CATEGORY_RETURNS_FIELD_MAP": (CATEGORY_RETURNS_FIELD_MAP, CategoryReturnsDaily),
    "ASSET_ALLOCATION_MAP": (ASSET_ALLOCATION_MAP, FundAssetAllocation),
    "CREDIT_QUALITY_MAP": (CREDIT_QUALITY_MAP, FundCreditQuality),
}


@pytest.mark.parametrize("map_name", ALL_MAPS.keys())
def test_no_duplicate_db_columns(map_name: str) -> None:
    """Each field map must not have duplicate DB column names."""
    field_map, _ = ALL_MAPS[map_name]
    db_cols = list(field_map.values())
    assert len(db_cols) == len(set(db_cols)), (
        f"{map_name} has duplicate DB columns: "
        f"{[c for c in db_cols if db_cols.count(c) > 1]}"
    )


@pytest.mark.parametrize("map_name", ALL_MAPS.keys())
def test_no_duplicate_csv_headers(map_name: str) -> None:
    """Each field map must not have duplicate Morningstar CSV headers."""
    field_map, _ = ALL_MAPS[map_name]
    csv_headers = list(field_map.keys())
    assert len(csv_headers) == len(set(csv_headers)), (
        f"{map_name} has duplicate CSV headers"
    )


@pytest.mark.parametrize("map_name", ALL_MAPS.keys())
def test_db_columns_exist_on_model(map_name: str) -> None:
    """Every DB column name in a field map must exist as an attribute on the ORM model."""
    field_map, model_cls = ALL_MAPS[map_name]
    model_columns = {c.key for c in model_cls.__table__.columns}
    for csv_header, db_col in field_map.items():
        assert db_col in model_columns, (
            f"{map_name}: '{csv_header}' maps to '{db_col}' "
            f"but {model_cls.__name__} has no such column. "
            f"Available: {sorted(model_columns)}"
        )


def test_master_map_has_mstar_id() -> None:
    assert MASTER_FIELD_MAP.get("SecId") == "mstar_id"


def test_nav_map_has_mstar_id() -> None:
    assert NAV_FIELD_MAP.get("SecId") == "mstar_id"


def test_risk_stats_map_has_mstar_id() -> None:
    assert RISK_STATS_FIELD_MAP.get("SecId") == "mstar_id"


def test_rank_map_has_mstar_id() -> None:
    assert RANK_FIELD_MAP.get("SecId") == "mstar_id"


def test_holdings_map_has_mstar_id() -> None:
    assert HOLDINGS_FIELD_MAP.get("MStarID") == "mstar_id"


def test_category_returns_map_has_key_field() -> None:
    assert CATEGORY_RETURNS_FIELD_MAP.get("Categorycode") == "category_code"


def test_sector_exposure_map_has_11_sectors() -> None:
    assert len(SECTOR_EXPOSURE_MAP) == 11


def test_master_fields_skipped_has_reasons() -> None:
    """Every skipped field must have a documented reason."""
    for entry in MASTER_FIELDS_SKIPPED:
        assert "field" in entry, "Skipped entry missing 'field'"
        assert "reason" in entry, f"Skipped field '{entry.get('field')}' missing 'reason'"
        assert len(entry["reason"]) > 5, f"Skipped field '{entry['field']}' has too short a reason"


def test_maps_are_non_empty() -> None:
    """All field maps must have at least one entry."""
    for map_name, (field_map, _) in ALL_MAPS.items():
        assert len(field_map) > 0, f"{map_name} is empty"


def test_asset_allocation_map_has_7_fields() -> None:
    """Asset allocation: 4 asset types + 3 market cap buckets."""
    assert len(ASSET_ALLOCATION_MAP) == 7


def test_credit_quality_map_has_8_ratings() -> None:
    """Credit quality: AAA through not_rated."""
    assert len(CREDIT_QUALITY_MAP) == 8


def test_asset_allocation_map_db_columns_exist() -> None:
    """Asset allocation map columns exist on FundAssetAllocation model."""
    model_columns = {c.key for c in FundAssetAllocation.__table__.columns}
    for ms_field, db_col in ASSET_ALLOCATION_MAP.items():
        assert db_col in model_columns, (
            f"ASSET_ALLOCATION_MAP: '{ms_field}' maps to '{db_col}' "
            f"but FundAssetAllocation has no such column"
        )


def test_credit_quality_map_db_columns_exist() -> None:
    """Credit quality map columns exist on FundCreditQuality model."""
    model_columns = {c.key for c in FundCreditQuality.__table__.columns}
    for ms_field, db_col in CREDIT_QUALITY_MAP.items():
        assert db_col in model_columns, (
            f"CREDIT_QUALITY_MAP: '{ms_field}' maps to '{db_col}' "
            f"but FundCreditQuality has no such column"
        )


def test_holdings_aliases_has_portfolio_date() -> None:
    """HOLDINGS_FIELD_ALIASES should map MostCurrentPortfolioDate → portfolio_date."""
    from app.ingestion.field_maps import HOLDINGS_FIELD_ALIASES
    assert "MostCurrentPortfolioDate" in HOLDINGS_FIELD_ALIASES
    assert HOLDINGS_FIELD_ALIASES["MostCurrentPortfolioDate"] == "portfolio_date"
