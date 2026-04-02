"""Morningstar API Center configuration.

All API hashes and universe codes are loaded from environment variables
via pydantic-settings. Field prefix mappings are static.
Verified against real API responses on 2026-03-27.
"""

from dataclasses import dataclass
from functools import lru_cache

from app.core.config import get_settings, register_settings_dependent_cache


@dataclass(frozen=True)
class MorningstarAPI:
    name: str
    hash: str
    db_target: str       # "fund_master" | "nav_daily" | "risk_stats_monthly" | "rank_monthly" | "category_returns" | "holdings" | "holdings_snapshot" | "holdings_detail"
    field_map_name: str  # Key into field_maps module


@lru_cache
def _build_apis() -> tuple[list[MorningstarAPI], str, str]:
    """Build API list from env-sourced settings. Cached after first call."""
    s = get_settings()
    apis = [
        MorningstarAPI("Identifier Data",      s.morningstar_hash_identifier,        "fund_master",         "MASTER_FIELD_MAP"),
        MorningstarAPI("Additional Data",      s.morningstar_hash_additional,        "fund_master",         "MASTER_FIELD_MAP"),
        MorningstarAPI("Category Data",        s.morningstar_hash_category,          "fund_master",         "MASTER_FIELD_MAP"),
        MorningstarAPI("Nav Data",             s.morningstar_hash_nav,               "nav_daily",            "NAV_FIELD_MAP"),
        MorningstarAPI("Return Data",          s.morningstar_hash_returns,           "nav_daily",            "NAV_FIELD_MAP"),
        MorningstarAPI("Risk Stats",           s.morningstar_hash_risk,              "risk_stats_monthly",   "RISK_STATS_FIELD_MAP"),
        MorningstarAPI("Rank Data",            s.morningstar_hash_ranks,             "rank_monthly",         "RANK_FIELD_MAP"),
        MorningstarAPI("Category Return Data", s.morningstar_hash_catreturns,        "category_returns",     "CATEGORY_RETURNS_FIELD_MAP"),
        MorningstarAPI("Portfolio Data",       s.morningstar_hash_holdings,          "holdings",              "HOLDINGS_FIELD_MAP"),
        MorningstarAPI("Portfolio Summary",    s.morningstar_hash_portfolio_summary, "holdings_snapshot",      "HOLDINGS_FIELD_MAP"),
        MorningstarAPI("Fund Holdings Detail", s.morningstar_hash_holdings_detail,   "holdings_detail",       "HOLDING_DETAIL_FIELD_MAP"),
        MorningstarAPI("Extended Risk Stats",  s.morningstar_hash_extended_risk,     "risk_stats_monthly",      "RISK_STATS_FIELD_MAP"),
    ]
    return apis, s.morningstar_universe_code, s.morningstar_api_base


def _get_apis() -> list[MorningstarAPI]:
    return _build_apis()[0]


def _get_universe_code() -> str:
    return _build_apis()[1]


def _get_api_base() -> str:
    return _build_apis()[2]


# Public accessors — lazy-loaded from env vars, cached after first access
class _LazyAPIS:
    """List-like proxy that builds APIS from settings on first access."""
    def __getitem__(self, idx):  # type: ignore[override]
        return _get_apis()[idx]
    def __iter__(self):  # type: ignore[override]
        return iter(_get_apis())
    def __len__(self):  # type: ignore[override]
        return len(_get_apis())


APIS = _LazyAPIS()  # type: ignore[assignment]


class _LazyStr:
    """String proxy that resolves from settings on first use."""
    def __init__(self, getter):  # type: ignore[no-untyped-def]
        self._getter = getter
    def __str__(self) -> str:
        return self._getter()
    def __repr__(self) -> str:
        return self._getter()
    def __format__(self, spec: str) -> str:
        return format(self._getter(), spec)
    def __eq__(self, other: object) -> bool:
        return self._getter() == other
    def __hash__(self) -> int:
        return hash(self._getter())
    def __add__(self, other: str) -> str:
        return self._getter() + other
    def __radd__(self, other: str) -> str:
        return other + self._getter()


UNIVERSE_CODE = _LazyStr(_get_universe_code)  # type: ignore[assignment]
API_BASE = _LazyStr(_get_api_base)  # type: ignore[assignment]


@lru_cache
def _build_name_map() -> dict[str, MorningstarAPI]:
    apis = _get_apis()
    return {
        "identifier": apis[0],
        "additional": apis[1],
        "category": apis[2],
        "nav": apis[3],
        "returns": apis[4],
        "risk": apis[5],
        "ranks": apis[6],
        "catreturns": apis[7],
        "holdings": apis[8],
        "portfolio_summary": apis[9],
        "holdings_detail": apis[10],
        "extended_risk": apis[11],
    }


class _LazyNameMap:
    """Dict-like proxy for API_NAME_MAP."""
    def get(self, key: str, default=None):  # type: ignore[no-untyped-def]
        return _build_name_map().get(key, default)
    def __getitem__(self, key: str) -> MorningstarAPI:
        return _build_name_map()[key]
    def __contains__(self, key: str) -> bool:
        return key in _build_name_map()
    def keys(self):  # type: ignore[no-untyped-def]
        return _build_name_map().keys()
    def values(self):  # type: ignore[no-untyped-def]
        return _build_name_map().values()
    def items(self):  # type: ignore[no-untyped-def]
        return _build_name_map().items()


API_NAME_MAP = _LazyNameMap()  # type: ignore[assignment]

# Register so clear_all_config_caches() resets these when settings change
register_settings_dependent_cache(_build_apis.cache_clear)
register_settings_dependent_cache(_build_name_map.cache_clear)

# Prefixes found in API responses — stripped during parsing
# This is for documentation; the parser strips everything before the first hyphen
KNOWN_PREFIXES = [
    "TS",    # Time Series (NAV, 52wk high/low)
    "DP",    # Data Point (returns, NAV change, category returns)
    "RM",    # Risk Measure (Sharpe, Sortino, StdDev, Mean)
    "RMC",   # Risk Measure Custom (Rsquared)
    "MPTPI", # Modern Portfolio Theory Prospectus Index (Alpha, Beta)
    "TTRR",  # Trailing Total Return Rank (quartile ranks)
    "TTR",   # Trailing Total Return (category returns 2yr)
    "FSCBI", # Fund Share Class Basic Info (LegalName, InceptionDate, etc.)
    "AT",    # Attribute (FundLevelCategoryName, risk levels, etc.)
    "FM",    # Fund Manager
    "IC",    # Investment Commentary (InvestmentStrategy)
    "FB",    # Fund Benchmark (PrimaryProspectusBenchmarks)
    "KD",    # Key Date
    "TEI",   # (IPODate)
    "TEIV2", # (IPODate v2)
    "PD",    # Portfolio Data (holdings, sector exposure, holding details)
]

# Access code management
ACCESS_CODE_VERIFY_URL = "https://api.morningstar.com/v2/service/account/AccessscodeBasicInfo/{accesscode}"
ACCESS_CODE_CREATE_URL = "https://api.morningstar.com/v2/service/account/CreateAccesscode/{days}"
