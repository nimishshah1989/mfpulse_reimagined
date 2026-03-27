#!/usr/bin/env python3
"""Validate field_maps.py against Morningstar data-point documentation.

Reads the official Excel spec (docs/morningstar_data_points_v2.xlsx) and
compares every documented datapoint name against our field_maps.py.

Prints:
  - Fields we map that exist in the docs  (MATCHED)
  - Fields in the docs that we don't map  (UNMAPPED)
  - Fields in our maps not found in docs   (EXTRA — possible typos)

Usage:
    python3 scripts/validate_morningstar_fields.py

Requires: openpyxl (pip install openpyxl)
"""

from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl required. Run: pip install openpyxl")
    sys.exit(1)

# Add backend to sys.path so we can import field_maps
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.ingestion.field_maps import (
    MASTER_FIELD_MAP,
    NAV_FIELD_MAP,
    RISK_STATS_FIELD_MAP,
    RANK_FIELD_MAP,
    HOLDINGS_FIELD_MAP,
    HOLDING_DETAIL_FIELD_MAP,
    SECTOR_EXPOSURE_MAP,
    CATEGORY_RETURNS_FIELD_MAP,
    MASTER_FIELDS_SKIPPED,
)

EXCEL_PATH = Path(__file__).resolve().parent.parent / "docs" / "morningstar_data_points_v2.xlsx"

# ── Sections within each Excel sheet ─────────────────────────────────────────
# The Excel has subsections separated by blank/header rows.
# We tag each datapoint with which logical section it belongs to.

SECTION_MAP = {
    "Operations - MasterFile": {
        "description": "Fund master data (identifiers, classification, costs, strategy, managers, etc.)",
        "our_maps": {
            "MASTER_FIELD_MAP": MASTER_FIELD_MAP,
        },
    },
    "Performance- DR (Daily Returns)": {
        "description": "NAV, returns, ranks, category returns, risk statistics",
        "our_maps": {
            "NAV_FIELD_MAP": NAV_FIELD_MAP,
            "RISK_STATS_FIELD_MAP": RISK_STATS_FIELD_MAP,
            "RANK_FIELD_MAP": RANK_FIELD_MAP,
            "CATEGORY_RETURNS_FIELD_MAP": CATEGORY_RETURNS_FIELD_MAP,
        },
    },
}

# Datapoint names that are structural/metadata, not real data fields
KNOWN_STRUCTURAL = {
    "Mornigstar datapoint name",  # sic — it's a header row repeated
    "SecId", "SecID", "MStarID",  # identifiers handled separately
    "CurrencyId", "MonthEndDate", "EndDate",  # metadata/keys
    "None",  # blank rows in Excel
}

# Fields in our maps that won't appear in the Excel because they come from
# different feeds or are constructed from sub-elements
EXPECTED_EXTRA = {
    # Holdings & sector exposure come from a separate feed/portal section
    "HOLDINGS_FIELD_MAP",
    "HOLDING_DETAIL_FIELD_MAP",
    "SECTOR_EXPOSURE_MAP",
}


def load_excel_datapoints(path: Path) -> dict[str, list[dict[str, str]]]:
    """Read the Excel and return {sheet_name: [{datapoint, field_name, freq}, ...]}."""
    wb = openpyxl.load_workbook(str(path), read_only=True)
    result: dict[str, list[dict[str, str]]] = {}

    for sheet_name in ["Operations - MasterFile", "Performance- DR (Daily Returns)"]:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        entries: list[dict[str, str]] = []

        for row in rows[1:]:  # skip header
            if len(row) < 5:
                continue
            datapoint = str(row[4]).strip() if row[4] else "None"
            field_name = str(row[0]).strip() if row[0] else "None"
            freq = str(row[6]).strip() if len(row) > 6 and row[6] else ""

            if datapoint == "None" or field_name == "None":
                continue
            if datapoint == "Mornigstar datapoint name":
                continue  # repeated header row

            entries.append({
                "datapoint": datapoint,
                "field_name": field_name,
                "frequency": freq,
            })

        result[sheet_name] = entries

    wb.close()
    return result


def compare_map_vs_excel(
    map_name: str,
    field_map: dict[str, str],
    excel_datapoints: set[str],
) -> dict:
    """Compare a single field map against the set of Excel datapoints."""
    map_keys = set(field_map.keys())
    matched = map_keys & excel_datapoints
    extra_in_map = map_keys - excel_datapoints
    return {
        "map_name": map_name,
        "total_in_map": len(field_map),
        "matched": sorted(matched),
        "extra_in_map": sorted(extra_in_map),
    }


def main() -> None:
    if not EXCEL_PATH.exists():
        print(f"ERROR: Excel not found at {EXCEL_PATH}")
        sys.exit(1)

    print("=" * 80)
    print("MORNINGSTAR FIELD VALIDATION — Excel Documentation vs field_maps.py")
    print(f"Excel: {EXCEL_PATH.name}")
    print("=" * 80)

    # Load all datapoints from Excel
    excel_data = load_excel_datapoints(EXCEL_PATH)

    # Build a flat set of all datapoint names per sheet
    all_excel_datapoints: set[str] = set()
    sheet_datapoints: dict[str, set[str]] = {}
    sheet_detail: dict[str, dict[str, str]] = {}  # datapoint → field_name

    for sheet_name, entries in excel_data.items():
        dp_set: set[str] = set()
        for e in entries:
            dp = e["datapoint"]
            dp_set.add(dp)
            all_excel_datapoints.add(dp)
            sheet_detail[dp] = e["field_name"]
        sheet_datapoints[sheet_name] = dp_set
        print(f"\n  {sheet_name}: {len(dp_set)} unique datapoints")

    print(f"\n  Total unique datapoints across sheets: {len(all_excel_datapoints)}")

    # ── Per-sheet comparison ──────────────────────────────────────────────────
    print("\n" + "=" * 80)
    print("PER-MAP COMPARISON")
    print("=" * 80)

    all_our_keys: set[str] = set()
    total_matched = 0
    total_extra = 0

    for sheet_name, config in SECTION_MAP.items():
        dp_set = sheet_datapoints.get(sheet_name, set())

        for map_name, field_map in config["our_maps"].items():
            result = compare_map_vs_excel(map_name, field_map, all_excel_datapoints)
            all_our_keys.update(field_map.keys())
            total_matched += len(result["matched"])
            total_extra += len(result["extra_in_map"])

            pct = (
                len(result["matched"]) / result["total_in_map"] * 100
                if result["total_in_map"] > 0
                else 0
            )

            print(f"\n{'─' * 60}")
            print(f"MAP: {map_name} ({result['total_in_map']} entries)")
            print(f"Sheet: {sheet_name}")
            print(f"Coverage: {len(result['matched'])}/{result['total_in_map']} ({pct:.0f}%)")

            if result["matched"]:
                print(f"\n  MATCHED ({len(result['matched'])} fields):")
                for f in result["matched"]:
                    db_col = field_map[f]
                    excel_name = sheet_detail.get(f, "?")
                    print(f"    OK  {f:45s} → {db_col:30s} (Excel: {excel_name})")

            if result["extra_in_map"]:
                print(f"\n  IN OUR MAP BUT NOT IN EXCEL ({len(result['extra_in_map'])} fields):")
                for f in result["extra_in_map"]:
                    db_col = field_map[f]
                    print(f"    ??  {f:45s} → {db_col}")

    # ── Holdings/Sector maps (not in the Excel sheets we parsed) ──────────────
    print(f"\n{'─' * 60}")
    print("HOLDINGS + SECTOR MAPS (separate feed, not in this Excel)")
    print(f"  HOLDINGS_FIELD_MAP: {len(HOLDINGS_FIELD_MAP)} entries")
    print(f"  HOLDING_DETAIL_FIELD_MAP: {len(HOLDING_DETAIL_FIELD_MAP)} entries")
    print(f"  SECTOR_EXPOSURE_MAP: {len(SECTOR_EXPOSURE_MAP)} entries")
    print("  (These come from a different Morningstar feed/portal section)")

    # ── Unmapped: fields Morningstar provides but we skip ─────────────────────
    print("\n" + "=" * 80)
    print("UNMAPPED — Morningstar fields we DON'T map (potential additions)")
    print("=" * 80)

    skipped_names = {s["field"] for s in MASTER_FIELDS_SKIPPED}
    unmapped = all_excel_datapoints - all_our_keys - KNOWN_STRUCTURAL - skipped_names

    # Group by sheet
    for sheet_name, dp_set in sheet_datapoints.items():
        sheet_unmapped = dp_set - all_our_keys - KNOWN_STRUCTURAL - skipped_names
        if not sheet_unmapped:
            print(f"\n  {sheet_name}: all fields mapped or documented as skipped!")
            continue

        print(f"\n  {sheet_name} ({len(sheet_unmapped)} unmapped):")
        for dp in sorted(sheet_unmapped):
            excel_name = sheet_detail.get(dp, "?")
            print(f"    -  {dp:50s} ({excel_name})")

    # ── Documented skips ──────────────────────────────────────────────────────
    print(f"\n{'─' * 60}")
    print(f"DOCUMENTED SKIPS (MASTER_FIELDS_SKIPPED): {len(MASTER_FIELDS_SKIPPED)} fields")
    for s in MASTER_FIELDS_SKIPPED:
        in_excel = "IN EXCEL" if s["field"] in all_excel_datapoints else "NOT IN EXCEL"
        print(f"    SKIP  {s['field']:40s} {in_excel}  — {s['reason']}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"  Excel datapoints (unique):         {len(all_excel_datapoints)}")
    print(f"  Our field_map keys (unique):        {len(all_our_keys)}")
    print(f"  Matched (in both):                  {total_matched}")
    print(f"  In our maps, not in Excel:          {total_extra}")
    print(f"  In Excel, not in any map or skip:   {len(unmapped)}")
    print(f"  Documented skips:                   {len(MASTER_FIELDS_SKIPPED)}")

    coverage = total_matched / len(all_our_keys) * 100 if all_our_keys else 0
    print(f"\n  Overall field map validation rate:   {coverage:.0f}%")

    if total_extra > 0:
        print(f"\n  WARNING: {total_extra} fields in our maps not found in Excel.")
        print("  These may use variant spellings or come from different documentation.")

    if unmapped:
        print(f"\n  INFO: {len(unmapped)} Excel fields not in any map.")
        print("  Review the UNMAPPED section above to decide if any should be added.")


if __name__ == "__main__":
    main()
