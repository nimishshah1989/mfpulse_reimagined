"""Index master and daily price tables."""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index as SQLIndex, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


class IndexMaster(Base, UUIDPrimaryKey):
    __tablename__ = "index_master"

    index_name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    index_code: Mapped[Optional[str]] = mapped_column(String(50))
    has_eod_price: Mapped[Optional[bool]] = mapped_column(Boolean)
    comments: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )


class IndexDaily(Base, UUIDPrimaryKey):
    __tablename__ = "index_daily"

    index_id: Mapped[None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("index_master.id"),
        nullable=False,
    )
    price_date: Mapped[date] = mapped_column(Date, nullable=False)
    close_price: Mapped[None] = mapped_column(Numeric(16, 4), nullable=True)

    # Return columns — matching nav_daily pattern
    return_1d: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)
    return_1w: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)
    return_1m: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)
    return_3m: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)
    return_6m: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)
    return_ytd: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)
    return_1y: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)
    return_2y: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)
    return_3y: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)
    return_5y: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)
    return_7y: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)
    return_10y: Mapped[None] = mapped_column(Numeric(12, 5), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("index_id", "price_date", name="uq_index_daily_id_date"),
        SQLIndex("ix_index_daily_id_date", "index_id", "price_date"),
    )
