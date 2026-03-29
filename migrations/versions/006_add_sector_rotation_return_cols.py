"""Add weighted_return and total_aum_exposed columns to sector_rotation_history.

Revision ID: 006
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sector_rotation_history",
        sa.Column("weighted_return", sa.Numeric(10, 4), nullable=True),
    )
    op.add_column(
        "sector_rotation_history",
        sa.Column("total_aum_exposed", sa.Numeric(20, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sector_rotation_history", "total_aum_exposed")
    op.drop_column("sector_rotation_history", "weighted_return")
