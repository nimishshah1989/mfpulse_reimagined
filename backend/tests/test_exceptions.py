"""Tests for custom exception hierarchy."""

from app.core.exceptions import (
    EngineError,
    IngestionError,
    MarketPulseError,
    MFPulseError,
    MorningstarError,
    NotFoundError,
    ValidationError,
)


def test_base_exception_attributes() -> None:
    exc = MFPulseError("something broke", code="TEST", details={"key": "val"})
    assert exc.message == "something broke"
    assert exc.code == "TEST"
    assert exc.details == {"key": "val"}
    assert str(exc) == "something broke"


def test_not_found_error_code() -> None:
    exc = NotFoundError("Fund not found")
    assert exc.code == "NOT_FOUND"


def test_validation_error_code() -> None:
    exc = ValidationError("Bad input")
    assert exc.code == "VALIDATION_ERROR"


def test_ingestion_error_code() -> None:
    exc = IngestionError("CSV parse failed")
    assert exc.code == "INGESTION_ERROR"


def test_morningstar_error_code() -> None:
    exc = MorningstarError("API timeout")
    assert exc.code == "MORNINGSTAR_ERROR"


def test_marketpulse_error_code() -> None:
    exc = MarketPulseError("Bridge down")
    assert exc.code == "MARKETPULSE_ERROR"


def test_engine_error_code() -> None:
    exc = EngineError("Computation failed")
    assert exc.code == "ENGINE_ERROR"


def test_exception_hierarchy() -> None:
    """All custom exceptions inherit from MFPulseError."""
    for exc_cls in [NotFoundError, ValidationError, IngestionError,
                    MorningstarError, MarketPulseError, EngineError]:
        assert issubclass(exc_cls, MFPulseError)
