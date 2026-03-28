"""Read/write operations for lens scores and classifications."""

from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.db.fund_master import FundMaster
from app.models.db.lens_scores import FundClassification, FundLensScores


class LensRepository:
    """Read/write operations for lens scores and classifications."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # --- Write ---

    def upsert_lens_scores(self, records: list[dict]) -> int:
        """Bulk upsert to fund_lens_scores. Returns count saved."""
        if not records:
            return 0
        stmt = insert(FundLensScores).values(records)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_lens_scores_mstar_date",
            set_={
                "category_name": stmt.excluded.category_name,
                "return_score": stmt.excluded.return_score,
                "risk_score": stmt.excluded.risk_score,
                "consistency_score": stmt.excluded.consistency_score,
                "alpha_score": stmt.excluded.alpha_score,
                "efficiency_score": stmt.excluded.efficiency_score,
                "resilience_score": stmt.excluded.resilience_score,
                "data_completeness_pct": stmt.excluded.data_completeness_pct,
                "available_horizons": stmt.excluded.available_horizons,
                "engine_version": stmt.excluded.engine_version,
                "input_hash": stmt.excluded.input_hash,
            },
        )
        self.db.execute(stmt)
        self.db.flush()
        return len(records)

    def upsert_classifications(self, records: list[dict]) -> int:
        """Bulk upsert to fund_classification. Returns count saved."""
        if not records:
            return 0
        stmt = insert(FundClassification).values(records)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_classification_mstar_date",
            set_={
                "return_class": stmt.excluded.return_class,
                "risk_class": stmt.excluded.risk_class,
                "consistency_class": stmt.excluded.consistency_class,
                "alpha_class": stmt.excluded.alpha_class,
                "efficiency_class": stmt.excluded.efficiency_class,
                "resilience_class": stmt.excluded.resilience_class,
                "headline_tag": stmt.excluded.headline_tag,
            },
        )
        self.db.execute(stmt)
        self.db.flush()
        return len(records)

    # --- Read ---

    def get_latest_scores(self, mstar_id: str) -> Optional[dict]:
        """Latest lens scores for one fund."""
        row = (
            self.db.query(FundLensScores)
            .filter(FundLensScores.mstar_id == mstar_id)
            .order_by(FundLensScores.computed_date.desc())
            .first()
        )
        if row is None:
            return None
        return self._scores_to_dict(row)

    def get_latest_classification(self, mstar_id: str) -> Optional[dict]:
        """Latest classification for one fund."""
        row = (
            self.db.query(FundClassification)
            .filter(FundClassification.mstar_id == mstar_id)
            .order_by(FundClassification.computed_date.desc())
            .first()
        )
        if row is None:
            return None
        return self._classification_to_dict(row)

    def get_category_scores(
        self,
        category_name: str,
        computed_date: Optional[date] = None,
    ) -> list[dict]:
        """All lens scores for funds in a category (for the explorer table)."""
        query = self.db.query(FundLensScores).filter(
            FundLensScores.category_name == category_name,
        )
        if computed_date:
            query = query.filter(FundLensScores.computed_date == computed_date)
        else:
            latest_sub = (
                self.db.query(func.max(FundLensScores.computed_date))
                .filter(FundLensScores.category_name == category_name)
                .scalar_subquery()
            )
            query = query.filter(FundLensScores.computed_date == latest_sub)

        rows = query.all()
        return [self._scores_to_dict(r) for r in rows]

    def get_all_scores(
        self,
        category: Optional[str] = None,
        sort_by: str = "return_score",
        sort_dir: str = "desc",
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """All lens scores with optional category filter, sort, pagination."""
        # Get latest computed_date per mstar_id
        latest_sub = (
            self.db.query(
                FundLensScores.mstar_id,
                func.max(FundLensScores.computed_date).label("max_date"),
            )
            .group_by(FundLensScores.mstar_id)
            .subquery()
        )

        query = (
            self.db.query(FundLensScores, FundMaster.fund_name)
            .join(
                latest_sub,
                (FundLensScores.mstar_id == latest_sub.c.mstar_id)
                & (FundLensScores.computed_date == latest_sub.c.max_date),
            )
            .outerjoin(
                FundMaster,
                FundLensScores.mstar_id == FundMaster.mstar_id,
            )
        )

        if category:
            query = query.filter(FundLensScores.category_name == category)

        total = query.count()

        sort_col = getattr(FundLensScores, sort_by, FundLensScores.return_score)
        if sort_dir == "desc":
            query = query.order_by(sort_col.desc().nulls_last())
        else:
            query = query.order_by(sort_col.asc().nulls_last())

        rows = query.offset(offset).limit(limit).all()
        result = []
        for score_row, fund_name in rows:
            d = self._scores_to_dict(score_row)
            d["fund_name"] = fund_name
            result.append(d)
        return result, total

    def get_all_scores_batch(self, mstar_ids: list[str]) -> dict[str, dict]:
        """Latest lens scores for multiple funds in a single query."""
        if not mstar_ids:
            return {}
        latest_sub = (
            self.db.query(
                FundLensScores.mstar_id,
                func.max(FundLensScores.computed_date).label("max_date"),
            )
            .filter(FundLensScores.mstar_id.in_(mstar_ids))
            .group_by(FundLensScores.mstar_id)
            .subquery()
        )
        rows = (
            self.db.query(FundLensScores)
            .join(
                latest_sub,
                (FundLensScores.mstar_id == latest_sub.c.mstar_id)
                & (FundLensScores.computed_date == latest_sub.c.max_date),
            )
            .all()
        )
        return {r.mstar_id: self._scores_to_dict(r) for r in rows}

    def get_all_classifications_batch(self, mstar_ids: list[str]) -> dict[str, dict]:
        """Latest classifications for multiple funds in a single query."""
        if not mstar_ids:
            return {}
        latest_sub = (
            self.db.query(
                FundClassification.mstar_id,
                func.max(FundClassification.computed_date).label("max_date"),
            )
            .filter(FundClassification.mstar_id.in_(mstar_ids))
            .group_by(FundClassification.mstar_id)
            .subquery()
        )
        rows = (
            self.db.query(FundClassification)
            .join(
                latest_sub,
                (FundClassification.mstar_id == latest_sub.c.mstar_id)
                & (FundClassification.computed_date == latest_sub.c.max_date),
            )
            .all()
        )
        return {r.mstar_id: self._classification_to_dict(r) for r in rows}

    def get_score_history(
        self,
        mstar_id: str,
        limit: int = 12,
    ) -> list[dict]:
        """Monthly lens score history for one fund (for trend charts)."""
        rows = (
            self.db.query(FundLensScores)
            .filter(FundLensScores.mstar_id == mstar_id)
            .order_by(FundLensScores.computed_date.desc())
            .limit(limit)
            .all()
        )
        return [self._scores_to_dict(r) for r in rows]

    def get_classification_distribution(
        self,
        category_name: Optional[str] = None,
    ) -> dict:
        """
        Count of funds per tier per lens.
        { "return": { "LEADER": 42, "STRONG": 85, ... }, "risk": { ... } }
        """
        # Get latest classification per fund
        latest_sub = (
            self.db.query(
                FundClassification.mstar_id,
                func.max(FundClassification.computed_date).label("max_date"),
            )
            .group_by(FundClassification.mstar_id)
            .subquery()
        )

        query = (
            self.db.query(FundClassification)
            .join(
                latest_sub,
                (FundClassification.mstar_id == latest_sub.c.mstar_id)
                & (FundClassification.computed_date == latest_sub.c.max_date),
            )
        )

        if category_name:
            # Filter by category via FundMaster join
            query = query.join(
                FundMaster,
                FundClassification.mstar_id == FundMaster.mstar_id,
            ).filter(FundMaster.category_name == category_name)

        rows = query.all()

        lens_names = ["return", "risk", "consistency", "alpha", "efficiency", "resilience"]
        distribution: dict[str, dict[str, int]] = {ln: {} for ln in lens_names}

        for row in rows:
            for ln in lens_names:
                cls = getattr(row, f"{ln}_class")
                if cls:
                    distribution[ln][cls] = distribution[ln].get(cls, 0) + 1

        return distribution

    # --- Private helpers ---

    @staticmethod
    def _scores_to_dict(row: FundLensScores) -> dict:
        return {
            "mstar_id": row.mstar_id,
            "computed_date": row.computed_date,
            "category_name": row.category_name,
            "return_score": row.return_score,
            "risk_score": row.risk_score,
            "consistency_score": row.consistency_score,
            "alpha_score": row.alpha_score,
            "efficiency_score": row.efficiency_score,
            "resilience_score": row.resilience_score,
            "data_completeness_pct": row.data_completeness_pct,
            "available_horizons": row.available_horizons,
            "engine_version": row.engine_version,
        }

    @staticmethod
    def _classification_to_dict(row: FundClassification) -> dict:
        return {
            "mstar_id": row.mstar_id,
            "computed_date": row.computed_date,
            "return_class": row.return_class,
            "risk_class": row.risk_class,
            "consistency_class": row.consistency_class,
            "alpha_class": row.alpha_class,
            "efficiency_class": row.efficiency_class,
            "resilience_class": row.resilience_class,
            "headline_tag": row.headline_tag,
        }
