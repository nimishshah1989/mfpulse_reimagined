"""AI-generated fund narrative briefs using Claude API with in-memory caching."""

import logging
import os
import time
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.repositories.fund_repo import FundRepository
from app.repositories.holdings_repo import HoldingsRepository
from app.repositories.lens_repo import LensRepository
from app.services.marketpulse_client import MarketPulseClient

logger = logging.getLogger(__name__)

# In-memory cache: mstar_id -> (narrative_text, expires_at)
_NARRATIVE_CACHE: dict[str, tuple[str, float]] = {}
_CACHE_TTL_SECONDS = 86400  # 24 hours


class NarrativeService:
    """Generates AI-powered fund intelligence briefs."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.fund_repo = FundRepository(db)
        self.holdings_repo = HoldingsRepository(db)
        self.lens_repo = LensRepository(db)

    def get_narrative(self, mstar_id: str) -> str:
        """Return cached narrative or generate a new one."""
        # Check cache
        cached = _NARRATIVE_CACHE.get(mstar_id)
        if cached and time.monotonic() < cached[1]:
            return cached[0]

        # Gather fund data
        fund_data = self._gather_fund_data(mstar_id)
        if fund_data is None:
            return ""

        # Check if API key is available
        settings = get_settings()
        # Need either Groq or Claude key for narrative generation
        has_llm = bool(settings.groq_api_key or settings.anthropic_api_key)
        if not has_llm:
            fallback = fund_data.get("headline_tag", "")
            return fallback

        # Generate narrative via LLM (Groq primary, Claude fallback)
        narrative = self._call_claude(settings.anthropic_api_key, fund_data)
        if narrative:
            _NARRATIVE_CACHE[mstar_id] = (narrative, time.monotonic() + _CACHE_TTL_SECONDS)
        return narrative

    def _gather_fund_data(self, mstar_id: str) -> Optional[dict]:
        """Collect all data needed for narrative generation."""
        fund = self.fund_repo.get_fund_by_mstar_id(mstar_id)
        if fund is None:
            return None

        latest_nav = self.fund_repo.get_latest_nav(mstar_id)
        scores = self.lens_repo.get_latest_scores(mstar_id)
        classification = self.lens_repo.get_latest_classification(mstar_id)
        top_holdings = self.holdings_repo.get_top_holdings(mstar_id, limit=5)
        sectors = self.holdings_repo.get_sector_exposure(mstar_id)
        snapshot = self.holdings_repo.get_latest_snapshot(mstar_id)

        # Get market regime (best-effort)
        market_regime = "N/A"
        try:
            settings = get_settings()
            mp_client = MarketPulseClient(
                base_url=settings.marketpulse_base_url,
                timeout=5,
            )
            picks = mp_client.get_market_picks()
            if picks and isinstance(picks, dict):
                market_regime = picks.get("regime", picks.get("market_regime", "N/A"))
        except Exception:
            pass

        holdings_str = ", ".join(
            f"{h['holding_name']} ({h.get('weighting_pct', 'N/A')}%)"
            for h in (top_holdings or [])[:5]
        )
        sectors_str = ", ".join(
            f"{s['sector_name']} ({s.get('net_pct', 'N/A')}%)"
            for s in (sectors or [])[:5]
        )

        return {
            "fund_name": fund.fund_name or fund.legal_name or "",
            "category_name": fund.category_name or "",
            "amc_name": fund.amc_name or "",
            "aum": str(snapshot.get("aum", "N/A")) if snapshot else "N/A",
            "return_score": scores.get("return_score", "N/A") if scores else "N/A",
            "risk_score": scores.get("risk_score", "N/A") if scores else "N/A",
            "alpha_score": scores.get("alpha_score", "N/A") if scores else "N/A",
            "consistency_score": scores.get("consistency_score", "N/A") if scores else "N/A",
            "efficiency_score": scores.get("efficiency_score", "N/A") if scores else "N/A",
            "return_class": classification.get("return_class", "") if classification else "",
            "risk_class": classification.get("risk_class", "") if classification else "",
            "alpha_class": classification.get("alpha_class", "") if classification else "",
            "consistency_class": classification.get("consistency_class", "") if classification else "",
            "headline_tag": classification.get("headline_tag", "") if classification else "",
            "return_1y": latest_nav.get("return_1y", "N/A") if latest_nav else "N/A",
            "return_3y": latest_nav.get("return_3y", "N/A") if latest_nav else "N/A",
            "top_holdings": holdings_str or "N/A",
            "sectors": sectors_str or "N/A",
            "market_regime": market_regime,
            "indian_risk_level": getattr(fund, "indian_risk_level", "N/A") or "N/A",
        }

    @staticmethod
    def _call_claude(api_key: str, fund_data: dict) -> str:
        """Generate narrative brief using Groq (free) with Claude fallback."""
        from app.services.claude_client import _call_claude as llm_call

        system = (
            "You are MF Pulse's fund intelligence system. Generate a concise "
            "3-4 sentence brief for an Indian mutual fund. Be specific with "
            "numbers. Mention strengths, risks, and actionable context. No markdown."
        )
        prompt = (
            f"Fund: {fund_data['fund_name']} ({fund_data['category_name']})\n"
            f"AMC: {fund_data['amc_name']}\n"
            f"AUM: \u20b9{fund_data.get('aum', 'N/A')}\n"
            f"Lens Scores: Return={fund_data.get('return_score', 'N/A')}/100, "
            f"Risk={fund_data.get('risk_score', 'N/A')}/100, "
            f"Alpha={fund_data.get('alpha_score', 'N/A')}/100, "
            f"Consistency={fund_data.get('consistency_score', 'N/A')}/100, "
            f"Efficiency={fund_data.get('efficiency_score', 'N/A')}/100\n"
            f"Classifications: {fund_data.get('return_class', '')}, "
            f"{fund_data.get('risk_class', '')}, "
            f"{fund_data.get('alpha_class', '')}, "
            f"{fund_data.get('consistency_class', '')}\n"
            f"1Y Return: {fund_data.get('return_1y', 'N/A')}%\n"
            f"3Y Return: {fund_data.get('return_3y', 'N/A')}%\n"
            f"Top Holdings: {fund_data.get('top_holdings', 'N/A')}\n"
            f"Sector Exposure: {fund_data.get('sectors', 'N/A')}\n"
            f"Market Regime: {fund_data.get('market_regime', 'N/A')}\n"
            f"Risk Level: {fund_data.get('indian_risk_level', 'N/A')}"
        )
        result = llm_call(system, prompt, max_tokens=300)
        return result or ""
