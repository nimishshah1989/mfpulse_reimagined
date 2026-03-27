"""Fund holdings snapshot and detail tables."""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey


class FundHoldingsSnapshot(Base, UUIDPrimaryKey):
    __tablename__ = "fund_holdings_snapshot"

    mstar_id: Mapped[str] = mapped_column(String(20), nullable=False)
    portfolio_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Counts
    num_holdings: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    num_equity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    num_bond: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Style boxes
    equity_style_box: Mapped[Optional[str]] = mapped_column(String(50))
    bond_style_box: Mapped[Optional[str]] = mapped_column(String(50))

    # Portfolio metrics
    aum: Mapped[None] = mapped_column(Numeric(16, 2), nullable=True)
    avg_market_cap: Mapped[None] = mapped_column(Numeric(16, 2), nullable=True)
    pe_ratio: Mapped[None] = mapped_column(Numeric(10, 4), nullable=True)
    pb_ratio: Mapped[None] = mapped_column(Numeric(10, 4), nullable=True)
    pc_ratio: Mapped[None] = mapped_column(Numeric(10, 4), nullable=True)
    ps_ratio: Mapped[None] = mapped_column(Numeric(10, 4), nullable=True)
    roe_ttm: Mapped[None] = mapped_column(Numeric(10, 4), nullable=True)
    roa_ttm: Mapped[None] = mapped_column(Numeric(10, 4), nullable=True)
    net_margin_ttm: Mapped[None] = mapped_column(Numeric(10, 4), nullable=True)

    # Bond metrics
    ytm: Mapped[None] = mapped_column(Numeric(10, 4), nullable=True)
    avg_eff_maturity: Mapped[None] = mapped_column(Numeric(10, 4), nullable=True)
    modified_duration: Mapped[None] = mapped_column(Numeric(10, 4), nullable=True)
    avg_credit_quality: Mapped[Optional[str]] = mapped_column(String(20))

    # Other
    prospective_div_yield: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    turnover_ratio: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    est_fund_net_flow: Mapped[None] = mapped_column(Numeric(16, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("mstar_id", "portfolio_date", name="uq_holdings_snapshot_mstar_date"),
    )


class FundHoldingDetail(Base, UUIDPrimaryKey):
    __tablename__ = "fund_holding_detail"

    snapshot_id: Mapped[None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("fund_holdings_snapshot.id"),
        nullable=False,
    )
    holding_name: Mapped[str] = mapped_column(String(300), nullable=False)
    isin: Mapped[Optional[str]] = mapped_column(String(12))
    holding_type: Mapped[Optional[str]] = mapped_column(String(20))
    weighting_pct: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    num_shares: Mapped[None] = mapped_column(Numeric(16, 4), nullable=True)
    market_value: Mapped[None] = mapped_column(Numeric(16, 2), nullable=True)
    global_sector: Mapped[Optional[str]] = mapped_column(String(100))
    country: Mapped[Optional[str]] = mapped_column(String(50))
    currency: Mapped[Optional[str]] = mapped_column(String(10))
    coupon: Mapped[None] = mapped_column(Numeric(8, 4), nullable=True)
    maturity_date: Mapped[Optional[date]] = mapped_column(Date)
    credit_quality: Mapped[Optional[str]] = mapped_column(String(20))
    share_change: Mapped[None] = mapped_column(Numeric(16, 4), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_holding_detail_snapshot_id", "snapshot_id"),
    )
