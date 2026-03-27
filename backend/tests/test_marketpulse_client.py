"""Tests for MarketPulse HTTP client with mocked httpx."""

import os
from unittest.mock import patch, MagicMock

import httpx
import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.services.marketpulse_client import MarketPulseClient


@pytest.fixture
def client() -> MarketPulseClient:
    return MarketPulseClient(base_url="http://localhost:8000", timeout=5)


class TestSuccessfulResponses:
    @patch("app.services.marketpulse_client.httpx.Client")
    def test_get_breadth_returns_data(self, mock_client_cls: MagicMock, client: MarketPulseClient) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = {"breadth_21ema": 52.3, "divergence": False}
        mock_response.raise_for_status = MagicMock()

        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=MagicMock(get=MagicMock(return_value=mock_response)))
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_ctx

        result = client.get_breadth_history("1y")
        assert result == {"breadth_21ema": 52.3, "divergence": False}

    @patch("app.services.marketpulse_client.httpx.Client")
    def test_get_sentiment_returns_data(self, mock_client_cls: MagicMock, client: MarketPulseClient) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = {"composite": 0.65, "signal": "BULLISH"}
        mock_response.raise_for_status = MagicMock()

        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=MagicMock(get=MagicMock(return_value=mock_response)))
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_ctx

        result = client.get_sentiment()
        assert result["composite"] == 0.65

    @patch("app.services.marketpulse_client.httpx.Client")
    def test_get_sectors_returns_list(self, mock_client_cls: MagicMock, client: MarketPulseClient) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = [{"sector": "Technology", "rs_score": 85}]
        mock_response.raise_for_status = MagicMock()

        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=MagicMock(get=MagicMock(return_value=mock_response)))
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_ctx

        result = client.get_sector_scores("3M")
        assert isinstance(result, list)
        assert result[0]["sector"] == "Technology"


class TestFailureHandling:
    @patch("app.services.marketpulse_client.httpx.Client")
    def test_timeout_returns_none(self, mock_client_cls: MagicMock, client: MarketPulseClient) -> None:
        mock_ctx = MagicMock()
        mock_http = MagicMock()
        mock_http.get.side_effect = httpx.TimeoutException("timeout")
        mock_ctx.__enter__ = MagicMock(return_value=mock_http)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_ctx

        result = client.get_breadth_history()
        assert result is None

    @patch("app.services.marketpulse_client.httpx.Client")
    def test_connection_error_returns_none(self, mock_client_cls: MagicMock, client: MarketPulseClient) -> None:
        mock_ctx = MagicMock()
        mock_http = MagicMock()
        mock_http.get.side_effect = httpx.ConnectError("refused")
        mock_ctx.__enter__ = MagicMock(return_value=mock_http)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_ctx

        result = client.get_sentiment()
        assert result is None

    @patch("app.services.marketpulse_client.httpx.Client")
    def test_server_error_returns_none(self, mock_client_cls: MagicMock, client: MarketPulseClient) -> None:
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500", request=MagicMock(), response=MagicMock()
        )

        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=MagicMock(get=MagicMock(return_value=mock_response)))
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_ctx

        result = client.get_market_picks()
        assert result is None


class TestCaching:
    @patch("app.services.marketpulse_client.httpx.Client")
    def test_cache_hit_no_http_call(self, mock_client_cls: MagicMock, client: MarketPulseClient) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = {"data": "cached"}
        mock_response.raise_for_status = MagicMock()

        mock_http = MagicMock()
        mock_http.get.return_value = mock_response
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_http)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_ctx

        # First call — hits HTTP
        result1 = client.get_sentiment()
        assert result1 == {"data": "cached"}

        # Second call — should use cache (reset the mock to verify no new call)
        mock_client_cls.reset_mock()
        result2 = client.get_sentiment()
        assert result2 == {"data": "cached"}
        mock_client_cls.assert_not_called()


class TestHealthCheck:
    @patch("app.services.marketpulse_client.httpx.Client")
    def test_healthy(self, mock_client_cls: MagicMock, client: MarketPulseClient) -> None:
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=MagicMock(get=MagicMock(return_value=mock_response)))
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_ctx

        assert client.health_check() is True

    @patch("app.services.marketpulse_client.httpx.Client")
    def test_unhealthy(self, mock_client_cls: MagicMock, client: MarketPulseClient) -> None:
        mock_ctx = MagicMock()
        mock_http = MagicMock()
        mock_http.get.side_effect = httpx.ConnectError("refused")
        mock_ctx.__enter__ = MagicMock(return_value=mock_http)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_ctx

        assert client.health_check() is False
