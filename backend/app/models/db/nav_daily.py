"""Daily NAV table — daily Morningstar NAV feed."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


class NavDaily(Base, UUIDPrimaryKey):
    __tablename__ = "nav_daily"

    mstar_id: Mapped[str] = mapped_column(String(20), nullable=False)
    nav_date: Mapped[date] = mapped_column(Date, nullable=False)
    # nullable because Return Data API updates return columns without providing NAV
    nav: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    nav_change: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)

    # Return columns
    return_1d: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_1w: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_1m: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_3m: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_6m: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_ytd: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_1y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_2y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_3y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_4y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_5y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_7y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_10y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_15y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_20y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    return_since_inception: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)

    # Cumulative returns
    cumulative_return_3y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cumulative_return_5y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cumulative_return_10y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)

    # Calendar year returns
    calendar_year_return_1y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    calendar_year_return_2y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    calendar_year_return_3y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    calendar_year_return_4y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    calendar_year_return_5y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    calendar_year_return_6y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    calendar_year_return_7y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    calendar_year_return_8y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    calendar_year_return_9y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    calendar_year_return_10y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)

    # 52-week range
    nav_52wk_high: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    nav_52wk_low: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("mstar_id", "nav_date", name="uq_nav_daily_mstar_date"),
        Index("ix_nav_daily_mstar_date_desc", "mstar_id", nav_date.desc()),
    )
