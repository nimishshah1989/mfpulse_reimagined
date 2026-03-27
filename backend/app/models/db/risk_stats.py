"""Monthly risk statistics from Morningstar risk stats feed."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


def _col() -> Mapped[None]:
    return mapped_column(Numeric(12, 5), nullable=True)


class RiskStatsMonthly(Base, UUIDPrimaryKey):
    __tablename__ = "risk_stats_monthly"

    mstar_id: Mapped[str] = mapped_column(String(20), nullable=False)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Sharpe
    sharpe_1y: Mapped[None] = _col()
    sharpe_3y: Mapped[None] = _col()
    sharpe_5y: Mapped[None] = _col()

    # Alpha
    alpha_3y: Mapped[None] = _col()
    alpha_5y: Mapped[None] = _col()
    alpha_10y: Mapped[None] = _col()

    # Beta
    beta_3y: Mapped[None] = _col()
    beta_5y: Mapped[None] = _col()
    beta_10y: Mapped[None] = _col()

    # Standard Deviation
    std_dev_1y: Mapped[None] = _col()
    std_dev_3y: Mapped[None] = _col()
    std_dev_5y: Mapped[None] = _col()

    # Sortino
    sortino_1y: Mapped[None] = _col()
    sortino_3y: Mapped[None] = _col()
    sortino_5y: Mapped[None] = _col()

    # Max Drawdown
    max_drawdown_1y: Mapped[None] = _col()
    max_drawdown_3y: Mapped[None] = _col()
    max_drawdown_5y: Mapped[None] = _col()

    # Treynor
    treynor_1y: Mapped[None] = _col()
    treynor_3y: Mapped[None] = _col()
    treynor_5y: Mapped[None] = _col()
    treynor_10y: Mapped[None] = _col()

    # Information Ratio
    info_ratio_1y: Mapped[None] = _col()
    info_ratio_3y: Mapped[None] = _col()
    info_ratio_5y: Mapped[None] = _col()
    info_ratio_10y: Mapped[None] = _col()

    # Tracking Error
    tracking_error_1y: Mapped[None] = _col()
    tracking_error_3y: Mapped[None] = _col()
    tracking_error_5y: Mapped[None] = _col()
    tracking_error_10y: Mapped[None] = _col()

    # Capture Ratios — Up
    capture_up_1y: Mapped[None] = _col()
    capture_up_3y: Mapped[None] = _col()
    capture_up_5y: Mapped[None] = _col()
    capture_up_10y: Mapped[None] = _col()

    # Capture Ratios — Down
    capture_down_1y: Mapped[None] = _col()
    capture_down_3y: Mapped[None] = _col()
    capture_down_5y: Mapped[None] = _col()

    # Correlation
    correlation_1y: Mapped[None] = _col()
    correlation_3y: Mapped[None] = _col()
    correlation_5y: Mapped[None] = _col()

    # R-Squared
    r_squared_1y: Mapped[None] = _col()
    r_squared_3y: Mapped[None] = _col()
    r_squared_5y: Mapped[None] = _col()

    # Kurtosis
    kurtosis_1y: Mapped[None] = _col()
    kurtosis_3y: Mapped[None] = _col()
    kurtosis_5y: Mapped[None] = _col()

    # Skewness
    skewness_1y: Mapped[None] = _col()
    skewness_3y: Mapped[None] = _col()
    skewness_5y: Mapped[None] = _col()

    # Mean
    mean_1y: Mapped[None] = _col()
    mean_3y: Mapped[None] = _col()
    mean_5y: Mapped[None] = _col()

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("mstar_id", "as_of_date", name="uq_risk_stats_mstar_date"),
    )
