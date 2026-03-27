"""Tests for Fund-Lens integration — lens scores in fund list and detail."""

import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from fastapi.testclient import TestClient


def _mock_fund_summary(mstar_id: str = "F0GBR06S2Q") -> dict:
    return {
        "mstar_id": mstar_id,
        "fund_name": "HDFC Top 100",
        "category_name": "Large Cap",
        "amc_name": "HDFC AMC",
        "latest_nav": Decimal("650.12"),
        "return_1y": Decimal("15.5"),
        "return_3y": Decimal("12.3"),
        "return_5y": Decimal("11.8"),
    }


def _mock_lens_scores(mstar_id: str = "F0GBR06S2Q") -> dict:
    return {
        "mstar_id": mstar_id,
        "computed_date": date(2026, 3, 1),
        "return_score": Decimal("85.5"),
        "risk_score": Decimal("72.3"),
        "consistency_score": Decimal("90.1"),
        "alpha_score": Decimal("78.8"),
        "efficiency_score": Decimal("65.0"),
        "resilience_score": Decimal("82.5"),
    }


def _mock_classification(mstar_id: str = "F0GBR06S2Q") -> dict:
    return {
        "mstar_id": mstar_id,
        "computed_date": date(2026, 3, 1),
        "return_class": "LEADER",
        "risk_class": "MODERATE",
        "consistency_class": "ROCK_SOLID",
        "alpha_class": "POSITIVE",
        "efficiency_class": "FAIR",
        "resilience_class": "STURDY",
        "headline_tag": "Consistent alpha generator with sturdy resilience",
    }


@pytest.fixture
def client() -> TestClient:
    from app.main import app
    return TestClient(app)


class TestFundListWithLens:
    @patch("app.api.v1.funds.OverrideRepository")
    @patch("app.api.v1.funds.LensRepository")
    @patch("app.api.v1.funds.FundService")
    def test_fund_list_includes_lens_scores(
        self, mock_fund_cls: MagicMock, mock_lens_cls: MagicMock, mock_override_cls: MagicMock, client: TestClient,
    ) -> None:
        funds = [_mock_fund_summary()]
        mock_fund_cls.return_value.list_funds.return_value = (funds, 1)
        mock_lens_cls.return_value.get_latest_scores.return_value = _mock_lens_scores()
        mock_lens_cls.return_value.get_latest_classification.return_value = _mock_classification()

        resp = client.get("/api/v1/funds")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        fund = body["data"][0]
        assert "return_score" in fund
        assert "return_class" in fund
        assert "headline_tag" in fund

    @patch("app.api.v1.funds.OverrideRepository")
    @patch("app.api.v1.funds.LensRepository")
    @patch("app.api.v1.funds.FundService")
    def test_fund_list_without_lens_data(
        self, mock_fund_cls: MagicMock, mock_lens_cls: MagicMock, mock_override_cls: MagicMock, client: TestClient,
    ) -> None:
        funds = [_mock_fund_summary()]
        mock_fund_cls.return_value.list_funds.return_value = (funds, 1)
        mock_lens_cls.return_value.get_latest_scores.return_value = None
        mock_lens_cls.return_value.get_latest_classification.return_value = None

        resp = client.get("/api/v1/funds")
        assert resp.status_code == 200
        fund = resp.json()["data"][0]
        assert fund["return_score"] is None
        assert fund["return_class"] is None


class TestFundListSortByLens:
    @patch("app.api.v1.funds.OverrideRepository")
    @patch("app.api.v1.funds.LensRepository")
    @patch("app.api.v1.funds.FundService")
    def test_sort_by_alpha_score(
        self, mock_fund_cls: MagicMock, mock_lens_cls: MagicMock, mock_override_cls: MagicMock, client: TestClient,
    ) -> None:
        scores = [_mock_lens_scores()]
        mock_lens_cls.return_value.get_all_scores.return_value = (scores, 1)

        resp = client.get("/api/v1/funds?sort_by=alpha_score")
        assert resp.status_code == 200


class TestFundListFilterByTier:
    @patch("app.api.v1.funds.OverrideRepository")
    @patch("app.api.v1.funds.LensRepository")
    @patch("app.api.v1.funds.FundService")
    def test_filter_by_return_class(
        self, mock_fund_cls: MagicMock, mock_lens_cls: MagicMock, mock_override_cls: MagicMock, client: TestClient,
    ) -> None:
        funds = [_mock_fund_summary()]
        mock_fund_cls.return_value.list_funds.return_value = (funds, 1)
        mock_lens_cls.return_value.get_latest_scores.return_value = _mock_lens_scores()
        mock_lens_cls.return_value.get_latest_classification.return_value = _mock_classification()

        resp = client.get("/api/v1/funds?return_class=LEADER")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1


class TestFundDetailWithLens:
    @patch("app.api.v1.funds.OverrideRepository")
    @patch("app.api.v1.funds.LensRepository")
    @patch("app.api.v1.funds.FundService")
    def test_detail_includes_lens_and_overrides(
        self, mock_fund_cls: MagicMock, mock_lens_cls: MagicMock, mock_override_cls: MagicMock, client: TestClient,
    ) -> None:
        detail = {
            "fund": _mock_fund_summary(),
            "returns": {},
            "risk_stats": {},
        }
        mock_fund_cls.return_value.get_fund_detail.return_value = detail
        mock_lens_cls.return_value.get_latest_scores.return_value = _mock_lens_scores()
        mock_lens_cls.return_value.get_latest_classification.return_value = _mock_classification()
        mock_override_cls.return_value.get_overrides_for_fund.return_value = []

        resp = client.get("/api/v1/funds/F0GBR06S2Q")
        assert resp.status_code == 200
        body = resp.json()
        assert "lens_scores" in body["data"]
        assert "lens_classification" in body["data"]
        assert "active_overrides" in body["data"]

    @patch("app.api.v1.funds.OverrideRepository")
    @patch("app.api.v1.funds.LensRepository")
    @patch("app.api.v1.funds.FundService")
    def test_detail_with_active_overrides(
        self, mock_fund_cls: MagicMock, mock_lens_cls: MagicMock, mock_override_cls: MagicMock, client: TestClient,
    ) -> None:
        detail = {"fund": _mock_fund_summary()}
        mock_fund_cls.return_value.get_fund_detail.return_value = detail
        mock_lens_cls.return_value.get_latest_scores.return_value = None
        mock_lens_cls.return_value.get_latest_classification.return_value = None
        mock_override_cls.return_value.get_overrides_for_fund.return_value = [
            {"id": str(uuid.uuid4()), "override_type": "FUND_BOOST", "magnitude": 3},
        ]

        resp = client.get("/api/v1/funds/F0GBR06S2Q")
        assert resp.status_code == 200
        assert len(resp.json()["data"]["active_overrides"]) == 1
