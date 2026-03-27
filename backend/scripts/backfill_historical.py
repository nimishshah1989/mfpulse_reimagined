"""One-time historical backfill script for Morningstar data.

Usage:
    python scripts/backfill_historical.py --dir /path/to/csv/dir [--chunk-size 50000]
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Processing order for FK integrity
FEED_TYPE_ORDER = ["master", "nav", "risk_stats", "ranks", "holdings", "category_returns"]

FEED_PATTERNS = {
    "master": "master",
    "nav": "nav",
    "risk_stats": "risk",
    "ranks": "rank",
    "holdings": "hold",
    "category_returns": "cat",
}


def _detect_feed_type(filename: str) -> Optional[str]:
    """Detect feed type from filename."""
    name = filename.lower()
    for feed_type, pattern in FEED_PATTERNS.items():
        if pattern in name:
            return feed_type
    return None


class BackfillRunner:
    """Processes historical CSV files in correct order with chunked processing."""

    def __init__(self, db_session: object) -> None:
        self._db_session = db_session
        self.chunk_size = 50000

    def run(self, data_dir: str) -> dict:
        """Run backfill from a directory of CSVs.

        Raises FileNotFoundError if directory doesn't exist.
        Returns summary dict.
        """
        dir_path = Path(data_dir)
        if not dir_path.exists():
            raise FileNotFoundError(f"Data directory not found: {data_dir}")

        csv_files = sorted(dir_path.glob("*.csv"))
        if not csv_files:
            logger.info("No CSV files found in %s", data_dir)
            return {"files_processed": 0, "status": "COMPLETED", "results": []}

        # Group files by type
        typed_files: dict[str, list[Path]] = {}
        for f in csv_files:
            ft = _detect_feed_type(f.name)
            if ft:
                typed_files.setdefault(ft, []).append(f)
            else:
                logger.warning("Unknown feed type: %s", f.name)

        # Process in order: master first for FK integrity
        results = []
        for feed_type in FEED_TYPE_ORDER:
            for file_path in typed_files.get(feed_type, []):
                logger.info("Processing %s as %s", file_path.name, feed_type)
                result = self._process_single_file(str(file_path), feed_type)
                results.append(result)

        return {
            "files_processed": len(results),
            "status": "COMPLETED",
            "results": results,
        }

    def _process_single_file(self, file_path: str, feed_type: str) -> dict:
        """Process a single CSV file using the ingestion service."""
        from app.services.ingestion_service import IngestionService

        start = time.monotonic()
        try:
            svc = IngestionService(self._db_session)
            dispatch = {
                "master": svc.ingest_master_feed,
                "nav": svc.ingest_nav_feed,
                "risk_stats": svc.ingest_risk_stats_feed,
                "ranks": svc.ingest_rank_feed,
                "holdings": svc.ingest_holdings_feed,
                "category_returns": svc.ingest_category_returns_feed,
            }
            ingest_fn = dispatch.get(feed_type)
            if not ingest_fn:
                return {"file": file_path, "status": "SKIPPED", "error": f"Unknown type: {feed_type}"}

            result = ingest_fn(file_path)
            duration_ms = int((time.monotonic() - start) * 1000)
            return {
                "file": file_path,
                "feed_type": feed_type,
                "status": result.status,
                "rows": result.inserted + result.updated,
                "duration_ms": duration_ms,
            }
        except Exception as e:
            logger.error("Failed to process %s: %s", file_path, e)
            return {"file": file_path, "status": "FAILED", "error": str(e)}


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Historical data backfill for MF Pulse")
    parser.add_argument("--dir", required=True, help="Directory containing CSV files")
    parser.add_argument("--chunk-size", type=int, default=50000, help="Rows per batch")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    # Import here to allow --help without DB
    import os
    os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        runner = BackfillRunner(db)
        runner.chunk_size = args.chunk_size
        result = runner.run(args.dir)
        print(f"\nBackfill complete: {result['files_processed']} files processed")
        for r in result.get("results", []):
            status = r.get("status", "UNKNOWN")
            print(f"  {r.get('file', 'unknown')}: {status}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
