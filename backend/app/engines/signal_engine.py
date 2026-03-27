"""
Signal Engine -- Multi-source signal evaluation with AND/OR combinatorial logic.

Signal sources:
  - MarketPulse breadth (stocks above 21/50/200 EMA, new lows, advance-decline)
  - MarketPulse sentiment (composite score, 0-100)
  - MarketPulse sector RS (count of leading sectors)
  - Index momentum (NIFTY 50 vs 200 SMA -- above or below)
  - VIX level (from index data)

Each SignalRule defines:
  - A set of conditions (signal_name, operator, threshold)
  - Logic: AND (all must be true) or OR (any must be true)
  - Multiplier: how much extra to deploy (1x = same as SIP, 3x = triple)
  - Cooloff: minimum days between triggers of this rule
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

VALID_OPERATORS = {"BELOW", "ABOVE", "CROSSES_BELOW", "CROSSES_ABOVE"}


@dataclass(frozen=True)
class SignalCondition:
    """One condition to evaluate."""

    signal_name: str
    operator: str
    threshold: float

    def evaluate(
        self, current_value: float, previous_value: Optional[float] = None
    ) -> bool:
        """Evaluate this condition against current (and optional previous) value."""
        if self.operator == "BELOW":
            return current_value < self.threshold
        if self.operator == "ABOVE":
            return current_value > self.threshold
        if self.operator == "CROSSES_BELOW":
            if previous_value is None:
                return False
            return previous_value >= self.threshold and current_value < self.threshold
        if self.operator == "CROSSES_ABOVE":
            if previous_value is None:
                return False
            return previous_value <= self.threshold and current_value > self.threshold
        return False


@dataclass(frozen=True)
class SignalRule:
    """A named rule with conditions, logic, and deployment parameters."""

    name: str
    conditions: list[SignalCondition]
    logic: str = "AND"
    multiplier: float = 1.0
    cooloff_days: int = 30

    def evaluate(
        self,
        signal_data: dict,
        previous_signal_data: Optional[dict] = None,
    ) -> bool:
        """
        Evaluate all conditions against current signal data.
        AND: all conditions must be True.
        OR: at least one condition must be True.
        Returns True if the rule fires.
        """
        if not self.conditions:
            return False

        results: list[bool] = []
        for cond in self.conditions:
            current = signal_data.get(cond.signal_name)
            if current is None:
                results.append(False)
                continue
            previous = (
                previous_signal_data.get(cond.signal_name)
                if previous_signal_data
                else None
            )
            results.append(cond.evaluate(current, previous))

        if self.logic == "OR":
            return any(results)
        return all(results)  # Default to AND


@dataclass
class SignalEvent:
    """A fired signal event."""

    date: date
    rule_name: str
    multiplier: float
    conditions_met: list[str]
    signal_snapshot: dict


# --- Pre-built Rule Templates ---

DEFAULT_RULES: list[SignalRule] = [
    SignalRule(
        name="Mild correction",
        conditions=[
            SignalCondition("breadth_pct_above_21ema", "BELOW", 30.0),
        ],
        logic="AND",
        multiplier=1.0,
        cooloff_days=30,
    ),
    SignalRule(
        name="Moderate panic",
        conditions=[
            SignalCondition("breadth_pct_above_200ema", "BELOW", 40.0),
            SignalCondition("sentiment_composite", "BELOW", 35.0),
        ],
        logic="AND",
        multiplier=2.0,
        cooloff_days=21,
    ),
    SignalRule(
        name="Deep panic -- max deploy",
        conditions=[
            SignalCondition("breadth_pct_above_200ema", "BELOW", 25.0),
            SignalCondition("sentiment_composite", "BELOW", 20.0),
        ],
        logic="AND",
        multiplier=3.0,
        cooloff_days=14,
    ),
    SignalRule(
        name="Trend recovery",
        conditions=[
            SignalCondition("nifty_above_200sma", "ABOVE", 0),
            SignalCondition("breadth_pct_above_50ema", "ABOVE", 60.0),
        ],
        logic="AND",
        multiplier=1.5,
        cooloff_days=45,
    ),
]


class SignalEngine:
    """
    Evaluates signal rules against daily signal data.
    Returns list of SignalEvents for a date range.
    """

    def __init__(self, rules: Optional[list[SignalRule]] = None) -> None:
        self.rules = rules if rules is not None else list(DEFAULT_RULES)

    def evaluate_range(
        self,
        signal_data_series: dict[date, dict],
        start_date: date,
        end_date: date,
    ) -> list[SignalEvent]:
        """
        Walk through each date in signal_data_series.
        For each date, evaluate all rules. If any fires (respecting cooloff),
        create a SignalEvent. If multiple rules fire on the same day,
        the one with the highest multiplier wins.
        Returns chronologically sorted list of SignalEvents.
        """
        if not signal_data_series:
            return []

        sorted_dates = sorted(
            d for d in signal_data_series if start_date <= d <= end_date
        )
        if not sorted_dates:
            return []

        events: list[SignalEvent] = []
        active_cooloffs: dict[str, date] = {}
        previous_data: Optional[dict] = None

        for current_date in sorted_dates:
            current_data = signal_data_series[current_date]
            event = self.evaluate_single_day(
                signal_data=current_data,
                previous_signal_data=previous_data,
                active_cooloffs=active_cooloffs,
                current_date=current_date,
            )
            if event is not None:
                events.append(event)
                active_cooloffs[event.rule_name] = current_date
            previous_data = current_data

        return events

    def evaluate_single_day(
        self,
        signal_data: dict,
        previous_signal_data: Optional[dict],
        active_cooloffs: dict[str, date],
        current_date: date,
    ) -> Optional[SignalEvent]:
        """Evaluate all rules for one day. Returns highest-multiplier event or None."""
        candidates: list[SignalEvent] = []

        for rule in self.rules:
            # Check cooloff
            last_fired = active_cooloffs.get(rule.name)
            if last_fired is not None:
                days_since = (current_date - last_fired).days
                if days_since < rule.cooloff_days:
                    continue

            if rule.evaluate(signal_data, previous_signal_data):
                conditions_met = [
                    c.signal_name
                    for c in rule.conditions
                    if signal_data.get(c.signal_name) is not None
                    and c.evaluate(
                        signal_data[c.signal_name],
                        (
                            previous_signal_data.get(c.signal_name)
                            if previous_signal_data
                            else None
                        ),
                    )
                ]
                candidates.append(
                    SignalEvent(
                        date=current_date,
                        rule_name=rule.name,
                        multiplier=rule.multiplier,
                        conditions_met=conditions_met,
                        signal_snapshot=dict(signal_data),
                    )
                )

        if not candidates:
            return None

        # Highest multiplier wins
        return max(candidates, key=lambda e: e.multiplier)
