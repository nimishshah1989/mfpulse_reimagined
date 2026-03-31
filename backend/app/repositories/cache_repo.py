"""Persistent KV cache repository backed by PostgreSQL."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.db.system import KVCache


class CacheRepository:
    """PostgreSQL-backed persistent cache with TTL support."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, key: str) -> Optional[dict]:
        """Get cached value. Returns None if missing or expired."""
        row = self.db.query(KVCache).filter(KVCache.cache_key == key).first()
        if row is None:
            return None
        if row.expires_at and row.expires_at < datetime.now(timezone.utc):
            return None
        return row.cache_value

    def set(self, key: str, value: dict, ttl_seconds: Optional[int] = None) -> None:
        """Upsert cache entry with optional TTL."""
        now = datetime.now(timezone.utc)
        expires = now + timedelta(seconds=ttl_seconds) if ttl_seconds else None

        stmt = insert(KVCache).values(
            cache_key=key,
            cache_value=value,
            updated_at=now,
            expires_at=expires,
        ).on_conflict_do_update(
            index_elements=["cache_key"],
            set_={
                "cache_value": value,
                "updated_at": now,
                "expires_at": expires,
            },
        )
        self.db.execute(stmt)
        self.db.commit()

    def delete(self, key: str) -> None:
        """Delete a cache entry."""
        self.db.query(KVCache).filter(KVCache.cache_key == key).delete()
        self.db.commit()

    def cleanup_expired(self) -> int:
        """Delete all expired entries. Returns count deleted."""
        count = self.db.query(KVCache).filter(
            KVCache.expires_at.isnot(None),
            KVCache.expires_at < datetime.now(timezone.utc),
        ).delete()
        self.db.commit()
        return count
