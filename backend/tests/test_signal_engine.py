"""Tests for signal engine — multi-source signal evaluation with AND/OR logic."""

from datetime import date, timedelta

import pytest

from app.engines.signal_engine import (
    DEFAULT_RULES,
    SignalCondition,
    SignalEngine,
    SignalEvent,
    SignalRule,
)


# ---------------------------------------------------------------------------
# SignalCondition.evaluate
# ---------------------------------------------------------------------------

class TestSignalConditionEvaluate:
    def test_below_true(self) -> None:
        cond = SignalCondition("breadth", "BELOW", 30.0)
        assert cond.evaluate(25.0) is True

    def test_below_false(self) -> None:
        cond = SignalCondition("breadth", "BELOW", 30.0)
        assert cond.evaluate(35.0) is False

    def test_below_equal_is_false(self) -> None:
        cond = SignalCondition("breadth", "BELOW", 30.0)
        assert cond.evaluate(30.0) is False

    def test_above_true(self) -> None:
        cond = SignalCondition("breadth", "ABOVE", 60.0)
        assert cond.evaluate(65.0) is True

    def test_above_false(self) -> None:
        cond = SignalCondition("breadth", "ABOVE", 60.0)
        assert cond.evaluate(55.0) is False

    def test_above_equal_is_false(self) -> None:
        cond = SignalCondition("breadth", "ABOVE", 60.0)
        assert cond.evaluate(60.0) is False

    def test_crosses_below_true(self) -> None:
        cond = SignalCondition("breadth", "CROSSES_BELOW", 30.0)
        assert cond.evaluate(25.0, previous_value=35.0) is True

    def test_crosses_below_both_below_is_false(self) -> None:
        cond = SignalCondition("breadth", "CROSSES_BELOW", 30.0)
        assert cond.evaluate(25.0, previous_value=20.0) is False

    def test_crosses_below_no_previous_is_false(self) -> None:
        cond = SignalCondition("breadth", "CROSSES_BELOW", 30.0)
        assert cond.evaluate(25.0) is False

    def test_crosses_above_true(self) -> None:
        cond = SignalCondition("breadth", "CROSSES_ABOVE", 60.0)
        assert cond.evaluate(65.0, previous_value=55.0) is True

    def test_crosses_above_both_above_is_false(self) -> None:
        cond = SignalCondition("breadth", "CROSSES_ABOVE", 60.0)
        assert cond.evaluate(65.0, previous_value=70.0) is False

    def test_crosses_above_no_previous_is_false(self) -> None:
        cond = SignalCondition("breadth", "CROSSES_ABOVE", 60.0)
        assert cond.evaluate(65.0) is False

    def test_invalid_operator_returns_false(self) -> None:
        cond = SignalCondition("breadth", "INVALID", 30.0)
        assert cond.evaluate(25.0) is False


# ---------------------------------------------------------------------------
# SignalRule.evaluate
# ---------------------------------------------------------------------------

class TestSignalRuleEvaluate:
    def test_and_all_true_fires(self) -> None:
        rule = SignalRule(
            name="test",
            conditions=[
                SignalCondition("breadth", "BELOW", 30.0),
                SignalCondition("sentiment", "BELOW", 35.0),
            ],
            logic="AND",
        )
        data = {"breadth": 20.0, "sentiment": 25.0}
        assert rule.evaluate(data) is True

    def test_and_one_false_does_not_fire(self) -> None:
        rule = SignalRule(
            name="test",
            conditions=[
                SignalCondition("breadth", "BELOW", 30.0),
                SignalCondition("sentiment", "BELOW", 35.0),
            ],
            logic="AND",
        )
        data = {"breadth": 20.0, "sentiment": 40.0}
        assert rule.evaluate(data) is False

    def test_or_one_true_fires(self) -> None:
        rule = SignalRule(
            name="test",
            conditions=[
                SignalCondition("breadth", "BELOW", 30.0),
                SignalCondition("sentiment", "BELOW", 35.0),
            ],
            logic="OR",
        )
        data = {"breadth": 20.0, "sentiment": 40.0}
        assert rule.evaluate(data) is True

    def test_or_both_false_does_not_fire(self) -> None:
        rule = SignalRule(
            name="test",
            conditions=[
                SignalCondition("breadth", "BELOW", 30.0),
                SignalCondition("sentiment", "BELOW", 35.0),
            ],
            logic="OR",
        )
        data = {"breadth": 40.0, "sentiment": 50.0}
        assert rule.evaluate(data) is False

    def test_empty_conditions_does_not_fire(self) -> None:
        rule = SignalRule(name="test", conditions=[], logic="AND")
        assert rule.evaluate({"breadth": 20.0}) is False

    def test_missing_signal_key_treated_as_not_met(self) -> None:
        rule = SignalRule(
            name="test",
            conditions=[SignalCondition("missing_key", "BELOW", 30.0)],
            logic="AND",
        )
        data = {"breadth": 20.0}
        assert rule.evaluate(data) is False

    def test_crosses_below_with_previous_data(self) -> None:
        rule = SignalRule(
            name="test",
            conditions=[SignalCondition("breadth", "CROSSES_BELOW", 30.0)],
            logic="AND",
        )
        data = {"breadth": 25.0}
        prev = {"breadth": 35.0}
        assert rule.evaluate(data, previous_signal_data=prev) is True


# ---------------------------------------------------------------------------
# SignalEngine.evaluate_range
# ---------------------------------------------------------------------------

class TestSignalEngineEvaluateRange:
    def test_empty_signal_data_returns_empty(self) -> None:
        engine = SignalEngine(rules=[
            SignalRule("test", [SignalCondition("b", "BELOW", 30.0)], multiplier=2.0),
        ])
        events = engine.evaluate_range({}, date(2024, 1, 1), date(2024, 3, 1))
        assert events == []

    def test_rule_fires_creates_event(self) -> None:
        rule = SignalRule(
            name="panic",
            conditions=[SignalCondition("breadth", "BELOW", 30.0)],
            multiplier=2.0,
            cooloff_days=30,
        )
        engine = SignalEngine(rules=[rule])
        d = date(2024, 1, 15)
        signal_data = {d: {"breadth": 20.0}}
        events = engine.evaluate_range(signal_data, date(2024, 1, 1), date(2024, 2, 1))
        assert len(events) == 1
        assert events[0].rule_name == "panic"
        assert events[0].multiplier == 2.0
        assert events[0].date == d

    def test_cooloff_respected(self) -> None:
        rule = SignalRule(
            name="panic",
            conditions=[SignalCondition("breadth", "BELOW", 30.0)],
            multiplier=2.0,
            cooloff_days=30,
        )
        engine = SignalEngine(rules=[rule])
        d1 = date(2024, 1, 15)
        d2 = date(2024, 1, 25)  # within cooloff
        signal_data = {d1: {"breadth": 20.0}, d2: {"breadth": 18.0}}
        events = engine.evaluate_range(signal_data, date(2024, 1, 1), date(2024, 2, 1))
        assert len(events) == 1
        assert events[0].date == d1

    def test_cooloff_expired_fires_again(self) -> None:
        rule = SignalRule(
            name="panic",
            conditions=[SignalCondition("breadth", "BELOW", 30.0)],
            multiplier=2.0,
            cooloff_days=10,
        )
        engine = SignalEngine(rules=[rule])
        d1 = date(2024, 1, 15)
        d2 = date(2024, 1, 26)  # cooloff expired (11 days)
        signal_data = {d1: {"breadth": 20.0}, d2: {"breadth": 18.0}}
        events = engine.evaluate_range(signal_data, date(2024, 1, 1), date(2024, 2, 1))
        assert len(events) == 2

    def test_multiple_rules_highest_multiplier_wins(self) -> None:
        rule1 = SignalRule(
            name="mild",
            conditions=[SignalCondition("breadth", "BELOW", 40.0)],
            multiplier=1.0,
            cooloff_days=30,
        )
        rule2 = SignalRule(
            name="severe",
            conditions=[SignalCondition("breadth", "BELOW", 25.0)],
            multiplier=3.0,
            cooloff_days=30,
        )
        engine = SignalEngine(rules=[rule1, rule2])
        d = date(2024, 1, 15)
        signal_data = {d: {"breadth": 20.0}}  # Both fire
        events = engine.evaluate_range(signal_data, date(2024, 1, 1), date(2024, 2, 1))
        assert len(events) == 1
        assert events[0].rule_name == "severe"
        assert events[0].multiplier == 3.0

    def test_events_sorted_chronologically(self) -> None:
        rule = SignalRule(
            name="test",
            conditions=[SignalCondition("breadth", "BELOW", 50.0)],
            multiplier=1.0,
            cooloff_days=1,
        )
        engine = SignalEngine(rules=[rule])
        d1 = date(2024, 1, 10)
        d2 = date(2024, 1, 15)
        d3 = date(2024, 1, 20)
        signal_data = {d3: {"breadth": 30.0}, d1: {"breadth": 30.0}, d2: {"breadth": 30.0}}
        events = engine.evaluate_range(signal_data, date(2024, 1, 1), date(2024, 2, 1))
        dates = [e.date for e in events]
        assert dates == sorted(dates)

    def test_dates_outside_range_ignored(self) -> None:
        rule = SignalRule(
            name="test",
            conditions=[SignalCondition("breadth", "BELOW", 50.0)],
            multiplier=1.0,
            cooloff_days=1,
        )
        engine = SignalEngine(rules=[rule])
        signal_data = {
            date(2023, 12, 15): {"breadth": 20.0},  # before start
            date(2024, 1, 15): {"breadth": 20.0},    # in range
            date(2024, 3, 15): {"breadth": 20.0},    # after end
        }
        events = engine.evaluate_range(signal_data, date(2024, 1, 1), date(2024, 2, 1))
        assert len(events) == 1
        assert events[0].date == date(2024, 1, 15)


# ---------------------------------------------------------------------------
# SignalEngine.evaluate_single_day
# ---------------------------------------------------------------------------

class TestSignalEngineEvaluateSingleDay:
    def test_no_rules_fire_returns_none(self) -> None:
        engine = SignalEngine(rules=[
            SignalRule("test", [SignalCondition("b", "BELOW", 10.0)], multiplier=1.0),
        ])
        result = engine.evaluate_single_day(
            signal_data={"b": 50.0},
            previous_signal_data=None,
            active_cooloffs={},
            current_date=date(2024, 1, 15),
        )
        assert result is None

    def test_cooloff_active_skips_rule(self) -> None:
        engine = SignalEngine(rules=[
            SignalRule("test", [SignalCondition("b", "BELOW", 30.0)],
                       multiplier=1.0, cooloff_days=30),
        ])
        result = engine.evaluate_single_day(
            signal_data={"b": 20.0},
            previous_signal_data=None,
            active_cooloffs={"test": date(2024, 1, 10)},
            current_date=date(2024, 1, 15),  # 5 days < 30 cooloff
        )
        assert result is None


# ---------------------------------------------------------------------------
# DEFAULT_RULES validity
# ---------------------------------------------------------------------------

class TestDefaultRules:
    def test_default_rules_load(self) -> None:
        assert len(DEFAULT_RULES) > 0
        for rule in DEFAULT_RULES:
            assert isinstance(rule, SignalRule)
            assert len(rule.conditions) > 0
            assert rule.multiplier > 0
            assert rule.cooloff_days > 0

    def test_default_rules_engine_init(self) -> None:
        engine = SignalEngine()
        assert len(engine.rules) == len(DEFAULT_RULES)
