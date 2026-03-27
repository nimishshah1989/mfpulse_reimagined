"""Append-only audit trail repository."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.db.system import AuditTrail


class AuditRepository:
    """Append-only audit trail operations. No updates, no deletes."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def log(
        self,
        actor: str,
        action: str,
        entity_type: str,
        entity_id: str,
        details: Optional[dict] = None,
    ) -> uuid.UUID:
        """Create audit trail entry. Returns the audit record ID."""
        entry = AuditTrail(
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
            timestamp=datetime.now(timezone.utc),
        )
        self.db.add(entry)
        self.db.flush()
        return entry.id

    def get_recent(
        self,
        limit: int = 50,
        entity_type: Optional[str] = None,
    ) -> list[AuditTrail]:
        """Get recent audit entries, optionally filtered by entity_type."""
        query = self.db.query(AuditTrail)
        if entity_type:
            query = query.filter(AuditTrail.entity_type == entity_type)
        return query.order_by(AuditTrail.timestamp.desc()).limit(limit).all()
