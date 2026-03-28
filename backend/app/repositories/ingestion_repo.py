"""Bulk upsert operations for Morningstar feed data."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.db.fund_master import FundMaster
from app.models.db.nav_daily import NavDaily
from app.models.db.risk_stats import RiskStatsMonthly
from app.models.db.rank_monthly import RankMonthly
from app.models.db.holdings import FundHoldingsSnapshot, FundHoldingDetail
from app.models.db.sector_exposure import FundSectorExposure
from app.models.db.asset_allocation import FundAssetAllocation
from app.models.db.credit_quality import FundCreditQuality
from app.models.db.category_returns import CategoryReturnsDaily
from app.models.db.system import IngestionLog

logger = logging.getLogger(__name__)

BATCH_SIZE = 500


@dataclass
class UpsertResult:
    inserted: int = 0
    updated: int = 0
    failed: int = 0
    errors: list[dict] = field(default_factory=list)


class IngestionRepository:
    """Bulk upsert operations for Morningstar feed data using ON CONFLICT."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def _get_column_names(self, model_cls: type) -> set[str]:
        """Get valid column names for a model."""
        return {c.key for c in inspect(model_cls).mapper.column_attrs}

    def _filter_record(self, record: dict, valid_cols: set[str]) -> dict:
        """Remove keys not in the model's columns."""
        return {k: v for k, v in record.items() if k in valid_cols}

    @staticmethod
    def _get_required_columns(model_cls: type) -> set[str]:
        """Get NOT NULL column names excluding auto-generated ones (id, timestamps)."""
        auto_cols = {"id", "created_at", "updated_at"}
        table = model_cls.__table__
        return {
            col.name
            for col in table.columns
            if not col.nullable
            and col.name not in auto_cols
            and col.default is None
            and col.server_default is None
        }

    @staticmethod
    def _normalize_batch_keys(batch: list[dict]) -> list[dict]:
        """Ensure all dicts in a batch have identical keys.

        SQLAlchemy's insert().values(list_of_dicts) requires every dict to
        have the same keys.  Records from the Morningstar API have inconsistent
        fields (e.g. some funds have ``isin``, others don't).  This pads
        missing keys with ``None``.
        """
        if not batch:
            return batch
        all_keys = set().union(*(d.keys() for d in batch))
        return [{k: d.get(k) for k in all_keys} for d in batch]

    def _batch_upsert(
        self,
        model_cls: type,
        records: list[dict],
        conflict_cols: list[str],
        exclude_from_update: list[str] | None = None,
        do_nothing_on_conflict: bool = False,
    ) -> UpsertResult:
        """Generic batch upsert using PostgreSQL ON CONFLICT.

        Records are grouped by their key signature so that each sub-batch
        contains dicts with identical keys.  This avoids padding missing
        columns with None (which would overwrite existing data or violate
        NOT NULL constraints).
        """
        result = UpsertResult()
        valid_cols = self._get_column_names(model_cls)
        table = model_cls.__table__

        if exclude_from_update is None:
            exclude_from_update = []
        exclude_set = set(exclude_from_update + ["id", "created_at"])

        # Filter and prepare all records
        prepared: list[dict] = []
        for rec in records:
            filtered = self._filter_record(rec, valid_cols)
            if "id" not in filtered:
                filtered["id"] = uuid.uuid4()
            prepared.append(filtered)

        # Group records by their key signature so each sub-batch has uniform keys.
        # This avoids normalization padding None into columns records don't provide.
        from collections import defaultdict
        groups: dict[frozenset[str], list[dict]] = defaultdict(list)
        for row in prepared:
            key_sig = frozenset(row.keys())
            groups[key_sig].append(row)

        for key_sig, group_rows in groups.items():
            for batch_start in range(0, len(group_rows), BATCH_SIZE):
                batch = group_rows[batch_start:batch_start + BATCH_SIZE]
                try:
                    stmt = pg_insert(table).values(batch)

                    if do_nothing_on_conflict:
                        stmt = stmt.on_conflict_do_nothing(
                            index_elements=conflict_cols,
                        )
                    else:
                        # ON CONFLICT UPDATE only columns this group provides
                        update_cols = {
                            col.name: stmt.excluded[col.name]
                            for col in table.columns
                            if col.name not in exclude_set
                            and col.name not in conflict_cols
                            and col.name in key_sig
                        }

                        if update_cols:
                            stmt = stmt.on_conflict_do_update(
                                index_elements=conflict_cols,
                                set_=update_cols,
                            )
                        else:
                            stmt = stmt.on_conflict_do_nothing(
                                index_elements=conflict_cols,
                            )

                    self.db.execute(stmt)
                    self.db.commit()
                    result.inserted += len(batch)
                except Exception as e:
                    self.db.rollback()
                    result.failed += len(batch)
                    result.errors.append({
                        "batch_start": batch_start,
                        "error": str(e),
                    })
                    logger.warning(
                        "Batch upsert failed at offset %d: %s",
                        batch_start,
                        str(e),
                    )

        return result

    def upsert_fund_masters(self, records: list[dict]) -> UpsertResult:
        return self._batch_upsert(
            FundMaster,
            records,
            conflict_cols=["mstar_id"],
        )

    def upsert_nav_daily(self, records: list[dict]) -> UpsertResult:
        return self._batch_upsert(
            NavDaily,
            records,
            conflict_cols=["mstar_id", "nav_date"],
        )

    def upsert_risk_stats(self, records: list[dict]) -> UpsertResult:
        return self._batch_upsert(
            RiskStatsMonthly,
            records,
            conflict_cols=["mstar_id", "as_of_date"],
        )

    def upsert_ranks(self, records: list[dict]) -> UpsertResult:
        return self._batch_upsert(
            RankMonthly,
            records,
            conflict_cols=["mstar_id", "as_of_date"],
        )

    def upsert_holdings_snapshot(self, records: list[dict]) -> UpsertResult:
        return self._batch_upsert(
            FundHoldingsSnapshot,
            records,
            conflict_cols=["mstar_id", "portfolio_date"],
        )

    def upsert_holding_details(self, snapshot_id: uuid.UUID, records: list[dict]) -> UpsertResult:
        """Insert holding details for a given snapshot. No upsert — replace all."""
        result = UpsertResult()
        valid_cols = self._get_column_names(FundHoldingDetail)

        try:
            # Delete existing details for this snapshot
            self.db.query(FundHoldingDetail).filter(
                FundHoldingDetail.snapshot_id == snapshot_id,
            ).delete()

            for rec in records:
                filtered = self._filter_record(rec, valid_cols)
                filtered["snapshot_id"] = snapshot_id
                if "id" not in filtered:
                    filtered["id"] = uuid.uuid4()
                detail = FundHoldingDetail(**filtered)
                self.db.add(detail)

            self.db.commit()
            result.inserted = len(records)
        except Exception as e:
            self.db.rollback()
            result.failed = len(records)
            result.errors.append({"error": str(e)})

        return result

    def upsert_sector_exposure(self, records: list[dict]) -> UpsertResult:
        return self._batch_upsert(
            FundSectorExposure,
            records,
            conflict_cols=["mstar_id", "portfolio_date", "sector_name"],
        )

    def upsert_asset_allocation(self, records: list[dict]) -> UpsertResult:
        return self._batch_upsert(
            FundAssetAllocation,
            records,
            conflict_cols=["mstar_id", "portfolio_date"],
        )

    def upsert_credit_quality(self, records: list[dict]) -> UpsertResult:
        return self._batch_upsert(
            FundCreditQuality,
            records,
            conflict_cols=["mstar_id", "portfolio_date"],
        )

    def upsert_category_returns(self, records: list[dict]) -> UpsertResult:
        return self._batch_upsert(
            CategoryReturnsDaily,
            records,
            conflict_cols=["category_code", "as_of_date"],
        )

    def insert_nav_daily_backfill(self, records: list[dict]) -> UpsertResult:
        """Insert historical NAV. ON CONFLICT DO NOTHING — never overwrite fresh daily data."""
        return self._batch_upsert(
            NavDaily,
            records,
            conflict_cols=["mstar_id", "nav_date"],
            do_nothing_on_conflict=True,
        )

    def get_earliest_nav_dates(self) -> dict[str, datetime]:
        """Return {mstar_id: earliest_nav_date} for skip-if-backfilled logic."""
        from sqlalchemy import func, select
        stmt = (
            select(
                NavDaily.mstar_id,
                func.min(NavDaily.nav_date).label("earliest"),
            )
            .group_by(NavDaily.mstar_id)
        )
        rows = self.db.execute(stmt).fetchall()
        return {row.mstar_id: row.earliest for row in rows}

    def create_ingestion_log(
        self,
        feed_name: str,
        records_processed: int,
        records_failed: int,
        duration_ms: int,
        status: str,
        error_details: str | None = None,
    ) -> uuid.UUID:
        """Create an ingestion log entry."""
        log_entry = IngestionLog(
            feed_name=feed_name,
            ingestion_date=datetime.now(timezone.utc),
            records_processed=records_processed,
            records_failed=records_failed,
            duration_ms=duration_ms,
            status=status,
            error_details=error_details,
        )
        self.db.add(log_entry)
        self.db.flush()
        return log_entry.id

    def get_recent_ingestion_logs(self, limit: int = 20) -> list[IngestionLog]:
        """Get recent ingestion log entries."""
        return (
            self.db.query(IngestionLog)
            .order_by(IngestionLog.created_at.desc())
            .limit(limit)
            .all()
        )
