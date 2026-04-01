"""Rule-based natural language search for funds.

Parses user queries into structured filters and returns matching funds.
This backend version is authoritative over the frontend client-side parser.
"""

from __future__ import annotations

import re
import logging
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session

from app.models.db.fund_master import FundMaster
from app.models.db.lens_scores import FundLensScores, FundClassification
from app.models.db.nav_daily import NavDaily

logger = logging.getLogger(__name__)

# Use word-boundary regex to avoid substring false positives (e.g., "it" in "with")
SECTOR_KEYWORDS: dict[str, re.Pattern] = {
    "Technology": re.compile(r"\b(?:technology|tech)\b", re.I),
    "Healthcare": re.compile(r"\b(?:healthcare|pharma)\b", re.I),
    "Financial Services": re.compile(r"\b(?:financial|banking|bank)\b", re.I),
    "Energy": re.compile(r"\b(?:energy|oil)\b", re.I),
    "Consumer Cyclical": re.compile(r"\b(?:consumer\s*cyclical|auto)\b", re.I),
    "Consumer Defensive": re.compile(r"\b(?:fmcg|staples|consumer\s*defensive)\b", re.I),
    "Industrials": re.compile(r"\b(?:industrial|infra|infrastructure)\b", re.I),
    "Real Estate": re.compile(r"\b(?:real\s*estate|realty)\b", re.I),
    "Basic Materials": re.compile(r"\b(?:materials|metal|mining)\b", re.I),
    "Communication Services": re.compile(r"\b(?:telecom|media)\b", re.I),
    "Utilities": re.compile(r"\b(?:utilities|power)\b", re.I),
}

TIER_KEYWORDS: dict[str, tuple[str, str]] = {
    "leader": ("return_class", "LEADER"),
    "fortress": ("resilience_class", "FORTRESS"),
    "alpha machine": ("alpha_class", "ALPHA_MACHINE"),
    "rock solid": ("consistency_class", "ROCK_SOLID"),
    "consistent": ("consistency_class", "CONSISTENT"),
    "sturdy": ("resilience_class", "STURDY"),
    "lean": ("efficiency_class", "LEAN"),
    "low risk": ("risk_class", "LOW_RISK"),
}

CATEGORY_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"small[\s-]*cap", re.I), "Small"),
    (re.compile(r"large[\s-]*cap", re.I), "Large"),
    (re.compile(r"mid[\s-]*cap", re.I), "Mid"),
    (re.compile(r"flexi", re.I), "Flexi"),
    (re.compile(r"multi[\s-]*cap", re.I), "Multi"),
    (re.compile(r"large\s*(and|&)\s*mid", re.I), "Large & Mid"),
    (re.compile(r"\belss\b|\btax\s*sav", re.I), "ELSS"),
    (re.compile(r"\bindex\b|\bpassive\b", re.I), "Index"),
    (re.compile(r"\bdebt\b|\bbond\b", re.I), "_BROAD_DEBT"),
    (re.compile(r"\bhybrid\b|\bbalanced\b", re.I), "_BROAD_HYBRID"),
    (re.compile(r"\bequity\b", re.I), "_BROAD_EQUITY"),
    (re.compile(r"\bvalue\b", re.I), "Value"),
    (re.compile(r"\bcontra\b", re.I), "Contra"),
    (re.compile(r"\bfocused\b", re.I), "Focused"),
    (re.compile(r"\bsector", re.I), "Sector"),
    (re.compile(r"\bthemat", re.I), "Thematic"),
    (re.compile(r"\bgilt\b", re.I), "Gilt"),
    (re.compile(r"\bliquid\b", re.I), "Liquid"),
    (re.compile(r"\bdividend\s*yield", re.I), "Dividend Yield"),
]

NUMERIC_PATTERN = re.compile(
    r"(\w[\w\s]*?)\s*(>|<|>=|<=|above|below|over|under)\s*(\d+\.?\d*)\s*%?",
    re.I,
)

FIELD_MAP: dict[str, str] = {
    "alpha": "alpha_score", "return": "return_1y", "risk": "risk_score",
    "sharpe": "sharpe_3y", "consistency": "consistency_score",
    "efficiency": "efficiency_score", "expense": "net_expense_ratio",
}


class NLSearchService:
    """Rule-based NL query parser returning matching funds."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # Map broad category markers to actual DB broad_category values
    BROAD_MAP = {
        "_BROAD_DEBT": "Fixed Income",
        "_BROAD_HYBRID": "Allocation",
        "_BROAD_EQUITY": "Equity",
    }

    def search(self, query: str, limit: int = 50, min_nav_count: int = 0) -> dict:
        """Parse NL query and return matching funds."""
        parsed = self._parse(query)
        funds = self._execute(parsed, limit=limit, min_nav_count=min_nav_count)
        return {
            "parsed": parsed,
            "funds": funds,
            "count": len(funds),
        }

    def _parse(self, query: str) -> Optional[dict]:
        """Parse query into structured filter."""
        if not query or len(query.strip()) < 2:
            return None

        lower = query.lower().strip()
        result: dict = {
            "sectors": [],
            "categories": [],
            "tier_filters": [],
            "numeric_filters": [],
            "sector_exposure_filters": [],  # e.g., {"sector": "Technology", "operator": "lt", "value": 20.0}
            "sort_by": None,
            "raw": query,
        }

        # Match sectors (word-boundary regex to prevent false positives)
        for sector, pattern in SECTOR_KEYWORDS.items():
            if pattern.search(lower) and sector not in result["sectors"]:
                result["sectors"].append(sector)

        # Match tiers
        for keyword, (field, value) in TIER_KEYWORDS.items():
            if keyword in lower:
                result["tier_filters"].append({"field": field, "value": value})

        # Match categories
        for pattern, cat in CATEGORY_PATTERNS:
            if pattern.search(query) and cat not in result["categories"]:
                result["categories"].append(cat)

        # Match numeric filters — extract only the last word as the field name
        # Skip when the captured field name is a sector keyword (e.g., "technology >20%")
        sector_field_names = {s.lower() for s in SECTOR_KEYWORDS}
        # Also collect the individual trigger words from sector patterns
        _sector_trigger_words = {
            "tech", "technology", "healthcare", "pharma", "financial", "banking",
            "bank", "energy", "oil", "auto", "fmcg", "staples", "industrial",
            "infra", "infrastructure", "realty", "materials", "metal", "mining",
            "telecom", "media", "utilities", "power",
        }
        sector_field_names |= _sector_trigger_words

        # Build reverse map: trigger word → canonical sector name
        _trigger_to_sector: dict[str, str] = {}
        for sector_name, pat in SECTOR_KEYWORDS.items():
            for tw in _sector_trigger_words:
                if pat.search(tw):
                    _trigger_to_sector[tw] = sector_name
        # Also map multi-word sector names
        _trigger_to_sector.update({
            "financial services": "Financial Services",
            "financial": "Financial Services",
            "consumer cyclical": "Consumer Cyclical",
            "consumer defensive": "Consumer Defensive",
            "basic materials": "Basic Materials",
            "real estate": "Real Estate",
            "communication services": "Communication Services",
        })

        for match in NUMERIC_PATTERN.finditer(lower):
            full_field = match.group(1).strip()
            last_word = full_field.split()[-1]
            operator, value = match.group(2), match.group(3)
            op = "gt" if operator in (">", "above", "over") else "lt"

            # Check if this is a sector exposure filter
            # Match "technology >20%" or "financial services >30%" or "technology exposure <20%"
            sector_match = None
            clean_field = full_field.replace("exposure", "").replace("sector", "").strip()
            for trigger, sector_name in _trigger_to_sector.items():
                if trigger in clean_field:
                    sector_match = sector_name
                    break
            if not sector_match and last_word.lower() in sector_field_names:
                sector_match = _trigger_to_sector.get(last_word.lower())

            if sector_match:
                result["sector_exposure_filters"].append({
                    "sector": sector_match, "operator": op, "value": float(value),
                })
            else:
                mapped = FIELD_MAP.get(last_word, last_word)
                result["numeric_filters"].append({
                    "field": mapped, "operator": op, "value": float(value),
                })

        # Detect high/top qualifiers for lens scores (word-boundary match)
        high_keywords = ["high", "strong", "good", "top", "best"]
        if any(re.search(rf"\b{k}\b", lower) for k in high_keywords):
            for lens_word, lens_key in [("alpha", "alpha_score"), ("return", "return_score"),
                                         ("consistency", "consistency_score"),
                                         ("efficiency", "efficiency_score"), ("resilience", "resilience_score")]:
                if re.search(rf"\b{lens_word}\b", lower):
                    result["numeric_filters"].append({
                        "field": lens_key, "operator": "gt", "value": 70,
                    })

        # Detect "top N" pattern
        top_match = re.search(r"top\s+(\d+)", lower)
        if top_match:
            result["sort_by"] = "return_score"

        has_filters = bool(
            result["sectors"] or result["categories"] or
            result["tier_filters"] or result["numeric_filters"] or
            result["sector_exposure_filters"]
        )
        # Fallback: if no structured filters matched, treat as fund/AMC name search
        if not has_filters:
            result["text_search"] = query.strip()
        return result

    def _execute(self, parsed: dict, limit: int = 50, min_nav_count: int = 0) -> list[dict]:
        """Execute parsed filters against DB."""
        if not parsed:
            return []

        # Get latest lens date
        latest_lens = self.db.query(func.max(FundLensScores.computed_date)).scalar()
        latest_class = self.db.query(func.max(FundClassification.computed_date)).scalar()

        if not latest_lens:
            return []

        # Base query: funds with lens scores (no expensive NAV count join)
        query = (
            self.db.query(
                FundMaster.mstar_id,
                FundMaster.fund_name,
                FundMaster.category_name,
                FundMaster.amc_name,
                FundLensScores.return_score,
                FundLensScores.risk_score,
                FundLensScores.alpha_score,
                FundLensScores.consistency_score,
                FundLensScores.efficiency_score,
                FundLensScores.resilience_score,
            )
            .join(FundLensScores, FundMaster.mstar_id == FundLensScores.mstar_id)
            .filter(
                FundMaster.purchase_mode == 1,
                FundLensScores.computed_date == latest_lens,
            )
        )

        # Text search fallback — search fund name (fast single-column ILIKE)
        if parsed.get("text_search"):
            txt = parsed["text_search"]
            words = [w for w in txt.split() if len(w) >= 2]
            if words:
                for w in words:
                    escaped = w.replace('%', r'\%').replace('_', r'\_')
                    query = query.filter(FundMaster.fund_name.ilike(f"%{escaped}%", escape='\\'))

        # Sector filter — filter by fund holdings sector exposure
        if parsed["sectors"]:
            from app.models.db.sector_exposure import FundSectorExposure
            sector_sq = (
                self.db.query(FundSectorExposure.mstar_id)
                .filter(
                    FundSectorExposure.sector_name.in_(parsed["sectors"]),
                    FundSectorExposure.net_pct > 5,  # Meaningful exposure > 5%
                )
                .distinct()
                .subquery()
            )
            query = query.filter(FundMaster.mstar_id.in_(
                self.db.query(sector_sq.c.mstar_id)
            ))

        # Sector exposure percentage filters (e.g., "technology <20%", "financial services >30%")
        if parsed.get("sector_exposure_filters"):
            from app.models.db.sector_exposure import FundSectorExposure
            for sef in parsed["sector_exposure_filters"]:
                exposure_sq = (
                    self.db.query(FundSectorExposure.mstar_id)
                    .filter(FundSectorExposure.sector_name == sef["sector"])
                )
                if sef["operator"] == "gt":
                    exposure_sq = exposure_sq.filter(FundSectorExposure.net_pct >= sef["value"])
                else:
                    exposure_sq = exposure_sq.filter(FundSectorExposure.net_pct <= sef["value"])
                exposure_sq = exposure_sq.distinct().subquery()
                query = query.filter(FundMaster.mstar_id.in_(
                    self.db.query(exposure_sq.c.mstar_id)
                ))

        # Category filter — separate broad_category markers from real category names
        broad_cats = [c for c in parsed["categories"] if c.startswith("_BROAD_")]
        real_cats = [c for c in parsed["categories"] if not c.startswith("_BROAD_")]

        if broad_cats:
            broad_values = [self.BROAD_MAP[bc] for bc in broad_cats if bc in self.BROAD_MAP]
            if broad_values:
                query = query.filter(FundMaster.broad_category.in_(broad_values))

        if real_cats:
            cat_conditions = [
                FundMaster.category_name.ilike(f"%{c}%")
                for c in real_cats
            ]
            query = query.filter(or_(*cat_conditions))

        # Tier filters (need classification join)
        if parsed["tier_filters"] and latest_class:
            query = query.join(
                FundClassification,
                and_(
                    FundMaster.mstar_id == FundClassification.mstar_id,
                    FundClassification.computed_date == latest_class,
                ),
            )
            for tf in parsed["tier_filters"]:
                col = getattr(FundClassification, tf["field"], None)
                if col is not None:
                    query = query.filter(col == tf["value"])

        # Numeric filters on lens scores
        for nf in parsed["numeric_filters"]:
            col = getattr(FundLensScores, nf["field"], None)
            if col is not None:
                if nf["operator"] == "gt":
                    query = query.filter(col >= Decimal(str(nf["value"])))
                else:
                    query = query.filter(col <= Decimal(str(nf["value"])))

        # Sort
        sort_col = getattr(FundLensScores, parsed.get("sort_by") or "return_score", FundLensScores.return_score)
        query = query.order_by(sort_col.desc().nulls_last())

        rows = query.limit(limit).all()

        return [
            {
                "mstar_id": r.mstar_id,
                "fund_name": r.fund_name,
                "category_name": r.category_name,
                "amc_name": r.amc_name,
                "return_score": float(r.return_score) if r.return_score else None,
                "risk_score": float(r.risk_score) if r.risk_score else None,
                "alpha_score": float(r.alpha_score) if r.alpha_score else None,
                "consistency_score": float(r.consistency_score) if r.consistency_score else None,
                "efficiency_score": float(r.efficiency_score) if r.efficiency_score else None,
                "resilience_score": float(r.resilience_score) if r.resilience_score else None,
                "nav_count": 0,  # Skip expensive NAV count query
            }
            for r in rows
        ]
