"""Tests for HoldingsRepository — portfolio holdings read queries."""

import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.core.exceptions import ValidationError
from app.models.db.holdings import FundHoldingsSnapshot, FundHoldingDetail
from app.models.db.sector_exposure import FundSectorExposure
from app.models.db.asset_allocation import FundAssetAllocation
from app.models.db.credit_quality import FundCreditQuality
from app.repositories.holdings_repo import HoldingsRepository


def _make_snapshot(**overrides) -> FundHoldingsSnapshot:
    defaults = {
        "id": uuid.uuid4(),
        "mstar_id": "F0GBR06S2Q",
        "portfolio_date": date(2026, 2, 28),
        "num_holdings": 65,
        "num_equity": 50,
        "num_bond": 0,
        "aum": Decimal("45000.00"),
        "pe_ratio": Decimal("22.5000"),
        "pb_ratio": Decimal("3.4000"),
        "equity_style_box": "Large Growth",
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    snap = FundHoldingsSnapshot()
    for k, v in defaults.items():
        setattr(snap, k, v)
    return snap


def _make_holding(**overrides) -> FundHoldingDetail:
    defaults = {
        "id": uuid.uuid4(),
        "snapshot_id": uuid.uuid4(),
        "holding_name": "HDFC Bank Ltd",
        "isin": "INE040A01034",
        "holding_type": "E",
        "weighting_pct": Decimal("8.5000"),
        "num_shares": Decimal("1500.0000"),
        "market_value": Decimal("2400.00"),
        "global_sector": "Financial Services",
        "country": "India",
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    h = FundHoldingDetail()
    for k, v in defaults.items():
        setattr(h, k, v)
    return h


def _make_sector(**overrides) -> FundSectorExposure:
    defaults = {
        "id": uuid.uuid4(),
        "mstar_id": "F0GBR06S2Q",
        "portfolio_date": date(2026, 2, 28),
        "sector_name": "Technology",
        "net_pct": Decimal("28.5000"),
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    s = FundSectorExposure()
    for k, v in defaults.items():
        setattr(s, k, v)
    return s


def _make_asset_alloc(**overrides) -> FundAssetAllocation:
    defaults = {
        "id": uuid.uuid4(),
        "mstar_id": "F0GBR06S2Q",
        "portfolio_date": date(2026, 2, 28),
        "equity_net": Decimal("95.0000"),
        "bond_net": Decimal("0.0000"),
        "cash_net": Decimal("5.0000"),
        "other_net": Decimal("0.0000"),
        "india_large_cap_pct": Decimal("70.0000"),
        "india_mid_cap_pct": Decimal("20.0000"),
        "india_small_cap_pct": Decimal("10.0000"),
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    a = FundAssetAllocation()
    for k, v in defaults.items():
        setattr(a, k, v)
    return a


def _make_credit_quality(**overrides) -> FundCreditQuality:
    defaults = {
        "id": uuid.uuid4(),
        "mstar_id": "F0GBR06S2Q",
        "portfolio_date": date(2026, 2, 28),
        "aaa_pct": Decimal("60.0000"),
        "aa_pct": Decimal("25.0000"),
        "a_pct": Decimal("10.0000"),
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    cq = FundCreditQuality()
    for k, v in defaults.items():
        setattr(cq, k, v)
    return cq


class TestGetLatestSnapshot:
    def test_returns_dict(self) -> None:
        db = MagicMock()
        snap = _make_snapshot()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = snap

        repo = HoldingsRepository(db)
        result = repo.get_latest_snapshot("F0GBR06S2Q")

        assert result is not None
        assert result["num_holdings"] == 65
        assert result["aum"] == Decimal("45000.00")

    def test_returns_none_when_no_data(self) -> None:
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = None

        repo = HoldingsRepository(db)
        result = repo.get_latest_snapshot("NONEXISTENT")

        assert result is None


class TestGetTopHoldings:
    def test_returns_top_n(self) -> None:
        db = MagicMock()
        snap = _make_snapshot()
        h1 = _make_holding(holding_name="HDFC Bank Ltd", weighting_pct=Decimal("8.5000"))
        h2 = _make_holding(holding_name="ICICI Bank Ltd", weighting_pct=Decimal("7.2000"))

        # Mock snapshot query
        snap_query = MagicMock()
        # Mock holding query
        hold_query = MagicMock()

        call_count = [0]

        def query_side_effect(model):
            call_count[0] += 1
            if model == FundHoldingsSnapshot:
                return snap_query
            return hold_query

        db.query.side_effect = query_side_effect
        snap_query.filter.return_value = snap_query
        snap_query.order_by.return_value = snap_query
        snap_query.first.return_value = snap

        hold_query.filter.return_value = hold_query
        hold_query.order_by.return_value = hold_query
        hold_query.limit.return_value = hold_query
        hold_query.all.return_value = [h1, h2]

        repo = HoldingsRepository(db)
        result = repo.get_top_holdings("F0GBR06S2Q", limit=10)

        assert len(result) == 2
        assert result[0]["holding_name"] == "HDFC Bank Ltd"

    def test_no_snapshot_returns_empty(self) -> None:
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = None

        repo = HoldingsRepository(db)
        result = repo.get_top_holdings("NONEXISTENT", limit=10)

        assert result == []


class TestGetSectorExposure:
    def test_returns_list(self) -> None:
        db = MagicMock()
        sector = _make_sector()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.all.return_value = [sector]

        repo = HoldingsRepository(db)
        result = repo.get_sector_exposure("F0GBR06S2Q")

        assert len(result) == 1
        assert result[0]["sector_name"] == "Technology"
        assert result[0]["net_pct"] == Decimal("28.5000")


class TestGetSectorExposureHistory:
    def test_returns_list(self) -> None:
        db = MagicMock()
        sector = _make_sector()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.limit.return_value = query
        query.all.return_value = [sector]

        repo = HoldingsRepository(db)
        result = repo.get_sector_exposure_history("F0GBR06S2Q", limit=12)

        assert len(result) == 1


class TestGetAssetAllocation:
    def test_returns_dict(self) -> None:
        db = MagicMock()
        alloc = _make_asset_alloc()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = alloc

        repo = HoldingsRepository(db)
        result = repo.get_asset_allocation("F0GBR06S2Q")

        assert result is not None
        assert result["equity_net"] == Decimal("95.0000")

    def test_returns_none_when_no_data(self) -> None:
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = None

        repo = HoldingsRepository(db)
        result = repo.get_asset_allocation("NONEXISTENT")

        assert result is None


class TestGetCreditQuality:
    def test_returns_dict(self) -> None:
        db = MagicMock()
        cq = _make_credit_quality()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = cq

        repo = HoldingsRepository(db)
        result = repo.get_credit_quality("F0GBR06S2Q")

        assert result is not None
        assert result["aaa_pct"] == Decimal("60.0000")


class TestComputeOverlap:
    def test_two_funds_with_shared_holding(self) -> None:
        db = MagicMock()
        snap_a = _make_snapshot(mstar_id="FUND_A")
        snap_b = _make_snapshot(mstar_id="FUND_B")

        shared_isin = "INE040A01034"
        h_a1 = _make_holding(
            snapshot_id=snap_a.id, isin=shared_isin,
            holding_name="HDFC Bank", weighting_pct=Decimal("8.0000"),
        )
        h_a2 = _make_holding(
            snapshot_id=snap_a.id, isin="INE001A01036",
            holding_name="Reliance", weighting_pct=Decimal("6.0000"),
        )
        h_b1 = _make_holding(
            snapshot_id=snap_b.id, isin=shared_isin,
            holding_name="HDFC Bank Ltd", weighting_pct=Decimal("10.0000"),
        )

        # Mock: get_holdings_for_overlap returns holdings keyed by mstar_id
        snap_query = MagicMock()
        hold_query = MagicMock()

        snapshots = {"FUND_A": snap_a, "FUND_B": snap_b}
        holdings = {snap_a.id: [h_a1, h_a2], snap_b.id: [h_b1]}

        def query_side_effect(model):
            if model == FundHoldingsSnapshot:
                return snap_query
            return hold_query

        db.query.side_effect = query_side_effect
        snap_query.filter.return_value = snap_query
        snap_query.order_by.return_value = snap_query

        def snap_all():
            return [snap_a, snap_b]
        snap_query.all.return_value = [snap_a, snap_b]

        hold_query.filter.return_value = hold_query
        hold_query.all.side_effect = lambda: [h_a1, h_a2, h_b1]

        repo = HoldingsRepository(db)
        result = repo.compute_overlap(["FUND_A", "FUND_B"])

        assert "overlap_matrix" in result
        assert "common_holdings" in result
        assert len(result["funds_analyzed"]) == 2

    def test_rejects_single_fund(self) -> None:
        db = MagicMock()
        repo = HoldingsRepository(db)

        with pytest.raises(ValidationError, match="at least 2"):
            repo.compute_overlap(["FUND_A"])

    def test_rejects_more_than_five_funds(self) -> None:
        db = MagicMock()
        repo = HoldingsRepository(db)

        with pytest.raises(ValidationError, match="at most 5"):
            repo.compute_overlap(["A", "B", "C", "D", "E", "F"])
