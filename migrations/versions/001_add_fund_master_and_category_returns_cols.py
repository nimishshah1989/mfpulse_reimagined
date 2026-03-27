"""add missing fund_master and category_returns columns

Revision ID: 001
Revises:
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # fund_master — manager details
    op.add_column("fund_master", sa.Column("manager_education", sa.String(500), nullable=True))
    op.add_column("fund_master", sa.Column("manager_birth_year", sa.Integer(), nullable=True))
    op.add_column("fund_master", sa.Column("manager_certification", sa.String(200), nullable=True))

    # fund_master — performance
    op.add_column("fund_master", sa.Column("performance_start_date", sa.Date(), nullable=True))
    op.add_column("fund_master", sa.Column("previous_fund_name", sa.String(300), nullable=True))
    op.add_column("fund_master", sa.Column("previous_name_end_date", sa.Date(), nullable=True))

    # fund_master — fund structure
    op.add_column("fund_master", sa.Column("pricing_frequency", sa.String(20), nullable=True))
    op.add_column("fund_master", sa.Column("legal_structure", sa.String(100), nullable=True))
    op.add_column("fund_master", sa.Column("domicile_id", sa.String(10), nullable=True))
    op.add_column("fund_master", sa.Column("exchange_id", sa.String(10), nullable=True))

    # fund_master — access restrictions
    op.add_column("fund_master", sa.Column("closed_to_investors", sa.Date(), nullable=True))
    op.add_column("fund_master", sa.Column("lock_in_period", sa.Numeric(8, 2), nullable=True))
    op.add_column("fund_master", sa.Column("distribution_status", sa.String(50), nullable=True))

    # category_returns_daily — 4-year columns
    op.add_column("category_returns_daily", sa.Column("cat_return_4y", sa.Numeric(12, 5), nullable=True))
    op.add_column("category_returns_daily", sa.Column("cat_cumulative_4y", sa.Numeric(12, 5), nullable=True))


def downgrade() -> None:
    # category_returns_daily
    op.drop_column("category_returns_daily", "cat_cumulative_4y")
    op.drop_column("category_returns_daily", "cat_return_4y")

    # fund_master — access restrictions
    op.drop_column("fund_master", "distribution_status")
    op.drop_column("fund_master", "lock_in_period")
    op.drop_column("fund_master", "closed_to_investors")

    # fund_master — fund structure
    op.drop_column("fund_master", "exchange_id")
    op.drop_column("fund_master", "domicile_id")
    op.drop_column("fund_master", "legal_structure")
    op.drop_column("fund_master", "pricing_frequency")

    # fund_master — performance
    op.drop_column("fund_master", "previous_name_end_date")
    op.drop_column("fund_master", "previous_fund_name")
    op.drop_column("fund_master", "performance_start_date")

    # fund_master — manager details
    op.drop_column("fund_master", "manager_certification")
    op.drop_column("fund_master", "manager_birth_year")
    op.drop_column("fund_master", "manager_education")
