"""Add TTR return + category return + cat_sharpe_10y columns to risk_stats_monthly.

These columns capture trailing total returns from the Extended Risk Stats API
(x7jihr9d49jb9f6d) along with their category comparisons, achieving 100%
field mapping coverage.
"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None

NEW_COLUMNS = [
    "cat_sharpe_10y",
    "ttr_return_1y", "ttr_return_3y", "ttr_return_5y", "ttr_return_10y",
    "cat_return_1y", "cat_return_3y", "cat_return_5y", "cat_return_10y",
]


def upgrade() -> None:
    for col in NEW_COLUMNS:
        op.add_column(
            "risk_stats_monthly",
            sa.Column(col, sa.Numeric(12, 5), nullable=True),
        )


def downgrade() -> None:
    for col in NEW_COLUMNS:
        op.drop_column("risk_stats_monthly", col)
