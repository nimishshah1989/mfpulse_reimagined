"""Add 10Y risk stat columns that Morningstar API actually returns.

Morningstar Risk Stats API returns MaxDrawdown, CaptureRatioDownside,
Kurtosis, Sharpe, Sortino, StdDev, Skewness, R-squared only at 10Y tenor.
The 1Y/3Y/5Y versions are not available in the API response.

Revision ID: 007
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None

NEW_COLUMNS = [
    "max_drawdown_10y",
    "capture_down_10y",
    "kurtosis_10y",
    "sharpe_10y",
    "sortino_10y",
    "std_dev_10y",
    "skewness_10y",
    "r_squared_10y",
    "mean_10y",
]


def upgrade() -> None:
    for col in NEW_COLUMNS:
        op.add_column(
            "risk_stats_monthly",
            sa.Column(col, sa.Numeric(12, 5), nullable=True),
        )


def downgrade() -> None:
    for col in reversed(NEW_COLUMNS):
        op.drop_column("risk_stats_monthly", col)
