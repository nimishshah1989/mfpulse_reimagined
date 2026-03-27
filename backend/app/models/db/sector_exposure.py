"""Fund sector exposure table."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


class FundSectorExposure(Base, UUIDPrimaryKey):
    __tablename__ = "fund_sector_exposure"

    mstar_id: Mapped[str] = mapped_column(String(20), nullable=False)
    portfolio_date: Mapped[date] = mapped_column(Date, nullable=False)
    sector_name: Mapped[str] = mapped_column(String(100), nullable=False)
    net_pct: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "mstar_id", "portfolio_date", "sector_name",
            name="uq_sector_exposure_mstar_date_sector",
        ),
    )
