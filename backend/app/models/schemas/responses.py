"""Standard API response envelope schemas."""

from datetime import datetime, timezone
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict = Field(default_factory=dict)


class Meta(BaseModel):
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    count: Optional[int] = None


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    meta: Meta = Field(default_factory=Meta)
    error: Optional[ErrorDetail] = None


class HealthResponse(BaseModel):
    status: str
    database: str
    version: str
    uptime_seconds: float
    timestamp: datetime


class SystemConfigResponse(BaseModel):
    app_version: str
    app_env: str
    scheduler_enabled: bool
    feed_csv_dir: str
