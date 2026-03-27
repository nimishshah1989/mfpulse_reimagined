"""FM override table — fund manager manual overrides."""

from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPrimaryKey, TimestampMixin


class FMOverride(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "fm_override"

    created_by: Mapped[str] = mapped_column(String(100), nullable=False)
    override_type: Mapped[str] = mapped_column(String(30), nullable=False)
    target_id: Mapped[str] = mapped_column(String(200), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    magnitude: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
