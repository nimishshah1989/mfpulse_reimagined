"""Category returns daily table."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


class CategoryReturnsDaily(Base, UUIDPrimaryKey):
    __tablename__ = "category_returns_daily"

    category_code: Mapped[str] = mapped_column(String(100), nullable=False)
    category_name: Mapped[Optional[str]] = mapped_column(String(200))
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Short-tenor returns
    cat_return_1d: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_return_1w: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_return_1m: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_return_3m: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_return_6m: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_return_1y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_return_ytd: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)

    # Multi-year returns
    cat_return_2y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_return_3y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_return_4y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_return_5y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_return_7y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_return_10y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)

    # Cumulative returns
    cat_cumulative_2y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_cumulative_3y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_cumulative_4y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_cumulative_5y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_cumulative_7y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_cumulative_10y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)

    # Calendar year category returns
    cat_calendar_year_1y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_calendar_year_2y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_calendar_year_3y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_calendar_year_4y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_calendar_year_5y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_calendar_year_6y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_calendar_year_7y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_calendar_year_8y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_calendar_year_9y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    cat_calendar_year_10y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("category_code", "as_of_date", name="uq_cat_returns_code_date"),
    )
