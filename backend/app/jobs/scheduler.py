"""APScheduler integration — scheduled jobs for data refresh and lens recomputation."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Callable, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session, sessionmaker

from app.models.db.system import AuditTrail

logger = logging.getLogger(__name__)

# Valid job names for manual triggering
VALID_JOBS = frozenset({
    "nav_feeds",
    "master_feed",
    "monthly_feeds",
    "lens_recompute",
    "marketpulse_sync",
    "expire_overrides",
})

# Job schedule descriptions
JOB_SCHEDULES = {
    "nav_feeds": "Daily 9:30 PM IST",
    "master_feed": "Weekly Mon 7:00 AM IST",
    "monthly_feeds": "Monthly 6th BD 9:00 AM IST",
    "lens_recompute": "Monthly 7th BD 9:00 AM IST",
    "marketpulse_sync": "Daily 9:45 PM IST",
    "expire_overrides": "Daily midnight IST",
}


class JobScheduler:
    """Manages APScheduler jobs for MF Pulse data pipelines."""

    def __init__(self, db_session_factory: sessionmaker) -> None:
        self._db_session_factory = db_session_factory
        self._scheduler: Optional[BackgroundScheduler] = None

    def start(self) -> None:
        """Start the scheduler with all registered jobs."""
        if self._scheduler and self._scheduler.running:
            logger.warning("Scheduler already running")
            return

        self._scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

        # Daily 9:30 PM IST — process NAV feeds
        self._scheduler.add_job(
            lambda: self._run_with_audit("nav_feeds", self.job_process_nav_feeds),
            CronTrigger(hour=21, minute=30),
            id="nav_feeds",
            replace_existing=True,
        )

        # Daily 9:45 PM IST — sync MarketPulse signals
        self._scheduler.add_job(
            lambda: self._run_with_audit("marketpulse_sync", self.job_sync_marketpulse),
            CronTrigger(hour=21, minute=45),
            id="marketpulse_sync",
            replace_existing=True,
        )

        # Weekly Mon 7 AM IST — process master feed
        self._scheduler.add_job(
            lambda: self._run_with_audit("master_feed", self.job_process_master_feed),
            CronTrigger(day_of_week="mon", hour=7, minute=0),
            id="master_feed",
            replace_existing=True,
        )

        # Monthly 6th 9 AM IST — process risk stats + ranks + holdings
        self._scheduler.add_job(
            lambda: self._run_with_audit("monthly_feeds", self.job_process_monthly_feeds),
            CronTrigger(day=6, hour=9, minute=0),
            id="monthly_feeds",
            replace_existing=True,
        )

        # Monthly 7th 9 AM IST — recompute lens scores
        self._scheduler.add_job(
            lambda: self._run_with_audit("lens_recompute", self.job_recompute_lens_scores),
            CronTrigger(day=7, hour=9, minute=0),
            id="lens_recompute",
            replace_existing=True,
        )

        # Daily midnight IST — expire stale overrides
        self._scheduler.add_job(
            lambda: self._run_with_audit("expire_overrides", self.job_expire_overrides),
            CronTrigger(hour=0, minute=0),
            id="expire_overrides",
            replace_existing=True,
        )

        self._scheduler.start()
        logger.info("Job scheduler started with %d jobs", len(VALID_JOBS))

    def stop(self) -> None:
        """Stop the scheduler gracefully."""
        if self._scheduler and self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("Job scheduler stopped")

    def trigger_job(self, job_name: str) -> bool:
        """Manually trigger a job by name. Returns False if job name is invalid."""
        if job_name not in VALID_JOBS:
            return False

        job_map: dict[str, Callable] = {
            "nav_feeds": self.job_process_nav_feeds,
            "master_feed": self.job_process_master_feed,
            "monthly_feeds": self.job_process_monthly_feeds,
            "lens_recompute": self.job_recompute_lens_scores,
            "marketpulse_sync": self.job_sync_marketpulse,
            "expire_overrides": self.job_expire_overrides,
        }

        func = job_map[job_name]
        self._run_with_audit(job_name, func)
        return True

    def get_job_status(self) -> list[dict]:
        """Return status of all registered jobs."""
        statuses = []
        for job_name, schedule in JOB_SCHEDULES.items():
            status_entry: dict = {
                "job_name": job_name,
                "schedule": schedule,
                "next_run": None,
                "last_status": None,
            }
            if self._scheduler:
                job = self._scheduler.get_job(job_name)
                if job and job.next_run_time:
                    status_entry["next_run"] = job.next_run_time.isoformat()
            statuses.append(status_entry)
        return statuses

    def _run_with_audit(self, job_name: str, func: Callable) -> None:
        """Execute a job function with audit trail logging. Never raises."""
        db: Session = self._db_session_factory()
        try:
            # Log start
            start_entry = AuditTrail(
                actor="scheduler",
                action="JOB_STARTED",
                entity_type="job",
                entity_id=job_name,
                details={"job_name": job_name},
                timestamp=datetime.now(timezone.utc),
            )
            db.add(start_entry)
            db.commit()

            # Execute
            func()

            # Log completion
            end_entry = AuditTrail(
                actor="scheduler",
                action="JOB_COMPLETED",
                entity_type="job",
                entity_id=job_name,
                details={"job_name": job_name, "status": "SUCCESS"},
                timestamp=datetime.now(timezone.utc),
            )
            db.add(end_entry)
            db.commit()
            logger.info("Job %s completed successfully", job_name)

        except Exception as e:
            logger.error("Job %s failed: %s", job_name, e)
            try:
                db.rollback()
                error_entry = AuditTrail(
                    actor="scheduler",
                    action="JOB_FAILED",
                    entity_type="job",
                    entity_id=job_name,
                    details={"job_name": job_name, "error": str(e)},
                    timestamp=datetime.now(timezone.utc),
                )
                db.add(error_entry)
                db.commit()
            except Exception as audit_err:
                logger.error("Failed to log job failure audit: %s", audit_err)
        finally:
            db.close()

    def job_process_nav_feeds(self) -> None:
        """Process new NAV CSV feeds."""
        from app.core.config import get_settings
        from app.services.ingestion_service import IngestionService

        db = self._db_session_factory()
        try:
            svc = IngestionService(db)
            settings = get_settings()
            results = svc.ingest_all_pending(settings.feed_csv_dir)
            logger.info("NAV feeds processed: %d files", len(results))
        finally:
            db.close()

    def job_process_master_feed(self) -> None:
        """Process master feed CSV."""
        from app.core.config import get_settings
        from app.services.ingestion_service import IngestionService

        db = self._db_session_factory()
        try:
            svc = IngestionService(db)
            settings = get_settings()
            results = svc.ingest_all_pending(settings.feed_csv_dir)
            logger.info("Master feed processed: %d files", len(results))
        finally:
            db.close()

    def job_process_monthly_feeds(self) -> None:
        """Process risk stats, ranks, holdings feeds."""
        from app.core.config import get_settings
        from app.services.ingestion_service import IngestionService

        db = self._db_session_factory()
        try:
            svc = IngestionService(db)
            settings = get_settings()
            results = svc.ingest_all_pending(settings.feed_csv_dir)
            logger.info("Monthly feeds processed: %d files", len(results))
        finally:
            db.close()

    def job_recompute_lens_scores(self) -> None:
        """Recompute all lens scores across all categories."""
        from app.services.lens_service import LensService

        db = self._db_session_factory()
        try:
            svc = LensService(db)
            result = svc.compute_all_categories()
            logger.info("Lens recompute: %s", result)
        finally:
            db.close()

    def job_sync_marketpulse(self) -> None:
        """Cache breadth, sentiment, and sector data from MarketPulse."""
        from app.core.config import get_settings
        from app.services.marketpulse_client import MarketPulseClient

        settings = get_settings()
        client = MarketPulseClient(
            base_url=settings.marketpulse_base_url,
            timeout=settings.marketpulse_timeout_seconds,
        )
        # Force-refresh cache by calling each endpoint
        client.get_breadth_history()
        client.get_sentiment()
        client.get_sector_scores()
        logger.info("MarketPulse signals synced")

    def job_expire_overrides(self) -> None:
        """Expire stale FM overrides."""
        from app.services.override_service import OverrideService

        db = self._db_session_factory()
        try:
            svc = OverrideService(db)
            count = svc.expire_stale_overrides()
            logger.info("Expired %d stale overrides", count)
        finally:
            db.close()
