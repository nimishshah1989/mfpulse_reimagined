"""Monthly risk statistics from Morningstar risk stats feed."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


def _col() -> Mapped[Optional[Decimal]]:
    return mapped_column(Numeric(12, 5), nullable=True)


class RiskStatsMonthly(Base, UUIDPrimaryKey):
    __tablename__ = "risk_stats_monthly"

    mstar_id: Mapped[str] = mapped_column(String(20), nullable=False)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Sharpe
    sharpe_1y: Mapped[Optional[Decimal]] = _col()
    sharpe_3y: Mapped[Optional[Decimal]] = _col()
    sharpe_5y: Mapped[Optional[Decimal]] = _col()
    sharpe_10y: Mapped[Optional[Decimal]] = _col()

    # Alpha
    alpha_1y: Mapped[Optional[Decimal]] = _col()
    alpha_3y: Mapped[Optional[Decimal]] = _col()
    alpha_5y: Mapped[Optional[Decimal]] = _col()
    alpha_10y: Mapped[Optional[Decimal]] = _col()

    # Beta
    beta_1y: Mapped[Optional[Decimal]] = _col()
    beta_3y: Mapped[Optional[Decimal]] = _col()
    beta_5y: Mapped[Optional[Decimal]] = _col()
    beta_10y: Mapped[Optional[Decimal]] = _col()

    # Standard Deviation
    std_dev_1y: Mapped[Optional[Decimal]] = _col()
    std_dev_3y: Mapped[Optional[Decimal]] = _col()
    std_dev_5y: Mapped[Optional[Decimal]] = _col()
    std_dev_10y: Mapped[Optional[Decimal]] = _col()

    # Sortino
    sortino_1y: Mapped[Optional[Decimal]] = _col()
    sortino_3y: Mapped[Optional[Decimal]] = _col()
    sortino_5y: Mapped[Optional[Decimal]] = _col()
    sortino_10y: Mapped[Optional[Decimal]] = _col()

    # Max Drawdown
    max_drawdown_1y: Mapped[Optional[Decimal]] = _col()
    max_drawdown_3y: Mapped[Optional[Decimal]] = _col()
    max_drawdown_5y: Mapped[Optional[Decimal]] = _col()
    max_drawdown_10y: Mapped[Optional[Decimal]] = _col()

    # Treynor
    treynor_1y: Mapped[Optional[Decimal]] = _col()
    treynor_3y: Mapped[Optional[Decimal]] = _col()
    treynor_5y: Mapped[Optional[Decimal]] = _col()
    treynor_10y: Mapped[Optional[Decimal]] = _col()

    # Information Ratio
    info_ratio_1y: Mapped[Optional[Decimal]] = _col()
    info_ratio_3y: Mapped[Optional[Decimal]] = _col()
    info_ratio_5y: Mapped[Optional[Decimal]] = _col()
    info_ratio_10y: Mapped[Optional[Decimal]] = _col()

    # Tracking Error
    tracking_error_1y: Mapped[Optional[Decimal]] = _col()
    tracking_error_3y: Mapped[Optional[Decimal]] = _col()
    tracking_error_5y: Mapped[Optional[Decimal]] = _col()
    tracking_error_10y: Mapped[Optional[Decimal]] = _col()

    # Capture Ratios — Up
    capture_up_1y: Mapped[Optional[Decimal]] = _col()
    capture_up_3y: Mapped[Optional[Decimal]] = _col()
    capture_up_5y: Mapped[Optional[Decimal]] = _col()
    capture_up_10y: Mapped[Optional[Decimal]] = _col()

    # Capture Ratios — Down
    capture_down_1y: Mapped[Optional[Decimal]] = _col()
    capture_down_3y: Mapped[Optional[Decimal]] = _col()
    capture_down_5y: Mapped[Optional[Decimal]] = _col()
    capture_down_10y: Mapped[Optional[Decimal]] = _col()

    # Correlation
    correlation_1y: Mapped[Optional[Decimal]] = _col()
    correlation_3y: Mapped[Optional[Decimal]] = _col()
    correlation_5y: Mapped[Optional[Decimal]] = _col()
    correlation_10y: Mapped[Optional[Decimal]] = _col()

    # R-Squared
    r_squared_1y: Mapped[Optional[Decimal]] = _col()
    r_squared_3y: Mapped[Optional[Decimal]] = _col()
    r_squared_5y: Mapped[Optional[Decimal]] = _col()
    r_squared_10y: Mapped[Optional[Decimal]] = _col()

    # Kurtosis
    kurtosis_1y: Mapped[Optional[Decimal]] = _col()
    kurtosis_3y: Mapped[Optional[Decimal]] = _col()
    kurtosis_5y: Mapped[Optional[Decimal]] = _col()
    kurtosis_10y: Mapped[Optional[Decimal]] = _col()

    # Skewness
    skewness_1y: Mapped[Optional[Decimal]] = _col()
    skewness_3y: Mapped[Optional[Decimal]] = _col()
    skewness_5y: Mapped[Optional[Decimal]] = _col()
    skewness_10y: Mapped[Optional[Decimal]] = _col()

    # Mean
    mean_1y: Mapped[Optional[Decimal]] = _col()
    mean_3y: Mapped[Optional[Decimal]] = _col()
    mean_5y: Mapped[Optional[Decimal]] = _col()
    mean_10y: Mapped[Optional[Decimal]] = _col()

    # Category comparison fields (from Extended Risk Stats API)
    cat_sharpe_1y: Mapped[Optional[Decimal]] = _col()
    cat_sharpe_3y: Mapped[Optional[Decimal]] = _col()
    cat_sharpe_5y: Mapped[Optional[Decimal]] = _col()
    cat_std_dev_1y: Mapped[Optional[Decimal]] = _col()
    cat_std_dev_3y: Mapped[Optional[Decimal]] = _col()
    cat_std_dev_5y: Mapped[Optional[Decimal]] = _col()
    cat_std_dev_10y: Mapped[Optional[Decimal]] = _col()
    cat_alpha_1y: Mapped[Optional[Decimal]] = _col()
    cat_alpha_3y: Mapped[Optional[Decimal]] = _col()
    cat_alpha_5y: Mapped[Optional[Decimal]] = _col()
    cat_alpha_10y: Mapped[Optional[Decimal]] = _col()
    cat_beta_1y: Mapped[Optional[Decimal]] = _col()
    cat_beta_3y: Mapped[Optional[Decimal]] = _col()
    cat_beta_5y: Mapped[Optional[Decimal]] = _col()
    cat_beta_10y: Mapped[Optional[Decimal]] = _col()
    cat_r_squared_1y: Mapped[Optional[Decimal]] = _col()
    cat_r_squared_3y: Mapped[Optional[Decimal]] = _col()
    cat_r_squared_5y: Mapped[Optional[Decimal]] = _col()
    cat_r_squared_10y: Mapped[Optional[Decimal]] = _col()
    cat_sortino_1y: Mapped[Optional[Decimal]] = _col()
    cat_sortino_3y: Mapped[Optional[Decimal]] = _col()
    cat_sortino_5y: Mapped[Optional[Decimal]] = _col()
    cat_sortino_10y: Mapped[Optional[Decimal]] = _col()
    cat_kurtosis_1y: Mapped[Optional[Decimal]] = _col()
    cat_kurtosis_3y: Mapped[Optional[Decimal]] = _col()
    cat_kurtosis_5y: Mapped[Optional[Decimal]] = _col()
    cat_kurtosis_10y: Mapped[Optional[Decimal]] = _col()
    cat_skewness_1y: Mapped[Optional[Decimal]] = _col()
    cat_skewness_3y: Mapped[Optional[Decimal]] = _col()
    cat_skewness_5y: Mapped[Optional[Decimal]] = _col()
    cat_skewness_10y: Mapped[Optional[Decimal]] = _col()
    cat_capture_up_1y: Mapped[Optional[Decimal]] = _col()
    cat_capture_up_3y: Mapped[Optional[Decimal]] = _col()
    cat_capture_up_5y: Mapped[Optional[Decimal]] = _col()
    cat_capture_up_10y: Mapped[Optional[Decimal]] = _col()
    cat_capture_down_1y: Mapped[Optional[Decimal]] = _col()
    cat_capture_down_3y: Mapped[Optional[Decimal]] = _col()
    cat_capture_down_5y: Mapped[Optional[Decimal]] = _col()
    cat_capture_down_10y: Mapped[Optional[Decimal]] = _col()
    cat_correlation_1y: Mapped[Optional[Decimal]] = _col()
    cat_correlation_3y: Mapped[Optional[Decimal]] = _col()
    cat_correlation_5y: Mapped[Optional[Decimal]] = _col()
    cat_correlation_10y: Mapped[Optional[Decimal]] = _col()
    cat_info_ratio_1y: Mapped[Optional[Decimal]] = _col()
    cat_info_ratio_3y: Mapped[Optional[Decimal]] = _col()
    cat_info_ratio_5y: Mapped[Optional[Decimal]] = _col()
    cat_info_ratio_10y: Mapped[Optional[Decimal]] = _col()
    cat_tracking_error_1y: Mapped[Optional[Decimal]] = _col()
    cat_tracking_error_3y: Mapped[Optional[Decimal]] = _col()
    cat_tracking_error_5y: Mapped[Optional[Decimal]] = _col()
    cat_tracking_error_10y: Mapped[Optional[Decimal]] = _col()
    cat_treynor_1y: Mapped[Optional[Decimal]] = _col()
    cat_treynor_3y: Mapped[Optional[Decimal]] = _col()
    cat_treynor_5y: Mapped[Optional[Decimal]] = _col()
    cat_treynor_10y: Mapped[Optional[Decimal]] = _col()

    # Category Sharpe 10Y (separate RMMP prefix in API)
    cat_sharpe_10y: Mapped[Optional[Decimal]] = _col()

    # Trailing Total Returns from Extended Risk Stats API (redundant copy)
    ttr_return_1y: Mapped[Optional[Decimal]] = _col()
    ttr_return_3y: Mapped[Optional[Decimal]] = _col()
    ttr_return_5y: Mapped[Optional[Decimal]] = _col()
    ttr_return_10y: Mapped[Optional[Decimal]] = _col()

    # Category trailing returns (for "vs category" return comparison)
    cat_return_1y: Mapped[Optional[Decimal]] = _col()
    cat_return_3y: Mapped[Optional[Decimal]] = _col()
    cat_return_5y: Mapped[Optional[Decimal]] = _col()
    cat_return_10y: Mapped[Optional[Decimal]] = _col()

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("mstar_id", "as_of_date", name="uq_risk_stats_mstar_date"),
    )
