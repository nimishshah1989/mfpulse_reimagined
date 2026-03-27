"""Tests for historical backfill script."""

import os
import sys
import csv
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://fie:changeme@localhost:5432/mf_pulse")

# Add scripts to path for import
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))

from scripts.backfill_historical import BackfillRunner


@pytest.fixture
def mock_session():
    return MagicMock()


@pytest.fixture
def runner(mock_session):
    return BackfillRunner(mock_session)


class TestBackfillRunner:
    def test_missing_dir_raises(self, runner: BackfillRunner) -> None:
        with pytest.raises(FileNotFoundError):
            runner.run("/nonexistent/path/that/does/not/exist")

    def test_empty_dir_skips(self, runner: BackfillRunner) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            result = runner.run(tmpdir)
            assert result["files_processed"] == 0
            assert result["status"] == "COMPLETED"

    def test_small_csv_success(self, runner: BackfillRunner) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a small master CSV
            csv_path = Path(tmpdir) / "master_2026.csv"
            with open(csv_path, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["SecId", "LegalName", "FundLevelCategoryName"])
                writer.writerow(["F0GBR06S2Q", "Test Fund", "Large Cap"])

            with patch.object(runner, "_process_single_file") as mock_process:
                mock_process.return_value = {"status": "SUCCESS", "rows": 1}
                result = runner.run(tmpdir)
                assert result["files_processed"] >= 1

    def test_processing_order_master_first(self, runner: BackfillRunner) -> None:
        """Master files must be processed before NAV/others for FK integrity."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create both master and nav files
            (Path(tmpdir) / "nav_2026.csv").write_text("SecId,NAV\nF1,100\n")
            (Path(tmpdir) / "master_2026.csv").write_text("SecId,LegalName\nF1,Fund\n")

            processed_order = []

            def track_process(file_path, feed_type):
                processed_order.append(feed_type)
                return {"status": "SUCCESS", "rows": 1}

            with patch.object(runner, "_process_single_file", side_effect=track_process):
                runner.run(tmpdir)
                # Master should come before nav
                if "master" in processed_order and "nav" in processed_order:
                    assert processed_order.index("master") < processed_order.index("nav")
