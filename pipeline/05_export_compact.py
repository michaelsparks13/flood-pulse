"""
Step 5: Export compact JSON for deck.gl H3HexagonLayer.

Reads hex aggregates and outputs a minimal columnar JSON file
containing only H3 indices and properties (no geometry).
deck.gl reconstructs hex geometry on the GPU from the index alone.

Output:
  - hex_compact.json (~8 MB uncompressed, ~1.5 MB gzipped)
"""

from __future__ import annotations

import json
import logging
import shutil
import sys
import time

import h3
import pandas as pd

from config import (
    FINAL,
    HEX_AGGREGATES_PARQUET,
    HEX_COMPACT_JSON,
    MAX_YEAR,
    ensure_dirs,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
log = logging.getLogger(__name__)

# Where the Next.js app serves static data from
PUBLIC_DATA = FINAL.parent.parent.parent / "public" / "data"


def is_antimeridian(h3_index: str) -> bool:
    """Check if an H3 hex straddles the antimeridian."""
    boundary = h3.cell_to_boundary(h3_index)
    lngs = [lng for _, lng in boundary]
    return (max(lngs) - min(lngs)) > 180


def main() -> None:
    ensure_dirs()

    if not HEX_AGGREGATES_PARQUET.exists():
        log.error(f"Hex aggregates not found: {HEX_AGGREGATES_PARQUET}")
        log.info("Run 03_aggregate.py first")
        sys.exit(1)

    t0 = time.time()

    df = pd.read_parquet(HEX_AGGREGATES_PARQUET)
    log.info(f"Read {len(df):,} hexes from parquet")

    # Defensive clamp: drop hexes whose first-flood year is past MAX_YEAR
    # (should be zero if 03_aggregate was run with the same MAX_YEAR).
    before = len(df)
    df = df[df["first_flood_year"] <= MAX_YEAR].copy()
    # Clamp last-flood year to MAX_YEAR for any stragglers
    df["last_flood_year"] = df["last_flood_year"].clip(upper=MAX_YEAR)
    if before != len(df):
        log.info(f"Dropped {before - len(df):,} hexes with y0 > {MAX_YEAR}")

    columns = ["h", "m", "yf", "p", "y0", "y1", "cc", "ft", "rp"]
    rows = []
    skipped = 0

    for _, row in df.iterrows():
        h3_index = row["h3_index"]

        # Skip antimeridian-crossing hexes (same as 04_generate_tiles.py)
        if is_antimeridian(h3_index):
            skipped += 1
            continue

        rows.append([
            h3_index,
            int(row["total_months_flooded"]),
            int(row["total_years_flooded"]),
            round(float(row["population"])),
            int(row["first_flood_year"]),
            int(row["last_flood_year"]),
            row["country_code"],
            round(float(row.get("frequency_trend", 0)), 1),
            round(float(row.get("return_period", 0)), 1),
        ])

    compact = {"columns": columns, "rows": rows}

    with open(HEX_COMPACT_JSON, "w") as f:
        json.dump(compact, f, separators=(",", ":"))

    size_mb = HEX_COMPACT_JSON.stat().st_size / 1_048_576
    log.info(
        f"Wrote {HEX_COMPACT_JSON} "
        f"({size_mb:.1f} MB, {len(rows):,} hexes, {skipped} antimeridian skipped)"
    )

    # Copy to public/data for the frontend
    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    dest = PUBLIC_DATA / "hex_compact.json"
    shutil.copy2(HEX_COMPACT_JSON, dest)
    log.info(f"Copied to {dest}")

    log.info(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
