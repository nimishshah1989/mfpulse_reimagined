"""Tests for MorningstarFetcher — XML parsing, field mapping, DB writes."""

import os
from datetime import date
from unittest.mock import MagicMock, patch, PropertyMock
from xml.etree import ElementTree as ET

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.core.morningstar_config import APIS, MorningstarAPI
from app.models.db.fund_master import FundMaster
from app.models.db.nav_daily import NavDaily
from app.models.db.rank_monthly import RankMonthly
from app.services.morningstar_fetcher import MorningstarFetcher, FetchResult


def _build_xml(funds: list[dict], api_hash: str = "n0fys3tcvprq4375") -> bytes:
    """Build a minimal Morningstar XML response for testing."""
    lines = [
        '<?xml version="1.0"?>',
        "<response>",
        "  <status><code>0</code><message>OK</message></status>",
    ]
    for fund in funds:
        mstar_id = fund.pop("_id")
        lines.append(f'  <data _idtype="mstarid" _id="{mstar_id}">')
        lines.append(f'    <api _id="{api_hash}">')
        for tag, value in fund.items():
            lines.append(f"      <{tag}>{value}</{tag}>")
        lines.append("    </api>")
        lines.append("  </data>")
    lines.append("</response>")
    return "\n".join(lines).encode("utf-8")


def _build_error_xml(code: str = "1", message: str = "Auth failed") -> bytes:
    return (
        f'<?xml version="1.0"?>'
        f"<response><status><code>{code}</code>"
        f"<message>{message}</message></status></response>"
    ).encode("utf-8")


@pytest.fixture
def mock_db():
    session = MagicMock()
    return session


@pytest.fixture
def fetcher(mock_db):
    with patch("app.services.morningstar_fetcher.get_settings") as mock_settings:
        settings = MagicMock()
        settings.morningstar_access_code = "test_access_code"
        mock_settings.return_value = settings
        f = MorningstarFetcher(mock_db)
    # Replace repos with mocks so we can assert calls
    f.ingestion_repo = MagicMock()
    f.audit_repo = MagicMock()
    return f


class TestXmlParsing:
    def test_parse_valid_nav_xml(self, fetcher: MorningstarFetcher) -> None:
        """Parse valid XML response with NAV data — correct fund count and field mapping."""
        xml = _build_xml([
            {"_id": "F00001SPNJ", "TS-DayEndNAV": "1002.45", "TS-DayEndNAVDate": "2026-03-26"},
            {"_id": "F00001SPNI", "TS-DayEndNAV": "500.10", "TS-DayEndNAVDate": "2026-03-26"},
        ])
        records, result = fetcher._parse_xml(xml, APIS[3])  # Nav Data API
        assert result.fund_count == 2
        assert records[0]["mstar_id"] == "F00001SPNJ"
        assert records[0]["nav"] == "1002.45"
        assert records[0]["nav_date"] == "2026-03-26"

    def test_strip_prefix_ts(self, fetcher: MorningstarFetcher) -> None:
        """TS-DayEndNAV → DayEndNAV → nav."""
        xml = _build_xml([{"_id": "F001", "TS-DayEndNAV": "100.00"}])
        records, _ = fetcher._parse_xml(xml, APIS[3])
        assert "nav" in records[0]

    def test_strip_prefix_mptpi(self, fetcher: MorningstarFetcher) -> None:
        """MPTPI-Alpha3Yr → Alpha3Yr → alpha_3y."""
        xml = _build_xml([{"_id": "F001", "MPTPI-Alpha3Yr": "2.5"}])
        records, _ = fetcher._parse_xml(xml, APIS[5])  # Risk Stats API
        assert records[0]["alpha_3y"] == "2.5"

    def test_strip_prefix_dp_return(self, fetcher: MorningstarFetcher) -> None:
        """DP-Return1Yr → Return1Yr → return_1y."""
        xml = _build_xml([{"_id": "F001", "DP-Return1Yr": "15.3"}])
        records, _ = fetcher._parse_xml(xml, APIS[4])  # Return Data API
        assert records[0]["return_1y"] == "15.3"

    def test_strip_prefix_ttrr_rank(self, fetcher: MorningstarFetcher) -> None:
        """TTRR-Rank1YrQuartile → Rank1YrQuartile → quartile_1y."""
        xml = _build_xml([{"_id": "F001", "TTRR-Rank1YrQuartile": "1"}])
        records, _ = fetcher._parse_xml(xml, APIS[6])  # Rank Data API
        assert records[0]["quartile_1y"] == "1"

    def test_strip_prefix_fscbi_master(self, fetcher: MorningstarFetcher) -> None:
        """FSCBI-LegalName → LegalName → legal_name."""
        xml = _build_xml([{"_id": "F001", "FSCBI-LegalName": "HDFC Equity Fund"}])
        records, _ = fetcher._parse_xml(xml, APIS[0])  # Identifier Data API
        assert records[0]["legal_name"] == "HDFC Equity Fund"

    def test_strip_prefix_at_category(self, fetcher: MorningstarFetcher) -> None:
        """AT-FundLevelCategoryName → FundLevelCategoryName → category_name."""
        xml = _build_xml([{"_id": "F001", "AT-FundLevelCategoryName": "Large Cap"}])
        records, _ = fetcher._parse_xml(xml, APIS[2])  # Category Data API
        assert records[0]["category_name"] == "Large Cap"

    def test_unknown_field_counted_as_unmapped(self, fetcher: MorningstarFetcher) -> None:
        """Unknown prefix/field → counted as unmapped, not an error."""
        xml = _build_xml([{"_id": "F001", "XX-SomeUnknownField": "val", "TS-DayEndNAV": "100"}])
        records, result = fetcher._parse_xml(xml, APIS[3])
        assert result.unmapped_fields >= 1
        assert result.status == "pending"  # no error

    def test_empty_element_skipped(self, fetcher: MorningstarFetcher) -> None:
        """Empty XML element → field skipped."""
        xml_str = (
            '<?xml version="1.0"?>'
            "<response><status><code>0</code><message>OK</message></status>"
            '<data _idtype="mstarid" _id="F001">'
            '<api _id="n0fys3tcvprq4375">'
            "<TS-DayEndNAV></TS-DayEndNAV>"
            "<TS-DayEndNAVDate>2026-03-26</TS-DayEndNAVDate>"
            "</api></data></response>"
        ).encode("utf-8")
        records, result = fetcher._parse_xml(xml_str, APIS[3])
        assert "nav" not in records[0]
        assert "nav_date" in records[0]

    def test_api_error_status(self, fetcher: MorningstarFetcher) -> None:
        """API returns error status code → FetchResult.status = error."""
        xml = _build_error_xml("1", "Auth failed")
        records, result = fetcher._parse_xml(xml, APIS[3])
        assert result.status == "error"
        assert len(records) == 0
        assert "Auth failed" in result.errors[0]

    def test_no_hyphen_in_tag_uses_full_tag(self, fetcher: MorningstarFetcher) -> None:
        """Tag without hyphen uses full tag as key."""
        xml = _build_xml([{"_id": "F001", "DayEndNAV": "100.00"}])
        records, _ = fetcher._parse_xml(xml, APIS[3])
        # DayEndNAV is in NAV_FIELD_MAP directly
        assert records[0].get("nav") == "100.00"

    def test_data_without_id_skipped(self, fetcher: MorningstarFetcher) -> None:
        """<data> element without _id attribute is skipped."""
        xml_str = (
            '<?xml version="1.0"?>'
            "<response><status><code>0</code><message>OK</message></status>"
            '<data _idtype="mstarid">'
            '<api _id="n0fys3tcvprq4375">'
            "<TS-DayEndNAV>100</TS-DayEndNAV>"
            "</api></data></response>"
        ).encode("utf-8")
        records, result = fetcher._parse_xml(xml_str, APIS[3])
        assert len(records) == 0


class TestFetchSingleApi:
    @patch("app.services.morningstar_fetcher.httpx.Client")
    def test_http_timeout_graceful(self, mock_client_cls, fetcher) -> None:
        """HTTP timeout → graceful error, no crash."""
        import httpx
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = httpx.TimeoutException("timed out")
        mock_client_cls.return_value = mock_client
        result = fetcher.fetch_single_api(APIS[3])
        assert result.status == "error"
        assert "Timeout" in result.errors[0]

    @patch("app.services.morningstar_fetcher.httpx.Client")
    def test_http_401_clear_error(self, mock_client_cls, fetcher) -> None:
        """HTTP 401 (bad access code) → clear error message."""
        import httpx
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = httpx.HTTPStatusError(
            "401", request=MagicMock(), response=mock_response,
        )
        mock_client_cls.return_value = mock_client
        result = fetcher.fetch_single_api(APIS[3])
        assert result.status == "error"
        assert "401" in result.errors[0]

    @patch("app.services.morningstar_fetcher.httpx.Client")
    def test_successful_fetch_calls_write(self, mock_client_cls, fetcher) -> None:
        """Successful fetch → calls _write_to_db with parsed records."""
        xml = _build_xml([{"_id": "F001", "TS-DayEndNAV": "100", "TS-DayEndNAVDate": "2026-03-26"}])
        mock_response = MagicMock()
        mock_response.content = xml
        mock_response.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        with patch.object(fetcher, "_write_to_db") as mock_write:
            result = fetcher.fetch_single_api(APIS[3])
        assert result.status == "success"
        assert result.fund_count == 1
        mock_write.assert_called_once()

    @patch("app.services.morningstar_fetcher.httpx.Client")
    def test_audit_trail_logged(self, mock_client_cls, fetcher) -> None:
        """Audit trail logged for every fetch."""
        xml = _build_xml([{"_id": "F001", "TS-DayEndNAV": "100"}])
        mock_response = MagicMock()
        mock_response.content = xml
        mock_response.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        with patch.object(fetcher, "_write_to_db"):
            fetcher.fetch_single_api(APIS[3])
        fetcher.audit_repo.log.assert_called_once()
        call_kwargs = fetcher.audit_repo.log.call_args
        assert call_kwargs[1]["entity_type"] == "morningstar_fetch"


class TestWriteToDb:
    def test_write_fund_master(self, fetcher) -> None:
        """Write to fund_master → upsert_fund_masters called."""
        api = APIS[0]  # Identifier Data → fund_master
        records = [{"mstar_id": "F001", "legal_name": "Test Fund"}]
        result = FetchResult(api.name)
        fetcher._write_to_db(api, records, result)
        fetcher.ingestion_repo.upsert_fund_masters.assert_called_once()

    def test_write_nav_daily_adds_date(self, fetcher) -> None:
        """Write to nav_daily → nav_date added if missing."""
        api = APIS[3]  # Nav Data → nav_daily
        records = [{"mstar_id": "F001", "nav": "100.00"}]
        result = FetchResult(api.name)
        fetcher._write_to_db(api, records, result)
        call_args = fetcher.ingestion_repo.upsert_nav_daily.call_args[0][0]
        assert "nav_date" in call_args[0]

    def test_write_nav_daily_keeps_existing_date(self, fetcher) -> None:
        """Write to nav_daily → nav_date preserved if already present."""
        api = APIS[3]
        records = [{"mstar_id": "F001", "nav": "100.00", "nav_date": "2026-03-25"}]
        result = FetchResult(api.name)
        fetcher._write_to_db(api, records, result)
        call_args = fetcher.ingestion_repo.upsert_nav_daily.call_args[0][0]
        assert call_args[0]["nav_date"] == date(2026, 3, 25)

    def test_write_risk_stats_splits_master_fields(self, fetcher) -> None:
        """Risk API → splits master fields from risk fields correctly."""
        api = APIS[5]  # Risk Stats
        records = [{
            "mstar_id": "F001",
            "sharpe_3y": "1.2",
            "legal_name": "Test Fund",  # master field
        }]
        result = FetchResult(api.name)
        fetcher._write_to_db(api, records, result)
        # Both upserts should be called
        fetcher.ingestion_repo.upsert_fund_masters.assert_called_once()
        fetcher.ingestion_repo.upsert_risk_stats.assert_called_once()

    def test_write_rank_monthly(self, fetcher) -> None:
        """Write to rank_monthly → upsert_ranks called."""
        api = APIS[6]  # Rank Data
        records = [{"mstar_id": "F001", "quartile_1y": "1"}]
        result = FetchResult(api.name)
        fetcher._write_to_db(api, records, result)
        fetcher.ingestion_repo.upsert_ranks.assert_called_once()

    def test_write_category_returns_derives_category_code(self, fetcher) -> None:
        """Write to category_returns → derives category_code from fund_master lookup."""
        api = APIS[7]  # Category Return Data
        records = [
            {"mstar_id": "F001", "cat_return_3y": "12.5"},
            {"mstar_id": "F002", "cat_return_3y": "10.0"},
        ]
        # Mock category lookup
        fetcher._get_category_lookup = MagicMock(
            return_value={"F001": "Large Cap", "F002": "Mid Cap"}
        )
        result = FetchResult(api.name)
        fetcher._write_to_db(api, records, result)
        fetcher.ingestion_repo.upsert_category_returns.assert_called_once()
        coerced = fetcher.ingestion_repo.upsert_category_returns.call_args[0][0]
        codes = {r["category_code"] for r in coerced}
        assert "Large Cap" in codes
        assert "Mid Cap" in codes

    def test_write_category_returns_deduplicates_by_category(self, fetcher) -> None:
        """Multiple funds in same category → one category return record."""
        api = APIS[7]
        records = [
            {"mstar_id": "F001", "cat_return_3y": "12.5"},
            {"mstar_id": "F002", "cat_return_3y": "12.5"},  # same category
        ]
        fetcher._get_category_lookup = MagicMock(
            return_value={"F001": "Large Cap", "F002": "Large Cap"}
        )
        result = FetchResult(api.name)
        fetcher._write_to_db(api, records, result)
        coerced = fetcher.ingestion_repo.upsert_category_returns.call_args[0][0]
        assert len(coerced) == 1  # deduplicated

    def test_db_error_captured(self, fetcher) -> None:
        """DB write error → captured in result.errors, not raised."""
        api = APIS[0]
        records = [{"mstar_id": "F001", "legal_name": "Test"}]
        result = FetchResult(api.name)
        fetcher.ingestion_repo.upsert_fund_masters.side_effect = RuntimeError("DB down")
        fetcher._write_to_db(api, records, result)
        assert len(result.errors) == 1
        assert "DB down" in result.errors[0]


class TestTypeCoercion:
    """Type coercion converts XML string values to proper DB types."""

    def test_numeric_column_coerced_to_decimal(self, fetcher) -> None:
        """Numeric columns → Decimal values."""
        from decimal import Decimal
        record = {"mstar_id": "F001", "nav": "1002.45", "nav_date": "2026-03-26"}
        coerced = fetcher._coerce_record(record, NavDaily)
        assert isinstance(coerced["nav"], Decimal)
        assert coerced["nav"] == Decimal("1002.45")

    def test_date_column_coerced(self, fetcher) -> None:
        """Date columns → date objects."""
        record = {"mstar_id": "F001", "inception_date": "2020-01-15", "legal_name": "Test", "category_name": "Large Cap"}
        coerced = fetcher._coerce_record(record, FundMaster)
        assert isinstance(coerced["inception_date"], date)
        assert coerced["inception_date"] == date(2020, 1, 15)

    def test_integer_column_coerced(self, fetcher) -> None:
        """Integer columns → int values."""
        record = {"mstar_id": "F001", "quartile_1y": "2", "as_of_date": "2026-03-26"}
        coerced = fetcher._coerce_record(record, RankMonthly)
        assert isinstance(coerced["quartile_1y"], int)
        assert coerced["quartile_1y"] == 2

    def test_boolean_column_coerced_true_values(self, fetcher) -> None:
        """Boolean columns — '1', 'true', 'True', 'Y' → True."""
        for val in ("1", "true", "True", "Y"):
            record = {"mstar_id": "F001", "is_index_fund": val, "legal_name": "Test", "category_name": "LC"}
            coerced = fetcher._coerce_record(record, FundMaster)
            assert coerced["is_index_fund"] is True, f"Expected True for '{val}'"

    def test_boolean_column_coerced_false_values(self, fetcher) -> None:
        """Boolean columns — '0', 'false', 'False', 'N' → False."""
        for val in ("0", "false", "False", "N"):
            record = {"mstar_id": "F001", "is_index_fund": val, "legal_name": "Test", "category_name": "LC"}
            coerced = fetcher._coerce_record(record, FundMaster)
            assert coerced["is_index_fund"] is False, f"Expected False for '{val}'"

    def test_string_column_unchanged(self, fetcher) -> None:
        """String columns stay as strings."""
        record = {"mstar_id": "F001", "legal_name": "HDFC Equity Fund", "category_name": "Large Cap"}
        coerced = fetcher._coerce_record(record, FundMaster)
        assert coerced["legal_name"] == "HDFC Equity Fund"

    def test_invalid_numeric_skipped(self, fetcher) -> None:
        """Invalid numeric value → key dropped, not crash."""
        record = {"mstar_id": "F001", "nav": "not_a_number", "nav_date": "2026-03-26"}
        coerced = fetcher._coerce_record(record, NavDaily)
        assert "nav" not in coerced

    def test_invalid_date_skipped(self, fetcher) -> None:
        """Invalid date value → key dropped, not crash."""
        record = {"mstar_id": "F001", "inception_date": "bad-date", "legal_name": "Test", "category_name": "LC"}
        coerced = fetcher._coerce_record(record, FundMaster)
        assert "inception_date" not in coerced

    def test_coercion_preserves_mstar_id(self, fetcher) -> None:
        """mstar_id always preserved."""
        record = {"mstar_id": "F001", "nav": "100.00", "nav_date": "2026-03-26"}
        coerced = fetcher._coerce_record(record, NavDaily)
        assert coerced["mstar_id"] == "F001"

    def test_unknown_column_dropped(self, fetcher) -> None:
        """Column not in model → dropped during coercion."""
        record = {"mstar_id": "F001", "nonexistent_col": "val", "legal_name": "Test", "category_name": "LC"}
        coerced = fetcher._coerce_record(record, FundMaster)
        assert "nonexistent_col" not in coerced


class TestFetchOrchestration:
    @patch("app.services.morningstar_fetcher.httpx.Client")
    def test_fetch_all_calls_all_apis(self, mock_client_cls, fetcher) -> None:
        """Full fetch → calls all 8 APIs in order."""
        xml = _build_xml([{"_id": "F001", "TS-DayEndNAV": "100"}])
        mock_response = MagicMock()
        mock_response.content = xml
        mock_response.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        results = fetcher.fetch_all()
        assert len(results) == 8

    @patch("app.services.morningstar_fetcher.httpx.Client")
    def test_fetch_nav_only_calls_2_apis(self, mock_client_cls, fetcher) -> None:
        """Nav-only fetch → calls only 2 APIs."""
        xml = _build_xml([{"_id": "F001", "TS-DayEndNAV": "100"}])
        mock_response = MagicMock()
        mock_response.content = xml
        mock_response.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        results = fetcher.fetch_nav_only()
        assert len(results) == 2
        assert all(r.api_name in ("Nav Data", "Return Data") for r in results)
