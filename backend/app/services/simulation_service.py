"""Orchestrates simulation runs: loads data from DB, calls engines, audits."""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.engines.signal_engine import SignalEngine, SignalRule
from app.engines.simulation_engine import (
    SimulationEngine,
    SimulationParams,
    SimulationResult,
)
from app.models.db.nav_daily import NavDaily
from app.repositories.audit_repo import AuditRepository
from app.services.marketpulse_client import MarketPulseClient

logger = logging.getLogger(__name__)


class SimulationService:
    """
    Orchestrates simulation runs.
    Loads NAV from DB + signals from MarketPulse -> calls engines -> returns results.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.audit_repo = AuditRepository(db)
        self.sim_engine = SimulationEngine()
        self.signal_engine = SignalEngine()
        settings = get_settings()
        self.mp_client = MarketPulseClient(settings.marketpulse_base_url)

    def run_simulation(
        self,
        mstar_id: str,
        params: SimulationParams,
        signal_rules: Optional[list[SignalRule]] = None,
    ) -> SimulationResult:
        """
        Run a complete simulation for one fund.

        Steps:
          1. Load NAV history from nav_daily table
          2. Load benchmark NAV (optional)
          3. Load signal data from MarketPulse client
          4. Run SignalEngine to get signal events
          5. Run SimulationEngine to get result
          6. Log to audit_trail
          7. Return result
        """
        end_date = params.end_date or date.today()

        # 1. Load NAV
        nav_series = self._load_nav_series(mstar_id, params.start_date, end_date)
        if not nav_series:
            raise NotFoundError(
                f"No NAV data for fund {mstar_id} in range "
                f"{params.start_date} to {end_date}",
                details={"mstar_id": mstar_id},
            )

        # 2. Load benchmark (optional, best-effort)
        benchmark_series = self._load_benchmark_series(
            params.benchmark_index, params.start_date, end_date
        )

        # 3. Load signal data + evaluate
        signal_events = []
        if params.mode in ("SIP_SIGNAL", "HYBRID"):
            signal_data = self._load_signal_data(params.start_date, end_date)
            if signal_data:
                engine = SignalEngine(rules=signal_rules) if signal_rules else self.signal_engine
                signal_events = engine.evaluate_range(
                    signal_data, params.start_date, end_date
                )

        # 4. Get fund name for result metadata
        fund_name = self._get_fund_name(mstar_id)

        # 5. Run simulation
        result = self.sim_engine.simulate(
            params=params,
            nav_series=nav_series,
            signal_events=signal_events,
            benchmark_series=benchmark_series,
            fund_name=fund_name,
            mstar_id=mstar_id,
        )

        # 6. Audit
        self.audit_repo.log(
            actor="simulation_engine",
            action="run_simulation",
            entity_type="simulation_result",
            entity_id=result.simulation_hash,
            details={
                "mstar_id": mstar_id,
                "mode": params.mode,
                "total_invested": str(result.total_invested),
                "final_value": str(result.final_value),
                "xirr_pct": str(result.xirr_pct) if result.xirr_pct else None,
                "num_sips": result.num_sips,
                "num_topups": result.num_topups,
                "compute_time_ms": result.compute_time_ms,
            },
        )
        self.db.commit()

        return result

    def compare_modes(
        self,
        mstar_id: str,
        sip_amount: Decimal,
        start_date: date,
        end_date: Optional[date] = None,
        signal_rules: Optional[list[SignalRule]] = None,
    ) -> dict:
        """
        Run all 4 modes for the same fund and return comparison.
        Lumpsum amount = total SIP amount over the period.
        """
        actual_end = end_date or date.today()

        # Calculate total SIP amount over period for lumpsum comparison
        months = (actual_end.year - start_date.year) * 12 + (actual_end.month - start_date.month)
        total_sip = sip_amount * Decimal(str(max(months, 1)))

        modes = {
            "pure_sip": SimulationParams(
                mode="SIP",
                sip_amount=sip_amount,
                start_date=start_date,
                end_date=actual_end,
            ),
            "sip_signal": SimulationParams(
                mode="SIP_SIGNAL",
                sip_amount=sip_amount,
                start_date=start_date,
                end_date=actual_end,
            ),
            "lumpsum": SimulationParams(
                mode="LUMPSUM",
                lumpsum_amount=total_sip,
                start_date=start_date,
                end_date=actual_end,
            ),
            "hybrid": SimulationParams(
                mode="HYBRID",
                sip_amount=sip_amount,
                lumpsum_amount=total_sip / Decimal("2"),
                lumpsum_deploy_pct=Decimal("50"),
                start_date=start_date,
                end_date=actual_end,
            ),
        }

        results = {}
        for key, params in modes.items():
            results[key] = self.run_simulation(mstar_id, params, signal_rules)

        return results

    def _load_nav_series(
        self, mstar_id: str, start: date, end: date
    ) -> list[tuple[date, Decimal]]:
        """Load NAV from nav_daily, return as sorted list of (date, nav) tuples."""
        rows = (
            self.db.query(NavDaily.nav_date, NavDaily.nav)
            .filter(
                NavDaily.mstar_id == mstar_id,
                NavDaily.nav_date >= start,
                NavDaily.nav_date <= end,
            )
            .order_by(NavDaily.nav_date)
            .all()
        )
        return [(row.nav_date, row.nav) for row in rows if row.nav is not None]

    def _load_benchmark_series(
        self, index_name: str, start: date, end: date
    ) -> Optional[list[tuple[date, Decimal]]]:
        """Load benchmark index data. Returns None if unavailable."""
        # Benchmark data will come from index_daily table (PR-05+)
        # For now, return None — simulation works without benchmark
        return None

    def _load_signal_data(
        self, start: date, end: date
    ) -> dict[date, dict]:
        """
        Load breadth/sentiment data from MarketPulse for signal evaluation.
        Returns { date: { breadth_pct_above_21ema: X, sentiment_composite: Y, ... } }
        Falls back to empty dict if MarketPulse unavailable.
        """
        breadth = self.mp_client.get_breadth_history(lookback="1y")
        if breadth is None:
            logger.warning("MarketPulse unavailable, running without signals")
            return {}

        # Transform MarketPulse response into date-keyed signal data
        signal_data: dict[date, dict] = {}
        history = breadth.get("history", [])
        for entry in history:
            try:
                d = date.fromisoformat(entry.get("date", ""))
                if start <= d <= end:
                    signal_data[d] = {
                        # Breadth fields: None if missing (triggers evaluate False)
                        "breadth_pct_above_21ema": entry.get("pct_above_21ema"),
                        "breadth_pct_above_50ema": entry.get("pct_above_50ema"),
                        "breadth_pct_above_200ema": entry.get("pct_above_200ema"),
                        # Sentiment/nifty come from different MP caches, not breadth.
                        # Default to neutral so rules that use these still fire.
                        "sentiment_composite": entry.get("sentiment_composite", 50),
                        "nifty_above_200sma": entry.get("nifty_above_200sma", 1),
                    }
            except (ValueError, TypeError):
                continue

        return signal_data

    def _get_fund_name(self, mstar_id: str) -> str:
        """Get fund name from fund_master. Returns mstar_id if not found."""
        from app.models.db.fund_master import FundMaster

        fund = (
            self.db.query(FundMaster.fund_name)
            .filter(FundMaster.mstar_id == mstar_id)
            .first()
        )
        return fund.fund_name if fund and fund.fund_name else mstar_id
