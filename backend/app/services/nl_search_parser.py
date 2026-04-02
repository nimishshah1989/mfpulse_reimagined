"""NL search query parser — converts natural language to structured filters.

Handles sector keywords, category patterns, numeric thresholds,
tier classifications, and lens score qualifiers.
"""

from __future__ import annotations

import re
from typing import Optional

# Use word-boundary regex to avoid substring false positives
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

# Longer patterns first so "large and mid" matches before "large"
CATEGORY_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"large\s*(and|&)\s*mid", re.I), "Large & Mid"),
    (re.compile(r"small[\s-]*cap", re.I), "Small"),
    (re.compile(r"large[\s-]*cap", re.I), "Large"),
    (re.compile(r"mid[\s-]*cap", re.I), "Mid"),
    (re.compile(r"flexi", re.I), "Flexi"),
    (re.compile(r"multi[\s-]*cap", re.I), "Multi"),
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

# Trigger words that map to canonical sector names
_SECTOR_TRIGGER_WORDS: set[str] = {
    "tech", "technology", "healthcare", "pharma", "financial", "banking",
    "bank", "energy", "oil", "auto", "fmcg", "staples", "industrial",
    "infra", "infrastructure", "realty", "materials", "metal", "mining",
    "telecom", "media", "utilities", "power",
}

TRIGGER_TO_SECTOR: dict[str, str] = {
    "financial services": "Financial Services",
    "financial": "Financial Services",
    "consumer cyclical": "Consumer Cyclical",
    "consumer defensive": "Consumer Defensive",
    "basic materials": "Basic Materials",
    "real estate": "Real Estate",
    "communication services": "Communication Services",
}
for _sn, _pat in SECTOR_KEYWORDS.items():
    for _tw in _SECTOR_TRIGGER_WORDS:
        if _pat.search(_tw):
            TRIGGER_TO_SECTOR[_tw] = _sn


def parse_nl_query(query: str) -> Optional[dict]:
    """Parse a natural language fund query into structured filters.

    Returns dict with keys: sectors, categories, tier_filters,
    numeric_filters, sector_exposure_filters, sort_by, raw.
    Returns None for empty/too-short queries.
    """
    if not query or len(query.strip()) < 2:
        return None

    lower = query.lower().strip()
    result: dict = {
        "sectors": [],
        "categories": [],
        "tier_filters": [],
        "numeric_filters": [],
        "sector_exposure_filters": [],
        "sort_by": None,
        "raw": query,
    }

    _match_sectors(lower, result)
    _match_tiers(lower, result)
    _match_categories(query, result)
    _match_numeric(lower, result)
    _deduplicate_sector_filters(result)
    _match_lens_qualifiers(lower, result)
    _match_top_n(lower, result)

    has_filters = bool(
        result["sectors"] or result["categories"]
        or result["tier_filters"] or result["numeric_filters"]
        or result["sector_exposure_filters"]
    )
    if not has_filters:
        result["text_search"] = query.strip()
    return result


def _match_sectors(lower: str, result: dict) -> None:
    for sector, pattern in SECTOR_KEYWORDS.items():
        if pattern.search(lower) and sector not in result["sectors"]:
            result["sectors"].append(sector)


def _match_tiers(lower: str, result: dict) -> None:
    for keyword, (field, value) in TIER_KEYWORDS.items():
        if keyword in lower:
            result["tier_filters"].append({"field": field, "value": value})


def _match_categories(query: str, result: dict) -> None:
    for pattern, cat in CATEGORY_PATTERNS:
        if pattern.search(query) and cat not in result["categories"]:
            result["categories"].append(cat)


def _match_numeric(lower: str, result: dict) -> None:
    """Parse numeric comparisons like 'technology > 30%' or 'alpha > 80'."""
    sector_field_names = {s.lower() for s in SECTOR_KEYWORDS}
    sector_field_names |= _SECTOR_TRIGGER_WORDS

    for match in NUMERIC_PATTERN.finditer(lower):
        full_field = match.group(1).strip()
        last_word = full_field.split()[-1]
        operator, value = match.group(2), match.group(3)
        op = "gt" if operator in (">", "above", "over") else "lt"

        sector_match = _resolve_sector_from_field(full_field, last_word, sector_field_names)

        if sector_match:
            result["sector_exposure_filters"].append({
                "sector": sector_match, "operator": op, "value": float(value),
            })
        else:
            mapped = FIELD_MAP.get(last_word, last_word)
            result["numeric_filters"].append({
                "field": mapped, "operator": op, "value": float(value),
            })


def _resolve_sector_from_field(
    full_field: str, last_word: str, sector_names: set[str]
) -> Optional[str]:
    """Check if a numeric filter field refers to a sector."""
    clean = full_field.replace("exposure", "").replace("sector", "").strip()
    for trigger, sector_name in TRIGGER_TO_SECTOR.items():
        if trigger in clean:
            return sector_name
    if last_word.lower() in sector_names:
        return TRIGGER_TO_SECTOR.get(last_word.lower())
    return None


def _deduplicate_sector_filters(result: dict) -> None:
    """When sector_exposure_filters has a sector, remove from plain sectors list."""
    if result["sector_exposure_filters"]:
        exposure_sectors = {
            sef["sector"] for sef in result["sector_exposure_filters"]
        }
        result["sectors"] = [
            s for s in result["sectors"] if s not in exposure_sectors
        ]


def _match_lens_qualifiers(lower: str, result: dict) -> None:
    """Detect 'high alpha', 'top return' etc. and add numeric filters."""
    high_keywords = ["high", "strong", "good", "top", "best"]
    if not any(re.search(rf"\b{k}\b", lower) for k in high_keywords):
        return
    for lens_word, lens_key in [
        ("alpha", "alpha_score"), ("return", "return_score"),
        ("consistency", "consistency_score"),
        ("efficiency", "efficiency_score"),
        ("resilience", "resilience_score"),
    ]:
        if re.search(rf"\b{lens_word}\b", lower):
            result["numeric_filters"].append({
                "field": lens_key, "operator": "gt", "value": 70,
            })


def _match_top_n(lower: str, result: dict) -> None:
    top_match = re.search(r"top\s+(\d+)", lower)
    if top_match:
        result["sort_by"] = "return_score"
