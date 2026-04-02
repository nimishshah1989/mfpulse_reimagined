"""Jobs API — manual trigger and status endpoints."""

from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])

# Module-level scheduler reference, set by main.py lifespan
_scheduler = None


def set_scheduler(scheduler: object) -> None:
    """Set the module-level scheduler reference."""
    global _scheduler
    _scheduler = scheduler


def get_scheduler() -> Optional[object]:
    """Get the current scheduler (or None)."""
    return _scheduler


@router.post("/trigger/{job_name}")
def trigger_job(job_name: str) -> dict:
    """Manually trigger a scheduled job."""
    sched = get_scheduler()
    if sched is None:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "SCHEDULER_UNAVAILABLE",
                    "message": "Scheduler is not running",
                    "details": {},
                },
            },
        )

    success = sched.trigger_job(job_name)
    if not success:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "INVALID_JOB",
                    "message": f"Unknown job: {job_name}",
                    "details": {"valid_jobs": list(sched.get_job_status())},
                },
            },
        )

    return JSONResponse(
        status_code=202,
        content={
            "success": True,
            "data": {"job_name": job_name, "status": "accepted"},
            "error": None,
        },
    )


@router.get("/status")
def job_status() -> dict:
    """All jobs with schedule, next_run, last_status."""
    sched = get_scheduler()
    if sched is None:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "SCHEDULER_UNAVAILABLE",
                    "message": "Scheduler is not running",
                    "details": {},
                },
            },
        )

    return {
        "success": True,
        "data": sched.get_job_status(),
        "error": None,
    }
