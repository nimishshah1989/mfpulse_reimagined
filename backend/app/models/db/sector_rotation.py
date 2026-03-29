"""Sector rotation history — computed from Morningstar fund holdings."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


class SectorRotationHistory(Base, UUIDPrimaryKey):
    __tablename__ = "sector_rotation_history"

    sector_name: Mapped[str] = mapped_column(String(100), nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    avg_weight_pct: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    momentum_1m: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    momentum_3m: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    rs_score: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    quadrant: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fund_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("sector_name", "snapshot_date", name="uq_sector_rotation_sector_date"),
    )
