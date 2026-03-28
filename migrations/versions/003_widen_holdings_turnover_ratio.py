"""widen fund_holdings_snapshot.turnover_ratio to Numeric(12,4)

Revision ID: 003
Revises: 002
Create Date: 2026-03-28

"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "fund_holdings_snapshot",
        "turnover_ratio",
        type_=sa.Numeric(12, 4),
        existing_type=sa.Numeric(8, 4),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "fund_holdings_snapshot",
        "turnover_ratio",
        type_=sa.Numeric(8, 4),
        existing_type=sa.Numeric(12, 4),
        existing_nullable=True,
    )
