"""Discover which Morningstar API endpoint returns historical daily NAV data.

Tests multiple URL patterns against F00000VSLQ (HDFC Flexi Cap),
date range 2024-01-01 to 2024-01-10. Prints full responses.
"""

import os
import sys

import httpx

# Load env
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

from app.core.config import get_settings

settings = get_settings()
ACCESS_CODE = settings.morningstar_access_code
MSTAR_ID = "F00000VSLQ"
START = "2024-01-01"
END = "2024-01-10"

# Known hashes from morningstar_config.py
NAV_HASH = "n0fys3tcvprq4375"
BULK_NAV_HASH = "lb6euvwac479lomk"
UNIVERSE_CODE = "hoi7dvf1dvm67w36"


def test_url(label: str, url: str) -> None:
    """Fetch a URL and print status + first 2000 chars of response."""
    print(f"\n{'='*80}")
    print(f"TEST: {label}")
    print(f"URL:  {url[:120]}...")
    print(f"{'='*80}")
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(url)
            print(f"Status: {resp.status_code}")
            print(f"Content-Type: {resp.headers.get('content-type', 'unknown')}")
            body = resp.text[:2000]
            print(f"Body ({len(resp.text)} chars total):\n{body}")
    except Exception as e:
        print(f"ERROR: {e}")


def main() -> None:
    if not ACCESS_CODE:
        print("ERROR: MORNINGSTAR_ACCESS_CODE not set in .env")
        sys.exit(1)

    print(f"Access code: {ACCESS_CODE[:8]}...")
    print(f"Testing against mstar_id={MSTAR_ID}, {START} to {END}")

    # Pattern 1: DailyReturnIndex v1
    test_url(
        "DailyReturnIndex v1",
        f"https://api.morningstar.com/service/mf/DailyReturnIndex/mstarid/{MSTAR_ID}"
        f"?accesscode={ACCESS_CODE}&startdate={START}&enddate={END}&frequency=D",
    )

    # Pattern 2: DailyReturnIndex v2
    test_url(
        "DailyReturnIndex v2",
        f"https://api.morningstar.com/v2/service/mf/DailyReturnIndex/mstarid/{MSTAR_ID}"
        f"?accesscode={ACCESS_CODE}&startdate={START}&enddate={END}&frequency=D",
    )

    # Pattern 3: NAV hash per-fund v1
    test_url(
        "NAV hash per-fund v1",
        f"https://api.morningstar.com/service/mf/{NAV_HASH}/mstarid/{MSTAR_ID}"
        f"?accesscode={ACCESS_CODE}&startdate={START}&enddate={END}&frequency=D",
    )

    # Pattern 4: NAV hash per-fund v2
    test_url(
        "NAV hash per-fund v2",
        f"https://api.morningstar.com/v2/service/mf/{NAV_HASH}/mstarid/{MSTAR_ID}"
        f"?accesscode={ACCESS_CODE}&startdate={START}&enddate={END}&frequency=D",
    )

    # Pattern 5: Bulk NAV hash per-fund v2
    test_url(
        "Bulk NAV hash per-fund v2",
        f"https://api.morningstar.com/v2/service/mf/{BULK_NAV_HASH}/mstarid/{MSTAR_ID}"
        f"?accesscode={ACCESS_CODE}&startdate={START}&enddate={END}&frequency=D",
    )

    # Pattern 6: Bulk universe with date range
    test_url(
        "Bulk universe with date params",
        f"https://api.morningstar.com/v2/service/mf/{NAV_HASH}/universeid/{UNIVERSE_CODE}"
        f"?accesscode={ACCESS_CODE}&startdate={START}&enddate={END}&frequency=D",
    )

    # Pattern 7: Bulk NAV hash universe with date range
    test_url(
        "Bulk NAV hash + universe + dates",
        f"https://api.morningstar.com/v2/service/mf/{BULK_NAV_HASH}/universeid/{UNIVERSE_CODE}"
        f"?accesscode={ACCESS_CODE}&startdate={START}&enddate={END}&frequency=D",
    )


if __name__ == "__main__":
    main()
