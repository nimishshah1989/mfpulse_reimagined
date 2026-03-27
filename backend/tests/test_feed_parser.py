"""Tests for Morningstar CSV feed parser."""

import os
import tempfile
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.ingestion.feed_parser import (
    FeedParser,
    ParseResult,
    parse_date,
    parse_decimal,
    parse_bool,
    parse_int,
    parse_string,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# --- Type coercion helpers ---

class TestParseDate:
    def test_yyyy_mm_dd(self) -> None:
        assert parse_date("2026-03-26") == date(2026, 3, 26)

    def test_dd_mm_yyyy_dash(self) -> None:
        assert parse_date("26-03-2026") == date(2026, 3, 26)

    def test_dd_mm_yyyy_slash(self) -> None:
        assert parse_date("26/03/2026") == date(2026, 3, 26)

    def test_none_returns_none(self) -> None:
        assert parse_date(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert parse_date("") is None

    def test_nan_returns_none(self) -> None:
        assert parse_date("NaN") is None
        assert parse_date(float("nan")) is None

    def test_invalid_date_returns_none(self) -> None:
        assert parse_date("not-a-date") is None

    def test_date_object_passthrough(self) -> None:
        d = date(2026, 1, 1)
        assert parse_date(d) == d


class TestParseDecimal:
    def test_simple_number(self) -> None:
        assert parse_decimal("1.2345") == Decimal("1.2345")

    def test_commas_stripped(self) -> None:
        assert parse_decimal("1,234.56") == Decimal("1234.56")

    def test_none_returns_none(self) -> None:
        assert parse_decimal(None) is None

    def test_empty_returns_none(self) -> None:
        assert parse_decimal("") is None

    def test_nan_returns_none(self) -> None:
        assert parse_decimal("NaN") is None
        assert parse_decimal(float("nan")) is None

    def test_dash_returns_none(self) -> None:
        assert parse_decimal("-") is None

    def test_negative_number(self) -> None:
        assert parse_decimal("-8.5") == Decimal("-8.5")

    def test_invalid_returns_none(self) -> None:
        assert parse_decimal("abc") is None


class TestParseBool:
    def test_true_variants(self) -> None:
        for val in ["true", "True", "1", "yes", "Yes"]:
            assert parse_bool(val) is True

    def test_false_variants(self) -> None:
        for val in ["false", "False", "0", "no", "No"]:
            assert parse_bool(val) is False

    def test_none_returns_none(self) -> None:
        assert parse_bool(None) is None

    def test_empty_returns_none(self) -> None:
        assert parse_bool("") is None

    def test_bool_passthrough(self) -> None:
        assert parse_bool(True) is True
        assert parse_bool(False) is False


class TestParseInt:
    def test_simple(self) -> None:
        assert parse_int("42") == 42

    def test_float_string(self) -> None:
        assert parse_int("3.0") == 3

    def test_none_returns_none(self) -> None:
        assert parse_int(None) is None

    def test_empty_returns_none(self) -> None:
        assert parse_int("") is None

    def test_commas_stripped(self) -> None:
        assert parse_int("1,000") == 1000


class TestParseString:
    def test_strips_whitespace(self) -> None:
        assert parse_string("  hello  ") == "hello"

    def test_empty_returns_none(self) -> None:
        assert parse_string("") is None

    def test_none_returns_none(self) -> None:
        assert parse_string(None) is None

    def test_nan_returns_none(self) -> None:
        assert parse_string(float("nan")) is None


# --- Feed parser ---

@pytest.fixture
def parser() -> FeedParser:
    return FeedParser()


class TestParseMasterFeed:
    def test_valid_master_csv(self, parser: FeedParser) -> None:
        result = parser.parse_master_feed(str(FIXTURES_DIR / "sample_master.csv"))
        assert isinstance(result, ParseResult)
        assert result.feed_type == "master"
        assert result.total_rows == 5
        assert result.parsed_rows == 5
        assert len(result.errors) == 0

        rec = result.records[0]
        assert rec["mstar_id"] == "F0GBR06S2Q"
        assert rec["legal_name"] == "HDFC Flexi Cap Fund - Direct Plan - Growth"
        assert rec["inception_date"] == date(2013, 1, 1)
        assert rec["is_index_fund"] is False
        assert rec["sip_available"] is True
        assert isinstance(rec["net_expense_ratio"], Decimal)
        assert rec["net_expense_ratio"] == Decimal("0.7500")
        assert rec["purchase_mode"] == 2

    def test_master_has_new_fields(self, parser: FeedParser) -> None:
        result = parser.parse_master_feed(str(FIXTURES_DIR / "sample_master.csv"))
        rec = result.records[0]
        assert rec["manager_education"] == "MBA"
        assert rec["manager_birth_year"] == 1975
        assert rec["manager_certification"] == "CFA"
        assert rec["performance_start_date"] == date(2013, 1, 1)
        assert rec["pricing_frequency"] == "Daily"
        assert rec["legal_structure"] == "Open Ended"
        assert rec["domicile_id"] == "IN"
        assert rec["exchange_id"] == "BSE"


class TestParseNavFeed:
    def test_valid_nav_csv(self, parser: FeedParser) -> None:
        result = parser.parse_nav_feed(str(FIXTURES_DIR / "sample_nav.csv"))
        assert result.feed_type == "nav"
        assert result.total_rows == 10
        assert result.parsed_rows == 10
        assert len(result.errors) == 0

        rec = result.records[0]
        assert rec["mstar_id"] == "F0GBR06S2Q"
        assert rec["nav_date"] == date(2026, 3, 26)
        assert isinstance(rec["nav"], Decimal)
        assert rec["nav"] == Decimal("185.4200")
        assert isinstance(rec["return_1y"], Decimal)

    def test_commas_in_nav_values(self, parser: FeedParser) -> None:
        """Row with commas in numbers (e.g. NAV of 1,234.56) should parse correctly."""
        result = parser.parse_nav_feed(str(FIXTURES_DIR / "sample_nav.csv"))
        # Last two rows are for F00000LMNO with NAV like 1,234.5600
        lmno_records = [r for r in result.records if r["mstar_id"] == "F00000LMNO"]
        assert len(lmno_records) == 2
        assert lmno_records[0]["nav"] == Decimal("1234.5600")


class TestParseRiskStatsFeed:
    def test_valid_risk_stats_csv(self, parser: FeedParser) -> None:
        result = parser.parse_risk_stats_feed(str(FIXTURES_DIR / "sample_risk_stats.csv"))
        assert result.feed_type == "risk_stats"
        assert result.total_rows == 3
        assert result.parsed_rows == 3
        assert len(result.errors) == 0

        rec = result.records[0]
        assert rec["mstar_id"] == "F0GBR06S2Q"
        assert rec["as_of_date"] == date(2026, 2, 28)
        assert isinstance(rec["sharpe_1y"], Decimal)
        assert rec["sharpe_1y"] == Decimal("1.25000")
        assert isinstance(rec["max_drawdown_3y"], Decimal)


class TestParseRankFeed:
    def test_valid_ranks_csv(self, parser: FeedParser) -> None:
        result = parser.parse_rank_feed(str(FIXTURES_DIR / "sample_ranks.csv"))
        assert result.feed_type == "ranks"
        assert result.total_rows == 3
        assert result.parsed_rows == 3
        assert len(result.errors) == 0

        rec = result.records[0]
        assert rec["mstar_id"] == "F0GBR06S2Q"
        assert rec["as_of_date"] == date(2026, 2, 28)
        assert rec["quartile_1m"] == 1
        assert rec["abs_rank_1m"] == 3
        assert rec["cal_year_pctile_ytd"] == 85


class TestMissingKeyField:
    def test_missing_mstar_id_goes_to_errors(self, parser: FeedParser) -> None:
        """Rows without mstar_id should be added to errors, not records."""
        csv_content = "SecId,DayEndNAV,DayEndNAVDate\n,100.00,2026-03-26\nF001,200.00,2026-03-26"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            f.flush()
            result = parser.parse_nav_feed(f.name)

        assert result.parsed_rows == 1
        assert len(result.errors) == 1
        assert "Missing required key field" in result.errors[0]["error"]
        os.unlink(f.name)


class TestEmptyCSV:
    def test_empty_csv_returns_empty_result(self, parser: FeedParser) -> None:
        csv_content = "SecId,DayEndNAV,DayEndNAVDate\n"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            f.flush()
            result = parser.parse_nav_feed(f.name)

        assert result.total_rows == 0
        assert result.parsed_rows == 0
        assert len(result.records) == 0
        assert len(result.errors) == 0
        os.unlink(f.name)


class TestFileNotFound:
    def test_nonexistent_file(self, parser: FeedParser) -> None:
        result = parser.parse_nav_feed("/nonexistent/path/data.csv")
        assert result.parsed_rows == 0
        assert len(result.errors) == 1
        assert "not found" in result.errors[0]["error"].lower()


class TestInvalidDate:
    def test_invalid_date_becomes_none(self, parser: FeedParser) -> None:
        """Invalid dates should become None, not crash the parser."""
        csv_content = "SecId,DayEndNAV,DayEndNAVDate\nF001,100.00,INVALID-DATE"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            f.flush()
            result = parser.parse_nav_feed(f.name)

        assert result.parsed_rows == 1
        assert result.records[0]["nav_date"] is None
        os.unlink(f.name)
