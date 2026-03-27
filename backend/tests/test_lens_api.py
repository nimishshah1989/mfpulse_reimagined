"""Tests for the lens API endpoints."""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from app.main import app
    return TestClient(app)


class TestGetAllScores:
    @patch("app.api.v1.lens.LensRepository")
    def test_list_with_pagination(self, mock_repo_cls: MagicMock, client: TestClient) -> None:
        mock_repo = mock_repo_cls.return_value
        mock_repo.get_all_scores.return_value = ([
            {
                "mstar_id": "F0GBR06S2Q",
                "fund_name": "HDFC Top 100",
                "category_name": "Large Cap",
                "return_score": Decimal("85"),
                "risk_score": Decimal("70"),
                "consistency_score": Decimal("60"),
                "alpha_score": Decimal("75"),
                "efficiency_score": Decimal("80"),
                "resilience_score": Decimal("65"),
                "computed_date": date(2026, 3, 27),
            },
        ], 1)

        resp = client.get("/api/v1/lens/scores")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["meta"]["count"] == 1

    @patch("app.api.v1.lens.LensRepository")
    def test_filter_by_category(self, mock_repo_cls: MagicMock, client: TestClient) -> None:
        mock_repo = mock_repo_cls.return_value
        mock_repo.get_all_scores.return_value = ([], 0)

        resp = client.get("/api/v1/lens/scores?category=Large+Cap")
        assert resp.status_code == 200
        mock_repo.get_all_scores.assert_called_once()
        call_kwargs = mock_repo.get_all_scores.call_args[1]
        assert call_kwargs["category"] == "Large Cap"

    @patch("app.api.v1.lens.LensRepository")
    def test_sort_by_risk_asc(self, mock_repo_cls: MagicMock, client: TestClient) -> None:
        mock_repo = mock_repo_cls.return_value
        mock_repo.get_all_scores.return_value = ([], 0)

        resp = client.get("/api/v1/lens/scores?sort_by=risk_score&sort_dir=asc")
        assert resp.status_code == 200
        call_kwargs = mock_repo.get_all_scores.call_args[1]
        assert call_kwargs["sort_by"] == "risk_score"
        assert call_kwargs["sort_dir"] == "asc"


class TestGetFundScores:
    @patch("app.api.v1.lens.LensRepository")
    def test_single_fund_scores(self, mock_repo_cls: MagicMock, client: TestClient) -> None:
        mock_repo = mock_repo_cls.return_value
        mock_repo.get_latest_scores.return_value = {
            "mstar_id": "F0GBR06S2Q",
            "return_score": Decimal("85"),
            "risk_score": Decimal("70"),
        }
        mock_repo.get_latest_classification.return_value = {
            "return_class": "LEADER",
            "risk_class": "MODERATE",
            "headline_tag": "Strong returns with moderate risk",
        }

        resp = client.get("/api/v1/lens/scores/F0GBR06S2Q")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["mstar_id"] == "F0GBR06S2Q"
        assert body["data"]["return_class"] == "LEADER"

    @patch("app.api.v1.lens.LensRepository")
    def test_nonexistent_fund_returns_null_data(self, mock_repo_cls: MagicMock, client: TestClient) -> None:
        mock_repo = mock_repo_cls.return_value
        mock_repo.get_latest_scores.return_value = None

        resp = client.get("/api/v1/lens/scores/NONEXIST")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"] is None


class TestGetScoreHistory:
    @patch("app.api.v1.lens.LensRepository")
    def test_monthly_trend(self, mock_repo_cls: MagicMock, client: TestClient) -> None:
        mock_repo = mock_repo_cls.return_value
        mock_repo.get_score_history.return_value = [
            {"computed_date": "2026-03-01", "return_score": Decimal("80")},
            {"computed_date": "2026-02-01", "return_score": Decimal("78")},
        ]

        resp = client.get("/api/v1/lens/scores/F0GBR06S2Q/history")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["meta"]["count"] == 2


class TestGetDistribution:
    @patch("app.api.v1.lens.LensRepository")
    def test_tier_counts(self, mock_repo_cls: MagicMock, client: TestClient) -> None:
        mock_repo = mock_repo_cls.return_value
        mock_repo.get_classification_distribution.return_value = {
            "return": {"LEADER": 10, "STRONG": 20, "AVERAGE": 15, "WEAK": 5},
            "risk": {"LOW_RISK": 8, "MODERATE": 22, "ELEVATED": 12, "HIGH_RISK": 8},
            "consistency": {},
            "alpha": {},
            "efficiency": {},
            "resilience": {},
        }

        resp = client.get("/api/v1/lens/distribution")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["total_funds"] == 50


class TestTriggerComputation:
    @patch("app.api.v1.lens.LensService")
    def test_compute_all(self, mock_svc_cls: MagicMock, client: TestClient) -> None:
        mock_svc = mock_svc_cls.return_value
        mock_svc.compute_all_categories.return_value = {
            "categories_processed": 5,
            "funds_scored": 200,
            "duration_ms": 1500,
            "errors": [],
        }

        resp = client.post("/api/v1/lens/compute")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["funds_scored"] == 200

    @patch("app.api.v1.lens.LensService")
    def test_compute_single_category(self, mock_svc_cls: MagicMock, client: TestClient) -> None:
        mock_svc = mock_svc_cls.return_value
        mock_svc.compute_single_category.return_value = {
            "category": "Large Cap",
            "funds_scored": 40,
        }

        resp = client.post("/api/v1/lens/compute?category=Large+Cap")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["funds_scored"] == 40


class TestTriggerSingleFund:
    @patch("app.api.v1.lens.LensService")
    def test_recompute_fund(self, mock_svc_cls: MagicMock, client: TestClient) -> None:
        from app.engines.lens_engine import LensResult
        mock_svc = mock_svc_cls.return_value
        mock_svc.compute_single_fund.return_value = LensResult(
            mstar_id="F0GBR06S2Q",
            category_name="Large Cap",
            return_score=Decimal("85"),
            risk_score=Decimal("70"),
            consistency_score=Decimal("60"),
            alpha_score=Decimal("75"),
            efficiency_score=Decimal("80"),
            resilience_score=Decimal("65"),
            return_class="LEADER",
            risk_class="MODERATE",
            consistency_class="CONSISTENT",
            alpha_class="POSITIVE",
            efficiency_class="LEAN",
            resilience_class="STURDY",
            headline_tag="Strong returns with moderate risk",
            data_completeness_pct=Decimal("100"),
            available_horizons=3,
        )

        resp = client.post("/api/v1/lens/compute/F0GBR06S2Q")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["mstar_id"] == "F0GBR06S2Q"

    @patch("app.api.v1.lens.LensService")
    def test_nonexistent_fund(self, mock_svc_cls: MagicMock, client: TestClient) -> None:
        mock_svc = mock_svc_cls.return_value
        mock_svc.compute_single_fund.return_value = None

        resp = client.post("/api/v1/lens/compute/NONEXIST")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] is None
