"""Tests for holdings detail backfill service — TDD: write these FIRST."""

import os
import threading
import time
import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch
from xml.etree import ElementTree as ET

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.services.holdings_backfill_service import (
    HoldingsBackfillService,
    HoldingsBackfillProgress,
    _parse_holdings_xml,
)


# --- XML Parsing Tests ---

class TestParseHoldingsXml:
    """Test XML parser extracts nested HoldingDetail elements correctly."""

    VALID_XML = b"""<?xml version="1.0"?>
    <response>
        <status><code>0</code><message>OK</message></status>
        <data _idtype="mstarid" _id="F00001ISYO">
            <api _id="fq9mxhk7xeb20f3b">
                <FHV2-Holdings>
                    <HoldingDetail>
                        <Name>HDFC Bank Ltd</Name>
                        <ISIN>INE040A01034</ISIN>
                        <HoldingType>E</HoldingType>
                        <Weighting>8.5</Weighting>
                        <NumberOfShare>1000000</NumberOfShare>
                        <MarketValue>50000000</MarketValue>
                        <Country>India</Country>
                        <Currency>Indian Rupee</Currency>
                        <GlobalSector>Financial Services</GlobalSector>
                        <ShareChange>0</ShareChange>
                    </HoldingDetail>
                    <HoldingDetail>
                        <Name>Infosys Ltd</Name>
                        <ISIN>INE009A01021</ISIN>
                        <HoldingType>E</HoldingType>
                        <Weighting>6.2</Weighting>
                        <NumberOfShare>500000</NumberOfShare>
                        <MarketValue>30000000</MarketValue>
                        <Country>India</Country>
                        <GlobalSector>Technology</GlobalSector>
                    </HoldingDetail>
                </FHV2-Holdings>
            </api>
        </data>
    </response>"""

    ERROR_XML = b"""<?xml version="1.0"?>
    <response>
        <status><code>1</code><message>Invalid access code</message></status>
    </response>"""

    EMPTY_HOLDINGS_XML = b"""<?xml version="1.0"?>
    <response>
        <status><code>0</code><message>OK</message></status>
        <data _idtype="mstarid" _id="F00001ISYO">
            <api _id="fq9mxhk7xeb20f3b">
                <FHV2-Holdings>
                </FHV2-Holdings>
            </api>
        </data>
    </response>"""

    def test_valid_xml_extracts_holdings(self) -> None:
        holdings = _parse_holdings_xml(self.VALID_XML, "F00001ISYO")
        assert len(holdings) == 2
        assert holdings[0]["holding_name"] == "HDFC Bank Ltd"
        assert holdings[0]["isin"] == "INE040A01034"
        assert holdings[0]["weighting_pct"] == "8.5"
        assert holdings[0]["global_sector"] == "Financial Services"
        assert holdings[1]["holding_name"] == "Infosys Ltd"

    def test_error_status_returns_empty(self) -> None:
        holdings = _parse_holdings_xml(self.ERROR_XML, "F00001ISYO")
        assert holdings == []

    def test_empty_holdings_returns_empty(self) -> None:
        holdings = _parse_holdings_xml(self.EMPTY_HOLDINGS_XML, "F00001ISYO")
        assert holdings == []

    def test_empty_content_returns_empty(self) -> None:
        holdings = _parse_holdings_xml(b"", "F00001ISYO")
        assert holdings == []

    def test_invalid_xml_returns_empty(self) -> None:
        holdings = _parse_holdings_xml(b"not xml at all", "F00001ISYO")
        assert holdings == []

    def test_holding_without_name_skipped(self) -> None:
        xml = b"""<?xml version="1.0"?>
        <response>
            <status><code>0</code><message>OK</message></status>
            <data _idtype="mstarid" _id="F001">
                <api _id="fq9mxhk7xeb20f3b">
                    <FHV2-Holdings>
                        <HoldingDetail>
                            <Weighting>5.0</Weighting>
                        </HoldingDetail>
                        <HoldingDetail>
                            <Name>Valid Holding</Name>
                            <Weighting>3.0</Weighting>
                        </HoldingDetail>
                    </FHV2-Holdings>
                </api>
            </data>
        </response>"""
        holdings = _parse_holdings_xml(xml, "F001")
        assert len(holdings) == 1
        assert holdings[0]["holding_name"] == "Valid Holding"


# --- Progress Tracker Tests ---

class TestHoldingsBackfillProgress:
    def test_initial_state(self) -> None:
        progress = HoldingsBackfillProgress()
        status = progress.get_status()
        assert status["total_funds"] == 0
        assert status["completed"] == 0
        assert status["failed"] == 0
        assert status["running"] is False

    def test_start_sets_running(self) -> None:
        progress = HoldingsBackfillProgress()
        progress.start(total=50)
        status = progress.get_status()
        assert status["total_funds"] == 50
        assert status["running"] is True

    def test_mark_completed_increments(self) -> None:
        progress = HoldingsBackfillProgress()
        progress.start(total=10)
        progress.mark_completed(holdings_count=50)
        progress.mark_completed(holdings_count=30)
        status = progress.get_status()
        assert status["completed"] == 2
        assert status["total_holdings_inserted"] == 80

    def test_thread_safe_increments(self) -> None:
        progress = HoldingsBackfillProgress()
        progress.start(total=100)
        errors: list[str] = []

        def worker() -> None:
            try:
                for _ in range(10):
                    progress.mark_completed(holdings_count=5)
            except Exception as e:
                errors.append(str(e))

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=5)

        status = progress.get_status()
        assert status["completed"] == 100
        assert status["total_holdings_inserted"] == 500
        assert len(errors) == 0


# --- Service Tests ---

class TestHoldingsBackfillService:
    @pytest.fixture
    def mock_db(self) -> MagicMock:
        return MagicMock()

    @pytest.fixture
    def service(self, mock_db: MagicMock) -> HoldingsBackfillService:
        with patch("app.services.holdings_backfill_service.get_settings") as ms:
            settings = MagicMock()
            settings.morningstar_access_code = "test_code"
            ms.return_value = settings
            return HoldingsBackfillService(mock_db)

    def test_get_candidates_queries_regular_funds(self, service, mock_db) -> None:
        """Candidates = purchase_mode=1, active, has category."""
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            MagicMock(mstar_id="F001"),
            MagicMock(mstar_id="F002"),
            MagicMock(mstar_id="F003"),
        ]
        mock_db.execute.return_value = mock_result
        candidates = service.get_candidates()
        assert len(candidates) == 3
        mock_db.execute.assert_called_once()

    @patch("app.services.holdings_backfill_service.httpx.Client")
    def test_fetch_single_fund(self, mock_httpx_cls, service, mock_db) -> None:
        """Single fund fetch: parses XML and inserts holdings."""
        xml_response = b"""<?xml version="1.0"?>
        <response>
            <status><code>0</code><message>OK</message></status>
            <data _idtype="mstarid" _id="F001">
                <api _id="fq9mxhk7xeb20f3b">
                    <FHV2-Holdings>
                        <HoldingDetail>
                            <Name>HDFC Bank</Name>
                            <Weighting>8.5</Weighting>
                            <ISIN>INE040A01034</ISIN>
                        </HoldingDetail>
                        <HoldingDetail>
                            <Name>Infosys</Name>
                            <Weighting>6.2</Weighting>
                        </HoldingDetail>
                    </FHV2-Holdings>
                </api>
            </data>
        </response>"""

        mock_response = MagicMock()
        mock_response.content = xml_response
        mock_response.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_httpx_cls.return_value = mock_client

        # Mock the repo methods on the thread-local session
        with patch("app.services.holdings_backfill_service.SessionLocal") as mock_sl:
            mock_thread_db = MagicMock()
            mock_sl.return_value = mock_thread_db
            mock_thread_repo = MagicMock()

            with patch("app.services.holdings_backfill_service.IngestionRepository") as mock_repo_cls:
                from app.repositories.ingestion_repo import UpsertResult
                mock_repo_cls.return_value = mock_thread_repo
                mock_thread_repo.upsert_holdings_snapshot.return_value = UpsertResult(inserted=1)

                # Mock snapshot ID lookup
                mock_snap = MagicMock()
                mock_snap.id = uuid.uuid4()
                mock_thread_db.execute.return_value.fetchone.return_value = mock_snap

                count = service.fetch_fund_holdings("F001")

        assert count == 2
        mock_thread_repo.upsert_holdings_snapshot.assert_called_once()
        mock_thread_repo.upsert_holding_details.assert_called_once()

    def test_fetch_all_skips_none(self, service, mock_db) -> None:
        """fetch_all calls _fetch_single for each candidate."""
        with patch.object(service, "get_candidates", return_value=["F001", "F002"]):
            called: list[str] = []

            def track(mid: str) -> int:
                called.append(mid)
                return 10

            with patch.object(service, "_fetch_single", side_effect=track):
                summary = service.fetch_all(concurrency=1)

        assert "F001" in called
        assert "F002" in called
        assert summary["fetched"] == 2
        assert summary["total_holdings"] == 20
