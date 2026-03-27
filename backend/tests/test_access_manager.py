"""Tests for AccessCodeManager — verify, create, rotate."""

import os
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.services.morningstar_access_manager import AccessCodeManager


@pytest.fixture
def manager():
    with patch("app.services.morningstar_access_manager.get_settings") as mock_settings:
        settings = MagicMock()
        settings.morningstar_access_code = "test_code_123"
        settings.morningstar_username = "test_account"
        settings.morningstar_password = "test_password"
        mock_settings.return_value = settings
        mgr = AccessCodeManager()
    return mgr


class TestVerifyCurrent:
    @patch("app.services.morningstar_access_manager.httpx.get")
    def test_valid_code_returns_expiry(self, mock_get, manager) -> None:
        """Verify valid code → returns expiry info."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = (
            b'<?xml version="1.0"?>'
            b"<response><status><code>0</code><message>OK</message></status>"
            b"<AccesscodeInfo>"
            b"<ExpirationDate>2026-06-25</ExpirationDate>"
            b"<DaysRemaining>90</DaysRemaining>"
            b"</AccesscodeInfo></response>"
        )
        mock_get.return_value = mock_response

        info = manager.verify_current()
        assert info["valid"] is True
        assert info["expires"] == "2026-06-25"
        assert info["days_remaining"] == 90

    @patch("app.services.morningstar_access_manager.httpx.get")
    def test_invalid_code(self, mock_get, manager) -> None:
        """Verify invalid code → returns valid=False."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = (
            b'<?xml version="1.0"?>'
            b"<response><status><code>1</code>"
            b"<message>Invalid access code</message></status></response>"
        )
        mock_get.return_value = mock_response

        info = manager.verify_current()
        assert info["valid"] is False

    @patch("app.services.morningstar_access_manager.httpx.get")
    def test_network_error(self, mock_get, manager) -> None:
        """Network error during verify → returns valid=False with error."""
        import httpx
        mock_get.side_effect = httpx.ConnectError("connection refused")

        info = manager.verify_current()
        assert info["valid"] is False
        assert "error" in info


class TestCreateNew:
    @patch("app.services.morningstar_access_manager.httpx.post")
    def test_create_returns_code(self, mock_post, manager) -> None:
        """Create new code → returns code string."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = (
            b'<?xml version="1.0"?>'
            b"<response><status><code>0</code><message>OK</message></status>"
            b"<Accesscode>new_code_456</Accesscode></response>"
        )
        mock_post.return_value = mock_response

        code = manager.create_new(days=90)
        assert code == "new_code_456"

    @patch("app.services.morningstar_access_manager.httpx.post")
    def test_create_failure(self, mock_post, manager) -> None:
        """Create failure → returns None."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = (
            b'<?xml version="1.0"?>'
            b"<response><status><code>1</code>"
            b"<message>Bad credentials</message></status></response>"
        )
        mock_post.return_value = mock_response

        code = manager.create_new(days=90)
        assert code is None


class TestRotateIfNeeded:
    @patch.object(AccessCodeManager, "create_new", return_value="new_code")
    @patch.object(AccessCodeManager, "verify_current")
    def test_rotate_when_days_low(self, mock_verify, mock_create, manager) -> None:
        """Rotate when < 7 days → creates new code."""
        mock_verify.return_value = {"valid": True, "expires": "2026-03-30", "days_remaining": 3}
        manager.rotate_if_needed(min_days=7)
        mock_create.assert_called_once_with(90)

    @patch.object(AccessCodeManager, "create_new")
    @patch.object(AccessCodeManager, "verify_current")
    def test_no_rotate_when_days_sufficient(self, mock_verify, mock_create, manager) -> None:
        """Don't rotate when days > threshold."""
        mock_verify.return_value = {"valid": True, "expires": "2026-06-25", "days_remaining": 30}
        manager.rotate_if_needed(min_days=7)
        mock_create.assert_not_called()
