"""APScheduler integration — scheduled jobs for data refresh and lens recomputation."""

from __future__ import annotations

import logging
import threading
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
    "fetch_nav",
    "fetch_full",
    "sector_rotation",
    "aum_sync",
    "cache_warm",
    "cache_cleanup",
})

# Job schedule descriptions
JOB_SCHEDULES = {
    "nav_feeds": "Daily 9:30 PM IST",
    "master_feed": "Weekly Mon 7:00 AM IST",
    "monthly_feeds": "Monthly 6th BD 9:00 AM IST",
    "lens_recompute": "Monthly 7th BD 9:00 AM IST",
    "marketpulse_sync": "Daily 9:45 PM IST",
    "expire_overrides": "Daily midnight IST",
    "fetch_nav": "Daily 10:00 PM IST (API)",
    "fetch_full": "Weekly Sun 11:00 PM IST (API)",
    "sector_rotation": "Monthly 8th 10:00 AM IST",
    "aum_sync": "Daily 10:30 PM IST",
    "cache_warm": "Daily 10:45 PM IST + 6:15 AM IST",
    "cache_cleanup": "Daily 3:00 AM IST",
}

# Common job kwargs: prevent overlap, coalesce missed triggers, 5 min grace
_JOB_OPTS = dict(max_instances=1, coalesce=True, misfire_grace_time=300)


class JobScheduler:
    """Manages APScheduler jobs for MF Pulse data pipelines."""

    def __init__(self, db_session_factory: sessionmaker) -> None:
        self._db_session_factory = db_session_factory
        self._scheduler: Optional[BackgroundScheduler] = None
        self._running_jobs: set[str] = set()
        self._running_lock = threading.Lock()

    def start(self) -> None:
        """Start the scheduler with all registered jobs."""
        if self._scheduler and self._scheduler.running:
            logger.warning("Scheduler already running")
            return

        self._scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

        # Daily 9:30 PM IST — process NAV CSV feeds
        self._scheduler.add_job(
            lambda: self._run_with_audit("nav_feeds", self.job_process_nav_feeds),
            CronTrigger(hour=21, minute=30),
            id="nav_feeds",
            replace_existing=True,
            **_JOB_OPTS,
        )

        # Daily 9:45 PM IST — sync MarketPulse signals
        self._scheduler.add_job(
            lambda: self._run_with_audit("marketpulse_sync", self.job_sync_marketpulse),
            CronTrigger(hour=21, minute=45),
            id="marketpulse_sync",
            replace_existing=True,
            **_JOB_OPTS,
        )

        # Weekly Mon 7 AM IST — process master feed
        self._scheduler.add_job(
            lambda: self._run_with_audit("master_feed", self.job_process_master_feed),
            CronTrigger(day_of_week="mon", hour=7, minute=0),
            id="master_feed",
            replace_existing=True,
            **_JOB_OPTS,
        )

        # Monthly 6th 9 AM IST — process risk stats + ranks + holdings
        self._scheduler.add_job(
            lambda: self._run_with_audit("monthly_feeds", self.job_process_monthly_feeds),
            CronTrigger(day=6, hour=9, minute=0),
            id="monthly_feeds",
            replace_existing=True,
            **_JOB_OPTS,
        )

        # Monthly 7th 9 AM IST — recompute lens scores
        self._scheduler.add_job(
            lambda: self._run_with_audit("lens_recompute", self.job_recompute_lens_scores),
            CronTrigger(day=7, hour=9, minute=0),
            id="lens_recompute",
            replace_existing=True,
            **_JOB_OPTS,
        )

        # Daily midnight IST — expire stale overrides
        self._scheduler.add_job(
            lambda: self._run_with_audit("expire_overrides", self.job_expire_overrides),
            CronTrigger(hour=0, minute=0),
            id="expire_overrides",
            replace_existing=True,
            **_JOB_OPTS,
        )

        # Daily 10:00 PM IST — fetch NAV + Returns from Morningstar API
        # (30 min after nav_feeds to avoid concurrent writes to nav_daily)
        self._scheduler.add_job(
            lambda: self._run_with_audit("fetch_nav", self.job_fetch_nav),
            CronTrigger(hour=22, minute=0),
            id="fetch_nav",
            replace_existing=True,
            **_JOB_OPTS,
        )

        # Weekly Sunday 11 PM IST — full Morningstar API refresh + lens recompute
        self._scheduler.add_job(
            lambda: self._run_with_audit("fetch_full", self.job_fetch_full),
            CronTrigger(day_of_week="sun", hour=23, minute=0),
            id="fetch_full",
            replace_existing=True,
            **_JOB_OPTS,
        )

        # Monthly 8th 10 AM IST — compute sector rotation from holdings
        self._scheduler.add_job(
            lambda: self._run_with_audit("sector_rotation", self.job_compute_sector_rotation),
            CronTrigger(day=8, hour=10, minute=0),
            id="sector_rotation",
            replace_existing=True,
            **_JOB_OPTS,
        )

        # Daily 10:30 PM IST — sync latest AUM to fund_master
        self._scheduler.add_job(
            lambda: self._run_with_audit("aum_sync", self.job_sync_aum),
            CronTrigger(hour=22, minute=30),
            id="aum_sync",
            replace_existing=True,
            **_JOB_OPTS,
        )

        # Daily 10:45 PM IST + 6:15 AM IST — warm caches
        self._scheduler.add_job(
            lambda: self._run_with_audit("cache_warm", self.job_warm_cache),
            CronTrigger(hour=22, minute=45),
            id="cache_warm_night",
            replace_existing=True,
            **_JOB_OPTS,
        )
        self._scheduler.add_job(
            lambda: self._run_with_audit("cache_warm", self.job_warm_cache),
            CronTrigger(hour=6, minute=15),
            id="cache_warm_morning",
            replace_existing=True,
            **_JOB_OPTS,
        )

        # Daily 3:00 AM IST — clean expired cache entries
        self._scheduler.add_job(
            lambda: self._run_with_audit("cache_cleanup", self.job_cleanup_cache),
            CronTrigger(hour=3, minute=0),
            id="cache_cleanup",
            replace_existing=True,
            **_JOB_OPTS,
        )

        self._scheduler.start()
        logger.info("Job scheduler started with %d jobs", len(VALID_JOBS))

    def stop(self) -> None:
        """Stop the scheduler gracefully."""
        if self._scheduler and self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("Job scheduler stopped")

    def trigger_job(self, job_name: str) -> bool:
        """Manually trigger a job in a background thread.

        Returns True on success, False if invalid name.
        Overlap protection is handled entirely inside _run_with_audit.
        """
        if job_name not in VALID_JOBS:
            return False

        job_map: dict[str, Callable] = {
            "nav_feeds": self.job_process_nav_feeds,
            "master_feed": self.job_process_master_feed,
            "monthly_feeds": self.job_process_monthly_feeds,
            "lens_recompute": self.job_recompute_lens_scores,
            "marketpulse_sync": self.job_sync_marketpulse,
            "expire_overrides": self.job_expire_overrides,
            "fetch_nav": self.job_fetch_nav,
            "fetch_full": self.job_fetch_full,
            "sector_rotation": self.job_compute_sector_rotation,
            "aum_sync": self.job_sync_aum,
            "cache_warm": self.job_warm_cache,
            "cache_cleanup": self.job_cleanup_cache,
        }

        func = job_map[job_name]
        thread = threading.Thread(
            target=self._run_with_audit,
            args=(job_name, func),
            daemon=True,
        )
        thread.start()
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
        """Execute a job function with audit trail logging. Never raises.

        Uses _running_jobs guard to prevent both scheduled and manual
        runs of the same job from overlapping.
        """
        with self._running_lock:
            if job_name in self._running_jobs:
                logger.warning("Skipping %s — already running", job_name)
                return
            self._running_jobs.add(job_name)

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
            with self._running_lock:
                self._running_jobs.discard(job_name)

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
        """Fetch from MarketPulse and persist to kv_cache DB table."""
        from app.core.config import get_settings
        from app.services.marketpulse_client import MarketPulseClient

        settings = get_settings()
        db = self._db_session_factory()
        try:
            client = MarketPulseClient(
                base_url=settings.marketpulse_base_url,
                timeout=min(settings.marketpulse_timeout_seconds, 10),
                db=db,
            )
            results = client.sync_all()
            success = sum(1 for v in results.values() if v)
            logger.info("MarketPulse sync: %d/%d endpoints cached to DB", success, len(results))
        finally:
            db.close()

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

    def job_fetch_nav(self) -> None:
        """Fetch latest NAV and returns from Morningstar API."""
        from app.services.morningstar_fetcher import MorningstarFetcher

        db = self._db_session_factory()
        success = False
        try:
            fetcher = MorningstarFetcher(db)
            results = fetcher.fetch_nav_only()
            for r in results:
                logger.info("Fetch %s: %s (%d funds)", r.api_name, r.status, r.fund_count)
            success = True
        finally:
            db.close()
        # Chain: warm cache only after successful NAV update
        if success:
            self.job_warm_cache()

    def job_compute_sector_rotation(self) -> None:
        """Compute sector rotation from latest Morningstar holdings."""
        from app.services.sector_rotation import SectorRotationService
        db = self._db_session_factory()
        try:
            svc = SectorRotationService(db)
            results = svc.compute_current()
            logger.info("Sector rotation computed: %d sectors", len(results))
        finally:
            db.close()

    def job_fetch_full(self) -> None:
        """Full Morningstar data refresh — master, risk, ranks, everything.

        After full fetch, recompute lens scores.
        """
        from app.services.morningstar_fetcher import MorningstarFetcher
        from app.services.lens_service import LensService

        db = self._db_session_factory()
        success = False
        try:
            fetcher = MorningstarFetcher(db)
            results = fetcher.fetch_all()
            for r in results:
                logger.info("Fetch %s: %s (%d funds)", r.api_name, r.status, r.fund_count)
            # After full fetch, recompute lens scores (same session — data is committed per-batch)
            lens_svc = LensService(db)
            lens_result = lens_svc.compute_all_categories()
            logger.info("Post-fetch lens recompute: %s", lens_result)
            success = True
        finally:
            db.close()
        # Chain only after successful fetch + lens recompute
        if success:
            self.job_sync_aum()
            self.job_warm_cache()

    def job_sync_aum(self) -> None:
        """Sync latest AUM from holdings snapshots to fund_master for fast filtering."""
        from app.services.cache_warmer import CacheWarmer
        db = self._db_session_factory()
        try:
            warmer = CacheWarmer(db)
            count = warmer.sync_latest_aum()
            logger.info("AUM sync complete: %d rows updated", count)
        finally:
            db.close()

    def job_warm_cache(self) -> None:
        """Pre-compute expensive API responses into kv_cache."""
        from app.services.cache_warmer import CacheWarmer
        db = self._db_session_factory()
        try:
            warmer = CacheWarmer(db)
            results = warmer.warm_all()
            ok = sum(1 for v in results.values() if v)
            logger.info("Cache warm: %d/%d succeeded — %s", ok, len(results), results)
        finally:
            db.close()

    def job_cleanup_cache(self) -> None:
        """Delete expired kv_cache entries."""
        from app.repositories.cache_repo import CacheRepository
        db = self._db_session_factory()
        try:
            count = CacheRepository(db).cleanup_expired()
            logger.info("Cache cleanup: %d expired entries removed", count)
        finally:
            db.close()
