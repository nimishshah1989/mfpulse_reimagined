"""Morningstar CSV feed parser with type coercion and error collection."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

import pandas as pd

from app.ingestion.field_maps import (
    MASTER_FIELD_MAP,
    NAV_FIELD_MAP,
    RISK_STATS_FIELD_MAP,
    RANK_FIELD_MAP,
    HOLDINGS_FIELD_MAP,
    HOLDING_DETAIL_FIELD_MAP,
    SECTOR_EXPOSURE_MAP,
    CATEGORY_RETURNS_FIELD_MAP,
)

logger = logging.getLogger(__name__)

DATE_FORMATS = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y"]

BOOL_TRUE = {"true", "1", "yes"}
BOOL_FALSE = {"false", "0", "no"}


@dataclass
class ParseResult:
    records: list[dict] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)
    total_rows: int = 0
    parsed_rows: int = 0
    feed_type: str = ""
    source_file: str = ""


def parse_date(value: object) -> Optional[date]:
    """Parse date from multiple formats. Returns None on failure."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (date, datetime)):
        return value if isinstance(value, date) and not isinstance(value, datetime) else value.date() if isinstance(value, datetime) else value
    s = str(value).strip()
    if not s or s.lower() in ("nan", "nat", "none", ""):
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def parse_decimal(value: object) -> Optional[Decimal]:
    """Parse to Decimal. Strips commas, handles empty/null/NaN."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip().replace(",", "")
    if not s or s.lower() in ("nan", "nat", "none", "", "-"):
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def parse_bool(value: object) -> Optional[bool]:
    """Parse boolean from true/false, 1/0, yes/no."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if not s or s in ("nan", "nat", "none"):
        return None
    if s in BOOL_TRUE:
        return True
    if s in BOOL_FALSE:
        return False
    return None


def parse_int(value: object) -> Optional[int]:
    """Parse integer. Empty → None."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip().replace(",", "")
    if not s or s.lower() in ("nan", "nat", "none", ""):
        return None
    try:
        return int(float(s))
    except (ValueError, OverflowError):
        return None


def parse_string(value: object) -> Optional[str]:
    """Strip whitespace. Empty string → None."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    if not s or s.lower() in ("nan", "nat"):
        return None
    return s


# Column type classification for each feed
MASTER_DATE_COLS = {"inception_date", "performance_start_date", "previous_name_end_date", "closed_to_investors"}
MASTER_BOOL_COLS = {"is_index_fund", "is_fund_of_funds", "is_etf", "is_insurance_product", "sip_available", "performance_ready"}
MASTER_DECIMAL_COLS = {"net_expense_ratio", "gross_expense_ratio", "turnover_ratio", "lock_in_period"}
MASTER_INT_COLS = {"purchase_mode", "manager_birth_year"}

NAV_DATE_COLS = {"nav_date"}
NAV_DECIMAL_COLS = {
    "nav", "nav_change",
    "return_1d", "return_1w", "return_1m", "return_3m", "return_6m",
    "return_ytd", "return_1y", "return_2y", "return_3y", "return_4y",
    "return_5y", "return_7y", "return_10y", "return_since_inception",
    "cumulative_return_3y", "cumulative_return_5y", "cumulative_return_10y",
    "nav_52wk_high", "nav_52wk_low",
}

RISK_DATE_COLS = {"as_of_date"}
RANK_DATE_COLS = {"as_of_date"}
HOLDINGS_DATE_COLS = {"portfolio_date"}
CATEGORY_DATE_COLS = {"as_of_date"}


class FeedParser:
    """Parses Morningstar CSV feeds into lists of dicts ready for DB insertion."""

    def _read_csv(self, csv_path: str) -> pd.DataFrame:
        """Read CSV file, handling common encoding issues."""
        path = Path(csv_path)
        if not path.exists():
            raise FileNotFoundError(f"CSV file not found: {csv_path}")
        try:
            return pd.read_csv(path, dtype=str, keep_default_na=False)
        except Exception:
            return pd.read_csv(path, dtype=str, keep_default_na=False, encoding="latin-1")

    def _apply_field_map(
        self,
        df: pd.DataFrame,
        field_map: dict[str, str],
    ) -> pd.DataFrame:
        """Rename columns using field map, drop unmapped columns."""
        rename_map = {}
        for csv_col, db_col in field_map.items():
            if csv_col in df.columns:
                rename_map[csv_col] = db_col
        df = df.rename(columns=rename_map)
        mapped_cols = set(field_map.values()) & set(df.columns)
        return df[list(mapped_cols)]

    def _coerce_row(
        self,
        row: dict,
        date_cols: set[str],
        decimal_cols: set[str],
        bool_cols: set[str],
        int_cols: set[str],
    ) -> dict:
        """Apply type coercion to a single row dict."""
        result = {}
        for col, val in row.items():
            if col in date_cols:
                result[col] = parse_date(val)
            elif col in decimal_cols:
                result[col] = parse_decimal(val)
            elif col in bool_cols:
                result[col] = parse_bool(val)
            elif col in int_cols:
                result[col] = parse_int(val)
            else:
                result[col] = parse_string(val)
        return result

    def _parse_feed(
        self,
        csv_path: str,
        field_map: dict[str, str],
        feed_type: str,
        key_field: str,
        date_cols: set[str],
        decimal_cols: set[str] | None = None,
        bool_cols: set[str] | None = None,
        int_cols: set[str] | None = None,
    ) -> ParseResult:
        """Generic feed parsing logic."""
        result = ParseResult(
            feed_type=feed_type,
            source_file=str(csv_path),
        )

        try:
            df = self._read_csv(csv_path)
        except FileNotFoundError as e:
            result.errors.append({"row": 0, "error": str(e)})
            return result
        except Exception as e:
            result.errors.append({"row": 0, "error": f"Failed to read CSV: {e}"})
            return result

        if df.empty:
            return result

        df = self._apply_field_map(df, field_map)
        result.total_rows = len(df)

        if decimal_cols is None:
            decimal_cols = set()
        if bool_cols is None:
            bool_cols = set()
        if int_cols is None:
            int_cols = set()

        # For feeds where all non-date, non-key columns are decimal
        all_db_cols = set(field_map.values())
        string_cols = all_db_cols - date_cols - decimal_cols - bool_cols - int_cols - {key_field}

        for idx, row in df.iterrows():
            row_dict = row.to_dict()
            row_num = int(idx) + 2  # +2 for 1-indexed + header row

            key_val = parse_string(row_dict.get(key_field))
            if not key_val:
                result.errors.append({
                    "row": row_num,
                    "error": f"Missing required key field: {key_field}",
                })
                continue

            try:
                coerced = self._coerce_row(
                    row_dict,
                    date_cols=date_cols,
                    decimal_cols=decimal_cols,
                    bool_cols=bool_cols,
                    int_cols=int_cols,
                )
                result.records.append(coerced)
                result.parsed_rows += 1
            except Exception as e:
                result.errors.append({"row": row_num, "error": str(e)})

        return result

    def parse_master_feed(self, csv_path: str) -> ParseResult:
        return self._parse_feed(
            csv_path=csv_path,
            field_map=MASTER_FIELD_MAP,
            feed_type="master",
            key_field="mstar_id",
            date_cols=MASTER_DATE_COLS,
            decimal_cols=MASTER_DECIMAL_COLS,
            bool_cols=MASTER_BOOL_COLS,
            int_cols=MASTER_INT_COLS,
        )

    def parse_nav_feed(self, csv_path: str) -> ParseResult:
        return self._parse_feed(
            csv_path=csv_path,
            field_map=NAV_FIELD_MAP,
            feed_type="nav",
            key_field="mstar_id",
            date_cols=NAV_DATE_COLS,
            decimal_cols=NAV_DECIMAL_COLS,
        )

    def parse_risk_stats_feed(self, csv_path: str) -> ParseResult:
        # All columns except mstar_id and as_of_date are decimals
        all_cols = set(RISK_STATS_FIELD_MAP.values())
        decimal_cols = all_cols - {"mstar_id", "as_of_date"}
        return self._parse_feed(
            csv_path=csv_path,
            field_map=RISK_STATS_FIELD_MAP,
            feed_type="risk_stats",
            key_field="mstar_id",
            date_cols=RISK_DATE_COLS,
            decimal_cols=decimal_cols,
        )

    def parse_rank_feed(self, csv_path: str) -> ParseResult:
        # All columns except mstar_id and as_of_date are ints
        all_cols = set(RANK_FIELD_MAP.values())
        int_cols = all_cols - {"mstar_id", "as_of_date"}
        return self._parse_feed(
            csv_path=csv_path,
            field_map=RANK_FIELD_MAP,
            feed_type="ranks",
            key_field="mstar_id",
            date_cols=RANK_DATE_COLS,
            int_cols=int_cols,
        )

    def parse_holdings_feed(self, csv_path: str) -> ParseResult:
        """Parse holdings snapshot feed (not individual holding details)."""
        all_cols = set(HOLDINGS_FIELD_MAP.values())
        string_cols = {"mstar_id", "equity_style_box", "bond_style_box", "avg_credit_quality"}
        int_cols = {"num_holdings", "num_equity", "num_bond"}
        decimal_cols = all_cols - string_cols - int_cols - {"portfolio_date"}
        return self._parse_feed(
            csv_path=csv_path,
            field_map=HOLDINGS_FIELD_MAP,
            feed_type="holdings",
            key_field="mstar_id",
            date_cols=HOLDINGS_DATE_COLS,
            decimal_cols=decimal_cols,
            int_cols=int_cols,
        )

    def parse_category_returns_feed(self, csv_path: str) -> ParseResult:
        all_cols = set(CATEGORY_RETURNS_FIELD_MAP.values())
        decimal_cols = all_cols - {"category_code", "as_of_date"}
        return self._parse_feed(
            csv_path=csv_path,
            field_map=CATEGORY_RETURNS_FIELD_MAP,
            feed_type="category_returns",
            key_field="category_code",
            date_cols=CATEGORY_DATE_COLS,
            decimal_cols=decimal_cols,
        )
