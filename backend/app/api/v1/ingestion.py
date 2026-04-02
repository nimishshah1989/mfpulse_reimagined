"""API endpoints for manual feed ingestion."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import ValidationError
from app.models.schemas.responses import APIResponse, ErrorDetail, Meta
from app.repositories.freshness_repo import FreshnessRepository
from app.repositories.ingestion_repo import IngestionRepository
from app.services.ingestion_service import IngestionService

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

VALID_FEED_TYPES = {"master", "nav", "risk_stats", "ranks", "holdings", "category_returns"}


@router.post("/upload/{feed_type}")
def upload_feed(
    feed_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> APIResponse:
    """Upload a Morningstar CSV feed for processing."""
    if feed_type not in VALID_FEED_TYPES:
        raise ValidationError(
            message=f"Invalid feed_type: {feed_type}. Must be one of: {', '.join(sorted(VALID_FEED_TYPES))}",
            details={"valid_types": sorted(VALID_FEED_TYPES)},
        )

    settings = get_settings()
    feed_dir = Path(settings.feed_csv_dir)
    feed_dir.mkdir(parents=True, exist_ok=True)

    # Sanitize filename: strip path separators and reject traversal sequences
    safe_name = Path(file.filename or "upload").name.replace("..", "")
    if not safe_name or safe_name.startswith("."):
        raise ValidationError(
            message="Invalid filename",
            details={"filename": file.filename},
        )
    dest = feed_dir / f"{feed_type}_{safe_name}"
    # Final guard: resolved path must stay inside feed_dir
    if not dest.resolve().is_relative_to(feed_dir.resolve()):
        raise ValidationError(
            message="Invalid filename",
            details={"filename": file.filename},
        )
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    service = IngestionService(db)
    dispatch = {
        "master": service.ingest_master_feed,
        "nav": service.ingest_nav_feed,
        "risk_stats": service.ingest_risk_stats_feed,
        "ranks": service.ingest_rank_feed,
        "holdings": service.ingest_holdings_feed,
        "category_returns": service.ingest_category_returns_feed,
    }

    result = dispatch[feed_type](str(dest))

    return APIResponse(
        data={
            "feed_type": result.feed_type,
            "status": result.status,
            "total_rows": result.total_rows,
            "parsed_rows": result.parsed_rows,
            "inserted": result.inserted,
            "updated": result.updated,
            "failed": result.failed,
            "duration_ms": result.duration_ms,
            "errors": result.errors[:10],
        },
        meta=Meta(count=result.inserted + result.updated),
    )


@router.post("/process")
def process_pending_feeds(db: Session = Depends(get_db)) -> APIResponse:
    """Process all unprocessed CSV files in the feed directory."""
    settings = get_settings()
    service = IngestionService(db)
    results = service.ingest_all_pending(settings.feed_csv_dir)

    return APIResponse(
        data=[
            {
                "feed_type": r.feed_type,
                "status": r.status,
                "total_rows": r.total_rows,
                "inserted": r.inserted,
                "failed": r.failed,
            }
            for r in results
        ],
        meta=Meta(count=len(results)),
    )


@router.get("/log")
def get_ingestion_log(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> APIResponse:
    """Get recent ingestion log entries."""
    repo = IngestionRepository(db)
    logs = repo.get_recent_ingestion_logs(limit=limit)
    return APIResponse(
        data=[
            {
                "id": str(log.id),
                "feed_name": log.feed_name,
                "ingestion_date": str(log.ingestion_date),
                "records_processed": log.records_processed,
                "records_failed": log.records_failed,
                "duration_ms": log.duration_ms,
                "status": log.status,
                "error_details": log.error_details,
            }
            for log in logs
        ],
        meta=Meta(count=len(logs)),
    )


@router.get("/data-freshness")
def get_data_freshness(db: Session = Depends(get_db)) -> APIResponse:
    """Returns latest data date for each table + fund count."""
    repo = FreshnessRepository(db)
    latest_dates = repo.get_latest_dates()
    fund_count = repo.get_fund_count()
    nav_coverage = repo.get_nav_coverage()

    return APIResponse(
        data={
            "latest_dates": latest_dates,
            "fund_count": fund_count,
            "nav_coverage": nav_coverage,
        },
    )
