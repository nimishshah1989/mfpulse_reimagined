"""Morningstar API Fetcher — programmatic data ingestion.

Fetches fund data from Morningstar's configured bulk APIs,
parses XML responses, maps prefixed field names to our DB schema,
and writes directly using existing IngestionRepository batch methods.

Usage:
    fetcher = MorningstarFetcher(db_session)
    result = fetcher.fetch_all()           # Full refresh: all 8 APIs
    result = fetcher.fetch_nav_only()      # Daily: just NAV + returns
    result = fetcher.fetch_single_api(api) # One specific API
"""

import logging
import time
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional
from xml.etree import ElementTree as ET

import httpx
from sqlalchemy import Boolean, Date, Integer, Numeric, inspect
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.morningstar_config import APIS, UNIVERSE_CODE, API_BASE, MorningstarAPI
from app.ingestion import field_maps
from app.models.db.category_returns import CategoryReturnsDaily
from app.models.db.fund_master import FundMaster
from app.models.db.nav_daily import NavDaily
from app.models.db.rank_monthly import RankMonthly
from app.models.db.risk_stats import RiskStatsMonthly
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

    def to_dict(self) -> dict:
        return {
            "api_name": self.api_name,
            "status": self.status,
            "fund_count": self.fund_count,
            "mapped_fields": self.mapped_fields,
            "unmapped_fields": self.unmapped_fields,
            "errors": self.errors[:5],
            "duration_ms": self.duration_ms,
        }


class MorningstarFetcher:
    """Fetches and ingests data from Morningstar bulk APIs."""

    _TRUTHY = frozenset(("1", "true", "True", "Y", "yes", "Yes"))

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.ingestion_repo = IngestionRepository(db)
        self.audit_repo = AuditRepository(db)
        self._access_code = self.settings.morningstar_access_code
        self._timeout = 120  # seconds — bulk responses can be large (5-8MB)
        self._col_type_cache: dict[type, dict[str, type]] = {}

    def _get_column_types(self, model_cls: type) -> dict[str, type]:
        """Build {col_name: sqlalchemy_type_class} map, cached per model."""
        if model_cls not in self._col_type_cache:
            mapper = inspect(model_cls)
            col_types: dict[str, type] = {}
            for attr in mapper.column_attrs:
                col = attr.columns[0]
                col_types[attr.key] = type(col.type)
            self._col_type_cache[model_cls] = col_types
        return self._col_type_cache[model_cls]

    def _coerce_record(self, record: dict, model_cls: type) -> dict:
        """Coerce string values from XML to types matching ORM columns.

        - Numeric → Decimal
        - Date → date.fromisoformat
        - Integer → int
        - Boolean → True/False
        - String/Text → str (no-op)
        - Unknown column → dropped
        """
        col_types = self._get_column_types(model_cls)
        coerced: dict = {}

        for key, value in record.items():
            if key not in col_types:
                continue

            col_type = col_types[key]

            # Already the right type (not a string) — pass through
            if not isinstance(value, str):
                coerced[key] = value
                continue

            try:
                if issubclass(col_type, Numeric):
                    coerced[key] = Decimal(value)
                elif issubclass(col_type, Date):
                    coerced[key] = date.fromisoformat(value)
                elif issubclass(col_type, Integer):
                    coerced[key] = int(value)
                elif issubclass(col_type, Boolean):
                    coerced[key] = value in self._TRUTHY
                else:
                    coerced[key] = value
            except (InvalidOperation, ValueError, TypeError) as exc:
                logger.warning(
                    "Coercion failed for %s.%s = %r (%s): %s",
                    model_cls.__tablename__, key, value, col_type.__name__, exc,
                )
                # Skip this field — don't crash the whole record

        return coerced

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

            # 2. Parse XML and map fields
            records, result = self._parse_xml(response.content, api, result)

            # 3. Write to DB using existing repository batch methods
            if records:
                self._write_to_db(api, records, result)

            if result.status == "pending":
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
                details=result.to_dict(),
            )
            self.db.commit()

        return result

    def _parse_xml(
        self,
        xml_content: bytes,
        api: MorningstarAPI,
        result: Optional[FetchResult] = None,
    ) -> tuple[list[dict], FetchResult]:
        """Parse XML response, strip prefixes, map to DB field names.

        Returns (records, result) tuple. Each record is a dict ready for repo upsert.
        """
        if result is None:
            result = FetchResult(api.name)

        root = ET.fromstring(xml_content)

        # Check status
        status_code = root.findtext(".//status/code")
        if status_code != "0":
            msg = root.findtext(".//status/message") or "Unknown error"
            result.status = "error"
            result.errors.append(f"API returned status {status_code}: {msg}")
            return [], result

        # Get the field map for this API
        field_map = getattr(field_maps, api.field_map_name, {})

        # All field maps for cross-lookup (risk API returns master fields too)
        all_maps = [
            ("MASTER_FIELD_MAP", getattr(field_maps, "MASTER_FIELD_MAP", {})),
            ("RISK_STATS_FIELD_MAP", getattr(field_maps, "RISK_STATS_FIELD_MAP", {})),
            ("NAV_FIELD_MAP", getattr(field_maps, "NAV_FIELD_MAP", {})),
            ("RANK_FIELD_MAP", getattr(field_maps, "RANK_FIELD_MAP", {})),
            ("CATEGORY_RETURNS_FIELD_MAP", getattr(field_maps, "CATEGORY_RETURNS_FIELD_MAP", {})),
        ]

        # Parse each <data> element (one per fund)
        fund_records: list[dict] = []
        for data_elem in root.findall("data"):
            mstar_id = data_elem.get("_id")
            if not mstar_id:
                continue

            record: dict[str, str] = {"mstar_id": mstar_id}
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

                # Look up in primary field map
                if stripped in field_map:
                    db_column = field_map[stripped]
                    record[db_column] = value.strip()
                    result.mapped_fields += 1
                else:
                    # Check other field maps (risk API returns master fields too)
                    found = False
                    for map_name, other_map in all_maps:
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
        logger.info(
            "Parsed %d funds from %s (%d fields mapped, %d unmapped)",
            result.fund_count, api.name, result.mapped_fields, result.unmapped_fields,
        )
        return fund_records, result

    def _coerce_records(self, records: list[dict], model_cls: type) -> list[dict]:
        """Coerce all records for a given model, filtering out empty results."""
        coerced = []
        for rec in records:
            c = self._coerce_record(rec, model_cls)
            if len(c) > 1:  # more than just mstar_id / category_code
                coerced.append(c)
        return coerced

    def _write_to_db(self, api: MorningstarAPI, records: list[dict], result: FetchResult) -> None:
        """Route records to the appropriate repository batch upsert method."""
        target = api.db_target
        today = str(date.today())

        try:
            if target == "fund_master":
                coerced = self._coerce_records(records, FundMaster)
                self.ingestion_repo.upsert_fund_masters(coerced)

            elif target == "nav_daily":
                for record in records:
                    if "nav_date" not in record:
                        record["nav_date"] = today
                coerced = self._coerce_records(records, NavDaily)
                self.ingestion_repo.upsert_nav_daily(coerced)

            elif target == "risk_stats_monthly":
                # Risk API also contains master fields (Managers, InceptionDate, etc.)
                # Split: master fields go to fund_master, risk fields go to risk_stats
                master_field_values = set(field_maps.MASTER_FIELD_MAP.values())
                master_records = []
                risk_records = []

                for record in records:
                    master_rec = {k: v for k, v in record.items()
                                  if k in master_field_values or k == "mstar_id"}
                    risk_rec = {k: v for k, v in record.items()
                                if k not in master_field_values or k == "mstar_id"}
                    if len(master_rec) > 1:
                        master_records.append(master_rec)
                    if len(risk_rec) > 1:
                        if "as_of_date" not in risk_rec:
                            risk_rec["as_of_date"] = today
                        risk_records.append(risk_rec)

                if master_records:
                    coerced_master = self._coerce_records(master_records, FundMaster)
                    self.ingestion_repo.upsert_fund_masters(coerced_master)
                if risk_records:
                    coerced_risk = self._coerce_records(risk_records, RiskStatsMonthly)
                    self.ingestion_repo.upsert_risk_stats(coerced_risk)

            elif target == "rank_monthly":
                for record in records:
                    if "as_of_date" not in record:
                        record["as_of_date"] = today
                coerced = self._coerce_records(records, RankMonthly)
                self.ingestion_repo.upsert_ranks(coerced)

            elif target == "category_returns":
                for record in records:
                    if "as_of_date" not in record:
                        record["as_of_date"] = today
                coerced = self._coerce_records(records, CategoryReturnsDaily)
                self.ingestion_repo.upsert_category_returns(coerced)

            self.db.commit()

        except Exception as e:
            self.db.rollback()
            result.errors.append(f"DB write error: {str(e)[:200]}")
            logger.exception("DB write error for %s", api.name)
