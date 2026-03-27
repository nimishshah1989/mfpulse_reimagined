"""Fund credit quality distribution table."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


class FundCreditQuality(Base, UUIDPrimaryKey):
    __tablename__ = "fund_credit_quality"

    mstar_id: Mapped[str] = mapped_column(String(20), nullable=False)
    portfolio_date: Mapped[date] = mapped_column(Date, nullable=False)

    aaa_pct: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    aa_pct: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    a_pct: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    bbb_pct: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    bb_pct: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    b_pct: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    below_b_pct: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    not_rated_pct: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("mstar_id", "portfolio_date", name="uq_credit_quality_mstar_date"),
    )
