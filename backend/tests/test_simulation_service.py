"""Tests for simulation service — orchestration layer."""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.engines.signal_engine import SignalRule, SignalCondition
from app.engines.simulation_engine import SimulationParams
from app.services.simulation_service import SimulationService


def _mock_nav_rows(count: int = 250) -> list:
    """Create mock NAV rows spanning ~1 year of trading days."""
    rows = []
    d = date(2024, 1, 2)
    nav = Decimal("100")
    from datetime import timedelta

    for i in range(count):
        row = MagicMock()
        row.mstar_id = "F001"
        row.nav_date = d
        row.nav = nav
        rows.append(row)
        nav += Decimal("0.05")
        d += timedelta(days=1)
        while d.weekday() >= 5:
            d += timedelta(days=1)
    return rows


@pytest.fixture
def mock_db() -> MagicMock:
    return MagicMock()


@pytest.fixture
def service(mock_db: MagicMock) -> SimulationService:
    return SimulationService(mock_db)


class TestRunSimulation:
    def test_returns_simulation_result(self, service: SimulationService) -> None:
        nav_rows = _mock_nav_rows()
        service._load_nav_series = MagicMock(
            return_value=[(r.nav_date, r.nav) for r in nav_rows]
        )
        service._load_benchmark_series = MagicMock(return_value=None)
        service._load_signal_data = MagicMock(return_value={})
        service.audit_repo = MagicMock()

        params = SimulationParams(
            mode="SIP",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = service.run_simulation("F001", params)
        assert result.mode == "SIP"
        assert result.total_invested > Decimal("0")
        assert result.mstar_id == "F001"

    def test_audit_trail_created(self, service: SimulationService) -> None:
        nav_rows = _mock_nav_rows()
        service._load_nav_series = MagicMock(
            return_value=[(r.nav_date, r.nav) for r in nav_rows]
        )
        service._load_benchmark_series = MagicMock(return_value=None)
        service._load_signal_data = MagicMock(return_value={})
        service.audit_repo = MagicMock()

        params = SimulationParams(
            mode="SIP",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        service.run_simulation("F001", params)
        service.audit_repo.log.assert_called_once()
        call_kwargs = service.audit_repo.log.call_args
        assert call_kwargs[1]["actor"] == "simulation_engine"
        assert call_kwargs[1]["action"] == "run_simulation"

    def test_no_nav_data_raises(self, service: SimulationService) -> None:
        service._load_nav_series = MagicMock(return_value=[])
        service._load_benchmark_series = MagicMock(return_value=None)
        service._load_signal_data = MagicMock(return_value={})

        params = SimulationParams(
            mode="SIP",
            sip_amount=Decimal("10000"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        from app.core.exceptions import NotFoundError
        with pytest.raises(NotFoundError, match="No NAV data"):
            service.run_simulation("F001", params)

    def test_marketpulse_unavailable_runs_without_signals(
        self, service: SimulationService
    ) -> None:
        nav_rows = _mock_nav_rows()
        service._load_nav_series = MagicMock(
            return_value=[(r.nav_date, r.nav) for r in nav_rows]
        )
        service._load_benchmark_series = MagicMock(return_value=None)
        service._load_signal_data = MagicMock(return_value={})  # Empty = MP down
        service.audit_repo = MagicMock()

        params = SimulationParams(
            mode="SIP_SIGNAL",
            sip_amount=Decimal("10000"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = service.run_simulation("F001", params)
        assert result.mode == "SIP_SIGNAL"
        assert result.num_topups == 0  # No signals -> no topups


class TestLoadNavSeries:
    def test_returns_sorted_tuples(self, service: SimulationService) -> None:
        rows = _mock_nav_rows(10)
        mock_q = MagicMock()
        service.db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.all.return_value = rows

        result = service._load_nav_series("F001", date(2024, 1, 1), date(2024, 12, 31))
        assert len(result) == 10
        assert all(isinstance(d, date) and isinstance(n, Decimal) for d, n in result)
        # Verify sorted
        dates = [d for d, _ in result]
        assert dates == sorted(dates)

    def test_filters_none_navs(self, service: SimulationService) -> None:
        rows = _mock_nav_rows(5)
        # Make one NAV None
        rows[2].nav = None
        mock_q = MagicMock()
        service.db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.all.return_value = rows

        result = service._load_nav_series("F001", date(2024, 1, 1), date(2024, 12, 31))
        assert len(result) == 4  # One filtered out

    def test_empty_nav(self, service: SimulationService) -> None:
        mock_q = MagicMock()
        service.db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.all.return_value = []

        result = service._load_nav_series("F001", date(2024, 1, 1), date(2024, 12, 31))
        assert result == []


class TestLoadSignalData:
    def test_returns_empty_when_mp_unavailable(self, service: SimulationService) -> None:
        service.mp_client = MagicMock()
        service.mp_client.get_breadth_history.return_value = None

        result = service._load_signal_data(date(2024, 1, 1), date(2024, 12, 31))
        assert result == {}

    def test_transforms_breadth_history(self, service: SimulationService) -> None:
        service.mp_client = MagicMock()
        service.mp_client.get_breadth_history.return_value = {
            "history": [
                {
                    "date": "2024-06-15",
                    "pct_above_21ema": 65,
                    "pct_above_50ema": 55,
                    "pct_above_200ema": 70,
                    "sentiment_composite": 62,
                    "nifty_above_200sma": 1,
                },
                {
                    "date": "2024-06-16",
                    "pct_above_21ema": 60,
                },
            ],
        }
        result = service._load_signal_data(date(2024, 1, 1), date(2024, 12, 31))
        assert date(2024, 6, 15) in result
        assert result[date(2024, 6, 15)]["breadth_pct_above_21ema"] == 65
        assert result[date(2024, 6, 15)]["sentiment_composite"] == 62

    def test_filters_out_of_range_dates(self, service: SimulationService) -> None:
        service.mp_client = MagicMock()
        service.mp_client.get_breadth_history.return_value = {
            "history": [
                {"date": "2023-01-01", "pct_above_21ema": 50},
                {"date": "2024-06-15", "pct_above_21ema": 60},
                {"date": "2025-12-31", "pct_above_21ema": 70},
            ],
        }
        result = service._load_signal_data(date(2024, 1, 1), date(2024, 12, 31))
        assert len(result) == 1
        assert date(2024, 6, 15) in result

    def test_handles_malformed_entries(self, service: SimulationService) -> None:
        service.mp_client = MagicMock()
        service.mp_client.get_breadth_history.return_value = {
            "history": [
                {"date": "not-a-date", "pct_above_21ema": 50},
                {"pct_above_21ema": 60},  # Missing date
                {"date": "2024-06-15", "pct_above_21ema": 65},
            ],
        }
        result = service._load_signal_data(date(2024, 1, 1), date(2024, 12, 31))
        assert len(result) == 1


class TestGetFundName:
    def test_returns_fund_name(self, service: SimulationService) -> None:
        mock_q = MagicMock()
        service.db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        fund_row = MagicMock()
        fund_row.fund_name = "HDFC Top 100 Fund"
        mock_q.first.return_value = fund_row

        assert service._get_fund_name("F001") == "HDFC Top 100 Fund"

    def test_returns_mstar_id_when_not_found(self, service: SimulationService) -> None:
        mock_q = MagicMock()
        service.db.query.return_value = mock_q
        mock_q.filter.return_value = mock_q
        mock_q.first.return_value = None

        assert service._get_fund_name("F001") == "F001"


class TestCompareModes:
    def test_returns_all_four_modes(self, service: SimulationService) -> None:
        nav_rows = _mock_nav_rows()
        service._load_nav_series = MagicMock(
            return_value=[(r.nav_date, r.nav) for r in nav_rows]
        )
        service._load_benchmark_series = MagicMock(return_value=None)
        service._load_signal_data = MagicMock(return_value={})
        service.audit_repo = MagicMock()

        result = service.compare_modes(
            mstar_id="F001",
            sip_amount=Decimal("10000"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        assert "pure_sip" in result
        assert "sip_signal" in result
        assert "lumpsum" in result
        assert "hybrid" in result
        assert result["pure_sip"].mode == "SIP"
        assert result["lumpsum"].mode == "LUMPSUM"
