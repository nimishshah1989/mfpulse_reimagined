"""Fund lens scores and classification tables."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


class FundLensScores(Base, UUIDPrimaryKey):
    __tablename__ = "fund_lens_scores"

    mstar_id: Mapped[str] = mapped_column(String(20), nullable=False)
    computed_date: Mapped[date] = mapped_column(Date, nullable=False)
    category_name: Mapped[Optional[str]] = mapped_column(String(200))

    # Six lens scores (0-100 percentile)
    return_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    risk_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    consistency_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    alpha_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    efficiency_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    resilience_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)

    # Data quality
    data_completeness_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    available_horizons: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Engine metadata
    engine_version: Mapped[Optional[str]] = mapped_column(String(20))
    input_hash: Mapped[Optional[str]] = mapped_column(String(64))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("mstar_id", "computed_date", name="uq_lens_scores_mstar_date"),
    )


class FundClassification(Base, UUIDPrimaryKey):
    __tablename__ = "fund_classification"

    mstar_id: Mapped[str] = mapped_column(String(20), nullable=False)
    computed_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Six lens tier labels
    return_class: Mapped[Optional[str]] = mapped_column(String(30))
    risk_class: Mapped[Optional[str]] = mapped_column(String(30))
    consistency_class: Mapped[Optional[str]] = mapped_column(String(30))
    alpha_class: Mapped[Optional[str]] = mapped_column(String(30))
    efficiency_class: Mapped[Optional[str]] = mapped_column(String(30))
    resilience_class: Mapped[Optional[str]] = mapped_column(String(30))

    # Human-readable headline
    headline_tag: Mapped[Optional[str]] = mapped_column(String(300))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("mstar_id", "computed_date", name="uq_classification_mstar_date"),
    )
