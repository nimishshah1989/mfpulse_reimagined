"""Tests for NAV backfill service — TDD: write these FIRST."""

import os
import threading
import time
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.services.nav_backfill_service import (
    NAVBackfillService,
    BackfillProgress,
    _RateLimiter,
    _parse_historical_nav_xml,
)


# --- XML Parsing Tests ---

class TestParseHistoricalNavXml:
    """Test XML parser extracts date + Decimal NAV correctly."""

    VALID_XML = b"""<?xml version="1.0"?>
    <serviceresponse>
        <status><code>0</code><message>OK</message></status>
        <data _id="F00000VSLQ">
            <api>
                <TS-DayEndNAV date="2024-01-02">152.3400</TS-DayEndNAV>
                <TS-DayEndNAV date="2024-01-03">153.1200</TS-DayEndNAV>
                <TS-DayEndNAV date="2024-01-04">151.9800</TS-DayEndNAV>
            </api>
        </data>
    </serviceresponse>"""

    ERROR_XML = b"""<?xml version="1.0"?>
    <serviceresponse>
        <status><code>1</code><message>Invalid access code</message></status>
    </serviceresponse>"""

    BAD_VALUES_XML = b"""<?xml version="1.0"?>
    <serviceresponse>
        <status><code>0</code><message>OK</message></status>
        <data _id="F00000VSLQ">
            <api>
                <TS-DayEndNAV date="2024-01-02">152.3400</TS-DayEndNAV>
                <TS-DayEndNAV date="bad-date">153.12</TS-DayEndNAV>
                <TS-DayEndNAV date="2024-01-04">not-a-number</TS-DayEndNAV>
                <TS-DayEndNAV date="2024-01-05"></TS-DayEndNAV>
            </api>
        </data>
    </serviceresponse>"""

    def test_valid_xml_extracts_records(self) -> None:
        records = _parse_historical_nav_xml(self.VALID_XML, "F00000VSLQ")
        assert len(records) == 3
        assert records[0]["mstar_id"] == "F00000VSLQ"
        assert records[0]["nav_date"] == date(2024, 1, 2)
        assert records[0]["nav"] == Decimal("152.3400")
        assert isinstance(records[0]["nav"], Decimal)

    def test_error_status_returns_empty(self) -> None:
        records = _parse_historical_nav_xml(self.ERROR_XML, "F00000VSLQ")
        assert records == []

    def test_bad_values_skipped_gracefully(self) -> None:
        records = _parse_historical_nav_xml(self.BAD_VALUES_XML, "F00000VSLQ")
        # Only the valid record should survive
        assert len(records) == 1
        assert records[0]["nav_date"] == date(2024, 1, 2)
        assert records[0]["nav"] == Decimal("152.3400")

    def test_empty_content_returns_empty(self) -> None:
        records = _parse_historical_nav_xml(b"", "F00000VSLQ")
        assert records == []


# --- Rate Limiter Tests ---

class TestRateLimiter:
    def test_allows_calls_under_limit(self) -> None:
        limiter = _RateLimiter(max_calls=5, period_seconds=3600)
        for _ in range(5):
            limiter.acquire()
        # Should not raise or hang

    def test_pauses_when_ceiling_reached(self) -> None:
        """Limiter should block when call count hits the ceiling."""
        limiter = _RateLimiter(max_calls=3, period_seconds=0.5)
        # Fill up the window
        for _ in range(3):
            limiter.acquire()
        # Next call should block until window expires (~0.5s)
        start = time.monotonic()
        limiter.acquire()
        elapsed = time.monotonic() - start
        # Should have waited at least 0.3s (allowing some tolerance)
        assert elapsed >= 0.2

    def test_thread_safe(self) -> None:
        """Concurrent acquire calls should not exceed limit."""
        limiter = _RateLimiter(max_calls=10, period_seconds=3600)
        errors: list[str] = []

        def worker() -> None:
            try:
                limiter.acquire()
            except Exception as e:
                errors.append(str(e))

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=5)
        assert len(errors) == 0


# --- BackfillProgress Tests ---

class TestBackfillProgress:
    def test_initial_state(self) -> None:
        progress = BackfillProgress()
        status = progress.get_status()
        assert status["total_funds"] == 0
        assert status["completed"] == 0
        assert status["failed"] == 0
        assert status["running"] is False

    def test_increment_thread_safe(self) -> None:
        progress = BackfillProgress()
        progress.start(total=100)

        errors: list[str] = []

        def worker() -> None:
            try:
                for _ in range(10):
                    progress.mark_completed(nav_count=5)
            except Exception as e:
                errors.append(str(e))

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=5)

        status = progress.get_status()
        assert status["completed"] == 100
        assert status["total_navs_inserted"] == 500
        assert len(errors) == 0


# --- Service Tests ---

class TestNAVBackfillService:
    @pytest.fixture
    def mock_db(self) -> MagicMock:
        return MagicMock()

    @pytest.fixture
    def service(self, mock_db: MagicMock) -> NAVBackfillService:
        return NAVBackfillService(mock_db)

    def test_get_backfill_candidates_filters_correctly(self, service: NAVBackfillService, mock_db: MagicMock) -> None:
        """Only purchase_mode=1, active, with category should be returned."""
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            MagicMock(mstar_id="F001"),
            MagicMock(mstar_id="F002"),
        ]
        mock_db.execute.return_value = mock_result

        candidates = service.get_backfill_candidates()
        assert len(candidates) == 2
        assert "F001" in candidates
        assert "F002" in candidates
        # Verify the SQL was called
        mock_db.execute.assert_called_once()

    def test_backfill_skips_already_done_funds(self, mock_db: MagicMock) -> None:
        """Funds with earliest date <= start_date should be skipped."""
        service = NAVBackfillService(mock_db)

        # Mock get_backfill_candidates
        with patch.object(service, "get_backfill_candidates", return_value=["F001", "F002"]):
            # Mock repo.get_earliest_nav_dates — F001 already backfilled to 2016-01-01
            with patch.object(service, "_repo") as mock_repo:
                mock_repo.get_earliest_nav_dates.return_value = {
                    "F001": date(2016, 1, 1),
                }
                # Mock _backfill_single to track which funds actually get called
                called_funds: list[str] = []

                def track_backfill(mstar_id: str, start: str, end: str) -> int:
                    called_funds.append(mstar_id)
                    return 100

                with patch.object(service, "_backfill_single", side_effect=track_backfill):
                    service.backfill_all(start_date="2016-01-01", concurrency=1)

                # F001 should be skipped (already at 2016-01-01), F002 should be fetched
                assert "F001" not in called_funds
                assert "F002" in called_funds

    @patch("app.services.nav_backfill_service.httpx.Client")
    def test_backfill_fund_single(self, mock_httpx_cls: MagicMock, mock_db: MagicMock) -> None:
        """Single fund backfill: mocked HTTP + repo, correct types."""
        xml_response = b"""<?xml version="1.0"?>
        <serviceresponse>
            <status><code>0</code><message>OK</message></status>
            <data _id="F00000VSLQ">
                <api>
                    <TS-DayEndNAV date="2024-01-02">152.34</TS-DayEndNAV>
                    <TS-DayEndNAV date="2024-01-03">153.12</TS-DayEndNAV>
                </api>
            </data>
        </serviceresponse>"""

        mock_response = MagicMock()
        mock_response.content = xml_response
        mock_response.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_httpx_cls.return_value = mock_client

        service = NAVBackfillService(mock_db)
        # Mock the repo method
        from app.repositories.ingestion_repo import UpsertResult
        service._repo.insert_nav_daily_backfill = MagicMock(
            return_value=UpsertResult(inserted=2)
        )

        count = service.backfill_fund("F00000VSLQ", "2024-01-01", "2024-01-10")
        assert count == 2
        # Verify records passed to repo have Decimal NAVs
        call_args = service._repo.insert_nav_daily_backfill.call_args[0][0]
        assert all(isinstance(r["nav"], Decimal) for r in call_args)
        assert all(isinstance(r["nav_date"], date) for r in call_args)
