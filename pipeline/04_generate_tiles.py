"""
Step 4: Generate GeoJSON for the hex map layer.

Converts hex aggregates to GeoJSON with H3 hex boundaries.
If tippecanoe is available, also generates PMTiles.

Output:
  - hex_aggregates.geojson
  - hex_aggregates.pmtiles (if tippecanoe is installed)
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import sys
import time

import h3
import pandas as pd

from config import (
    FINAL,
    HEX_AGGREGATES_GEOJSON,
    HEX_AGGREGATES_PARQUET,
    ensure_dirs,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
log = logging.getLogger(__name__)


def hex_to_geojson_polygon(h3_index: str) -> dict:
    """Convert H3 index to GeoJSON polygon geometry."""
    boundary = h3.cell_to_boundary(h3_index)
    # h3 returns (lat, lng) tuples; GeoJSON needs [lng, lat]
    coords = [[lng, lat] for lat, lng in boundary]
    coords.append(coords[0])  # Close the ring
    return {"type": "Polygon", "coordinates": [coords]}


def main() -> None:
    ensure_dirs()

    if not HEX_AGGREGATES_PARQUET.exists():
        log.error(f"Hex aggregates not found: {HEX_AGGREGATES_PARQUET}")
        log.info("Run 03_aggregate.py first")
        sys.exit(1)

    t0 = time.time()

    df = pd.read_parquet(HEX_AGGREGATES_PARQUET)
    log.info(f"Building GeoJSON for {len(df):,} hexes ...")

    features = []
    for _, row in df.iterrows():
        feature = {
            "type": "Feature",
            "geometry": hex_to_geojson_polygon(row["h3_index"]),
            "properties": {
                "h": row["h3_index"],
                "m": int(row["total_months_flooded"]),
                "pm": round(float(row["cumulative_person_months"])),
                "p": round(float(row["population"])),
                "y0": int(row["first_flood_year"]),
                "y1": int(row["last_flood_year"]),
                "cc": row["country_code"],
            },
        }
        features.append(feature)

    geojson = {"type": "FeatureCollection", "features": features}

    with open(HEX_AGGREGATES_GEOJSON, "w") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_mb = HEX_AGGREGATES_GEOJSON.stat().st_size / 1_048_576
    log.info(f"Wrote {HEX_AGGREGATES_GEOJSON} ({size_mb:.1f} MB, {len(features):,} features)")

    # Try to generate PMTiles
    tippecanoe = shutil.which("tippecanoe")
    if tippecanoe:
        pmtiles_path = FINAL / "flood_pulse.pmtiles"
        cmd = [
            tippecanoe,
            "-o", str(pmtiles_path),
            "-l", "hexes",
            "--no-feature-limit",
            "--no-tile-size-limit",
            "--no-line-simplification",
            "--no-simplification-of-shared-nodes",
            "--no-tiny-polygon-reduction",
            "--minimum-zoom=1",
            "--maximum-zoom=5",
            "--full-detail=14",
            "--low-detail=14",
            "--minimum-detail=14",
            "--buffer=64",
            "--force",
            str(HEX_AGGREGATES_GEOJSON),
        ]
        log.info(f"Running tippecanoe ...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            pm_size = pmtiles_path.stat().st_size / 1_048_576
            log.info(f"Wrote {pmtiles_path} ({pm_size:.1f} MB)")
        else:
            log.warning(f"tippecanoe failed: {result.stderr}")
    else:
        log.info("tippecanoe not found — skipping PMTiles generation")
        log.info("The frontend will use the GeoJSON directly")

    log.info(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
