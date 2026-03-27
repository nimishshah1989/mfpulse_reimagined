"""Custom exception hierarchy for MF Pulse."""

from typing import Dict, Optional


class MFPulseError(Exception):
    """Base exception for all MF Pulse errors."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        details: Optional[Dict] = None,
    ) -> None:
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(message)


class NotFoundError(MFPulseError):
    """Requested entity does not exist."""

    def __init__(self, message: str, details: Optional[Dict] = None) -> None:
        super().__init__(message=message, code="NOT_FOUND", details=details)


class ValidationError(MFPulseError):
    """Input validation failed."""

    def __init__(self, message: str, details: Optional[Dict] = None) -> None:
        super().__init__(message=message, code="VALIDATION_ERROR", details=details)


class IngestionError(MFPulseError):
    """Data feed ingestion failed."""

    def __init__(self, message: str, details: Optional[Dict] = None) -> None:
        super().__init__(message=message, code="INGESTION_ERROR", details=details)


class MorningstarError(MFPulseError):
    """Morningstar API call failed."""

    def __init__(self, message: str, details: Optional[Dict] = None) -> None:
        super().__init__(message=message, code="MORNINGSTAR_ERROR", details=details)


class MarketPulseError(MFPulseError):
    """MarketPulse bridge call failed."""

    def __init__(self, message: str, details: Optional[Dict] = None) -> None:
        super().__init__(message=message, code="MARKETPULSE_ERROR", details=details)


class EngineError(MFPulseError):
    """Lens/simulation engine computation failed."""

    def __init__(self, message: str, details: Optional[Dict] = None) -> None:
        super().__init__(message=message, code="ENGINE_ERROR", details=details)
