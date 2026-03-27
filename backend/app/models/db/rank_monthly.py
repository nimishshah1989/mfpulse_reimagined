"""Monthly rank data from Morningstar."""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


class RankMonthly(Base, UUIDPrimaryKey):
    __tablename__ = "rank_monthly"

    mstar_id: Mapped[str] = mapped_column(String(20), nullable=False)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Quartile ranks
    quartile_1m: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quartile_3m: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quartile_6m: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quartile_1y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quartile_2y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quartile_3y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quartile_4y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quartile_5y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quartile_7y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quartile_10y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Absolute ranks
    abs_rank_1m: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    abs_rank_3m: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    abs_rank_6m: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    abs_rank_ytd: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    abs_rank_1y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    abs_rank_2y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    abs_rank_3y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    abs_rank_4y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    abs_rank_5y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    abs_rank_7y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    abs_rank_10y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Calendar year percentile ranks
    cal_year_pctile_ytd: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cal_year_pctile_1y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cal_year_pctile_2y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cal_year_pctile_3y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cal_year_pctile_4y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cal_year_pctile_5y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cal_year_pctile_6y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cal_year_pctile_7y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cal_year_pctile_8y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cal_year_pctile_9y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cal_year_pctile_10y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("mstar_id", "as_of_date", name="uq_rank_monthly_mstar_date"),
    )
