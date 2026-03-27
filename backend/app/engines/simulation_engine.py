"""
SIP/Lumpsum Simulation Engine

4 investment modes:
  Mode 1: Pure SIP -- fixed amount on fixed date (Nth of month), no signals
  Mode 2: SIP + Signal Top-ups -- regular SIP + extra on signal events
  Mode 3: Pure Lumpsum -- deploy full amount at start date
  Mode 4: Hybrid -- SIP + lumpsum reserve deployed in chunks on deep signals

All money computations use Decimal. NAV values from Morningstar (already in DB).
Signal events from SignalEngine.

The engine takes sorted NAV tuples in, returns structured results out.
No DB dependency.
"""

from __future__ import annotations

import hashlib
import logging
import time
from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Optional

from app.engines.signal_engine import SignalEvent

logger = logging.getLogger(__name__)

VALID_MODES = {"SIP", "SIP_SIGNAL", "LUMPSUM", "HYBRID"}
NAV_FORWARD_SEARCH_DAYS = 10


@dataclass(frozen=True)
class SimulationParams:
    """All parameters for one simulation run."""

    mode: str = "SIP"
    sip_amount: Decimal = Decimal("10000")
    sip_day: int = 5
    lumpsum_amount: Decimal = Decimal("0")
    lumpsum_deploy_pct: Decimal = Decimal("100")
    start_date: date = date(2020, 1, 1)
    end_date: Optional[date] = None
    benchmark_index: str = "NIFTY 50 TRI"


@dataclass
class CashflowEvent:
    """Single investment event."""

    date: date
    amount: Decimal
    nav: Decimal
    units: Decimal
    event_type: str  # "SIP", "TOPUP", "LUMPSUM"
    trigger: str  # "scheduled", rule_name, etc.


@dataclass
class DailySnapshot:
    """Portfolio state on one day."""

    date: date
    nav: Decimal
    cumulative_units: Decimal
    cumulative_invested: Decimal
    portfolio_value: Decimal
    benchmark_value: Optional[Decimal] = None


@dataclass
class SimulationResult:
    """Complete output of a simulation run."""

    params: SimulationParams
    mode: str

    # Summary statistics
    total_invested: Decimal
    final_value: Decimal
    absolute_return_pct: Decimal
    xirr_pct: Optional[Decimal]
    cagr_pct: Optional[Decimal]
    max_drawdown_pct: Decimal
    max_drawdown_start: Optional[date]
    max_drawdown_end: Optional[date]
    sharpe_ratio: Optional[Decimal]
    sortino_ratio: Optional[Decimal]

    # SIP-specific
    num_sips: int
    num_topups: int
    topup_invested: Decimal

    # Signal-specific
    signal_hit_rate_3m: Optional[Decimal]
    signal_hit_rate_6m: Optional[Decimal]
    signal_hit_rate_12m: Optional[Decimal]
    capital_efficiency: Optional[Decimal]

    # Benchmark comparison
    benchmark_cagr_pct: Optional[Decimal]
    alpha_vs_benchmark: Optional[Decimal]

    # Time series
    daily_timeline: list[DailySnapshot]
    cashflow_events: list[CashflowEvent]
    signal_events: list[SignalEvent]

    # Rolling metrics
    rolling_1y_xirr: list[dict]
    monthly_returns: list[dict]

    # Metadata
    fund_name: str
    mstar_id: str
    simulation_hash: str
    compute_time_ms: int


class SimulationEngine:
    """Core simulation engine. Pure computation -- no DB access."""

    def simulate(
        self,
        params: SimulationParams,
        nav_series: list[tuple[date, Decimal]],
        signal_events: list[SignalEvent],
        benchmark_series: Optional[list[tuple[date, Decimal]]] = None,
        fund_name: str = "",
        mstar_id: str = "",
    ) -> SimulationResult:
        """
        Run a full simulation.

        Steps:
          1. Generate cashflow events (SIP/lumpsum/topup)
          2. Build daily portfolio value timeline
          3. Compute all statistics
          4. Package into SimulationResult
        """
        start_time = time.monotonic()
        end_date = params.end_date or (nav_series[-1][0] if nav_series else params.start_date)

        # Build NAV lookup dict for fast access
        nav_dict: dict[date, Decimal] = {d: n for d, n in nav_series}

        # 1. Generate cashflow events
        cashflow_events: list[CashflowEvent] = []

        if params.mode in ("SIP", "SIP_SIGNAL", "HYBRID"):
            sip_dates = self._generate_sip_dates(params.start_date, end_date, params.sip_day)
            for sd in sip_dates:
                event = self._process_sip(sd, params.sip_amount, nav_series)
                if event:
                    cashflow_events.append(event)

        if params.mode == "LUMPSUM":
            event = self._process_lumpsum(params.start_date, params.lumpsum_amount, nav_series)
            if event:
                cashflow_events.append(event)

        if params.mode in ("SIP_SIGNAL", "HYBRID"):
            for se in signal_events:
                if params.start_date <= se.date <= end_date:
                    event = self._process_topup(se, params.sip_amount, nav_series)
                    if event:
                        cashflow_events.append(event)

        if params.mode == "HYBRID" and signal_events:
            remaining_reserve = params.lumpsum_amount
            for se in sorted(signal_events, key=lambda e: e.date):
                if remaining_reserve <= Decimal("0"):
                    break
                if params.start_date <= se.date <= end_date:
                    deploy = (remaining_reserve * params.lumpsum_deploy_pct / Decimal("100")).quantize(
                        Decimal("0.01"), ROUND_HALF_UP
                    )
                    deploy = min(deploy, remaining_reserve)
                    event = self._process_lumpsum(se.date, deploy, nav_series)
                    if event:
                        cashflow_events.append(event)
                        remaining_reserve -= deploy

        # Sort by date
        cashflow_events.sort(key=lambda e: e.date)

        # 2. Build daily timeline
        daily_timeline = self._build_timeline(
            cashflow_events, nav_series, params.start_date, end_date, benchmark_series
        )

        # 3. Compute statistics
        total_invested = sum(ce.amount for ce in cashflow_events)
        final_value = daily_timeline[-1].portfolio_value if daily_timeline else Decimal("0")

        abs_return = Decimal("0")
        if total_invested > Decimal("0"):
            abs_return = ((final_value - total_invested) / total_invested * Decimal("100")).quantize(
                Decimal("0.01"), ROUND_HALF_UP
            )

        # XIRR cashflows: negative for investments, positive for final value
        xirr_cashflows: list[tuple[date, Decimal]] = [
            (ce.date, -ce.amount) for ce in cashflow_events
        ]
        if daily_timeline:
            xirr_cashflows.append((daily_timeline[-1].date, final_value))
        xirr_pct = self._compute_xirr(xirr_cashflows)

        # CAGR
        years = Decimal("0")
        if daily_timeline and len(daily_timeline) > 1:
            delta = (daily_timeline[-1].date - daily_timeline[0].date).days
            years = Decimal(str(delta)) / Decimal("365.25")
        cagr_pct = self._compute_cagr(total_invested, final_value, years) if total_invested > 0 else None

        # Max drawdown
        dd_pct, dd_start, dd_end = self._compute_max_drawdown(daily_timeline)

        # Monthly returns
        monthly_rets_list = self._compute_monthly_returns(daily_timeline)
        monthly_ret_values = [Decimal(str(m["return_pct"])) for m in monthly_rets_list]

        # Sharpe / Sortino
        sharpe = self._compute_sharpe(monthly_ret_values)
        sortino = self._compute_sortino(monthly_ret_values)

        # Rolling XIRR
        rolling_xirr = self._compute_rolling_xirr(cashflow_events, daily_timeline)

        # Signal hit rates
        topup_events = [ce for ce in cashflow_events if ce.event_type == "TOPUP"]
        hit_rates = self._compute_signal_hit_rates(topup_events, nav_series)

        # Benchmark comparison
        benchmark_cagr = None
        alpha = None
        if benchmark_series and len(benchmark_series) > 1 and daily_timeline:
            bm_start = benchmark_series[0][1]
            bm_end = benchmark_series[-1][1]
            bm_years = Decimal(str((benchmark_series[-1][0] - benchmark_series[0][0]).days)) / Decimal("365.25")
            benchmark_cagr = self._compute_cagr(bm_start, bm_end, bm_years)
            if benchmark_cagr is not None and cagr_pct is not None:
                alpha = (cagr_pct - benchmark_cagr).quantize(Decimal("0.01"), ROUND_HALF_UP)

        num_sips = len([ce for ce in cashflow_events if ce.event_type == "SIP"])
        num_topups = len(topup_events)
        topup_invested = sum(ce.amount for ce in topup_events)

        compute_time_ms = int((time.monotonic() - start_time) * 1000)

        return SimulationResult(
            params=params,
            mode=params.mode,
            total_invested=total_invested,
            final_value=final_value,
            absolute_return_pct=abs_return,
            xirr_pct=xirr_pct,
            cagr_pct=cagr_pct,
            max_drawdown_pct=dd_pct,
            max_drawdown_start=dd_start,
            max_drawdown_end=dd_end,
            sharpe_ratio=sharpe,
            sortino_ratio=sortino,
            num_sips=num_sips,
            num_topups=num_topups,
            topup_invested=topup_invested,
            signal_hit_rate_3m=hit_rates.get("hit_rate_3m"),
            signal_hit_rate_6m=hit_rates.get("hit_rate_6m"),
            signal_hit_rate_12m=hit_rates.get("hit_rate_12m"),
            capital_efficiency=hit_rates.get("capital_efficiency"),
            benchmark_cagr_pct=benchmark_cagr,
            alpha_vs_benchmark=alpha,
            daily_timeline=daily_timeline,
            cashflow_events=cashflow_events,
            signal_events=signal_events,
            rolling_1y_xirr=rolling_xirr,
            monthly_returns=monthly_rets_list,
            fund_name=fund_name,
            mstar_id=mstar_id,
            simulation_hash=self._compute_simulation_hash(params, mstar_id),
            compute_time_ms=compute_time_ms,
        )

    # --- Investment Processing ---

    def _generate_sip_dates(self, start: date, end: date, sip_day: int) -> list[date]:
        """Generate SIP dates (Nth of every month in range)."""
        dates: list[date] = []
        year, month = start.year, start.month

        while True:
            max_day = monthrange(year, month)[1]
            actual_day = min(sip_day, max_day)
            sip_date = date(year, month, actual_day)

            if sip_date > end:
                break
            if sip_date >= start:
                dates.append(sip_date)

            # Next month
            if month == 12:
                year += 1
                month = 1
            else:
                month += 1

        return dates

    def _get_nav_on_date(
        self, nav_series: list[tuple[date, Decimal]], target: date
    ) -> Optional[tuple[date, Decimal]]:
        """Get NAV on target date or next available trading day (up to 10 days forward)."""
        nav_dict = {d: n for d, n in nav_series}
        for offset in range(NAV_FORWARD_SEARCH_DAYS + 1):
            check_date = target + timedelta(days=offset)
            if check_date in nav_dict:
                return (check_date, nav_dict[check_date])
        return None

    def _process_sip(
        self, sip_date: date, amount: Decimal, nav_series: list[tuple[date, Decimal]]
    ) -> Optional[CashflowEvent]:
        """Process one SIP installment."""
        result = self._get_nav_on_date(nav_series, sip_date)
        if result is None:
            return None
        actual_date, nav = result
        units = (amount / nav).quantize(Decimal("0.0001"), ROUND_HALF_UP)
        return CashflowEvent(
            date=actual_date,
            amount=amount,
            nav=nav,
            units=units,
            event_type="SIP",
            trigger="scheduled",
        )

    def _process_topup(
        self, event: SignalEvent, sip_amount: Decimal, nav_series: list[tuple[date, Decimal]]
    ) -> Optional[CashflowEvent]:
        """Process one signal-triggered top-up. Amount = sip_amount x multiplier."""
        result = self._get_nav_on_date(nav_series, event.date)
        if result is None:
            return None
        actual_date, nav = result
        amount = (sip_amount * Decimal(str(event.multiplier))).quantize(
            Decimal("0.01"), ROUND_HALF_UP
        )
        units = (amount / nav).quantize(Decimal("0.0001"), ROUND_HALF_UP)
        return CashflowEvent(
            date=actual_date,
            amount=amount,
            nav=nav,
            units=units,
            event_type="TOPUP",
            trigger=event.rule_name,
        )

    def _process_lumpsum(
        self, deploy_date: date, amount: Decimal, nav_series: list[tuple[date, Decimal]]
    ) -> Optional[CashflowEvent]:
        """Process a lumpsum deployment."""
        if amount <= Decimal("0"):
            return None
        result = self._get_nav_on_date(nav_series, deploy_date)
        if result is None:
            return None
        actual_date, nav = result
        units = (amount / nav).quantize(Decimal("0.0001"), ROUND_HALF_UP)
        return CashflowEvent(
            date=actual_date,
            amount=amount,
            nav=nav,
            units=units,
            event_type="LUMPSUM",
            trigger="lumpsum_deploy",
        )

    # --- Timeline ---

    def _build_timeline(
        self,
        cashflow_events: list[CashflowEvent],
        nav_series: list[tuple[date, Decimal]],
        start_date: date,
        end_date: date,
        benchmark_series: Optional[list[tuple[date, Decimal]]] = None,
    ) -> list[DailySnapshot]:
        """Build daily portfolio value timeline."""
        if not cashflow_events or not nav_series:
            return []

        # Pre-compute cashflows by date
        cf_by_date: dict[date, list[CashflowEvent]] = {}
        for ce in cashflow_events:
            cf_by_date.setdefault(ce.date, []).append(ce)

        benchmark_dict: dict[date, Decimal] = {}
        if benchmark_series:
            benchmark_dict = {d: v for d, v in benchmark_series}

        timeline: list[DailySnapshot] = []
        cumulative_units = Decimal("0")
        cumulative_invested = Decimal("0")

        for nav_date, nav_val in nav_series:
            if nav_date < start_date or nav_date > end_date:
                continue

            # Apply cashflows for this date
            for ce in cf_by_date.get(nav_date, []):
                cumulative_units += ce.units
                cumulative_invested += ce.amount

            if cumulative_units == Decimal("0"):
                continue

            portfolio_value = (cumulative_units * nav_val).quantize(
                Decimal("0.01"), ROUND_HALF_UP
            )
            timeline.append(
                DailySnapshot(
                    date=nav_date,
                    nav=nav_val,
                    cumulative_units=cumulative_units,
                    cumulative_invested=cumulative_invested,
                    portfolio_value=portfolio_value,
                    benchmark_value=benchmark_dict.get(nav_date),
                )
            )

        return timeline

    # --- Statistics ---

    def _compute_xirr(
        self, cashflows: list[tuple[date, Decimal]]
    ) -> Optional[Decimal]:
        """
        XIRR using Newton-Raphson method.
        Cashflows: [(date, -amount), ..., (date, +final_value)]
        Negative = money invested, positive = money returned.
        """
        if len(cashflows) < 2:
            return None

        dates = [cf[0] for cf in cashflows]
        amounts = [float(cf[1]) for cf in cashflows]  # float required for Newton-Raphson — Decimal inputs validated upstream
        base_date = min(dates)

        # Check that dates span more than 0 days
        day_diffs = [(d - base_date).days for d in dates]
        if max(day_diffs) == 0:
            return None

        year_fracs = [d / 365.25 for d in day_diffs]

        def npv(rate: float) -> float:
            return sum(a / (1 + rate) ** t for a, t in zip(amounts, year_fracs))

        def npv_deriv(rate: float) -> float:
            return sum(
                -t * a / (1 + rate) ** (t + 1)
                for a, t in zip(amounts, year_fracs)
            )

        # Newton-Raphson
        rate = 0.1  # Initial guess: 10%
        for _ in range(100):
            val = npv(rate)
            deriv = npv_deriv(rate)
            if abs(deriv) < 1e-12:
                break
            new_rate = rate - val / deriv
            if abs(new_rate - rate) < 1e-9:
                rate = new_rate
                break
            rate = new_rate
            # Guard against divergence
            if rate < -0.99:
                rate = -0.99
            if rate > 10:
                rate = 10

        try:
            result = Decimal(str(round(rate * 100, 6)))
            if result < Decimal("-99") or result > Decimal("1000"):
                return None
            return result
        except (InvalidOperation, ValueError):
            return None

    def _compute_cagr(
        self, initial: Decimal, final: Decimal, years: Decimal
    ) -> Optional[Decimal]:
        """CAGR = (final/initial)^(1/years) - 1"""
        if initial <= Decimal("0") or years <= Decimal("0"):
            return None
        try:
            ratio = float(final / initial)  # float required for math.pow — Decimal inputs validated upstream
            exp = 1.0 / float(years)  # float required for math.pow — Decimal inputs validated upstream
            cagr = (ratio ** exp - 1) * 100
            return Decimal(str(round(cagr, 6)))
        except (OverflowError, ZeroDivisionError, ValueError):
            return None

    def _compute_max_drawdown(
        self, timeline: list[DailySnapshot]
    ) -> tuple[Decimal, Optional[date], Optional[date]]:
        """
        Max peak-to-trough drawdown.
        Returns (drawdown_pct, peak_date, trough_date).
        """
        if not timeline:
            return Decimal("0"), None, None

        peak = timeline[0].portfolio_value
        peak_date = timeline[0].date
        max_dd = Decimal("0")
        dd_peak_date: Optional[date] = None
        dd_trough_date: Optional[date] = None

        for snap in timeline:
            if snap.portfolio_value >= peak:
                peak = snap.portfolio_value
                peak_date = snap.date

            if peak > Decimal("0"):
                dd = ((peak - snap.portfolio_value) / peak * Decimal("100")).quantize(
                    Decimal("0.01"), ROUND_HALF_UP
                )
                if dd > max_dd:
                    max_dd = dd
                    dd_peak_date = peak_date
                    dd_trough_date = snap.date

        return max_dd, dd_peak_date, dd_trough_date

    def _compute_sharpe(
        self,
        monthly_returns: list[Decimal],
        risk_free_annual: Decimal = Decimal("0.06"),
    ) -> Optional[Decimal]:
        """Sharpe = (avg_monthly_return - rf_monthly) / std_monthly_return * sqrt(12)"""
        if len(monthly_returns) < 2:
            return None

        rf_monthly = float(risk_free_annual) / 12  # float required for std/variance math — Decimal inputs validated upstream
        returns = [float(r) for r in monthly_returns]  # float required for std/variance math — Decimal inputs validated upstream
        avg = sum(returns) / len(returns)
        variance = sum((r - avg) ** 2 for r in returns) / (len(returns) - 1)
        std = variance ** 0.5

        if std < 1e-10:
            # Near-zero volatility -> very high Sharpe
            return Decimal("99.99") if avg > rf_monthly else Decimal("0")

        sharpe = (avg - rf_monthly) / std * (12 ** 0.5)
        return Decimal(str(round(sharpe, 6)))

    def _compute_sortino(
        self,
        monthly_returns: list[Decimal],
        risk_free_annual: Decimal = Decimal("0.06"),
    ) -> Optional[Decimal]:
        """Sortino = (avg_monthly_return - rf_monthly) / downside_std * sqrt(12)"""
        if len(monthly_returns) < 2:
            return None

        rf_monthly = float(risk_free_annual) / 12  # float required for downside std math — Decimal inputs validated upstream
        returns = [float(r) for r in monthly_returns]  # float required for downside std math — Decimal inputs validated upstream
        avg = sum(returns) / len(returns)
        downside = [min(r - rf_monthly, 0) ** 2 for r in returns]
        downside_var = sum(downside) / len(downside)
        downside_std = downside_var ** 0.5

        if downside_std < 1e-10:
            return Decimal("99.99") if avg > rf_monthly else None

        sortino = (avg - rf_monthly) / downside_std * (12 ** 0.5)
        return Decimal(str(round(sortino, 6)))

    def _compute_rolling_xirr(
        self,
        cashflow_events: list[CashflowEvent],
        timeline: list[DailySnapshot],
    ) -> list[dict]:
        """
        Rolling 1Y XIRR computed monthly.
        For each month-end, compute XIRR using cashflows from the past 12 months.
        """
        if not timeline or not cashflow_events:
            return []

        result: list[dict] = []
        # Group timeline by month
        months: dict[tuple[int, int], DailySnapshot] = {}
        for snap in timeline:
            key = (snap.date.year, snap.date.month)
            months[key] = snap  # Last snapshot of each month

        sorted_months = sorted(months.keys())
        if len(sorted_months) < 13:
            # Need at least 13 months for first rolling 1Y
            # Use what we have if > 6 months
            if len(sorted_months) < 7:
                return []

        for i in range(12, len(sorted_months)):
            end_key = sorted_months[i]
            start_key = sorted_months[i - 12] if i >= 12 else sorted_months[0]

            end_snap = months[end_key]
            start_date = date(start_key[0], start_key[1], 1)
            end_date_val = end_snap.date

            # Cashflows in this window
            window_cfs: list[tuple[date, Decimal]] = []
            for ce in cashflow_events:
                if start_date <= ce.date <= end_date_val:
                    window_cfs.append((ce.date, -ce.amount))

            if not window_cfs:
                continue

            window_cfs.append((end_date_val, end_snap.portfolio_value))
            xirr = self._compute_xirr(window_cfs)
            if xirr is not None:
                result.append({
                    "date": end_date_val.isoformat(),
                    "xirr": float(xirr),
                })

        return result

    def _compute_monthly_returns(
        self, timeline: list[DailySnapshot]
    ) -> list[dict]:
        """Monthly portfolio returns from daily timeline."""
        if not timeline:
            return []

        # Group by month, take last snapshot
        monthly: dict[tuple[int, int], DailySnapshot] = {}
        for snap in timeline:
            key = (snap.date.year, snap.date.month)
            monthly[key] = snap

        sorted_months = sorted(monthly.keys())
        result: list[dict] = []

        for i in range(1, len(sorted_months)):
            prev = monthly[sorted_months[i - 1]]
            curr = monthly[sorted_months[i]]
            if prev.portfolio_value > Decimal("0"):
                ret = ((curr.portfolio_value - prev.portfolio_value) / prev.portfolio_value * Decimal("100")).quantize(
                    Decimal("0.01"), ROUND_HALF_UP
                )
                result.append({
                    "month": f"{curr.date.year}-{curr.date.month:02d}",
                    "return_pct": float(ret),
                })

        return result

    def _compute_signal_hit_rates(
        self,
        topup_events: list[CashflowEvent],
        nav_series: list[tuple[date, Decimal]],
    ) -> dict:
        """
        For each top-up event, check if the investment was profitable after 3m, 6m, 12m.
        Hit rate = profitable_topups / total_topups.
        """
        if not topup_events:
            return {
                "hit_rate_3m": None,
                "hit_rate_6m": None,
                "hit_rate_12m": None,
                "capital_efficiency": None,
            }

        nav_dict = {d: n for d, n in nav_series}

        def _get_nav_near(target: date) -> Optional[Decimal]:
            for offset in range(NAV_FORWARD_SEARCH_DAYS + 1):
                check = target + timedelta(days=offset)
                if check in nav_dict:
                    return nav_dict[check]
            return None

        hits_3m = 0
        hits_6m = 0
        hits_12m = 0
        total_3m = 0
        total_6m = 0
        total_12m = 0

        for ce in topup_events:
            buy_nav = ce.nav

            nav_3m = _get_nav_near(ce.date + timedelta(days=90))
            if nav_3m is not None:
                total_3m += 1
                if nav_3m > buy_nav:
                    hits_3m += 1

            nav_6m = _get_nav_near(ce.date + timedelta(days=180))
            if nav_6m is not None:
                total_6m += 1
                if nav_6m > buy_nav:
                    hits_6m += 1

            nav_12m = _get_nav_near(ce.date + timedelta(days=365))
            if nav_12m is not None:
                total_12m += 1
                if nav_12m > buy_nav:
                    hits_12m += 1

        return {
            "hit_rate_3m": Decimal(str(round(hits_3m / total_3m * 100, 1))) if total_3m > 0 else None,
            "hit_rate_6m": Decimal(str(round(hits_6m / total_6m * 100, 1))) if total_6m > 0 else None,
            "hit_rate_12m": Decimal(str(round(hits_12m / total_12m * 100, 1))) if total_12m > 0 else None,
            "capital_efficiency": None,  # Computed at service level (needs baseline comparison)
        }

    def _compute_simulation_hash(self, params: SimulationParams, mstar_id: str) -> str:
        """Deterministic hash for cache/dedup."""
        raw = f"{mstar_id}:{params.mode}:{params.sip_amount}:{params.sip_day}:" \
              f"{params.lumpsum_amount}:{params.start_date}:{params.end_date}:" \
              f"{params.benchmark_index}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]
