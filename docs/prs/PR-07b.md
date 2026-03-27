# PR-07b: Morningstar API Fetcher — Programmatic Data Ingestion

## Objective
Build a fetcher service that programmatically pulls fund data from Morningstar's configured bulk APIs, parses XML responses, maps fields to our DB schema, and writes directly to the database using existing repositories. After this PR, one API call or one scheduled job populates the entire fund universe — no manual CSV downloads.

---

## Context

Morningstar API Center has 8 pre-configured bulk APIs for Jhaveri Securities. Each API returns data for the **entire fund universe** (~3,000+ open-end schemes) in a single HTTP call. Responses are XML with prefixed field names — stripping the prefix yields exact matches to our existing `field_maps.py`.

**This PR does NOT modify any existing code.** It adds a new service, a new API endpoint, and a new scheduler job. Existing ingestion pipeline, field maps, and DB schema remain untouched.

---

## API Contract (verified against real responses)

### Authentication
- Access code passed as query param: `?accesscode={code}`
- Access codes expire every 90 days
- Auto-rotation endpoint: `POST /v2/service/account/CreateAccesscode/{days}?account_code={code}&account_password={pwd}`

### Base URL Pattern
```
GET https://api.morningstar.com/v2/service/mf/{api_hash}/universeid/{universe_code}?accesscode={accesscode}
```

### Configured APIs

| API Name | Hash | DB Target | Our Field Map |
|----------|------|-----------|---------------|
| Identifier Data | `l308tct18q1h759g` | fund_master | MASTER_FIELD_MAP |
| Additional Data | `lhqwwmpfryy07xct` | fund_master | MASTER_FIELD_MAP |
| Category Data | `ssjwhtlzv3e4vw1c` | fund_master | MASTER_FIELD_MAP |
| Nav Data | `n0fys3tcvprq4375` | nav_daily | NAV_FIELD_MAP |
| Return Data | `fhqbikngn12un6yk` | nav_daily | NAV_FIELD_MAP |
| Rank Data | `c6ey0lob8683mm5d` | rank_monthly | RANK_FIELD_MAP |
| Risk/Additional Data | `qmaym0ulfsyb83j7` | risk_stats_monthly + fund_master | RISK_STATS_FIELD_MAP + MASTER |
| Category Return Data | `msncecvsohvimjkx` | category_returns_daily | CATEGORY_RETURNS_FIELD_MAP |

### Universe
- **All Open End Universe**: `hoi7dvf1dvm67w36`

### XML Response Structure (verified)
```xml
<response>
  <status>
    <code>0</code>
    <message>OK</message>
  </status>
  <data _idtype="mstarid" _id="F00001SPNJ">
    <api _id="n0fys3tcvprq4375">
      <TS-NAV52wkHigh>1003.41260</TS-NAV52wkHigh>
      <TS-DayEndNAV>1002.45450</TS-DayEndNAV>
      <TS-DayEndNAVDate>2026-03-26</TS-DayEndNAVDate>
      <DP-NAVChange>0.21090</DP-NAVChange>
    </api>
  </data>
  <data _idtype="mstarid" _id="F00001SPNI">
    ...
  </data>
</response>
```

**Key parsing rules:**
1. Each `<data>` element = one fund. `_id` attribute = `mstar_id`
2. Each child element name has a prefix (e.g., `TS-`, `DP-`, `RM-`, `FSCBI-`, `AT-`, `TTRR-`, `RMC-`, `MPTPI-`, `FM-`, `IC-`, `FB-`, `TEI-`, `KD-`, `TTR-`)
3. **Strip everything up to and including the first hyphen** → yields the datapoint name that matches `field_maps.py`
4. Element text content = field value
5. Special case: Risk API has nested `<Manager>` elements with sub-elements — handle separately

### Verified Field Mapping (prefix → stripped name → our field map)

```
TS-DayEndNAV           → DayEndNAV           → NAV_FIELD_MAP["DayEndNAV"] = "nav"
DP-Return1Yr           → Return1Yr           → NAV_FIELD_MAP["Return1Yr"] = "return_1y"
RM-SharpeRatio3Yr      → SharpeRatio3Yr      → RISK_STATS_FIELD_MAP["SharpeRatio3Yr"] = "sharpe_3y"
TTRR-Rank1YrQuartile   → Rank1YrQuartile     → RANK_FIELD_MAP["Rank1YrQuartile"] = "quartile_1y"
FSCBI-LegalName        → LegalName           → MASTER_FIELD_MAP["LegalName"] = "legal_name"
AT-FundLevelCategoryName → FundLevelCategoryName → MASTER_FIELD_MAP["FundLevelCategoryName"] = "category_name"
MPTPI-Alpha3Yr         → Alpha3Yr            → RISK_STATS_FIELD_MAP["Alpha3Yr"] = "alpha_3y"
DP-CategoryReturn3Yr   → CategoryReturn3Yr   → CATEGORY_RETURNS_FIELD_MAP["CategoryReturn3Yr"] = "cat_return_3y"
```

### Rate Limit
- 10,000 calls/hour per client
- We make ~10 calls for a full refresh — not a concern

---

## Deliverables

### File 1: `backend/app/core/morningstar_config.py`

Centralized Morningstar API configuration. All hashes, universe codes, and API-to-table mappings in one place.

```python
"""Morningstar API Center configuration.

All API hashes, universe codes, and field prefix mappings.
Verified against real API responses on 2026-03-27.
"""

from dataclasses import dataclass

@dataclass(frozen=True)
class MorningstarAPI:
    name: str
    hash: str
    db_target: str           # "fund_master" | "nav_daily" | "risk_stats" | "rank_monthly" | "category_returns"
    field_map_name: str      # Key into field_maps module

UNIVERSE_CODE = "hoi7dvf1dvm67w36"
API_BASE = "https://api.morningstar.com/v2/service/mf"

# Order matters: master data first (FK integrity), then dependent tables
APIS = [
    # Master data (3 APIs contribute to fund_master)
    MorningstarAPI("Identifier Data",      "l308tct18q1h759g", "fund_master",        "MASTER_FIELD_MAP"),
    MorningstarAPI("Additional Data",      "lhqwwmpfryy07xct", "fund_master",        "MASTER_FIELD_MAP"),
    MorningstarAPI("Category Data",        "ssjwhtlzv3e4vw1c", "fund_master",        "MASTER_FIELD_MAP"),
    # NAV + Returns (2 APIs contribute to nav_daily)
    MorningstarAPI("Nav Data",             "n0fys3tcvprq4375", "nav_daily",           "NAV_FIELD_MAP"),
    MorningstarAPI("Return Data",          "fhqbikngn12un6yk", "nav_daily",           "NAV_FIELD_MAP"),
    # Risk stats (also contains some master fields like Managers, InceptionDate)
    MorningstarAPI("Risk Stats",           "qmaym0ulfsyb83j7", "risk_stats_monthly",  "RISK_STATS_FIELD_MAP"),
    # Ranks
    MorningstarAPI("Rank Data",            "c6ey0lob8683mm5d", "rank_monthly",        "RANK_FIELD_MAP"),
    # Category returns
    MorningstarAPI("Category Return Data", "msncecvsohvimjkx", "category_returns",    "CATEGORY_RETURNS_FIELD_MAP"),
]

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
    "TEI",   # ... (IPODate)
    "TEIV2", # ... (IPODate v2)
]

# Access code management
ACCESS_CODE_CREATE_URL = "https://api.morningstar.com/v2/service/account/CreateAccesscode/{days}"
ACCESS_CODE_VERIFY_URL = "https://api.morningstar.com/v2/service/account/AccessscodeBasicInfo/{accesscode}"
```

### File 2: `backend/app/services/morningstar_fetcher.py`

The main fetcher service. Fetches from all 8 APIs, parses XML, maps fields, writes to DB.

```python
"""Morningstar API Fetcher — programmatic data ingestion.

Fetches fund data from Morningstar's configured bulk APIs,
parses XML responses, maps prefixed field names to our DB schema,
and writes directly using existing IngestionRepository methods.

Usage:
    fetcher = MorningstarFetcher(db_session)
    result = fetcher.fetch_all()           # Full refresh: all 8 APIs
    result = fetcher.fetch_nav_only()      # Daily: just NAV + returns
    result = fetcher.fetch_single_api(api) # One specific API
"""

import logging
import time
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional
from xml.etree import ElementTree as ET

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.morningstar_config import APIS, UNIVERSE_CODE, API_BASE, MorningstarAPI
from app.ingestion import field_maps
from app.repositories.audit_repo import AuditRepository
from app.repositories.ingestion_repo import IngestionRepository

logger = logging.getLogger(__name__)


class FetchResult:
    """Result of a single API fetch operation."""
    __slots__ = ("api_name", "status", "fund_count", "mapped_fields",
                 "unmapped_fields", "errors", "duration_ms")

    def __init__(self, api_name: str):
        self.api_name = api_name
        self.status = "pending"
        self.fund_count = 0
        self.mapped_fields = 0
        self.unmapped_fields = 0
        self.errors: list[str] = []
        self.duration_ms = 0


class MorningstarFetcher:
    """Fetches and ingests data from Morningstar bulk APIs."""

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.ingestion_repo = IngestionRepository(db)
        self.audit_repo = AuditRepository(db)
        self._access_code = self.settings.morningstar_access_code
        self._timeout = 120  # seconds — bulk responses can be large (5-8MB)

    def fetch_all(self) -> list[FetchResult]:
        """Full refresh: fetch all 8 APIs in order. Master data first."""
        results = []
        for api in APIS:
            result = self.fetch_single_api(api)
            results.append(result)
            if result.status == "error":
                logger.error("API %s failed: %s", api.name, result.errors)
                # Continue with other APIs — don't abort entire refresh
        return results

    def fetch_nav_only(self) -> list[FetchResult]:
        """Daily refresh: just NAV + Returns (2 API calls)."""
        nav_apis = [a for a in APIS if a.db_target == "nav_daily"]
        return [self.fetch_single_api(api) for api in nav_apis]

    def fetch_single_api(self, api: MorningstarAPI) -> FetchResult:
        """Fetch one API, parse XML, map fields, write to DB."""
        result = FetchResult(api.name)
        start = time.monotonic()

        try:
            # 1. HTTP fetch
            url = f"{API_BASE}/{api.hash}/universeid/{UNIVERSE_CODE}?accesscode={self._access_code}"
            logger.info("Fetching %s from %s", api.name, url[:80] + "...")

            with httpx.Client(timeout=self._timeout) as client:
                response = client.get(url)
                response.raise_for_status()

            # 2. Parse XML
            root = ET.fromstring(response.content)

            # Check status
            status_code = root.findtext(".//status/code")
            if status_code != "0":
                msg = root.findtext(".//status/message") or "Unknown error"
                result.status = "error"
                result.errors.append(f"API returned status {status_code}: {msg}")
                return result

            # 3. Get the field map for this API
            field_map = getattr(field_maps, api.field_map_name, {})

            # 4. Parse each <data> element (one per fund)
            fund_records = []
            for data_elem in root.findall("data"):
                mstar_id = data_elem.get("_id")
                if not mstar_id:
                    continue

                record = {"mstar_id": mstar_id}
                api_elem = data_elem.find("api")
                if api_elem is None:
                    continue

                for child in api_elem:
                    raw_tag = child.tag
                    value = child.text

                    if value is None:
                        continue

                    # Strip prefix: "TS-DayEndNAV" → "DayEndNAV"
                    if "-" in raw_tag:
                        stripped = raw_tag.split("-", 1)[1]
                    else:
                        stripped = raw_tag

                    # Look up in field map
                    if stripped in field_map:
                        db_column = field_map[stripped]
                        record[db_column] = value.strip()
                        result.mapped_fields += 1
                    else:
                        # Check other field maps (risk API returns master fields too)
                        found = False
                        for other_map_name in ["MASTER_FIELD_MAP", "RISK_STATS_FIELD_MAP",
                                                "NAV_FIELD_MAP", "RANK_FIELD_MAP"]:
                            other_map = getattr(field_maps, other_map_name, {})
                            if stripped in other_map:
                                db_column = other_map[stripped]
                                record[db_column] = value.strip()
                                result.mapped_fields += 1
                                found = True
                                break
                        if not found:
                            result.unmapped_fields += 1

                if len(record) > 1:  # has more than just mstar_id
                    fund_records.append(record)

            result.fund_count = len(fund_records)
            logger.info("Parsed %d funds from %s (%d fields mapped, %d unmapped)",
                        result.fund_count, api.name, result.mapped_fields, result.unmapped_fields)

            # 5. Write to DB using existing repository methods
            if fund_records:
                self._write_to_db(api, fund_records, result)

            result.status = "success"

        except httpx.TimeoutException:
            result.status = "error"
            result.errors.append(f"Timeout after {self._timeout}s")
        except httpx.HTTPStatusError as e:
            result.status = "error"
            result.errors.append(f"HTTP {e.response.status_code}: {e.response.text[:200]}")
        except ET.ParseError as e:
            result.status = "error"
            result.errors.append(f"XML parse error: {str(e)[:200]}")
        except Exception as e:
            result.status = "error"
            result.errors.append(f"Unexpected error: {str(e)[:200]}")
            logger.exception("Error fetching %s", api.name)
        finally:
            result.duration_ms = int((time.monotonic() - start) * 1000)
            # Audit trail
            self.audit_repo.log(
                entity_type="morningstar_fetch",
                entity_id=api.name,
                action="fetch",
                actor="system",
                details={
                    "status": result.status,
                    "fund_count": result.fund_count,
                    "mapped_fields": result.mapped_fields,
                    "unmapped_fields": result.unmapped_fields,
                    "errors": result.errors[:5],
                    "duration_ms": result.duration_ms,
                },
            )
            self.db.commit()

        return result

    def _write_to_db(self, api: MorningstarAPI, records: list[dict], result: FetchResult) -> None:
        """Route records to the appropriate repository upsert method."""
        target = api.db_target
        today = date.today()

        try:
            if target == "fund_master":
                # Merge multiple API responses into fund_master
                for record in records:
                    self.ingestion_repo.upsert_fund_master(record)

            elif target == "nav_daily":
                # Add nav_date from the data if present, else use today
                for record in records:
                    if "nav_date" not in record:
                        record["nav_date"] = str(today)
                    self.ingestion_repo.upsert_nav_daily(record)

            elif target == "risk_stats_monthly":
                # Risk API also contains master fields (Managers, InceptionDate, etc.)
                # Split: master fields go to fund_master, risk fields go to risk_stats
                master_fields = set(field_maps.MASTER_FIELD_MAP.values())
                for record in records:
                    master_record = {k: v for k, v in record.items()
                                     if k in master_fields or k == "mstar_id"}
                    risk_record = {k: v for k, v in record.items()
                                   if k not in master_fields or k == "mstar_id"}
                    if len(master_record) > 1:
                        self.ingestion_repo.upsert_fund_master(master_record)
                    if len(risk_record) > 1:
                        if "as_of_date" not in risk_record:
                            risk_record["as_of_date"] = str(today)
                        self.ingestion_repo.upsert_risk_stats(risk_record)

            elif target == "rank_monthly":
                for record in records:
                    if "as_of_date" not in record:
                        record["as_of_date"] = str(today)
                    self.ingestion_repo.upsert_rank(record)

            elif target == "category_returns":
                for record in records:
                    if "as_of_date" not in record:
                        record["as_of_date"] = str(today)
                    self.ingestion_repo.upsert_category_returns(record)

            self.db.commit()

        except Exception as e:
            self.db.rollback()
            result.errors.append(f"DB write error: {str(e)[:200]}")
            logger.exception("DB write error for %s", api.name)
```

### File 3: `backend/app/api/v1/fetch.py`

API endpoints for triggering fetches.

```python
@router.post("/fetch/full")
    """Trigger a full Morningstar data refresh (all 8 APIs).
    Returns summary of each API fetch result.
    Takes ~2-3 minutes for ~3000 funds."""

@router.post("/fetch/nav")
    """Trigger daily NAV + returns refresh only (2 API calls).
    Takes ~30 seconds."""

@router.post("/fetch/single/{api_name}")
    """Trigger a single API fetch by name.
    Valid names: identifier, additional, category, nav, returns, risk, ranks, catreturns"""

@router.get("/fetch/status")
    """Get last fetch results from audit trail."""
```

### File 4: Update `backend/app/api/v1/router.py`

Mount the new fetch router.

### File 5: Update `backend/app/jobs/scheduler.py`

Add two new scheduled jobs:

```python
# Daily 9:30 PM IST — NAV + Returns refresh
def job_fetch_nav(self):
    """Fetch latest NAV and returns from Morningstar."""
    fetcher = MorningstarFetcher(self._get_db())
    results = fetcher.fetch_nav_only()
    # Log results to audit trail

# Weekly Sunday 11 PM IST — Full refresh (all APIs)
def job_fetch_full(self):
    """Full Morningstar data refresh — master, risk, ranks, everything."""
    fetcher = MorningstarFetcher(self._get_db())
    results = fetcher.fetch_all()
    # After full fetch, recompute lens scores
    lens_service = LensService(self._get_db())
    lens_service.compute_all()
```

### File 6: Update `backend/app/core/config.py`

Add new config fields:

```python
morningstar_universe_code: str = "hoi7dvf1dvm67w36"
morningstar_client_account_code: str = ""      # For access code auto-rotation
morningstar_client_password: str = ""           # For access code auto-rotation
```

### File 7: `backend/app/services/morningstar_access_manager.py`

Access code auto-rotation (codes expire every 90 days).

```python
class AccessCodeManager:
    """Manages Morningstar access code lifecycle.
    
    Checks if current code is valid, creates new one before expiry,
    updates the running config.
    """
    def verify_current(self) -> dict       # Returns {valid, expires, days_remaining}
    def create_new(self, days: int = 90) -> str  # Creates and returns new code
    def rotate_if_needed(self, min_days: int = 7) -> None  # Auto-rotate if <7 days left
```

### File 8: Tests (20+)

**test_morningstar_fetcher.py:**
- Parse valid XML response → correct fund count and field mapping
- Strip prefixes: "TS-DayEndNAV" → "DayEndNAV" → "nav"
- Strip prefixes: "MPTPI-Alpha3Yr" → "Alpha3Yr" → "alpha_3y"
- Unknown prefix → field counted as unmapped, not error
- Empty XML element → field skipped
- API returns error status code → FetchResult.status = "error"
- HTTP timeout → graceful error
- HTTP 401 (bad access code) → clear error message
- Write to fund_master → upsert called with correct data
- Write to nav_daily → nav_date added if missing
- Risk API → splits master fields from risk fields correctly
- Full fetch → calls all 8 APIs in order
- Nav-only fetch → calls only 2 APIs
- Audit trail logged for every fetch

**test_fetch_api.py:**
- POST /fetch/full → returns results array
- POST /fetch/nav → returns results for 2 APIs
- POST /fetch/single/nav → returns result for 1 API
- POST /fetch/single/invalid → 400
- GET /fetch/status → returns last fetch from audit

**test_access_manager.py:**
- Verify valid code → returns expiry info
- Create new code → returns code string
- Rotate when < 7 days → creates new code

---

## Initial Data Load Procedure

After this PR is deployed, run the full fetch once to populate all tables:

```bash
curl -X POST https://mfpulse.jslwealth.in/api/v1/ingestion/fetch/full
```

This will:
1. Fetch ~3,000 funds from all 8 APIs (~2-3 minutes)
2. Populate fund_master, nav_daily, risk_stats_monthly, rank_monthly, category_returns_daily
3. Log every step to audit_trail

Then trigger lens computation:

```bash
curl -X POST https://mfpulse.jslwealth.in/api/v1/lens/compute
```

After these two calls, the Universe Explorer will have real data.

---

## QA Checklist

1. `python -m pytest tests/ -x -q --tb=short` — ALL green
2. Coverage: new files above 80%
3. App boots OK
4. POST /api/v1/ingestion/fetch/nav → fetches real data from Morningstar (requires valid access code)
5. fund_master table populated with fund names, categories
6. nav_daily table populated with latest NAV + returns
7. risk_stats_monthly populated with Sharpe, Alpha, etc.
8. Audit trail shows fetch results for each API
9. Unmapped fields logged but don't cause errors
10. Timeout after 120s → graceful error, other APIs still fetched
11. Invalid access code → clear 401 error message

Commit: `PR-07b: Morningstar API fetcher — programmatic data ingestion`

---

## What This PR Does NOT Include
- Holdings/portfolio data (need to configure new API on portal first — HoldingDetail, GlobalStockSectorBreakdown)
- Historical NAV backfill (separate concern — per-fund API with date range params)
- Feed Builder CSV download automation (not needed — REST API is superior)
- Editing existing field_maps.py (all mapping works via existing maps + prefix stripping)

## Follow-up: Portal Edits Needed
After validating the fetcher works, edit these APIs on the Morningstar portal to add missing data points:

**Identifier Data** — add: SecId, FundId, ProviderCompanyID, ProviderCompanyName, AMFICode, InceptionDate, InterimNetExpenseRatio, GrossExpenseRatio, SIPAvailability, ClosedToInvestors, PerformanceReady

**Rank Data** — add: AbsRank1Mth through AbsRank10Yr, MonthEndDate, Rank4YrQuartile, Rank7YrQuartile

**Return Data** — add: ReturnYTD, Return4Yr, Return7Yr, CumulativeReturn3Yr/5Yr/10Yr, Year1 through Year10

**Risk Stats** — add: Alpha5Yr, Alpha10Yr, Beta5Yr, Beta10Yr, MaxDrawdown1Yr/3Yr/5Yr, TreynorRatio1Yr/3Yr/5Yr/10Yr, InformationRatio1Yr/3Yr/5Yr, TrackingError1Yr/3Yr/5Yr, CaptureRatioUpside/Downside 1Yr/3Yr/5Yr, Correlation1Yr/3Yr/5Yr, Kurtosis1Yr/3Yr/5Yr, Skewness1Yr/3Yr/5Yr

**New API needed** — Portfolio/Holdings: NumberofHolding, PortfolioDate, EquityStyleBoxLongName, AverageMarketCapMilLong, PERatioTTMLong, all EquitySector*Net fields, HoldingDetail (top 25)
