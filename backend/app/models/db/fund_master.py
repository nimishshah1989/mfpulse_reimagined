"""Fund master table — weekly Morningstar OperationsMasterFile feed."""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey, TimestampMixin


class FundMaster(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "fund_master"

    # Identifiers
    mstar_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    fund_id: Mapped[Optional[str]] = mapped_column(String(20))
    amc_id: Mapped[Optional[str]] = mapped_column(String(20))
    isin: Mapped[Optional[str]] = mapped_column(String(12))
    amfi_code: Mapped[Optional[str]] = mapped_column(String(10))

    # Names
    legal_name: Mapped[str] = mapped_column(String(300), nullable=False)
    fund_name: Mapped[Optional[str]] = mapped_column(String(200))
    amc_name: Mapped[Optional[str]] = mapped_column(String(300))

    # Classification — nullable because category comes from a separate API call
    category_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    broad_category: Mapped[Optional[str]] = mapped_column(String(200))

    # Dates
    inception_date: Mapped[Optional[date]] = mapped_column(Date)

    # Fund type flags
    purchase_mode: Mapped[Optional[int]] = mapped_column(Integer)
    is_index_fund: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_fund_of_funds: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_etf: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_insurance_product: Mapped[Optional[bool]] = mapped_column(Boolean)
    sip_available: Mapped[Optional[bool]] = mapped_column(Boolean)

    # Costs & ratios
    net_expense_ratio: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    gross_expense_ratio: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    turnover_ratio: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)

    # Risk labels
    indian_risk_level: Mapped[Optional[str]] = mapped_column(String(50))
    benchmark_risk_level: Mapped[Optional[str]] = mapped_column(String(50))
    fund_risk_level: Mapped[Optional[str]] = mapped_column(String(50))

    # Benchmark
    primary_benchmark: Mapped[Optional[str]] = mapped_column(String(300))

    # Strategy text
    investment_strategy: Mapped[Optional[str]] = mapped_column(Text)
    investment_philosophy: Mapped[Optional[str]] = mapped_column(Text)

    # Managers
    managers: Mapped[Optional[str]] = mapped_column(String(500))
    manager_education: Mapped[Optional[str]] = mapped_column(String(500))
    manager_birth_year: Mapped[Optional[int]] = mapped_column(Integer)
    manager_certification: Mapped[Optional[str]] = mapped_column(String(200))

    # Performance
    performance_start_date: Mapped[Optional[date]] = mapped_column(Date)
    previous_fund_name: Mapped[Optional[str]] = mapped_column(String(300))
    previous_name_end_date: Mapped[Optional[date]] = mapped_column(Date)

    # Fund structure
    pricing_frequency: Mapped[Optional[str]] = mapped_column(String(20))
    legal_structure: Mapped[Optional[str]] = mapped_column(String(100))
    domicile_id: Mapped[Optional[str]] = mapped_column(String(10))
    exchange_id: Mapped[Optional[str]] = mapped_column(String(10))

    # Access restrictions
    closed_to_investors: Mapped[Optional[date]] = mapped_column(Date)
    lock_in_period: Mapped[None] = mapped_column(Numeric(8, 2), nullable=True)
    distribution_status: Mapped[Optional[str]] = mapped_column(String(50))

    # Termination
    termination_date: Mapped[Optional[date]] = mapped_column(Date)

    # Status flags
    performance_ready: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_eligible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    eligibility_reason: Mapped[Optional[str]] = mapped_column(String(200))

    __table_args__ = (
        Index("ix_fund_master_category_name", "category_name"),
        Index("ix_fund_master_amfi_code", "amfi_code"),
        Index("ix_fund_master_isin", "isin"),
        Index("ix_fund_master_eligible_category", "is_eligible", "category_name"),
        Index("ix_fund_master_purchase_mode", "purchase_mode"),
    )
