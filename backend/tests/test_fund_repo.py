"""Tests for FundRepository — fund data read queries."""

import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.models.db.fund_master import FundMaster
from app.models.db.nav_daily import NavDaily
from app.models.db.risk_stats import RiskStatsMonthly
from app.models.db.rank_monthly import RankMonthly
from app.models.db.category_returns import CategoryReturnsDaily
from app.repositories.fund_repo import FundRepository


def _make_fund(**overrides) -> FundMaster:
    """Create a FundMaster instance with sensible defaults."""
    defaults = {
        "id": uuid.uuid4(),
        "mstar_id": "F0GBR06S2Q",
        "legal_name": "HDFC Top 100 Fund",
        "fund_name": "HDFC Top 100",
        "amc_name": "HDFC AMC",
        "category_name": "Large Cap",
        "broad_category": "Equity",
        "inception_date": date(2000, 1, 1),
        "isin": "INF179K01AA0",
        "amfi_code": "100345",
        "purchase_mode": 1,
        "is_active": True,
        "is_eligible": True,
        "net_expense_ratio": Decimal("1.6200"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    fund = FundMaster()
    for k, v in defaults.items():
        setattr(fund, k, v)
    return fund


def _make_nav(**overrides) -> NavDaily:
    """Create a NavDaily instance with defaults."""
    defaults = {
        "id": uuid.uuid4(),
        "mstar_id": "F0GBR06S2Q",
        "nav_date": date(2026, 3, 27),
        "nav": Decimal("650.1234"),
        "return_1d": Decimal("0.12345"),
        "return_1y": Decimal("15.50000"),
        "return_3y": Decimal("12.30000"),
        "return_5y": Decimal("11.80000"),
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    nav = NavDaily()
    for k, v in defaults.items():
        setattr(nav, k, v)
    return nav


def _make_risk_stats(**overrides) -> RiskStatsMonthly:
    """Create a RiskStatsMonthly instance."""
    defaults = {
        "id": uuid.uuid4(),
        "mstar_id": "F0GBR06S2Q",
        "as_of_date": date(2026, 2, 28),
        "sharpe_3y": Decimal("1.25000"),
        "alpha_3y": Decimal("2.50000"),
        "beta_3y": Decimal("0.95000"),
        "std_dev_3y": Decimal("14.20000"),
        "max_drawdown_3y": Decimal("-18.50000"),
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    rs = RiskStatsMonthly()
    for k, v in defaults.items():
        setattr(rs, k, v)
    return rs


def _make_rank(**overrides) -> RankMonthly:
    """Create a RankMonthly instance."""
    defaults = {
        "id": uuid.uuid4(),
        "mstar_id": "F0GBR06S2Q",
        "as_of_date": date(2026, 2, 28),
        "quartile_1y": 1,
        "quartile_3y": 2,
        "abs_rank_1y": 5,
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    r = RankMonthly()
    for k, v in defaults.items():
        setattr(r, k, v)
    return r


class TestGetAllFunds:
    """Tests for FundRepository.get_all_funds."""

    def test_returns_tuple_of_funds_and_count(self) -> None:
        """get_all_funds returns (list[FundMaster], int)."""
        db = MagicMock()
        fund = _make_fund()

        # Mock the chained query
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.offset.return_value = query
        query.limit.return_value = query
        query.all.return_value = [fund]
        query.count.return_value = 1

        repo = FundRepository(db)
        funds, total = repo.get_all_funds()

        assert isinstance(funds, list)
        assert isinstance(total, int)
        assert total == 1

    def test_filter_by_category(self) -> None:
        """Filtering by category passes through to query."""
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.offset.return_value = query
        query.limit.return_value = query
        query.all.return_value = []
        query.count.return_value = 0

        repo = FundRepository(db)
        funds, total = repo.get_all_funds(category="Large Cap")

        assert total == 0
        assert funds == []

    def test_filter_by_amc(self) -> None:
        """Filtering by AMC passes through to query."""
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.offset.return_value = query
        query.limit.return_value = query
        query.all.return_value = []
        query.count.return_value = 0

        repo = FundRepository(db)
        funds, total = repo.get_all_funds(amc="HDFC AMC")

        assert total == 0

    def test_search_filter(self) -> None:
        """Search by fund name triggers ilike filter."""
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.offset.return_value = query
        query.limit.return_value = query
        query.all.return_value = []
        query.count.return_value = 0

        repo = FundRepository(db)
        funds, total = repo.get_all_funds(search="HDFC")

        assert total == 0


class TestGetFundByMstarId:
    """Tests for FundRepository.get_fund_by_mstar_id."""

    def test_found(self) -> None:
        db = MagicMock()
        fund = _make_fund()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.first.return_value = fund

        repo = FundRepository(db)
        result = repo.get_fund_by_mstar_id("F0GBR06S2Q")

        assert result is not None
        assert result.mstar_id == "F0GBR06S2Q"

    def test_not_found(self) -> None:
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.first.return_value = None

        repo = FundRepository(db)
        result = repo.get_fund_by_mstar_id("NONEXISTENT")

        assert result is None


class TestGetFundByIsin:
    def test_found(self) -> None:
        db = MagicMock()
        fund = _make_fund(isin="INF179K01AA0")
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.first.return_value = fund

        repo = FundRepository(db)
        result = repo.get_fund_by_isin("INF179K01AA0")

        assert result is not None
        assert result.isin == "INF179K01AA0"


class TestGetFundByAmfiCode:
    def test_found(self) -> None:
        db = MagicMock()
        fund = _make_fund(amfi_code="100345")
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.first.return_value = fund

        repo = FundRepository(db)
        result = repo.get_fund_by_amfi_code("100345")

        assert result is not None
        assert result.amfi_code == "100345"


class TestGetCategories:
    def test_returns_list_of_dicts(self) -> None:
        db = MagicMock()
        # Simulate query result: rows with category_name, broad_category, fund_count
        row = MagicMock()
        row.category_name = "Large Cap"
        row.broad_category = "Equity"
        row.fund_count = 42
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.group_by.return_value = query
        query.order_by.return_value = query
        query.all.return_value = [row]

        repo = FundRepository(db)
        categories = repo.get_categories()

        assert len(categories) == 1
        assert categories[0]["category_name"] == "Large Cap"
        assert categories[0]["fund_count"] == 42


class TestGetAmcs:
    def test_returns_list_of_dicts(self) -> None:
        db = MagicMock()
        row = MagicMock()
        row.amc_name = "HDFC AMC"
        row.fund_count = 38
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.group_by.return_value = query
        query.order_by.return_value = query
        query.all.return_value = [row]

        repo = FundRepository(db)
        amcs = repo.get_amcs()

        assert len(amcs) == 1
        assert amcs[0]["amc_name"] == "HDFC AMC"
        assert amcs[0]["fund_count"] == 38


class TestGetLatestNav:
    def test_returns_dict_when_found(self) -> None:
        db = MagicMock()
        nav = _make_nav()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = nav

        repo = FundRepository(db)
        result = repo.get_latest_nav("F0GBR06S2Q")

        assert result is not None
        assert result["nav"] == Decimal("650.1234")
        assert result["nav_date"] == date(2026, 3, 27)

    def test_returns_none_when_no_nav(self) -> None:
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = None

        repo = FundRepository(db)
        result = repo.get_latest_nav("NONEXISTENT")

        assert result is None


class TestGetNavHistory:
    def test_returns_list_of_dicts(self) -> None:
        db = MagicMock()
        nav1 = _make_nav(nav_date=date(2026, 3, 27))
        nav2 = _make_nav(nav_date=date(2026, 3, 26), nav=Decimal("649.0000"))
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.limit.return_value = query
        query.all.return_value = [nav1, nav2]

        repo = FundRepository(db)
        result = repo.get_nav_history("F0GBR06S2Q", limit=2)

        assert len(result) == 2
        assert result[0]["nav_date"] == date(2026, 3, 27)

    def test_date_range_filter(self) -> None:
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.limit.return_value = query
        query.all.return_value = []

        repo = FundRepository(db)
        result = repo.get_nav_history(
            "F0GBR06S2Q",
            start_date=date(2025, 1, 1),
            end_date=date(2026, 3, 27),
        )

        assert result == []


class TestGetTrailingReturns:
    def test_returns_dict(self) -> None:
        db = MagicMock()
        nav = _make_nav(
            return_1y=Decimal("15.50000"),
            return_3y=Decimal("12.30000"),
            return_5y=Decimal("11.80000"),
        )
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = nav

        repo = FundRepository(db)
        result = repo.get_trailing_returns("F0GBR06S2Q")

        assert result is not None
        assert result["return_1y"] == Decimal("15.50000")

    def test_returns_none_when_no_data(self) -> None:
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = None

        repo = FundRepository(db)
        result = repo.get_trailing_returns("NONEXISTENT")

        assert result is None


class TestGetLatestRiskStats:
    def test_returns_dict(self) -> None:
        db = MagicMock()
        rs = _make_risk_stats()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = rs

        repo = FundRepository(db)
        result = repo.get_latest_risk_stats("F0GBR06S2Q")

        assert result is not None
        assert result["sharpe_3y"] == Decimal("1.25000")


class TestGetRiskStatsHistory:
    def test_returns_list(self) -> None:
        db = MagicMock()
        rs = _make_risk_stats()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.limit.return_value = query
        query.all.return_value = [rs]

        repo = FundRepository(db)
        result = repo.get_risk_stats_history("F0GBR06S2Q", limit=12)

        assert len(result) == 1


class TestGetLatestRanks:
    def test_returns_dict(self) -> None:
        db = MagicMock()
        rank = _make_rank()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = rank

        repo = FundRepository(db)
        result = repo.get_latest_ranks("F0GBR06S2Q")

        assert result is not None
        assert result["quartile_1y"] == 1


class TestGetCategoryReturns:
    def test_returns_dict(self) -> None:
        db = MagicMock()
        cat = CategoryReturnsDaily()
        cat.id = uuid.uuid4()
        cat.category_code = "EIIN0001"
        cat.as_of_date = date(2026, 3, 27)
        cat.cat_return_3y = Decimal("12.50000")
        cat.created_at = datetime.now(timezone.utc)
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.first.return_value = cat

        repo = FundRepository(db)
        result = repo.get_category_returns("EIIN0001")

        assert result is not None
        assert result["cat_return_3y"] == Decimal("12.50000")


class TestGetCategoryPeers:
    def test_returns_list_of_dicts(self) -> None:
        db = MagicMock()
        fund = _make_fund(category_name="Large Cap")
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.limit.return_value = query
        query.all.return_value = [fund]

        repo = FundRepository(db)
        result = repo.get_category_peers("Large Cap", limit=50)

        assert len(result) == 1
        assert result[0]["mstar_id"] == "F0GBR06S2Q"

    def test_exclude_mstar_id(self) -> None:
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.limit.return_value = query
        query.all.return_value = []

        repo = FundRepository(db)
        result = repo.get_category_peers(
            "Large Cap", exclude_mstar_id="F0GBR06S2Q", limit=50,
        )

        assert result == []
