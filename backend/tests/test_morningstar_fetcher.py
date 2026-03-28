"""Tests for MorningstarFetcher — XML parsing, field mapping, DB writes."""

import os
from datetime import date
from unittest.mock import MagicMock, patch, PropertyMock
from xml.etree import ElementTree as ET

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.core.morningstar_config import APIS, API_NAME_MAP, MorningstarAPI
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
        assert len(results) == 11  # 9 original + 2 new holdings APIs

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


class TestWriteHoldings:
    """Portfolio Data API → splits into snapshot, sector exposure, holding detail."""

    def test_write_holdings_snapshot_upserted(self, fetcher) -> None:
        """Holdings target → upsert_holdings_snapshot called with snapshot fields."""
        api = MorningstarAPI("Portfolio Data", "s4bqvv72rjpelvwf", "holdings", "HOLDINGS_FIELD_MAP")
        records = [{
            "mstar_id": "F001",
            "portfolio_date": "2026-03-15",
            "num_holdings": "50",
            "pe_ratio": "22.5",
        }]
        result = FetchResult(api.name)
        # Mock upsert_holdings_snapshot to return a fake result with snapshot ids
        from app.repositories.ingestion_repo import UpsertResult
        mock_upsert_result = UpsertResult(inserted=1)
        fetcher.ingestion_repo.upsert_holdings_snapshot.return_value = mock_upsert_result
        fetcher._write_to_db(api, records, result)
        fetcher.ingestion_repo.upsert_holdings_snapshot.assert_called_once()

    def test_write_holdings_sector_exposure_upserted(self, fetcher) -> None:
        """Holdings target with sector fields → upsert_sector_exposure called."""
        api = MorningstarAPI("Portfolio Data", "s4bqvv72rjpelvwf", "holdings", "HOLDINGS_FIELD_MAP")
        records = [{
            "mstar_id": "F001",
            "portfolio_date": "2026-03-15",
            "num_holdings": "50",
            # Sector fields (already stripped+mapped by _parse_xml via SECTOR_EXPOSURE_MAP)
            "sector_Technology": "25.5",
            "sector_Financial Services": "18.3",
        }]
        result = FetchResult(api.name)
        from app.repositories.ingestion_repo import UpsertResult
        fetcher.ingestion_repo.upsert_holdings_snapshot.return_value = UpsertResult(inserted=1)
        fetcher._write_to_db(api, records, result)
        fetcher.ingestion_repo.upsert_sector_exposure.assert_called_once()
        sector_records = fetcher.ingestion_repo.upsert_sector_exposure.call_args[0][0]
        sector_names = {r["sector_name"] for r in sector_records}
        assert "Technology" in sector_names
        assert "Financial Services" in sector_names

    def test_write_holdings_detail_upserted(self, fetcher) -> None:
        """Holdings target with detail fields → holding details inserted."""
        api = MorningstarAPI("Portfolio Data", "s4bqvv72rjpelvwf", "holdings", "HOLDINGS_FIELD_MAP")
        records = [{
            "mstar_id": "F001",
            "portfolio_date": "2026-03-15",
            "num_holdings": "2",
            # Holding details are stored as lists by the parser
            "holding_details": [
                {"holding_name": "HDFC Bank Ltd", "weighting_pct": "8.5", "isin": "INE040A01034"},
                {"holding_name": "Infosys Ltd", "weighting_pct": "6.2", "isin": "INE009A01021"},
            ],
        }]
        result = FetchResult(api.name)
        from app.repositories.ingestion_repo import UpsertResult
        fetcher.ingestion_repo.upsert_holdings_snapshot.return_value = UpsertResult(inserted=1)
        # Mock the snapshot lookup query (fetchall returns list of row-like objects)
        import uuid
        mock_snapshot_id = uuid.uuid4()
        mock_row = MagicMock()
        mock_row.id = mock_snapshot_id
        mock_row.mstar_id = "F001"
        mock_row.portfolio_date = "2026-03-15"
        fetcher.db.execute.return_value.fetchall.return_value = [mock_row]
        fetcher._write_to_db(api, records, result)
        fetcher.ingestion_repo.upsert_holding_details.assert_called_once()
        call_args = fetcher.ingestion_repo.upsert_holding_details.call_args
        assert call_args[0][0] == mock_snapshot_id
        assert len(call_args[0][1]) == 2

    def test_write_holdings_missing_portfolio_date_defaults_today(self, fetcher) -> None:
        """Holdings without portfolio_date → defaults to today."""
        api = MorningstarAPI("Portfolio Data", "s4bqvv72rjpelvwf", "holdings", "HOLDINGS_FIELD_MAP")
        records = [{"mstar_id": "F001", "num_holdings": "50"}]
        result = FetchResult(api.name)
        from app.repositories.ingestion_repo import UpsertResult
        fetcher.ingestion_repo.upsert_holdings_snapshot.return_value = UpsertResult(inserted=1)
        fetcher._write_to_db(api, records, result)
        call_args = fetcher.ingestion_repo.upsert_holdings_snapshot.call_args[0][0]
        assert "portfolio_date" in call_args[0]

    def test_parse_xml_holdings_maps_all_three_types(self, fetcher) -> None:
        """Portfolio Data XML → snapshot, sector, and detail fields all mapped."""
        xml = _build_xml([{
            "_id": "F001",
            "PD-PortfolioDate": "2026-03-15",
            "PD-NumberofHolding": "50",
            "PD-PERatioTTMLong": "22.5",
            "PD-EquitySectorTechnologyNet": "25.5",
            "PD-EquitySectorEnergyNet": "10.2",
            "PD-HoldingDetail_Name": "HDFC Bank|Infosys",
            "PD-HoldingDetail_Weighting": "8.5|6.2",
        }])
        api = MorningstarAPI("Portfolio Data", "s4bqvv72rjpelvwf", "holdings", "HOLDINGS_FIELD_MAP")
        records, result = fetcher._parse_xml(xml, api)
        assert result.fund_count == 1
        record = records[0]
        # Snapshot fields
        assert record.get("portfolio_date") == "2026-03-15"
        assert record.get("num_holdings") == "50"
        # Sector fields (prefixed with sector_)
        assert record.get("sector_Technology") == "25.5"
        # Detail fields (pipe-delimited lists)
        assert "holding_details" in record


class TestNewAPIs:
    """Tests for Portfolio Summary and Fund Holdings Detail APIs."""

    def test_config_has_portfolio_summary_api(self) -> None:
        """morningstar_config has Portfolio Summary API."""
        assert "portfolio_summary" in API_NAME_MAP

    def test_config_has_holdings_detail_api(self) -> None:
        """morningstar_config has Fund Holdings Detail API."""
        assert "holdings_detail" in API_NAME_MAP

    def test_portfolio_summary_api_properties(self) -> None:
        """Portfolio Summary API has correct hash and db_target."""
        api = API_NAME_MAP["portfolio_summary"]
        assert api.hash == "ryt74bh4koatkf2w"
        assert api.db_target == "holdings_snapshot"

    def test_holdings_detail_api_properties(self) -> None:
        """Fund Holdings Detail API has correct hash and db_target."""
        api = API_NAME_MAP["holdings_detail"]
        assert api.hash == "fq9mxhk7xeb20f3b"
        assert api.db_target == "holdings_detail"


class TestWriteHoldingsSnapshot:
    """Portfolio Summary API → splits into snapshot + sector + asset alloc + credit quality."""

    @pytest.fixture(autouse=True)
    def mock_regular_ids(self, fetcher):
        """All holdings_snapshot tests assume F001 is a Regular fund."""
        fetcher._get_regular_fund_ids = MagicMock(return_value={"F001"})

    def test_write_holdings_snapshot_filters_regular_only(self, fetcher) -> None:
        """holdings_snapshot target → only Regular funds (purchase_mode=1) written."""
        api = MorningstarAPI("Portfolio Summary", "ryt74bh4koatkf2w", "holdings_snapshot", "HOLDINGS_FIELD_MAP")
        records = [
            {"mstar_id": "F001", "portfolio_date": "2026-03-15", "num_holdings": "50"},
            {"mstar_id": "F002", "portfolio_date": "2026-03-15", "num_holdings": "30"},  # Direct fund
        ]
        result = FetchResult(api.name)
        # F001 is Regular (via autouse fixture), F002 is not
        from app.repositories.ingestion_repo import UpsertResult
        fetcher.ingestion_repo.upsert_holdings_snapshot.return_value = UpsertResult(inserted=1)
        fetcher._write_to_db(api, records, result)
        coerced = fetcher.ingestion_repo.upsert_holdings_snapshot.call_args[0][0]
        mstar_ids = {r["mstar_id"] for r in coerced}
        assert "F001" in mstar_ids
        assert "F002" not in mstar_ids

    def test_write_holdings_snapshot_upserts_snapshot(self, fetcher) -> None:
        """holdings_snapshot target → upsert_holdings_snapshot called."""
        api = MorningstarAPI("Portfolio Summary", "ryt74bh4koatkf2w", "holdings_snapshot", "HOLDINGS_FIELD_MAP")
        records = [{
            "mstar_id": "F001",
            "portfolio_date": "2026-03-15",
            "num_holdings": "50",
        }]
        result = FetchResult(api.name)
        from app.repositories.ingestion_repo import UpsertResult
        fetcher.ingestion_repo.upsert_holdings_snapshot.return_value = UpsertResult(inserted=1)
        fetcher._write_to_db(api, records, result)
        fetcher.ingestion_repo.upsert_holdings_snapshot.assert_called_once()

    def test_write_holdings_snapshot_extracts_sectors(self, fetcher) -> None:
        """holdings_snapshot target with sector fields → upsert_sector_exposure called."""
        api = MorningstarAPI("Portfolio Summary", "ryt74bh4koatkf2w", "holdings_snapshot", "HOLDINGS_FIELD_MAP")
        records = [{
            "mstar_id": "F001",
            "portfolio_date": "2026-03-15",
            "num_holdings": "50",
            "sector_Technology": "25.5",
            "sector_Financial Services": "18.3",
        }]
        result = FetchResult(api.name)
        from app.repositories.ingestion_repo import UpsertResult
        fetcher.ingestion_repo.upsert_holdings_snapshot.return_value = UpsertResult(inserted=1)
        fetcher._write_to_db(api, records, result)
        fetcher.ingestion_repo.upsert_sector_exposure.assert_called_once()
        sector_recs = fetcher.ingestion_repo.upsert_sector_exposure.call_args[0][0]
        assert len(sector_recs) == 2

    def test_write_holdings_snapshot_extracts_asset_allocation(self, fetcher) -> None:
        """holdings_snapshot target with asset alloc fields → upsert_asset_allocation called."""
        api = MorningstarAPI("Portfolio Summary", "ryt74bh4koatkf2w", "holdings_snapshot", "HOLDINGS_FIELD_MAP")
        records = [{
            "mstar_id": "F001",
            "portfolio_date": "2026-03-15",
            "asset_alloc_equity_net": "85.5",
            "asset_alloc_bond_net": "10.2",
            "asset_alloc_cash_net": "4.3",
        }]
        result = FetchResult(api.name)
        from app.repositories.ingestion_repo import UpsertResult
        fetcher.ingestion_repo.upsert_holdings_snapshot.return_value = UpsertResult(inserted=1)
        fetcher._write_to_db(api, records, result)
        fetcher.ingestion_repo.upsert_asset_allocation.assert_called_once()
        alloc_recs = fetcher.ingestion_repo.upsert_asset_allocation.call_args[0][0]
        assert alloc_recs[0]["mstar_id"] == "F001"
        assert "equity_net" in alloc_recs[0]

    def test_write_holdings_snapshot_extracts_credit_quality(self, fetcher) -> None:
        """holdings_snapshot target with credit quality fields → upsert_credit_quality called."""
        api = MorningstarAPI("Portfolio Summary", "ryt74bh4koatkf2w", "holdings_snapshot", "HOLDINGS_FIELD_MAP")
        records = [{
            "mstar_id": "F001",
            "portfolio_date": "2026-03-15",
            "credit_aaa_pct": "30.0",
            "credit_aa_pct": "25.0",
        }]
        result = FetchResult(api.name)
        from app.repositories.ingestion_repo import UpsertResult
        fetcher.ingestion_repo.upsert_holdings_snapshot.return_value = UpsertResult(inserted=1)
        fetcher._write_to_db(api, records, result)
        fetcher.ingestion_repo.upsert_credit_quality.assert_called_once()
        credit_recs = fetcher.ingestion_repo.upsert_credit_quality.call_args[0][0]
        assert credit_recs[0]["mstar_id"] == "F001"
        assert "aaa_pct" in credit_recs[0]

    def test_parse_xml_holdings_snapshot_maps_asset_alloc(self, fetcher) -> None:
        """Portfolio Summary XML → asset allocation fields mapped with prefix."""
        xml = _build_xml([{
            "_id": "F001",
            "PD-MostCurrentPortfolioDate": "2026-03-15",
            "PD-AssetAllocEquityNet": "85.5",
            "PD-AssetAllocBondNet": "10.2",
            "PD-IndiaLargeCapPct": "60.0",
        }])
        api = MorningstarAPI("Portfolio Summary", "ryt74bh4koatkf2w", "holdings_snapshot", "HOLDINGS_FIELD_MAP")
        records, result = fetcher._parse_xml(xml, api)
        assert result.fund_count == 1
        record = records[0]
        assert record.get("asset_alloc_equity_net") == "85.5"
        assert record.get("asset_alloc_india_large_cap_pct") == "60.0"

    def test_parse_xml_holdings_snapshot_maps_credit_quality(self, fetcher) -> None:
        """Portfolio Summary XML → credit quality fields mapped with prefix."""
        xml = _build_xml([{
            "_id": "F001",
            "PD-MostCurrentPortfolioDate": "2026-03-15",
            "PD-CreditQualAAA": "30.0",
            "PD-CreditQualAA": "25.0",
            "PD-CreditQualNotRated": "5.0",
        }])
        api = MorningstarAPI("Portfolio Summary", "ryt74bh4koatkf2w", "holdings_snapshot", "HOLDINGS_FIELD_MAP")
        records, result = fetcher._parse_xml(xml, api)
        record = records[0]
        assert record.get("credit_aaa_pct") == "30.0"
        assert record.get("credit_aa_pct") == "25.0"
        assert record.get("credit_not_rated_pct") == "5.0"


class TestWriteHoldingsDetail:
    """Fund Holdings Detail API → creates snapshot + inserts individual holdings."""

    @pytest.fixture(autouse=True)
    def mock_regular_ids(self, fetcher):
        """All holdings_detail tests assume F001 is a Regular fund."""
        fetcher._get_regular_fund_ids = MagicMock(return_value={"F001"})

    def test_write_holdings_detail_creates_details(self, fetcher) -> None:
        """holdings_detail target → holding details inserted via snapshot FK."""
        api = MorningstarAPI("Fund Holdings Detail", "fq9mxhk7xeb20f3b", "holdings_detail", "HOLDING_DETAIL_FIELD_MAP")
        records = [{
            "mstar_id": "F001",
            "portfolio_date": "2026-03-15",
            "holding_details": [
                {"holding_name": "HDFC Bank", "weighting_pct": "8.5"},
                {"holding_name": "Infosys", "weighting_pct": "6.2"},
            ],
        }]
        result = FetchResult(api.name)
        from app.repositories.ingestion_repo import UpsertResult
        fetcher.ingestion_repo.upsert_holdings_snapshot.return_value = UpsertResult(inserted=1)
        import uuid
        mock_snapshot_id = uuid.uuid4()
        mock_row = MagicMock()
        mock_row.id = mock_snapshot_id
        mock_row.mstar_id = "F001"
        mock_row.portfolio_date = "2026-03-15"
        fetcher.db.execute.return_value.fetchall.return_value = [mock_row]
        fetcher._write_to_db(api, records, result)
        fetcher.ingestion_repo.upsert_holding_details.assert_called_once()

    def test_parse_xml_holdings_detail_maps_pipe_delimited(self, fetcher) -> None:
        """Fund Holdings Detail XML → pipe-delimited holding details parsed."""
        xml = _build_xml([{
            "_id": "F001",
            "PD-MostCurrentPortfolioDate": "2026-03-15",
            "PD-HoldingDetail_Name": "HDFC Bank|Infosys|TCS",
            "PD-HoldingDetail_Weighting": "8.5|6.2|5.1",
            "PD-HoldingDetail_ISIN": "INE040A01034|INE009A01021|INE467B01029",
        }])
        api = MorningstarAPI("Fund Holdings Detail", "fq9mxhk7xeb20f3b", "holdings_detail", "HOLDING_DETAIL_FIELD_MAP")
        records, result = fetcher._parse_xml(xml, api)
        assert result.fund_count == 1
        record = records[0]
        assert "holding_details" in record
        details = record["holding_details"]
        assert len(details) == 3
        assert details[0]["holding_name"] == "HDFC Bank"

    def test_parse_xml_holdings_detail_nested_elements(self, fetcher) -> None:
        """Fund Holdings Detail XML → nested <HoldingDetail> elements parsed."""
        xml = (
            '<?xml version="1.0"?>'
            "<response><status><code>0</code><message>OK</message></status>"
            '<data _idtype="mstarid" _id="F001">'
            '<api _id="fq9mxhk7xeb20f3b">'
            "<FHV2-Holdings>"
            "<HoldingDetail>"
            "<Name>HDFC Bank Ltd</Name>"
            "<ISIN>INE040A01034</ISIN>"
            "<HoldingType>E</HoldingType>"
            "<Weighting>8.5</Weighting>"
            "<NumberOfShare>1000000</NumberOfShare>"
            "<MarketValue>50000000</MarketValue>"
            "<Country>India</Country>"
            "</HoldingDetail>"
            "<HoldingDetail>"
            "<Name>Infosys Ltd</Name>"
            "<ISIN>INE009A01021</ISIN>"
            "<HoldingType>E</HoldingType>"
            "<Weighting>6.2</Weighting>"
            "</HoldingDetail>"
            "</FHV2-Holdings>"
            "</api></data></response>"
        ).encode("utf-8")
        api = MorningstarAPI("Fund Holdings Detail", "fq9mxhk7xeb20f3b", "holdings_detail", "HOLDING_DETAIL_FIELD_MAP")
        records, result = fetcher._parse_xml(xml, api)
        assert result.fund_count == 1
        record = records[0]
        assert "holding_details" in record
        details = record["holding_details"]
        assert len(details) == 2
        assert details[0]["holding_name"] == "HDFC Bank Ltd"
        assert details[0]["weighting_pct"] == "8.5"
        assert details[0]["isin"] == "INE040A01034"
        assert details[1]["holding_name"] == "Infosys Ltd"
