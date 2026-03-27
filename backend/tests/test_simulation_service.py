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
