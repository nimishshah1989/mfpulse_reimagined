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

SECTOR_KEYWORDS: dict[str, str] = {
    "technology": "Technology", "tech": "Technology", "it": "Technology",
    "healthcare": "Healthcare", "pharma": "Healthcare",
    "financial": "Financial Services", "banking": "Financial Services", "bank": "Financial Services",
    "energy": "Energy", "oil": "Energy",
    "consumer": "Consumer Cyclical", "auto": "Consumer Cyclical",
    "fmcg": "Consumer Defensive", "staples": "Consumer Defensive",
    "industrial": "Industrials", "infra": "Industrials", "infrastructure": "Industrials",
    "real estate": "Real Estate", "realty": "Real Estate",
    "materials": "Basic Materials", "metal": "Basic Materials", "mining": "Basic Materials",
    "telecom": "Communication Services", "media": "Communication Services",
    "utilities": "Utilities", "power": "Utilities",
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
    (re.compile(r"small\s*cap", re.I), "Small Cap"),
    (re.compile(r"large\s*cap", re.I), "Large Cap"),
    (re.compile(r"mid\s*cap", re.I), "Mid Cap"),
    (re.compile(r"flexi", re.I), "Flexi Cap"),
    (re.compile(r"multi\s*cap", re.I), "Multi Cap"),
    (re.compile(r"\belss\b|\btax\b", re.I), "ELSS"),
    (re.compile(r"\bindex\b|\bpassive\b", re.I), "Index"),
    (re.compile(r"\bdebt\b|\bbond\b", re.I), "Debt"),
    (re.compile(r"\bhybrid\b|\bbalanced\b", re.I), "Hybrid"),
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

    def search(self, query: str, limit: int = 50) -> dict:
        """Parse NL query and return matching funds."""
        parsed = self._parse(query)
        if not parsed:
            return {"parsed": None, "funds": [], "count": 0}

        funds = self._execute(parsed, limit=limit)
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
            "sort_by": None,
            "raw": query,
        }

        # Match sectors
        for keyword, sector in SECTOR_KEYWORDS.items():
            if keyword in lower and sector not in result["sectors"]:
                result["sectors"].append(sector)

        # Match tiers
        for keyword, (field, value) in TIER_KEYWORDS.items():
            if keyword in lower:
                result["tier_filters"].append({"field": field, "value": value})

        # Match categories
        for pattern, cat in CATEGORY_PATTERNS:
            if pattern.search(query) and cat not in result["categories"]:
                result["categories"].append(cat)

        # Match numeric filters
        for match in NUMERIC_PATTERN.finditer(lower):
            field_raw, operator, value = match.group(1).strip(), match.group(2), match.group(3)
            mapped = FIELD_MAP.get(field_raw, field_raw)
            op = "gt" if operator in (">", "above", "over") else "lt"
            result["numeric_filters"].append({
                "field": mapped, "operator": op, "value": float(value),
            })

        # Detect high/top qualifiers for lens scores
        high_keywords = ["high", "strong", "good", "top", "best"]
        if any(k in lower for k in high_keywords):
            for lens_word, lens_key in [("alpha", "alpha_score"), ("return", "return_score"),
                                         ("risk", "risk_score"), ("consistency", "consistency_score"),
                                         ("efficiency", "efficiency_score"), ("resilience", "resilience_score")]:
                if lens_word in lower:
                    result["numeric_filters"].append({
                        "field": lens_key, "operator": "gt", "value": 70,
                    })

        # Detect "top N" pattern
        top_match = re.search(r"top\s+(\d+)", lower)
        if top_match:
            result["sort_by"] = "return_score"

        has_filters = bool(
            result["sectors"] or result["categories"] or
            result["tier_filters"] or result["numeric_filters"]
        )
        return result if has_filters else None

    def _execute(self, parsed: dict, limit: int = 50) -> list[dict]:
        """Execute parsed filters against DB."""
        # Get latest lens date
        latest_lens = self.db.query(func.max(FundLensScores.computed_date)).scalar()
        latest_class = self.db.query(func.max(FundClassification.computed_date)).scalar()

        if not latest_lens:
            return []

        # Base query: funds with lens scores
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
                FundMaster.is_eligible.is_(True),
                FundLensScores.computed_date == latest_lens,
            )
        )

        # Category filter
        if parsed["categories"]:
            cat_conditions = [
                FundMaster.category_name.ilike(f"%{c}%")
                for c in parsed["categories"]
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
            }
            for r in rows
        ]
