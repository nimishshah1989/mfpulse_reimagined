"""Backfill historical NAV data from mfapi.in for all regular funds.

mfapi.in provides full NAV history from inception for every Indian mutual fund.
This script fetches NAV data for funds that have gaps in nav_daily and bulk-inserts
using ON CONFLICT DO NOTHING (never overwrites existing Morningstar data).

Usage:
    # From project root on EC2:
    cd /home/ubuntu/mfpulse_reimagined
    python -m scripts.backfill_nav_mfapi              # all regular funds
    python -m scripts.backfill_nav_mfapi --limit 100  # first 100 funds only
    python -m scripts.backfill_nav_mfapi --min-gap 50 # only funds missing >50% data
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, sessionmaker

# Add backend to path so we can import models
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.models.db.nav_daily import NavDaily

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

MFAPI_BASE = "https://api.mfapi.in/mf"
CONCURRENCY = 5          # Parallel requests
DELAY_BETWEEN = 0.2      # Seconds between batches (respect rate limits)
BATCH_INSERT_SIZE = 1000  # Rows per DB insert
PROGRESS_LOG_EVERY = 50   # Log progress every N funds


def get_db_session() -> Session:
    """Create DB session from DATABASE_URL env var."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        # Try reading from .env
        env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DATABASE_URL="):
                        db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")
    engine = create_engine(db_url, pool_pre_ping=True)
    return sessionmaker(bind=engine)()


def get_funds_to_backfill(db: Session, min_gap_pct: float = 0.0) -> list[dict]:
    """Get regular funds with AMFI codes that need NAV backfill.

    Returns list of {mstar_id, amfi_code, inception_date, existing_rows, expected_rows, gap_pct}.
    """
    query = text("""
        WITH fund_stats AS (
            SELECT
                fm.mstar_id,
                fm.amfi_code,
                fm.inception_date,
                COALESCE(nav.cnt, 0) AS existing_rows,
                GREATEST(1, FLOOR((CURRENT_DATE - fm.inception_date) * 252.0 / 365)) AS expected_rows
            FROM fund_master fm
            LEFT JOIN (
                SELECT mstar_id, COUNT(*) AS cnt
                FROM nav_daily
                WHERE nav IS NOT NULL
                GROUP BY mstar_id
            ) nav ON nav.mstar_id = fm.mstar_id
            WHERE fm.amfi_code IS NOT NULL
              AND fm.inception_date IS NOT NULL
              AND fm.inception_date < CURRENT_DATE
        )
        SELECT
            mstar_id, amfi_code, inception_date,
            existing_rows, expected_rows,
            ROUND(100.0 * (1 - existing_rows::numeric / expected_rows), 1) AS gap_pct
        FROM fund_stats
        WHERE (1 - existing_rows::numeric / expected_rows) >= :min_gap
        ORDER BY gap_pct DESC
    """)
    rows = db.execute(query, {"min_gap": min_gap_pct / 100.0}).fetchall()
    return [
        {
            "mstar_id": r.mstar_id,
            "amfi_code": str(r.amfi_code),
            "inception_date": r.inception_date,
            "existing_rows": r.existing_rows,
            "expected_rows": r.expected_rows,
            "gap_pct": float(r.gap_pct),
        }
        for r in rows
    ]


async def fetch_nav_history(
    client: httpx.AsyncClient,
    amfi_code: str,
    semaphore: asyncio.Semaphore,
) -> list[dict] | None:
    """Fetch full NAV history for one fund from mfapi.in."""
    async with semaphore:
        try:
            resp = await client.get(f"{MFAPI_BASE}/{amfi_code}", timeout=30)
            if resp.status_code != 200:
                return None
            data = resp.json()
            if data.get("status") != "SUCCESS" or not data.get("data"):
                return None
            return data["data"]
        except Exception as e:
            logger.warning("Failed to fetch AMFI %s: %s", amfi_code, e)
            return None


def parse_nav_records(
    mstar_id: str,
    raw_data: list[dict],
) -> list[dict]:
    """Parse mfapi.in response into nav_daily records."""
    records = []
    for entry in raw_data:
        try:
            nav_str = entry.get("nav")
            date_str = entry.get("date")
            if not nav_str or not date_str:
                continue
            nav_val = Decimal(str(nav_str))
            # mfapi.in date format: dd-MM-yyyy
            nav_date = datetime.strptime(date_str, "%d-%m-%Y").date()
            records.append({
                "id": uuid.uuid4(),
                "mstar_id": mstar_id,
                "nav_date": nav_date,
                "nav": nav_val,
            })
        except (InvalidOperation, ValueError):
            continue
    return records


def bulk_insert_navs(db: Session, records: list[dict]) -> int:
    """Bulk insert NAV records with ON CONFLICT DO NOTHING."""
    if not records:
        return 0
    inserted = 0
    table = NavDaily.__table__
    for i in range(0, len(records), BATCH_INSERT_SIZE):
        batch = records[i:i + BATCH_INSERT_SIZE]
        try:
            stmt = pg_insert(table).values(batch).on_conflict_do_nothing(
                index_elements=["mstar_id", "nav_date"],
            )
            result = db.execute(stmt)
            db.commit()
            inserted += result.rowcount
        except Exception as e:
            db.rollback()
            logger.warning("Insert batch failed: %s", e)
    return inserted


async def backfill_funds(
    db: Session,
    funds: list[dict],
    concurrency: int = CONCURRENCY,
) -> dict:
    """Run the backfill for a list of funds."""
    semaphore = asyncio.Semaphore(concurrency)
    stats = {
        "total_funds": len(funds),
        "fetched": 0,
        "failed": 0,
        "skipped": 0,
        "new_rows": 0,
        "start_time": time.time(),
    }

    async with httpx.AsyncClient() as client:
        for idx, fund in enumerate(funds):
            mstar_id = fund["mstar_id"]
            amfi_code = fund["amfi_code"]

            raw_data = await fetch_nav_history(client, amfi_code, semaphore)
            if raw_data is None:
                stats["failed"] += 1
                if (idx + 1) % PROGRESS_LOG_EVERY == 0:
                    _log_progress(stats, idx + 1)
                await asyncio.sleep(DELAY_BETWEEN)
                continue

            nav_records = parse_nav_records(mstar_id, raw_data)
            if not nav_records:
                stats["skipped"] += 1
                await asyncio.sleep(DELAY_BETWEEN)
                continue

            new_rows = bulk_insert_navs(db, nav_records)
            stats["new_rows"] += new_rows
            stats["fetched"] += 1

            if (idx + 1) % PROGRESS_LOG_EVERY == 0:
                _log_progress(stats, idx + 1)

            await asyncio.sleep(DELAY_BETWEEN)

    stats["duration_s"] = round(time.time() - stats["start_time"], 1)
    return stats


def _log_progress(stats: dict, current: int) -> None:
    elapsed = time.time() - stats["start_time"]
    rate = current / elapsed if elapsed > 0 else 0
    eta_s = (stats["total_funds"] - current) / rate if rate > 0 else 0
    logger.info(
        "Progress: %d/%d funds (%.0f/s) | %d new NAVs | %d failed | ETA: %.0fm",
        current,
        stats["total_funds"],
        rate,
        stats["new_rows"],
        stats["failed"],
        eta_s / 60,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill NAV history from mfapi.in")
    parser.add_argument("--limit", type=int, default=0, help="Max funds to process (0=all)")
    parser.add_argument("--min-gap", type=float, default=0.0, help="Only funds with gap > N%%")
    parser.add_argument("--concurrency", type=int, default=CONCURRENCY, help="Parallel requests")
    args = parser.parse_args()

    db = get_db_session()
    logger.info("Fetching fund list from database...")
    funds = get_funds_to_backfill(db, min_gap_pct=args.min_gap)
    logger.info("Found %d funds needing backfill", len(funds))

    if args.limit > 0:
        funds = funds[:args.limit]
        logger.info("Limited to %d funds", len(funds))

    if not funds:
        logger.info("No funds need backfill. Done.")
        return

    # Show top gaps
    logger.info("Top 5 gaps:")
    for f in funds[:5]:
        logger.info(
            "  %s (AMFI %s): %d/%d rows (%.1f%% gap)",
            f["mstar_id"], f["amfi_code"],
            f["existing_rows"], f["expected_rows"], f["gap_pct"],
        )

    stats = asyncio.run(backfill_funds(db, funds, concurrency=args.concurrency))

    logger.info("=" * 60)
    logger.info("BACKFILL COMPLETE")
    logger.info("  Funds processed: %d/%d", stats["fetched"], stats["total_funds"])
    logger.info("  Failed: %d", stats["failed"])
    logger.info("  Skipped (no data): %d", stats["skipped"])
    logger.info("  New NAV rows inserted: %d", stats["new_rows"])
    logger.info("  Duration: %.1fs", stats["duration_s"])
    logger.info("=" * 60)

    db.close()


if __name__ == "__main__":
    main()
