"""Tests for NAV backfill service (AMFI API) — TDD."""

import os
import threading
import time
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.services.nav_backfill_service import (
    NAVBackfillService,
    BackfillProgress,
    _RateLimiter,
    _parse_mfapi_response,
)


# --- AMFI JSON Parsing Tests ---

class TestParseMfapiResponse:
    """Test JSON parser extracts date + Decimal NAV correctly."""

    VALID_RESPONSE = {
        "meta": {"fund_house": "HDFC", "scheme_name": "HDFC Flexi Cap"},
        "data": [
            {"date": "03-01-2024", "nav": "153.12000"},
            {"date": "02-01-2024", "nav": "152.34000"},
            {"date": "01-01-2024", "nav": "151.98000"},
        ],
    }

    ERROR_RESPONSE = {
        "status": "error",
        "data": None,
    }

    BAD_VALUES_RESPONSE = {
        "data": [
            {"date": "02-01-2024", "nav": "152.34000"},
            {"date": "bad-date", "nav": "153.12"},
            {"date": "04-01-2024", "nav": "not-a-number"},
            {"date": "05-01-2024", "nav": ""},
            {"date": "", "nav": "100.00"},
        ],
    }

    def test_valid_response_extracts_records(self) -> None:
        records = _parse_mfapi_response(self.VALID_RESPONSE, "F00000VSLQ")
        assert len(records) == 3
        assert records[0]["mstar_id"] == "F00000VSLQ"
        assert records[0]["nav_date"] == date(2024, 1, 3)
        assert records[0]["nav"] == Decimal("153.12000")
        assert isinstance(records[0]["nav"], Decimal)

    def test_error_response_returns_empty(self) -> None:
        records = _parse_mfapi_response(self.ERROR_RESPONSE, "F00000VSLQ")
        assert records == []

    def test_bad_values_skipped_gracefully(self) -> None:
        records = _parse_mfapi_response(self.BAD_VALUES_RESPONSE, "F00000VSLQ")
        assert len(records) == 1
        assert records[0]["nav_date"] == date(2024, 1, 2)
        assert records[0]["nav"] == Decimal("152.34000")

    def test_empty_data_returns_empty(self) -> None:
        records = _parse_mfapi_response({"data": []}, "F00000VSLQ")
        assert records == []

    def test_date_range_filtering(self) -> None:
        records = _parse_mfapi_response(
            self.VALID_RESPONSE, "F00000VSLQ",
            start_date=date(2024, 1, 2),
            end_date=date(2024, 1, 2),
        )
        assert len(records) == 1
        assert records[0]["nav_date"] == date(2024, 1, 2)

    def test_dd_mm_yyyy_format(self) -> None:
        """AMFI uses DD-MM-YYYY, not ISO format."""
        data = {"data": [{"date": "15-06-2023", "nav": "100.50"}]}
        records = _parse_mfapi_response(data, "TEST")
        assert len(records) == 1
        assert records[0]["nav_date"] == date(2023, 6, 15)


# --- Rate Limiter Tests ---

class TestRateLimiter:
    def test_allows_calls_under_limit(self) -> None:
        limiter = _RateLimiter(max_calls=5, period_seconds=3600)
        for _ in range(5):
            limiter.acquire()

    def test_pauses_when_ceiling_reached(self) -> None:
        limiter = _RateLimiter(max_calls=3, period_seconds=0.5)
        for _ in range(3):
            limiter.acquire()
        start = time.monotonic()
        limiter.acquire()
        elapsed = time.monotonic() - start
        assert elapsed >= 0.2

    def test_thread_safe(self) -> None:
        limiter = _RateLimiter(max_calls=10, period_seconds=3600)
        errors: list = []

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
        errors: list = []

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
        """Only purchase_mode=1, active, has category, has amfi_code should be returned."""
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            MagicMock(mstar_id="F001", amfi_code="118989"),
            MagicMock(mstar_id="F002", amfi_code="120503"),
        ]
        mock_db.execute.return_value = mock_result

        candidates = service.get_backfill_candidates()
        assert len(candidates) == 2
        assert candidates[0]["mstar_id"] == "F001"
        assert candidates[0]["amfi_code"] == "118989"
        mock_db.execute.assert_called_once()

    def test_backfill_skips_already_done_funds(self, mock_db: MagicMock) -> None:
        """Funds with earliest date <= start_date should be skipped."""
        service = NAVBackfillService(mock_db)

        with patch.object(service, "get_backfill_candidates", return_value=[
            {"mstar_id": "F001", "amfi_code": "111"},
            {"mstar_id": "F002", "amfi_code": "222"},
        ]):
            with patch.object(service, "_repo") as mock_repo:
                mock_repo.get_earliest_nav_dates.return_value = {
                    "F001": date(2016, 1, 1),
                }
                called_funds: list = []

                def track_backfill(mstar_id: str, amfi_code: str, start: str, end: str) -> int:
                    called_funds.append(mstar_id)
                    return 100

                with patch.object(service, "_backfill_single", side_effect=track_backfill):
                    service.backfill_all(start_date="2016-01-01", concurrency=1)

                assert "F001" not in called_funds
                assert "F002" in called_funds

    @patch("app.services.nav_backfill_service.httpx.Client")
    def test_backfill_fund_single(self, mock_httpx_cls: MagicMock, mock_db: MagicMock) -> None:
        """Single fund backfill via AMFI API: mocked HTTP + repo, correct types."""
        json_response = {
            "meta": {"fund_house": "Test"},
            "data": [
                {"date": "03-01-2024", "nav": "153.12000"},
                {"date": "02-01-2024", "nav": "152.34000"},
            ],
        }

        mock_response = MagicMock()
        mock_response.json.return_value = json_response
        mock_response.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_httpx_cls.return_value = mock_client

        service = NAVBackfillService(mock_db)
        from app.repositories.ingestion_repo import UpsertResult
        service._repo.insert_nav_daily_backfill = MagicMock(
            return_value=UpsertResult(inserted=2)
        )

        count = service.backfill_fund(
            "F00000VSLQ", "2024-01-01", "2024-01-10", amfi_code="118989"
        )
        assert count == 2
        call_args = service._repo.insert_nav_daily_backfill.call_args[0][0]
        assert all(isinstance(r["nav"], Decimal) for r in call_args)
        assert all(isinstance(r["nav_date"], date) for r in call_args)

    @patch("app.services.nav_backfill_service.httpx.Client")
    def test_backfill_fund_looks_up_amfi_code(self, mock_httpx_cls: MagicMock, mock_db: MagicMock) -> None:
        """When amfi_code not provided, looks it up from fund_master."""
        mock_row = MagicMock()
        mock_row.amfi_code = "118989"
        mock_db.execute.return_value.first.return_value = mock_row

        mock_response = MagicMock()
        mock_response.json.return_value = {"data": [{"date": "02-01-2024", "nav": "152.34"}]}
        mock_response.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_httpx_cls.return_value = mock_client

        service = NAVBackfillService(mock_db)
        from app.repositories.ingestion_repo import UpsertResult
        service._repo.insert_nav_daily_backfill = MagicMock(
            return_value=UpsertResult(inserted=1)
        )

        count = service.backfill_fund("F00000VSLQ", "2024-01-01")
        assert count == 1
        mock_client.get.assert_called_once()
        call_url = mock_client.get.call_args[0][0]
        assert "118989" in call_url
        assert "mfapi.in" in call_url

    def test_backfill_fund_no_amfi_code_returns_zero(self, mock_db: MagicMock) -> None:
        """Fund without amfi_code should return 0, not crash."""
        mock_db.execute.return_value.first.return_value = None

        service = NAVBackfillService(mock_db)
        count = service.backfill_fund("F_NO_AMFI", "2024-01-01")
        assert count == 0
