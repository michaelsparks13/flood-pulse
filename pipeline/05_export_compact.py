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
    TRAD_HEX_AGGREGATES,
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
    log.info(f"Read {len(df):,} FP hexes from parquet")

    # Defensive clamp: drop hexes whose first-flood year is past MAX_YEAR
    # (should be zero if 03_aggregate was run with the same MAX_YEAR).
    before = len(df)
    df = df[df["first_flood_year"] <= MAX_YEAR].copy()
    # Clamp last-flood year to MAX_YEAR for any stragglers
    df["last_flood_year"] = df["last_flood_year"].clip(upper=MAX_YEAR)
    if before != len(df):
        log.info(f"Dropped {before - len(df):,} hexes with y0 > {MAX_YEAR}")

    # Traditional-database hex set (DFO + GFD + GDACS). Left-join so every
    # FP hex gets trad fields (nullable) and trad-only hexes are appended.
    trad_df: pd.DataFrame | None = None
    if TRAD_HEX_AGGREGATES.exists():
        trad_df = pd.read_parquet(TRAD_HEX_AGGREGATES)
        trad_df["trad_y1"] = trad_df["trad_y1"].clip(upper=MAX_YEAR)
        log.info(f"Read {len(trad_df):,} traditional hexes from parquet")

        merged = df.merge(trad_df, on="h3_index", how="outer", indicator=True)
        only_trad = (merged["_merge"] == "right_only").sum()
        both = (merged["_merge"] == "both").sum()
        log.info(f"  FP+Trad overlap: {both:,}  |  Trad-only: {only_trad:,}")
        df = merged.drop(columns=["_merge"])
    else:
        log.warning(
            f"Traditional aggregates not found at {TRAD_HEX_AGGREGATES} — "
            "proceeding without trad_* fields."
        )
        # Fill placeholder columns so downstream loop is uniform
        for c in ("trad_y0", "trad_y1", "trad_yf", "trad_src", "trad_population"):
            df[c] = None

    # Columns (order matters — frontend reads positional).
    # New trad fields are appended so existing frontend code keeps working.
    columns = [
        "h", "m", "yf", "p", "y0", "y1", "cc", "ft", "rp",
        "trad_y0", "trad_y1", "trad_yf", "trad_p", "trad_src",
    ]
    rows = []
    skipped = 0

    for _, row in df.iterrows():
        h3_index = row["h3_index"]

        # Skip antimeridian-crossing hexes (same as 04_generate_tiles.py)
        if is_antimeridian(h3_index):
            skipped += 1
            continue

        # FP fields may be NaN for trad-only hexes
        def _int_or_none(v):
            return int(v) if pd.notna(v) else None

        def _round_or_none(v, d=0):
            return round(float(v), d) if pd.notna(v) else None

        fp_m  = _int_or_none(row.get("total_months_flooded"))
        fp_yf = _int_or_none(row.get("total_years_flooded"))
        fp_p  = _round_or_none(row.get("population"))
        fp_y0 = _int_or_none(row.get("first_flood_year"))
        fp_y1 = _int_or_none(row.get("last_flood_year"))
        fp_cc = row.get("country_code") if pd.notna(row.get("country_code")) else None
        fp_ft = _round_or_none(row.get("frequency_trend", 0), 1)
        fp_rp = _round_or_none(row.get("return_period", 0), 1)

        t_y0  = _int_or_none(row.get("trad_y0"))
        t_y1  = _int_or_none(row.get("trad_y1"))
        t_yf  = _int_or_none(row.get("trad_yf"))
        t_p   = _round_or_none(row.get("trad_population"))
        t_src = row.get("trad_src") if pd.notna(row.get("trad_src")) else None

        rows.append([
            h3_index,
            fp_m, fp_yf, fp_p, fp_y0, fp_y1, fp_cc, fp_ft, fp_rp,
            t_y0, t_y1, t_yf, t_p, t_src,
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
