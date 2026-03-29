"""Fund asset allocation table."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


class FundAssetAllocation(Base, UUIDPrimaryKey):
    __tablename__ = "fund_asset_allocation"

    mstar_id: Mapped[str] = mapped_column(String(20), nullable=False)
    portfolio_date: Mapped[date] = mapped_column(Date, nullable=False)

    equity_net: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    bond_net: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    cash_net: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    other_net: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)

    india_large_cap_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    india_mid_cap_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    india_small_cap_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("mstar_id", "portfolio_date", name="uq_asset_alloc_mstar_date"),
    )
