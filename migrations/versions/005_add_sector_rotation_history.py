"""Add sector_rotation_history table.

Revision ID: 005
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sector_rotation_history",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("sector_name", sa.String(100), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("avg_weight_pct", sa.Numeric(8, 4), nullable=True),
        sa.Column("momentum_1m", sa.Numeric(8, 4), nullable=True),
        sa.Column("momentum_3m", sa.Numeric(8, 4), nullable=True),
        sa.Column("rs_score", sa.Numeric(8, 4), nullable=True),
        sa.Column("quadrant", sa.String(20), nullable=True),
        sa.Column("fund_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sector_name", "snapshot_date", name="uq_sector_rotation_sector_date"),
    )
    op.create_index("ix_sector_rotation_date", "sector_rotation_history", ["snapshot_date"])
    op.create_index("ix_sector_rotation_sector", "sector_rotation_history", ["sector_name"])


def downgrade() -> None:
    op.drop_index("ix_sector_rotation_sector")
    op.drop_index("ix_sector_rotation_date")
    op.drop_table("sector_rotation_history")
