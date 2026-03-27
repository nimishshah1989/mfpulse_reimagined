"""add nav calendar year returns and fund_master termination_date

Revision ID: 002
Revises: 001
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # nav_daily — calendar year returns (Year1 through Year10)
    for i in range(1, 11):
        op.add_column(
            "nav_daily",
            sa.Column(f"calendar_year_return_{i}y", sa.Numeric(12, 5), nullable=True),
        )

    # fund_master — termination date
    op.add_column(
        "fund_master",
        sa.Column("termination_date", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fund_master", "termination_date")

    for i in range(10, 0, -1):
        op.drop_column("nav_daily", f"calendar_year_return_{i}y")
