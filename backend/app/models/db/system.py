"""System tables: audit trail, ingestion log, engine config."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey, TimestampMixin


class AuditTrail(Base, UUIDPrimaryKey):
    """Append-only audit log. No updates, no deletes."""

    __tablename__ = "audit_trail"

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )
    actor: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50))
    entity_id: Mapped[Optional[str]] = mapped_column(String(100))
    details: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)


class IngestionLog(Base, UUIDPrimaryKey):
    __tablename__ = "ingestion_log"

    feed_name: Mapped[str] = mapped_column(String(100), nullable=False)
    ingestion_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    records_processed: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    records_failed: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(20))
    error_details: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )


class KVCache(Base):
    """Persistent key-value cache for external service data (e.g. MarketPulse).

    Survives container restarts. Data is refreshed by scheduled jobs.
    Frontend reads from here — never calls external services directly.
    """

    __tablename__ = "kv_cache"

    cache_key: Mapped[str] = mapped_column(String(100), primary_key=True)
    cache_value: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )


class EngineConfig(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "engine_config"

    config_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    config_value: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    updated_by: Mapped[Optional[str]] = mapped_column(String(100))
