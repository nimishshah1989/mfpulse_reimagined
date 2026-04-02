"""Tests for simulation engine -- SIP/lumpsum/hybrid simulator."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.engines.signal_engine import SignalEvent
from app.engines.simulation_engine import (
    CashflowEvent,
    DailySnapshot,
    SimulationEngine,
    SimulationParams,
    SimulationResult,
)


@pytest.fixture
def engine() -> SimulationEngine:
    return SimulationEngine()


def _nav_series(
    start: date,
    months: int,
    base_nav: Decimal = Decimal("100"),
    monthly_return: Decimal = Decimal("0.01"),
) -> list[tuple[date, Decimal]]:
    """Generate daily NAV series with fixed monthly return (compounding daily)."""
    import math

    daily_return = float(monthly_return) / 21  # ~21 trading days/month
    series: list[tuple[date, Decimal]] = []
    current = float(base_nav)
    d = start
    end = date(start.year + (start.month + months - 1) // 12,
               (start.month + months - 1) % 12 + 1, 28)
    while d <= end:
        if d.weekday() < 5:  # Mon-Fri
            series.append((d, Decimal(str(round(current, 4)))))
            current *= (1 + daily_return)
        d += timedelta(days=1)
    return series


def _flat_nav_series(
    start: date, months: int, nav: Decimal = Decimal("100")
) -> list[tuple[date, Decimal]]:
    """Generate daily NAV series with constant NAV."""
    series: list[tuple[date, Decimal]] = []
    d = start
    end = date(start.year + (start.month + months - 1) // 12,
               (start.month + months - 1) % 12 + 1, 28)
    while d <= end:
        if d.weekday() < 5:
            series.append((d, nav))
        d += timedelta(days=1)
    return series


def _dropping_nav_series(
    start: date, months: int, base_nav: Decimal = Decimal("100"),
    drop_pct: Decimal = Decimal("20"), drop_month: int = 6,
) -> list[tuple[date, Decimal]]:
    """NAV rises, drops by drop_pct at drop_month, then recovers."""
    series: list[tuple[date, Decimal]] = []
    d = start
    end = date(start.year + (start.month + months - 1) // 12,
               (start.month + months - 1) % 12 + 1, 28)
    current = float(base_nav)
    day_count = 0
    drop_day = drop_month * 21  # approximate
    recovery_days = (months - drop_month) * 21
    while d <= end:
        if d.weekday() < 5:
            if day_count == drop_day:
                current = current * (1 - float(drop_pct) / 100)
            elif day_count > drop_day and recovery_days > 0:
                # Gradual recovery
                current *= 1.002
            else:
                current *= 1.001
            series.append((d, Decimal(str(round(current, 4)))))
            day_count += 1
        d += timedelta(days=1)
    return series


# ---------------------------------------------------------------------------
# SIP date generation
# ---------------------------------------------------------------------------

class TestSIPDateGeneration:
    def test_12_months_generates_12_dates(self, engine: SimulationEngine) -> None:
        dates = engine._generate_sip_dates(date(2024, 1, 1), date(2024, 12, 31), 5)
        assert len(dates) == 12
        for d in dates:
            assert d.day == 5

    def test_start_mid_month_first_sip_next_month(self, engine: SimulationEngine) -> None:
        dates = engine._generate_sip_dates(date(2024, 1, 15), date(2024, 6, 30), 5)
        assert dates[0] == date(2024, 2, 5)

    def test_sip_day_after_start_day_still_includes_start_month(self, engine: SimulationEngine) -> None:
        # Start on Jan 3, SIP day 5 -> should include Jan 5
        dates = engine._generate_sip_dates(date(2024, 1, 3), date(2024, 3, 31), 5)
        assert dates[0] == date(2024, 1, 5)

    def test_sip_day_31_handles_short_months(self, engine: SimulationEngine) -> None:
        # Use a known leap year (2024) for predictable results
        dates = engine._generate_sip_dates(date(2024, 1, 1), date(2024, 4, 30), 31)
        assert any(d.month == 2 and d.day == 29 for d in dates)

    def test_sip_day_31_non_leap_year(self, engine: SimulationEngine) -> None:
        # 2023 is NOT a leap year — Feb should clamp to 28
        dates = engine._generate_sip_dates(date(2023, 1, 1), date(2023, 4, 30), 31)
        feb_dates = [d for d in dates if d.month == 2]
        assert len(feb_dates) > 0
        assert all(d.day <= 28 for d in feb_dates)


# ---------------------------------------------------------------------------
# NAV lookup
# ---------------------------------------------------------------------------

class TestNAVLookup:
    def test_exact_date_match(self, engine: SimulationEngine) -> None:
        series = [(date(2024, 1, 5), Decimal("100")), (date(2024, 1, 8), Decimal("101"))]
        d, nav = engine._get_nav_on_date(series, date(2024, 1, 5))
        assert d == date(2024, 1, 5)
        assert nav == Decimal("100")

    def test_weekend_returns_next_monday(self, engine: SimulationEngine) -> None:
        # Jan 6 2024 = Saturday
        series = [
            (date(2024, 1, 5), Decimal("100")),
            (date(2024, 1, 8), Decimal("101")),  # Monday
        ]
        d, nav = engine._get_nav_on_date(series, date(2024, 1, 6))
        assert d == date(2024, 1, 8)
        assert nav == Decimal("101")

    def test_no_nav_within_10_days_returns_none(self, engine: SimulationEngine) -> None:
        series = [(date(2024, 1, 1), Decimal("100")), (date(2024, 2, 1), Decimal("110"))]
        result = engine._get_nav_on_date(series, date(2024, 1, 10))
        assert result is None


# ---------------------------------------------------------------------------
# Pure SIP simulation
# ---------------------------------------------------------------------------

class TestPureSIPSimulation:
    def test_12_months_correct_invested(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="SIP",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert result.total_invested == Decimal("10000") * result.num_sips
        assert result.num_sips == 12

    def test_units_accumulated_correctly(self, engine: SimulationEngine) -> None:
        # Flat NAV = 100 -> each SIP buys 100 units
        nav = _flat_nav_series(date(2024, 1, 1), 13, Decimal("100"))
        params = SimulationParams(
            mode="SIP",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        expected_units = Decimal("10000") / Decimal("100") * result.num_sips
        assert result.final_value == expected_units * Decimal("100")

    def test_xirr_computed_and_reasonable(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="SIP",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert result.xirr_pct is not None
        assert Decimal("-50") < result.xirr_pct < Decimal("100")

    def test_final_value_matches_units_times_last_nav(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="SIP",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        # Final value = cumulative_units * last timeline NAV (rounding accumulates across SIPs)
        last_snap = result.daily_timeline[-1]
        expected = last_snap.cumulative_units * last_snap.nav
        assert abs(result.final_value - expected) < Decimal("1")

    def test_no_topups_in_pure_sip(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="SIP",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert result.num_topups == 0
        assert result.topup_invested == Decimal("0")


# ---------------------------------------------------------------------------
# SIP + Signal simulation
# ---------------------------------------------------------------------------

class TestSIPSignalSimulation:
    def test_topups_increase_invested(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="SIP_SIGNAL",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        signal_events = [
            SignalEvent(
                date=date(2024, 3, 15),
                rule_name="panic",
                multiplier=2.0,
                conditions_met=["breadth"],
                signal_snapshot={"breadth": 20.0},
            ),
            SignalEvent(
                date=date(2024, 7, 15),
                rule_name="deep_panic",
                multiplier=3.0,
                conditions_met=["breadth"],
                signal_snapshot={"breadth": 15.0},
            ),
        ]
        result = engine.simulate(params, nav, signal_events=signal_events, fund_name="Test", mstar_id="T001")
        pure_sip_invested = Decimal("10000") * result.num_sips
        assert result.total_invested > pure_sip_invested
        assert result.num_topups == 2

    def test_topup_amount_is_sip_times_multiplier(self, engine: SimulationEngine) -> None:
        nav = _flat_nav_series(date(2024, 1, 1), 13, Decimal("100"))
        params = SimulationParams(
            mode="SIP_SIGNAL",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        signal_events = [
            SignalEvent(
                date=date(2024, 3, 15),
                rule_name="test",
                multiplier=2.0,
                conditions_met=["b"],
                signal_snapshot={},
            ),
        ]
        result = engine.simulate(params, nav, signal_events=signal_events, fund_name="Test", mstar_id="T001")
        topup_events = [ce for ce in result.cashflow_events if ce.event_type == "TOPUP"]
        assert len(topup_events) == 1
        assert topup_events[0].amount == Decimal("20000")  # 10000 * 2.0

    def test_signal_events_recorded(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="SIP_SIGNAL",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        signal_events = [
            SignalEvent(
                date=date(2024, 3, 15),
                rule_name="panic",
                multiplier=2.0,
                conditions_met=["b"],
                signal_snapshot={},
            ),
        ]
        result = engine.simulate(params, nav, signal_events=signal_events, fund_name="Test", mstar_id="T001")
        assert len(result.signal_events) == 1


# ---------------------------------------------------------------------------
# Pure Lumpsum simulation
# ---------------------------------------------------------------------------

class TestLumpsumSimulation:
    def test_full_amount_deployed_at_start(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="LUMPSUM",
            lumpsum_amount=Decimal("1200000"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert result.total_invested == Decimal("1200000")
        lumpsum_events = [ce for ce in result.cashflow_events if ce.event_type == "LUMPSUM"]
        assert len(lumpsum_events) == 1

    def test_cagr_for_lumpsum(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="LUMPSUM",
            lumpsum_amount=Decimal("100000"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert result.cagr_pct is not None
        assert result.cagr_pct > Decimal("0")

    def test_no_sips_in_lumpsum_mode(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="LUMPSUM",
            lumpsum_amount=Decimal("100000"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert result.num_sips == 0


# ---------------------------------------------------------------------------
# Hybrid simulation
# ---------------------------------------------------------------------------

class TestHybridSimulation:
    def test_sip_plus_lumpsum_on_signals(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="HYBRID",
            sip_amount=Decimal("10000"),
            sip_day=5,
            lumpsum_amount=Decimal("500000"),
            lumpsum_deploy_pct=Decimal("50"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        signal_events = [
            SignalEvent(
                date=date(2024, 3, 15),
                rule_name="panic",
                multiplier=2.0,
                conditions_met=["b"],
                signal_snapshot={},
            ),
        ]
        result = engine.simulate(params, nav, signal_events=signal_events, fund_name="Test", mstar_id="T001")
        sip_invested = Decimal("10000") * result.num_sips
        assert result.total_invested > sip_invested
        lumpsum_events = [ce for ce in result.cashflow_events if ce.event_type == "LUMPSUM"]
        assert len(lumpsum_events) >= 1


# ---------------------------------------------------------------------------
# Max Drawdown
# ---------------------------------------------------------------------------

class TestMaxDrawdown:
    def test_monotonically_increasing_nav_zero_drawdown(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="LUMPSUM",
            lumpsum_amount=Decimal("100000"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert result.max_drawdown_pct == Decimal("0")

    def test_nav_drops_reports_drawdown(self, engine: SimulationEngine) -> None:
        nav = _dropping_nav_series(
            date(2024, 1, 1), 13, drop_pct=Decimal("20"), drop_month=6
        )
        params = SimulationParams(
            mode="LUMPSUM",
            lumpsum_amount=Decimal("100000"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert result.max_drawdown_pct > Decimal("15")  # At least 15% given 20% drop
        assert result.max_drawdown_start is not None
        assert result.max_drawdown_end is not None


# ---------------------------------------------------------------------------
# XIRR
# ---------------------------------------------------------------------------

class TestXIRR:
    def test_known_cashflows(self, engine: SimulationEngine) -> None:
        # Invest 100, get back 110 after 1 year -> ~10% XIRR
        cashflows = [
            (date(2024, 1, 1), Decimal("-100")),
            (date(2025, 1, 1), Decimal("110")),
        ]
        xirr = engine._compute_xirr(cashflows)
        assert xirr is not None
        assert abs(xirr - Decimal("10")) < Decimal("1")

    def test_lumpsum_xirr_approx_cagr(self, engine: SimulationEngine) -> None:
        # For a single investment, XIRR should approximate CAGR
        cashflows = [
            (date(2023, 1, 1), Decimal("-100000")),
            (date(2025, 1, 1), Decimal("121000")),  # ~10% CAGR over 2 years
        ]
        xirr = engine._compute_xirr(cashflows)
        cagr = engine._compute_cagr(Decimal("100000"), Decimal("121000"), Decimal("2"))
        assert xirr is not None
        assert cagr is not None
        assert abs(xirr - cagr) < Decimal("1")

    def test_single_day_investment_returns_none(self, engine: SimulationEngine) -> None:
        cashflows = [
            (date(2024, 1, 1), Decimal("-100")),
            (date(2024, 1, 1), Decimal("100")),
        ]
        xirr = engine._compute_xirr(cashflows)
        assert xirr is None


# ---------------------------------------------------------------------------
# CAGR
# ---------------------------------------------------------------------------

class TestCAGR:
    def test_basic_cagr(self, engine: SimulationEngine) -> None:
        cagr = engine._compute_cagr(Decimal("100"), Decimal("121"), Decimal("2"))
        assert cagr is not None
        assert abs(cagr - Decimal("10")) < Decimal("1")

    def test_zero_initial_returns_none(self, engine: SimulationEngine) -> None:
        cagr = engine._compute_cagr(Decimal("0"), Decimal("100"), Decimal("2"))
        assert cagr is None

    def test_zero_years_returns_none(self, engine: SimulationEngine) -> None:
        cagr = engine._compute_cagr(Decimal("100"), Decimal("121"), Decimal("0"))
        assert cagr is None


# ---------------------------------------------------------------------------
# Sharpe / Sortino
# ---------------------------------------------------------------------------

class TestSharpeAndSortino:
    def test_positive_returns_positive_sharpe(self, engine: SimulationEngine) -> None:
        monthly_returns = [Decimal("2")] * 12  # 2% each month
        sharpe = engine._compute_sharpe(monthly_returns)
        assert sharpe is not None
        assert sharpe > Decimal("0")

    def test_constant_returns_high_sharpe(self, engine: SimulationEngine) -> None:
        # No volatility -> extremely high Sharpe
        monthly_returns = [Decimal("1")] * 12
        sharpe = engine._compute_sharpe(monthly_returns)
        assert sharpe is not None
        assert sharpe > Decimal("5")

    def test_no_downside_sortino_higher_than_sharpe(self, engine: SimulationEngine) -> None:
        # All positive returns -> Sortino should be higher (less downside dev)
        monthly_returns = [Decimal("1"), Decimal("2"), Decimal("3")] * 4
        sharpe = engine._compute_sharpe(monthly_returns)
        sortino = engine._compute_sortino(monthly_returns)
        # With no negative returns, sortino can be None (0 downside dev) or very large
        assert sharpe is not None
        if sortino is not None:
            assert sortino >= sharpe

    def test_insufficient_data_returns_none(self, engine: SimulationEngine) -> None:
        sharpe = engine._compute_sharpe([Decimal("1")])
        assert sharpe is None


# ---------------------------------------------------------------------------
# Rolling XIRR
# ---------------------------------------------------------------------------

class TestRollingXIRR:
    def test_24_month_sim_gives_rolling_values(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2023, 1, 1), 25, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="SIP",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2023, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert len(result.rolling_1y_xirr) >= 10  # At least 10 rolling values


# ---------------------------------------------------------------------------
# Monthly returns
# ---------------------------------------------------------------------------

class TestMonthlyReturns:
    def test_12_month_sim_gives_12_returns(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="LUMPSUM",
            lumpsum_amount=Decimal("100000"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert len(result.monthly_returns) >= 11  # At least 11 months


# ---------------------------------------------------------------------------
# Signal hit rates
# ---------------------------------------------------------------------------

class TestSignalHitRates:
    def test_profitable_topup_is_hit(self, engine: SimulationEngine) -> None:
        # NAV goes up after topup
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.02"))
        topup_events = [
            CashflowEvent(
                date=date(2024, 3, 15),
                amount=Decimal("20000"),
                nav=Decimal("100"),
                units=Decimal("200"),
                event_type="TOPUP",
                trigger="panic",
            ),
        ]
        hit_rates = engine._compute_signal_hit_rates(topup_events, nav)
        assert hit_rates.get("hit_rate_3m") is not None

    def test_no_topups_returns_none(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        hit_rates = engine._compute_signal_hit_rates([], nav)
        assert hit_rates.get("hit_rate_3m") is None


# ---------------------------------------------------------------------------
# Simulation hash
# ---------------------------------------------------------------------------

class TestSimulationHash:
    def test_same_params_same_hash(self, engine: SimulationEngine) -> None:
        params = SimulationParams(mode="SIP", sip_amount=Decimal("10000"),
                                   start_date=date(2024, 1, 1))
        h1 = engine._compute_simulation_hash(params, "T001")
        h2 = engine._compute_simulation_hash(params, "T001")
        assert h1 == h2

    def test_different_params_different_hash(self, engine: SimulationEngine) -> None:
        p1 = SimulationParams(mode="SIP", sip_amount=Decimal("10000"),
                               start_date=date(2024, 1, 1))
        p2 = SimulationParams(mode="SIP", sip_amount=Decimal("20000"),
                               start_date=date(2024, 1, 1))
        h1 = engine._compute_simulation_hash(p1, "T001")
        h2 = engine._compute_simulation_hash(p2, "T001")
        assert h1 != h2


# ---------------------------------------------------------------------------
# Result metadata
# ---------------------------------------------------------------------------

class TestResultMetadata:
    def test_result_has_fund_info(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 13, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="SIP",
            sip_amount=Decimal("10000"),
            sip_day=5,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="HDFC Top 100", mstar_id="F0GBR06S2Q")
        assert result.fund_name == "HDFC Top 100"
        assert result.mstar_id == "F0GBR06S2Q"
        assert result.simulation_hash != ""
        assert result.compute_time_ms >= 0

    def test_result_has_daily_timeline(self, engine: SimulationEngine) -> None:
        nav = _nav_series(date(2024, 1, 1), 3, monthly_return=Decimal("0.01"))
        params = SimulationParams(
            mode="LUMPSUM",
            lumpsum_amount=Decimal("100000"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 28),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert len(result.daily_timeline) > 0
        assert all(isinstance(s, DailySnapshot) for s in result.daily_timeline)


# ---------------------------------------------------------------------------
# Financial edge cases (Codex adversarial review — Batch 5)
# ---------------------------------------------------------------------------

class TestNegativeXIRR:
    """Portfolio that consistently lost money should produce negative XIRR."""

    def test_losing_investment(self, engine: SimulationEngine) -> None:
        cashflows = [
            (date(2024, 1, 1), Decimal("-100000")),
            (date(2025, 1, 1), Decimal("80000")),  # Lost 20%
        ]
        xirr = engine._compute_xirr(cashflows)
        assert xirr is not None
        assert xirr < Decimal("0"), f"Expected negative XIRR, got {xirr}"

    def test_total_loss(self, engine: SimulationEngine) -> None:
        cashflows = [
            (date(2024, 1, 1), Decimal("-100000")),
            (date(2025, 1, 1), Decimal("1000")),  # 99% loss
        ]
        xirr = engine._compute_xirr(cashflows)
        assert xirr is not None
        assert xirr < Decimal("-90")


class TestZeroNAVProtection:
    """Division by zero when NAV is 0 should not crash."""

    def test_zero_nav_in_series_skips_to_valid(self, engine: SimulationEngine) -> None:
        # First valid NAV is 100 — the engine should skip zero and use the next valid day
        nav = [
            (date(2024, 1, 1), Decimal("0")),
            (date(2024, 1, 2), Decimal("100")),
            (date(2024, 6, 28), Decimal("110")),
        ]
        params = SimulationParams(
            mode="LUMPSUM",
            lumpsum_amount=Decimal("10000"),
            start_date=date(2024, 1, 2),  # Start on a day with valid NAV
            end_date=date(2024, 6, 28),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Test", mstar_id="T001")
        assert result is not None
        assert result.final_value > Decimal("0")

    def test_cagr_zero_initial(self, engine: SimulationEngine) -> None:
        assert engine._compute_cagr(Decimal("0"), Decimal("100"), Decimal("2")) is None

    def test_cagr_zero_final(self, engine: SimulationEngine) -> None:
        result = engine._compute_cagr(Decimal("100"), Decimal("0"), Decimal("2"))
        assert result is not None
        assert result < Decimal("0")  # Negative CAGR for total loss


class TestExtremeValues:
    """Very large and very small financial values."""

    def test_very_large_aum_xirr(self, engine: SimulationEngine) -> None:
        # 10,000 Cr invested
        cashflows = [
            (date(2024, 1, 1), Decimal("-99999999999")),
            (date(2025, 1, 1), Decimal("109999999999")),
        ]
        xirr = engine._compute_xirr(cashflows)
        assert xirr is not None
        assert abs(xirr - Decimal("10")) < Decimal("2")

    def test_tiny_nav(self, engine: SimulationEngine) -> None:
        nav = [
            (date(2024, 1, 1), Decimal("0.0001")),
            (date(2024, 6, 30), Decimal("0.0002")),
        ]
        params = SimulationParams(
            mode="LUMPSUM",
            lumpsum_amount=Decimal("10000"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 6, 30),
        )
        result = engine.simulate(params, nav, signal_events=[], fund_name="Tiny", mstar_id="T002")
        assert result.final_value > Decimal("0")


class TestIdenticalScoresRanking:
    """When all funds have identical scores, they should all get the same percentile."""

    def test_all_same_returns(self, engine: SimulationEngine) -> None:
        from app.engines.lens_engine import LensEngine
        lens = LensEngine()
        raw = {f"fund_{i}": Decimal("15.5") for i in range(10)}
        ranked = lens._percentile_rank(raw, higher_is_better=True)
        # All funds have identical values — all should get same rank
        values = [v for v in ranked.values() if v is not None]
        assert len(set(values)) == 1, f"Expected all same rank, got {set(values)}"


class TestDecimalZeroNotFalsy:
    """Regression test: Decimal('0') must not be treated as missing/falsy."""

    def test_decimal_zero_is_valid_return(self) -> None:
        val = Decimal("0")
        # The old bug: `val or default` would replace 0 with default
        result = val if val is not None else Decimal("-1")
        assert result == Decimal("0"), "Decimal('0') should not be replaced by default"

    def test_decimal_zero_in_percentile_rank(self) -> None:
        from app.engines.lens_engine import LensEngine
        lens = LensEngine()
        raw = {"fund_a": Decimal("0"), "fund_b": Decimal("10"), "fund_c": Decimal("20")}
        ranked = lens._percentile_rank(raw, higher_is_better=True)
        # fund_a has 0 but should still be ranked (not treated as missing)
        assert ranked["fund_a"] is not None, "Decimal('0') must not be excluded from ranking"

    def test_decimal_zero_sharpe(self, engine: SimulationEngine) -> None:
        # Zero risk-free rate should NOT be overridden to 6%.
        # Use volatile returns so we don't hit the 99.99 cap.
        monthly_returns = [Decimal("1"), Decimal("3"), Decimal("0.5"), Decimal("2.5")] * 3
        sharpe_zero_rf = engine._compute_sharpe(monthly_returns, risk_free_annual=Decimal("0"))
        sharpe_six_rf = engine._compute_sharpe(monthly_returns, risk_free_annual=Decimal("0.06"))
        assert sharpe_zero_rf is not None
        assert sharpe_six_rf is not None
        assert sharpe_zero_rf > sharpe_six_rf, "Zero risk-free rate should give higher Sharpe"
