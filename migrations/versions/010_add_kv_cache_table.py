"""Add kv_cache table for persistent MarketPulse data caching.

Revision ID: 010
Revises: 009
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "kv_cache",
        sa.Column("cache_key", sa.String(100), primary_key=True),
        sa.Column("cache_value", JSONB, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("kv_cache")
