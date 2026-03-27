"""Ingestion service — orchestrates parse → upsert → audit."""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.ingestion.feed_parser import FeedParser, ParseResult
from app.repositories.audit_repo import AuditRepository
from app.repositories.ingestion_repo import IngestionRepository, UpsertResult

logger = logging.getLogger(__name__)

MAX_ERRORS_IN_RESULT = 20

FILENAME_PATTERNS: dict[str, re.Pattern] = {
    "master": re.compile(r"master", re.IGNORECASE),
    "nav": re.compile(r"nav", re.IGNORECASE),
    "risk_stats": re.compile(r"risk[_\s-]?stats?", re.IGNORECASE),
    "ranks": re.compile(r"rank", re.IGNORECASE),
    "holdings": re.compile(r"hold", re.IGNORECASE),
    "category_returns": re.compile(r"cat(egory)?[_\s-]?ret", re.IGNORECASE),
}


@dataclass
class IngestionResult:
    feed_type: str = ""
    source_file: str = ""
    status: str = "FAILED"
    total_rows: int = 0
    parsed_rows: int = 0
    inserted: int = 0
    updated: int = 0
    failed: int = 0
    duration_ms: int = 0
    errors: list[dict] = field(default_factory=list)


def _detect_feed_type(filename: str) -> Optional[str]:
    """Detect feed type from filename using patterns."""
    name = Path(filename).stem.lower()
    for feed_type, pattern in FILENAME_PATTERNS.items():
        if pattern.search(name):
            return feed_type
    return None


class IngestionService:
    """Orchestrates Morningstar feed ingestion: parse → upsert → log → audit."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.parser = FeedParser()
        self.repo = IngestionRepository(db)
        self.audit = AuditRepository(db)

    def _ingest(
        self,
        csv_path: str,
        feed_type: str,
        parse_fn: callable,
        upsert_fn: callable,
    ) -> IngestionResult:
        """Generic ingestion flow."""
        start = time.monotonic()
        result = IngestionResult(feed_type=feed_type, source_file=csv_path)

        # 1. Parse
        parse_result: ParseResult = parse_fn(csv_path)
        result.total_rows = parse_result.total_rows
        result.parsed_rows = parse_result.parsed_rows
        result.errors.extend(parse_result.errors[:MAX_ERRORS_IN_RESULT])

        if not parse_result.records:
            result.status = "FAILED" if parse_result.errors else "EMPTY"
            result.duration_ms = int((time.monotonic() - start) * 1000)
            self._log_ingestion(result)
            return result

        # 2. Upsert
        upsert_result: UpsertResult = upsert_fn(parse_result.records)
        result.inserted = upsert_result.inserted
        result.updated = upsert_result.updated
        result.failed += upsert_result.failed
        remaining_slots = MAX_ERRORS_IN_RESULT - len(result.errors)
        if remaining_slots > 0:
            result.errors.extend(upsert_result.errors[:remaining_slots])

        # 3. Status
        total_failed = len(parse_result.errors) + upsert_result.failed
        if total_failed == 0:
            result.status = "SUCCESS"
        elif result.inserted > 0 or result.updated > 0:
            result.status = "PARTIAL"
        else:
            result.status = "FAILED"

        result.duration_ms = int((time.monotonic() - start) * 1000)

        # 4. Log
        self._log_ingestion(result)

        return result

    def _log_ingestion(self, result: IngestionResult) -> None:
        """Write ingestion_log and audit_trail entries."""
        try:
            error_text = None
            if result.errors:
                error_text = str(result.errors[:5])

            self.repo.create_ingestion_log(
                feed_name=f"{result.feed_type}:{Path(result.source_file).name}",
                records_processed=result.inserted + result.updated,
                records_failed=result.failed + (result.total_rows - result.parsed_rows),
                duration_ms=result.duration_ms,
                status=result.status,
                error_details=error_text,
            )

            self.audit.log(
                actor="system/ingestion",
                action="DATA_INGESTED",
                entity_type="ingestion",
                entity_id=Path(result.source_file).name,
                details={
                    "feed_type": result.feed_type,
                    "status": result.status,
                    "total_rows": result.total_rows,
                    "parsed_rows": result.parsed_rows,
                    "inserted": result.inserted,
                    "failed": result.failed,
                    "duration_ms": result.duration_ms,
                },
            )
            self.db.commit()
        except Exception as e:
            logger.warning("Failed to log ingestion: %s", e)
            self.db.rollback()

    def ingest_master_feed(self, csv_path: str) -> IngestionResult:
        return self._ingest(csv_path, "master", self.parser.parse_master_feed, self.repo.upsert_fund_masters)

    def ingest_nav_feed(self, csv_path: str) -> IngestionResult:
        return self._ingest(csv_path, "nav", self.parser.parse_nav_feed, self.repo.upsert_nav_daily)

    def ingest_risk_stats_feed(self, csv_path: str) -> IngestionResult:
        return self._ingest(csv_path, "risk_stats", self.parser.parse_risk_stats_feed, self.repo.upsert_risk_stats)

    def ingest_rank_feed(self, csv_path: str) -> IngestionResult:
        return self._ingest(csv_path, "ranks", self.parser.parse_rank_feed, self.repo.upsert_ranks)

    def ingest_holdings_feed(self, csv_path: str) -> IngestionResult:
        return self._ingest(csv_path, "holdings", self.parser.parse_holdings_feed, self.repo.upsert_holdings_snapshot)

    def ingest_category_returns_feed(self, csv_path: str) -> IngestionResult:
        return self._ingest(csv_path, "category_returns", self.parser.parse_category_returns_feed, self.repo.upsert_category_returns)

    def ingest_all_pending(self, feed_dir: str) -> list[IngestionResult]:
        """Scan feed directory, detect types, process each CSV."""
        results: list[IngestionResult] = []
        feed_path = Path(feed_dir)

        if not feed_path.exists():
            logger.warning("Feed directory does not exist: %s", feed_dir)
            return results

        dispatch = {
            "master": self.ingest_master_feed,
            "nav": self.ingest_nav_feed,
            "risk_stats": self.ingest_risk_stats_feed,
            "ranks": self.ingest_rank_feed,
            "holdings": self.ingest_holdings_feed,
            "category_returns": self.ingest_category_returns_feed,
        }

        for csv_file in sorted(feed_path.glob("*.csv")):
            feed_type = _detect_feed_type(csv_file.name)
            if feed_type and feed_type in dispatch:
                logger.info("Processing %s as %s feed", csv_file.name, feed_type)
                result = dispatch[feed_type](str(csv_file))
                results.append(result)
            else:
                logger.warning("Could not detect feed type for: %s", csv_file.name)

        return results
