"""Add columns for expanded Morningstar field mappings.

New columns across four tables:
- category_returns_daily: short-tenor returns, calendar year returns
- nav_daily: nav_change_pct
- fund_holdings_snapshot: est_fund_net_flow_ytd
- fund_holding_detail: ticker, global_industry, holding_ytd_return, first_bought_date

Revision ID: 013
Revises: 012
"""

from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- category_returns_daily: short-tenor returns ---
    op.add_column("category_returns_daily", sa.Column("cat_return_1d", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_return_1w", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_return_1m", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_return_3m", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_return_6m", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_return_1y", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_return_ytd", sa.Numeric(12, 5), nullable=True))

    # --- category_returns_daily: calendar year returns ---
    op.add_column("category_returns_daily", sa.Column("cat_calendar_year_1y", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_calendar_year_2y", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_calendar_year_3y", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_calendar_year_4y", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_calendar_year_5y", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_calendar_year_6y", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_calendar_year_7y", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_calendar_year_8y", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_calendar_year_9y", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_calendar_year_10y", sa.Numeric(12, 5), nullable=True))

    # --- nav_daily: NAV change percentage ---
    op.add_column("nav_daily", sa.Column("nav_change_pct", sa.Numeric(10, 5), nullable=True))

    # --- fund_holdings_snapshot: YTD net flow ---
    op.add_column("fund_holdings_snapshot", sa.Column("est_fund_net_flow_ytd", sa.Numeric(18, 2), nullable=True))

    # --- fund_holding_detail: ticker, industry, YTD return, first bought ---
    op.add_column("fund_holding_detail", sa.Column("ticker", sa.String(50), nullable=True))
    op.add_column("fund_holding_detail", sa.Column("global_industry", sa.String(100), nullable=True))
    op.add_column("fund_holding_detail", sa.Column("holding_ytd_return", sa.Numeric(10, 5), nullable=True))
    op.add_column("fund_holding_detail", sa.Column("first_bought_date", sa.Date(), nullable=True))


def downgrade() -> None:
    # --- fund_holding_detail ---
    op.drop_column("fund_holding_detail", "first_bought_date")
    op.drop_column("fund_holding_detail", "holding_ytd_return")
    op.drop_column("fund_holding_detail", "global_industry")
    op.drop_column("fund_holding_detail", "ticker")

    # --- fund_holdings_snapshot ---
    op.drop_column("fund_holdings_snapshot", "est_fund_net_flow_ytd")

    # --- nav_daily ---
    op.drop_column("nav_daily", "nav_change_pct")

    # --- category_returns_daily: calendar year returns ---
    op.drop_column("category_returns_daily", "cat_calendar_year_10y")
    op.drop_column("category_returns_daily", "cat_calendar_year_9y")
    op.drop_column("category_returns_daily", "cat_calendar_year_8y")
    op.drop_column("category_returns_daily", "cat_calendar_year_7y")
    op.drop_column("category_returns_daily", "cat_calendar_year_6y")
    op.drop_column("category_returns_daily", "cat_calendar_year_5y")
    op.drop_column("category_returns_daily", "cat_calendar_year_4y")
    op.drop_column("category_returns_daily", "cat_calendar_year_3y")
    op.drop_column("category_returns_daily", "cat_calendar_year_2y")
    op.drop_column("category_returns_daily", "cat_calendar_year_1y")

    # --- category_returns_daily: short-tenor returns ---
    op.drop_column("category_returns_daily", "cat_return_ytd")
    op.drop_column("category_returns_daily", "cat_return_1y")
    op.drop_column("category_returns_daily", "cat_return_6m")
    op.drop_column("category_returns_daily", "cat_return_3m")
    op.drop_column("category_returns_daily", "cat_return_1m")
    op.drop_column("category_returns_daily", "cat_return_1w")
    op.drop_column("category_returns_daily", "cat_return_1d")
