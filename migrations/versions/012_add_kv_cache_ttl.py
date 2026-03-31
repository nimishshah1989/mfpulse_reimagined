"""Add expires_at column to kv_cache for TTL-based expiry.

Revision ID: 012
Revises: 011
"""

from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("kv_cache", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_kv_cache_expires",
        "kv_cache",
        ["expires_at"],
        postgresql_where=sa.text("expires_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_kv_cache_expires", table_name="kv_cache")
    op.drop_column("kv_cache", "expires_at")
