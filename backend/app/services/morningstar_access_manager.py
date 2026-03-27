"""Morningstar access code lifecycle management.

Checks if current code is valid, creates new one before expiry,
updates the running config. Codes expire every 90 days.
"""

import logging
from typing import Optional
from xml.etree import ElementTree as ET

import httpx

from app.core.config import get_settings
from app.core.morningstar_config import ACCESS_CODE_CREATE_URL, ACCESS_CODE_VERIFY_URL

logger = logging.getLogger(__name__)


class AccessCodeManager:
    """Manages Morningstar access code lifecycle."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._access_code = self.settings.morningstar_access_code
        self._account_code = self.settings.morningstar_username
        self._account_password = self.settings.morningstar_password
        self._timeout = 30

    def verify_current(self) -> dict:
        """Check if current access code is valid.

        Returns dict with keys: valid (bool), expires (str|None),
        days_remaining (int|None), error (str|None).
        """
        try:
            url = ACCESS_CODE_VERIFY_URL.format(accesscode=self._access_code)
            response = httpx.get(url, timeout=self._timeout)

            root = ET.fromstring(response.content)
            status_code = root.findtext(".//status/code")

            if status_code != "0":
                msg = root.findtext(".//status/message") or "Unknown"
                return {"valid": False, "expires": None, "days_remaining": None, "error": msg}

            expires = root.findtext(".//ExpirationDate")
            days_str = root.findtext(".//DaysRemaining")
            days_remaining = int(days_str) if days_str else None

            return {
                "valid": True,
                "expires": expires,
                "days_remaining": days_remaining,
            }
        except Exception as e:
            logger.warning("Failed to verify access code: %s", e)
            return {"valid": False, "expires": None, "days_remaining": None, "error": str(e)}

    def create_new(self, days: int = 90) -> Optional[str]:
        """Create a new access code. Returns the code string, or None on failure."""
        try:
            url = ACCESS_CODE_CREATE_URL.format(days=days)
            params = {
                "account_code": self._account_code,
                "account_password": self._account_password,
            }
            response = httpx.post(url, params=params, timeout=self._timeout)

            root = ET.fromstring(response.content)
            status_code = root.findtext(".//status/code")

            if status_code != "0":
                msg = root.findtext(".//status/message") or "Unknown"
                logger.error("Failed to create access code: %s", msg)
                return None

            new_code = root.findtext(".//Accesscode")
            if new_code:
                logger.info("New Morningstar access code created (expires in %d days)", days)
                return new_code
            return None
        except Exception as e:
            logger.error("Error creating access code: %s", e)
            return None

    def rotate_if_needed(self, min_days: int = 7) -> None:
        """Auto-rotate access code if fewer than min_days remain."""
        info = self.verify_current()
        if not info.get("valid"):
            logger.warning("Current access code is invalid — attempting rotation")
            new_code = self.create_new(90)
            if new_code:
                self._access_code = new_code
            return

        days_remaining = info.get("days_remaining")
        if days_remaining is not None and days_remaining < min_days:
            logger.info("Access code expires in %d days — rotating", days_remaining)
            new_code = self.create_new(90)
            if new_code:
                self._access_code = new_code
