"""
Step 2: Population Join

For each unique H3 hex in the flood index, estimate population.

Two modes:
  1. RASTER mode (preferred): Uses GHS-POP 2020 1km GeoTIFF for precise
     per-hex population via zonal statistics.
  2. COUNTRY mode (fallback): Uses Natural Earth POP_EST per country,
     distributed by area across hexes. Accurate enough at H3 res-5 (~252 km²)
     for a global overview, but less precise than raster mode.

Output: hex_population.parquet
  Columns: [h3_index, population]
"""

from __future__ import annotations

import json
import logging
import sys
import time
from collections import defaultdict

import geopandas as gpd
import h3
import numpy as np
import pandas as pd
from shapely.geometry import Point

from config import (
    GHSPOP_TIFF,
    H3_RES5_AREA_KM2,
    HEX_FLOOD_MONTHS,
    HEX_POPULATION,
    NATURAL_EARTH_GEOJSON,
    ensure_dirs,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
log = logging.getLogger(__name__)

BATCH_SIZE = 5_000


# ---------------------------------------------------------------------------
# Mode 1: Raster-based (GHS-POP)
# ---------------------------------------------------------------------------

def hex_population_from_raster(
    h3_indices: list[str], raster_path: str
) -> dict[str, float]:
    """Compute population sum for each H3 hex using windowed raster reads."""
    import rasterio
    from rasterio.windows import from_bounds

    results: dict[str, float] = {}

    with rasterio.open(raster_path) as src:
        nodata = src.nodata

        for i, h3_idx in enumerate(h3_indices):
            try:
                boundary = h3.cell_to_boundary(h3_idx)
                lats = [p[0] for p in boundary]
                lngs = [p[1] for p in boundary]
                minx, maxx = min(lngs), max(lngs)
                miny, maxy = min(lats), max(lats)

                window = from_bounds(minx, miny, maxx, maxy, src.transform)
                row_off = max(0, int(window.row_off))
                col_off = max(0, int(window.col_off))
                row_end = min(src.height, int(window.row_off + window.height))
                col_end = min(src.width, int(window.col_off + window.width))

                if row_end <= row_off or col_end <= col_off:
                    results[h3_idx] = 0.0
                    continue

                win = rasterio.windows.Window(
                    col_off, row_off, col_end - col_off, row_end - row_off
                )
                data = src.read(1, window=win)

                if nodata is not None:
                    data = np.where(data == nodata, 0, data)
                data = np.where(data < 0, 0, data)

                results[h3_idx] = float(np.sum(data))
            except Exception as e:
                log.debug(f"Error for {h3_idx}: {e}")
                results[h3_idx] = 0.0

            if (i + 1) % BATCH_SIZE == 0:
                log.info(f"  Processed {i + 1:,} / {len(h3_indices):,} hexes")

    return results


# ---------------------------------------------------------------------------
# Mode 2: Country-based estimation
# ---------------------------------------------------------------------------

def hex_population_from_countries(
    h3_indices: list[str], ne_path: str
) -> dict[str, float]:
    """
    Estimate population by assigning each hex to a country, then distributing
    the country's total population proportionally among its hexes.
    """
    log.info("Loading Natural Earth boundaries ...")
    world = gpd.read_file(ne_path)
    world = world[["ISO_A3", "POP_EST", "geometry"]].copy()
    world.loc[world["ISO_A3"] == "-99", "ISO_A3"] = "UNK"
    world["area_km2"] = world.to_crs("EPSG:6933").geometry.area / 1e6

    # Build centroids for all hexes
    log.info(f"Assigning {len(h3_indices):,} hexes to countries ...")
    centroids = []
    for idx in h3_indices:
        lat, lng = h3.cell_to_latlng(idx)
        centroids.append(Point(lng, lat))

    pts = gpd.GeoDataFrame(
        {"h3_index": h3_indices}, geometry=centroids, crs="EPSG:4326"
    )
    joined = gpd.sjoin(pts, world.reset_index(), how="left", predicate="within")

    # Count hexes per country to distribute population
    country_hex_counts: dict[str, int] = defaultdict(int)
    hex_country: dict[str, str] = {}
    for _, row in joined.iterrows():
        code = row.get("ISO_A3", "UNK")
        if pd.isna(code):
            code = "UNK"
        hex_country[row["h3_index"]] = code
        country_hex_counts[code] += 1

    # Country population lookup
    country_pop: dict[str, float] = {}
    country_area: dict[str, float] = {}
    for _, row in world.iterrows():
        code = row["ISO_A3"]
        pop = row["POP_EST"]
        area = row["area_km2"]
        if pd.notna(pop) and pop > 0:
            country_pop[code] = float(pop)
            country_area[code] = float(area) if pd.notna(area) and area > 0 else 1.0

    # Population density per km² for each country
    country_density: dict[str, float] = {}
    for code in country_pop:
        country_density[code] = country_pop[code] / country_area.get(code, 1.0)

    # Assign population to each hex
    results: dict[str, float] = {}
    for idx in h3_indices:
        code = hex_country.get(idx, "UNK")
        density = country_density.get(code, 0.0)
        # Population in hex = density * hex area
        results[idx] = density * H3_RES5_AREA_KM2

    assigned = sum(1 for v in hex_country.values() if v != "UNK")
    log.info(f"  Assigned {assigned:,} / {len(h3_indices):,} hexes to countries")

    total_pop = sum(results.values())
    log.info(f"  Estimated total population in flooded hexes: {total_pop:,.0f}")
    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    ensure_dirs()

    if not HEX_FLOOD_MONTHS.exists():
        log.error(f"Hex flood months not found: {HEX_FLOOD_MONTHS}")
        log.info("Run 01_hex_index.py first")
        sys.exit(1)

    t0 = time.time()

    # Get unique H3 indices
    df = pd.read_parquet(HEX_FLOOD_MONTHS, columns=["h3_index"])
    unique_hexes = df["h3_index"].unique().tolist()
    log.info(f"Unique H3 hexes to process: {len(unique_hexes):,}")

    # Choose mode
    if GHSPOP_TIFF.exists():
        log.info("Using RASTER mode (GHS-POP 2020)")
        pop_map = hex_population_from_raster(unique_hexes, str(GHSPOP_TIFF))
    elif NATURAL_EARTH_GEOJSON.exists():
        log.info("Using COUNTRY mode (Natural Earth POP_EST fallback)")
        log.info(
            "For higher precision, place GHS-POP 2020 1km GeoTIFF at:\n"
            f"  {GHSPOP_TIFF}"
        )
        pop_map = hex_population_from_countries(
            unique_hexes, str(NATURAL_EARTH_GEOJSON)
        )
    else:
        log.error("No population data source found.")
        log.info(f"Need either:\n  {GHSPOP_TIFF}\n  {NATURAL_EARTH_GEOJSON}")
        sys.exit(1)

    # Write output
    out_df = pd.DataFrame(
        [{"h3_index": k, "population": v} for k, v in pop_map.items()]
    )
    out_df.to_parquet(HEX_POPULATION, index=False)
    log.info(f"Wrote {HEX_POPULATION} ({len(out_df):,} rows)")
    log.info(f"Total population across all flooded hexes: {out_df['population'].sum():,.0f}")
    log.info(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
