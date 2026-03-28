"""widen category_returns_daily.category_code to String(100)

Category names like 'Sector - Financial Services' (27 chars) overflow String(20).

Revision ID: 004
Revises: 003
Create Date: 2026-03-28

"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "category_returns_daily",
        "category_code",
        type_=sa.String(100),
        existing_type=sa.String(20),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "category_returns_daily",
        "category_code",
        type_=sa.String(20),
        existing_type=sa.String(100),
        existing_nullable=False,
    )
