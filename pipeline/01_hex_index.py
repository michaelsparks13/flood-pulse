"""
Step 1: H3 Hexagonal Indexing

Reads the Groundsource parquet file and converts each flood polygon
into H3 hexagons at resolution 5. Deduplication happens naturally:
if 1,004 Harvey polygons all cover the same hex, it's marked "flooded"
once for that month.

Performance optimization: Since most polygons (median 2 km²) are much
smaller than a single H3 res-5 hex (~252 km²), we use centroid-based
assignment for small polygons and only run full polyfill for large ones.

Output: hex_flood_months.parquet
  Columns: [h3_index, year_month, flood_count]
"""

from __future__ import annotations

import logging
import sys
import time
from collections import Counter

import h3
import numpy as np
import pandas as pd
import pyarrow.parquet as pq
from shapely import wkb
from shapely.geometry import mapping

from config import (
    GROUNDSOURCE_PARQUET,
    H3_RESOLUTION,
    HEX_FLOOD_MONTHS,
    ensure_dirs,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
log = logging.getLogger(__name__)

# Polygons smaller than this threshold (in km²) use centroid-only assignment.
# At res 5 (~252 km²), a polygon needs to be > ~100 km² to potentially
# span multiple hexes.
AREA_THRESHOLD_KM2 = 100.0


def polygon_to_h3_cells(geom_wkb: bytes, area_km2: float, resolution: int) -> set[str]:
    """Convert a WKB geometry to H3 hex indices."""
    try:
        geom = wkb.loads(geom_wkb)

        # Small polygons: use centroid (much faster, equivalent at res 5)
        if area_km2 < AREA_THRESHOLD_KM2:
            centroid = geom.centroid
            cell = h3.latlng_to_cell(centroid.y, centroid.x, resolution)
            return {cell}

        # Large polygons: full polyfill
        geojson = mapping(geom)
        if geojson["type"] == "MultiPolygon":
            hexes: set[str] = set()
            for coords in geojson["coordinates"]:
                single = {"type": "Polygon", "coordinates": coords}
                try:
                    hexes.update(h3.geo_to_cells(single, res=resolution))
                except Exception:
                    # Fall back to centroid for degenerate polygons
                    centroid = geom.centroid
                    hexes.add(h3.latlng_to_cell(centroid.y, centroid.x, resolution))
            return hexes
        else:
            try:
                return set(h3.geo_to_cells(geojson, res=resolution))
            except Exception:
                centroid = geom.centroid
                return {h3.latlng_to_cell(centroid.y, centroid.x, resolution)}
    except Exception:
        return set()


def main() -> None:
    ensure_dirs()

    if not GROUNDSOURCE_PARQUET.exists():
        log.error(f"Groundsource parquet not found at {GROUNDSOURCE_PARQUET}")
        log.info("Copy from /tmp/groundsource_2026.parquet or download from Zenodo")
        sys.exit(1)

    t0 = time.time()

    # Read with pyarrow for faster access
    log.info(f"Opening {GROUNDSOURCE_PARQUET} ...")
    pf = pq.ParquetFile(str(GROUNDSOURCE_PARQUET))
    total_rows = pf.metadata.num_rows
    log.info(f"Total rows: {total_rows:,} across {pf.metadata.num_row_groups} row groups")

    hex_month_counts: Counter = Counter()
    processed = 0

    for rg_idx in range(pf.metadata.num_row_groups):
        rg_t0 = time.time()
        table = pf.read_row_group(rg_idx, columns=["start_date", "area_km2", "geometry"])

        start_dates = table.column("start_date").to_pylist()
        areas = table.column("area_km2").to_pylist()
        geometries = table.column("geometry").to_pylist()  # WKB bytes

        rg_size = len(start_dates)
        log.info(f"Row group {rg_idx}: {rg_size:,} rows (loaded in {time.time() - rg_t0:.1f}s)")

        for i in range(rg_size):
            ym = start_dates[i][:7]  # "2017-08"
            area = areas[i] if areas[i] is not None else 0.0
            geom_bytes = geometries[i]

            if geom_bytes is None:
                continue

            hexes = polygon_to_h3_cells(geom_bytes, area, H3_RESOLUTION)
            for h in hexes:
                hex_month_counts[(h, ym)] += 1

            processed += 1
            if processed % 200_000 == 0:
                elapsed = time.time() - t0
                rate = processed / elapsed
                pct = processed / total_rows * 100
                log.info(
                    f"  {processed:>10,} / {total_rows:,} ({pct:5.1f}%) "
                    f"| {rate:,.0f} rows/s "
                    f"| {len(hex_month_counts):,} unique hex-months"
                )

    log.info(f"Processed {processed:,} records")
    log.info(f"Total unique hex-months: {len(hex_month_counts):,}")

    # Convert to DataFrame
    records = [
        {"h3_index": k[0], "year_month": k[1], "flood_count": v}
        for k, v in hex_month_counts.items()
    ]
    df = pd.DataFrame(records)
    df.to_parquet(HEX_FLOOD_MONTHS, index=False)
    log.info(f"Wrote {HEX_FLOOD_MONTHS} ({len(df):,} rows)")
    log.info(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
