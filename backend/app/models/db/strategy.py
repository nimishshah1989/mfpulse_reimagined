"""Strategy definition, backtest, live portfolio, and holdings tables."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey, TimestampMixin


class StrategyDefinition(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "strategy_definition"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    strategy_type: Mapped[Optional[str]] = mapped_column(String(30))
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class StrategyBacktestRun(Base, UUIDPrimaryKey):
    __tablename__ = "strategy_backtest_run"

    strategy_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("strategy_definition.id"),
        nullable=False,
    )
    run_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    params: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    initial_investment: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    mode: Mapped[Optional[str]] = mapped_column(String(20))

    # Results
    final_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    cagr: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    xirr: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    max_drawdown: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    sharpe: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    benchmark_cagr: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    alpha_vs_benchmark: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)

    # Series data
    monthly_returns: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    nav_series: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)

    # Metadata
    simulation_hash: Mapped[Optional[str]] = mapped_column(String(64))
    compute_time_ms: Mapped[Optional[int]] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )


class StrategyLivePortfolio(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "strategy_live_portfolio"

    strategy_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("strategy_definition.id"),
        nullable=False,
    )
    name: Mapped[Optional[str]] = mapped_column(String(200))
    inception_date: Mapped[Optional[date]] = mapped_column(Date)
    current_nav: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    current_aum: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    last_rebalance_date: Mapped[Optional[date]] = mapped_column(Date)
    next_rebalance_due: Mapped[Optional[date]] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class StrategyPortfolioHolding(Base, UUIDPrimaryKey):
    __tablename__ = "strategy_portfolio_holding"

    portfolio_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("strategy_live_portfolio.id"),
        nullable=False,
    )
    mstar_id: Mapped[str] = mapped_column(String(20), nullable=False)
    weight_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    units: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    entry_date: Mapped[Optional[date]] = mapped_column(Date)
    entry_nav: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )
