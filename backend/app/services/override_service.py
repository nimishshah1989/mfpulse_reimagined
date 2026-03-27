"""Override service — FM override CRUD with validation and audit trail."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.repositories.audit_repo import AuditRepository
from app.repositories.override_repo import OverrideRepository


class OverrideService:
    """Orchestrates FM override CRUD with audit trail."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.override_repo = OverrideRepository(db)
        self.audit_repo = AuditRepository(db)

    def create_override(self, data: dict) -> dict:
        """Create override + audit trail."""
        override = self.override_repo.create_override(data)
        self.audit_repo.log(
            actor=data.get("created_by", "system"),
            action="OVERRIDE_CREATE",
            entity_type="override",
            entity_id=override["id"],
            details={
                "override_type": data["override_type"],
                "target_id": data["target_id"],
                "direction": data["direction"],
                "magnitude": data.get("magnitude"),
            },
        )
        self.db.commit()
        return override

    def list_overrides(
        self,
        active_only: bool = True,
        override_type: Optional[str] = None,
    ) -> list[dict]:
        """List overrides with optional filters."""
        return self.override_repo.list_overrides(
            active_only=active_only,
            override_type=override_type,
        )

    def get_override(self, override_id: str) -> dict:
        """Get a single override."""
        override = self.override_repo.get_override(override_id)
        if override is None:
            raise NotFoundError(
                f"Override {override_id} not found",
                details={"override_id": override_id},
            )
        return override

    def deactivate_override(self, override_id: str) -> bool:
        """Deactivate override + audit trail."""
        # Get details for audit before deactivation
        override = self.override_repo.get_override(override_id)
        if override is None:
            raise NotFoundError(
                f"Override {override_id} not found",
                details={"override_id": override_id},
            )
        success = self.override_repo.deactivate_override(override_id)
        self.audit_repo.log(
            actor="system",
            action="OVERRIDE_DEACTIVATE",
            entity_type="override",
            entity_id=override_id,
            details={
                "override_type": override["override_type"],
                "target_id": override["target_id"],
            },
        )
        self.db.commit()
        return success

    def get_overrides_for_fund(self, mstar_id: str) -> list[dict]:
        """Get all active overrides for a fund."""
        return self.override_repo.get_overrides_for_fund(mstar_id)

    def get_overrides_for_category(self, category_name: str) -> list[dict]:
        """Get all active overrides for a category."""
        return self.override_repo.get_overrides_for_category(category_name)

    def expire_stale_overrides(self) -> int:
        """Expire stale overrides + audit trail."""
        count = self.override_repo.expire_stale_overrides()
        if count > 0:
            self.audit_repo.log(
                actor="system",
                action="OVERRIDE_EXPIRE_STALE",
                entity_type="override",
                entity_id="batch",
                details={"expired_count": count},
            )
        self.db.commit()
        return count
