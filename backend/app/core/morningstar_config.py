"""Morningstar API Center configuration.

All API hashes, universe codes, and field prefix mappings.
Verified against real API responses on 2026-03-27.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class MorningstarAPI:
    name: str
    hash: str
    db_target: str       # "fund_master" | "nav_daily" | "risk_stats_monthly" | "rank_monthly" | "category_returns" | "holdings" | "holdings_snapshot" | "holdings_detail"
    field_map_name: str  # Key into field_maps module


UNIVERSE_CODE = "hoi7dvf1dvm67w36"
API_BASE = "https://api.morningstar.com/v2/service/mf"

# Order matters: master data first (FK integrity), then dependent tables
APIS = [
    # Master data (3 APIs contribute to fund_master)
    MorningstarAPI("Identifier Data",      "l308tct18q1h759g", "fund_master",         "MASTER_FIELD_MAP"),
    MorningstarAPI("Additional Data",      "lhqwwmpfryy07xct", "fund_master",         "MASTER_FIELD_MAP"),
    MorningstarAPI("Category Data",        "ssjwhtlzv3e4vw1c", "fund_master",         "MASTER_FIELD_MAP"),
    # NAV + Returns (2 APIs contribute to nav_daily)
    MorningstarAPI("Nav Data",             "n0fys3tcvprq4375", "nav_daily",            "NAV_FIELD_MAP"),
    MorningstarAPI("Return Data",          "fhqbikngn12un6yk", "nav_daily",            "NAV_FIELD_MAP"),
    # Risk stats (also contains some master fields like Managers, InceptionDate)
    MorningstarAPI("Risk Stats",           "qmaym0ulfsyb83j7", "risk_stats_monthly",   "RISK_STATS_FIELD_MAP"),
    # Ranks
    MorningstarAPI("Rank Data",            "c6ey0lob8683mm5d", "rank_monthly",         "RANK_FIELD_MAP"),
    # Category returns
    MorningstarAPI("Category Return Data", "msncecvsohvimjkx", "category_returns",     "CATEGORY_RETURNS_FIELD_MAP"),
    # Portfolio data (holdings, sector exposure, holding details)
    MorningstarAPI("Portfolio Data",       "s4bqvv72rjpelvwf", "holdings",              "HOLDINGS_FIELD_MAP"),
    # Portfolio summary (snapshot, sector, asset allocation, credit quality)
    MorningstarAPI("Portfolio Summary",    "ryt74bh4koatkf2w", "holdings_snapshot",      "HOLDINGS_FIELD_MAP"),
    # Fund holdings detail (individual stock/bond holdings per fund)
    MorningstarAPI("Fund Holdings Detail", "fq9mxhk7xeb20f3b", "holdings_detail",       "HOLDING_DETAIL_FIELD_MAP"),
]

# Short name → API object mapping for single-API fetch endpoint
API_NAME_MAP: dict[str, MorningstarAPI] = {
    "identifier": APIS[0],
    "additional": APIS[1],
    "category": APIS[2],
    "nav": APIS[3],
    "returns": APIS[4],
    "risk": APIS[5],
    "ranks": APIS[6],
    "catreturns": APIS[7],
    "holdings": APIS[8],
    "portfolio_summary": APIS[9],
    "holdings_detail": APIS[10],
}

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
