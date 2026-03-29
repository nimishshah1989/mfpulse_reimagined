"""Sector rotation history — computed from Morningstar fund holdings."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


class SectorRotationHistory(Base, UUIDPrimaryKey):
    __tablename__ = "sector_rotation_history"

    sector_name: Mapped[str] = mapped_column(String(100), nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    avg_weight_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    momentum_1m: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    momentum_3m: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    rs_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    quadrant: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    fund_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    weighted_return: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    total_aum_exposed: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("sector_name", "snapshot_date", name="uq_sector_rotation_sector_date"),
    )
