"""Append-only audit trail repository."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
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

    def get_paginated(
        self,
        page: int = 1,
        page_size: int = 50,
        entity_type: Optional[str] = None,
        action: Optional[str] = None,
        actor: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> tuple[list[dict], int]:
        """Get paginated audit entries with filters. Returns (items, total_count)."""
        query = self.db.query(AuditTrail)

        if entity_type:
            query = query.filter(AuditTrail.entity_type == entity_type)
        if action:
            query = query.filter(AuditTrail.action == action)
        if actor:
            query = query.filter(AuditTrail.actor == actor)
        if start_date:
            query = query.filter(AuditTrail.timestamp >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc))
        if end_date:
            query = query.filter(AuditTrail.timestamp <= datetime.combine(end_date, datetime.max.time(), tzinfo=timezone.utc))

        total = query.count()

        offset = (page - 1) * page_size
        rows = (
            query
            .order_by(AuditTrail.timestamp.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        items = [
            {
                "id": str(r.id),
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "actor": r.actor,
                "action": r.action,
                "entity_type": r.entity_type,
                "entity_id": r.entity_id,
                "details": r.details,
            }
            for r in rows
        ]
        return items, total

    def get_summary(self, days: int = 7) -> dict:
        """Activity summary: counts by action and actor for last N days."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        base = self.db.query(AuditTrail).filter(AuditTrail.timestamp >= cutoff)

        # Count by action
        action_counts = (
            base.with_entities(AuditTrail.action, func.count())
            .group_by(AuditTrail.action)
            .all()
        )
        by_action = {action: count for action, count in action_counts}

        # Count by actor
        actor_counts = (
            base.with_entities(AuditTrail.actor, func.count())
            .group_by(AuditTrail.actor)
            .all()
        )
        by_actor = {actor: count for actor, count in actor_counts}

        total = sum(by_action.values())

        latest = base.order_by(AuditTrail.timestamp.desc()).first()
        latest_timestamp = latest.timestamp.isoformat() if latest else None

        return {
            "by_action": by_action,
            "by_actor": by_actor,
            "total": total,
            "latest_timestamp": latest_timestamp,
        }

    def get_by_entity(self, entity_id: str, limit: int = 100) -> list[dict]:
        """Get audit entries for a specific entity (fund, override, etc.)."""
        rows = (
            self.db.query(AuditTrail)
            .filter(AuditTrail.entity_id == entity_id)
            .order_by(AuditTrail.timestamp.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": str(r.id),
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "actor": r.actor,
                "action": r.action,
                "entity_type": r.entity_type,
                "entity_id": r.entity_id,
                "details": r.details,
            }
            for r in rows
        ]
