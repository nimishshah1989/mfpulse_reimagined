"""Add category comparison columns to risk_stats_monthly.

These columns store the category average for each metric, from the
Extended Risk Stats API (x7jihr9d49jb9f6d). Enables "vs category"
display on every risk metric without separate queries.
"""

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None

NEW_COLUMNS = [
    "cat_sortino_1y", "cat_sortino_3y", "cat_sortino_5y", "cat_sortino_10y",
    "cat_kurtosis_1y", "cat_kurtosis_3y", "cat_kurtosis_5y", "cat_kurtosis_10y",
    "cat_skewness_1y", "cat_skewness_3y", "cat_skewness_5y", "cat_skewness_10y",
    "cat_capture_up_1y", "cat_capture_up_3y", "cat_capture_up_5y", "cat_capture_up_10y",
    "cat_capture_down_1y", "cat_capture_down_3y", "cat_capture_down_5y", "cat_capture_down_10y",
    "cat_correlation_1y", "cat_correlation_3y", "cat_correlation_5y", "cat_correlation_10y",
    "cat_info_ratio_1y", "cat_info_ratio_3y", "cat_info_ratio_5y", "cat_info_ratio_10y",
    "cat_tracking_error_1y", "cat_tracking_error_3y", "cat_tracking_error_5y", "cat_tracking_error_10y",
    "cat_treynor_1y", "cat_treynor_3y", "cat_treynor_5y", "cat_treynor_10y",
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
