"""Add latest_aum denormalized column to fund_master for fast AUM filtering.

Revision ID: 011
Revises: 010
"""

from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fund_master", sa.Column("latest_aum", sa.Numeric(16, 2), nullable=True))
    op.create_index(
        "ix_fund_master_latest_aum",
        "fund_master",
        ["latest_aum"],
        postgresql_where=sa.text("latest_aum IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_fund_master_latest_aum", table_name="fund_master")
    op.drop_column("fund_master", "latest_aum")
