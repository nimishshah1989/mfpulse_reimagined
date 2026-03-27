"""FM override repository — CRUD for fund manager overrides."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.db.overrides import FMOverride


class OverrideRepository:
    """All DB access for FM overrides."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create_override(self, data: dict) -> dict:
        """Create a new FM override."""
        override = FMOverride(
            created_by=data["created_by"],
            override_type=data["override_type"],
            target_id=data["target_id"],
            direction=data["direction"],
            magnitude=data.get("magnitude"),
            rationale=data["rationale"],
            expires_at=data["expires_at"],
            is_active=True,
        )
        self.db.add(override)
        self.db.flush()
        return self._to_dict(override)

    def list_overrides(
        self,
        active_only: bool = True,
        override_type: Optional[str] = None,
    ) -> list[dict]:
        """List all overrides with optional filters."""
        query = self.db.query(FMOverride)
        if active_only:
            query = query.filter(FMOverride.is_active.is_(True))
        if override_type:
            query = query.filter(FMOverride.override_type == override_type)
        rows = query.order_by(FMOverride.created_at.desc()).all()
        return [self._to_dict(r) for r in rows]

    def get_override(self, override_id: str) -> dict | None:
        """Get a single override by ID."""
        oid = uuid.UUID(override_id) if isinstance(override_id, str) else override_id
        row = (
            self.db.query(FMOverride)
            .filter(FMOverride.id == oid)
            .first()
        )
        return self._to_dict(row) if row else None

    def deactivate_override(self, override_id: str) -> bool:
        """Soft-delete an override. Returns True if found and deactivated."""
        oid = uuid.UUID(override_id) if isinstance(override_id, str) else override_id
        row = (
            self.db.query(FMOverride)
            .filter(FMOverride.id == oid)
            .first()
        )
        if row is None:
            return False
        row.is_active = False
        row.updated_at = datetime.now(timezone.utc)
        self.db.flush()
        return True

    def get_overrides_for_fund(self, mstar_id: str) -> list[dict]:
        """Get all active overrides targeting a specific fund."""
        rows = (
            self.db.query(FMOverride)
            .filter(
                FMOverride.target_id == mstar_id,
                FMOverride.is_active.is_(True),
                FMOverride.override_type.in_(["FUND_BOOST", "FUND_SUPPRESS"]),
            )
            .order_by(FMOverride.created_at.desc())
            .all()
        )
        return [self._to_dict(r) for r in rows]

    def get_overrides_for_category(self, category_name: str) -> list[dict]:
        """Get all active overrides targeting a specific category."""
        rows = (
            self.db.query(FMOverride)
            .filter(
                FMOverride.target_id == category_name,
                FMOverride.is_active.is_(True),
                FMOverride.override_type == "CATEGORY_TILT",
            )
            .order_by(FMOverride.created_at.desc())
            .all()
        )
        return [self._to_dict(r) for r in rows]

    def expire_stale_overrides(self) -> int:
        """Deactivate all overrides past their expiry date. Returns count expired."""
        today = date.today()
        rows = (
            self.db.query(FMOverride)
            .filter(
                FMOverride.is_active.is_(True),
                FMOverride.expires_at < today,
            )
            .all()
        )
        for row in rows:
            row.is_active = False
            row.updated_at = datetime.now(timezone.utc)
        self.db.flush()
        return len(rows)

    # --- Private helpers ---

    @staticmethod
    def _to_dict(row: FMOverride) -> dict:
        return {
            "id": str(row.id),
            "created_by": row.created_by,
            "override_type": row.override_type,
            "target_id": row.target_id,
            "direction": row.direction,
            "magnitude": row.magnitude,
            "rationale": row.rationale,
            "expires_at": str(row.expires_at),
            "is_active": row.is_active,
            "created_at": str(row.created_at) if row.created_at else None,
            "updated_at": str(row.updated_at) if hasattr(row, "updated_at") and row.updated_at else None,
        }
