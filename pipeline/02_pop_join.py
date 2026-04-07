"""
Step 2: Population Join (multi-epoch)

For each unique H3 hex in the flood index, estimate population at each year
using GHS-POP R2023A epoch rasters (2000, 2005, 2010, 2015, 2020, 2025).
Population between epochs is linearly interpolated.

Two modes:
  1. RASTER mode (preferred): Uses one or more GHS-POP 1km GeoTIFFs.
     If multiple epochs are present, interpolates per year.
     If only one epoch is present, uses it for all years.
  2. COUNTRY mode (fallback): Uses Natural Earth POP_EST per country,
     distributed by area across hexes (static, no temporal variation).

Output: hex_population.parquet
  Columns: [h3_index, year, population]
  One row per hex per year that appears in the flood data.
"""

from __future__ import annotations

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
    GHSPOP_EPOCHS,
    GHSPOP_TIFF,
    GHSPOP_TIFFS,
    GHSPOP_URLS,
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
# Mode 1: Raster-based (GHS-POP) — single epoch helper
# ---------------------------------------------------------------------------

def _pop_from_raster(h3_indices: list[str], raster_path: str) -> dict[str, float]:
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


def hex_population_multiyear_raster(
    h3_indices: list[str],
    years: list[int],
) -> pd.DataFrame:
    """
    Compute per-hex population at each year using available GHS-POP epochs.
    Linearly interpolates between the two nearest epochs.
    """
    # Find available epoch rasters on disk
    available: dict[int, str] = {}
    for epoch, path in sorted(GHSPOP_TIFFS.items()):
        if path.exists():
            available[epoch] = str(path)

    if not available:
        raise FileNotFoundError("No GHS-POP epoch rasters found")

    epochs_present = sorted(available.keys())
    log.info(f"Available GHS-POP epochs: {epochs_present}")

    if len(epochs_present) < len(GHSPOP_EPOCHS):
        missing = set(GHSPOP_EPOCHS) - set(epochs_present)
        log.warning(f"Missing epochs: {sorted(missing)}")
        for epoch in sorted(missing):
            log.info(f"  Download from: {GHSPOP_URLS[epoch]}")

    # Read population at each available epoch
    epoch_pops: dict[int, dict[str, float]] = {}
    for epoch in epochs_present:
        log.info(f"Reading GHS-POP epoch {epoch} ...")
        epoch_pops[epoch] = _pop_from_raster(h3_indices, available[epoch])

    # Interpolate population for each (hex, year)
    rows: list[dict] = []
    for yr in sorted(set(years)):
        if yr <= epochs_present[0]:
            # Before or at first epoch — use first epoch
            src_epoch = epochs_present[0]
            for h3_idx in h3_indices:
                rows.append({
                    "h3_index": h3_idx,
                    "year": yr,
                    "population": epoch_pops[src_epoch].get(h3_idx, 0.0),
                })
        elif yr >= epochs_present[-1]:
            # At or after last epoch — use last epoch
            src_epoch = epochs_present[-1]
            for h3_idx in h3_indices:
                rows.append({
                    "h3_index": h3_idx,
                    "year": yr,
                    "population": epoch_pops[src_epoch].get(h3_idx, 0.0),
                })
        else:
            # Interpolate between two bracketing epochs
            lo = max(e for e in epochs_present if e <= yr)
            hi = min(e for e in epochs_present if e > yr)
            frac = (yr - lo) / (hi - lo)
            for h3_idx in h3_indices:
                p_lo = epoch_pops[lo].get(h3_idx, 0.0)
                p_hi = epoch_pops[hi].get(h3_idx, 0.0)
                pop = p_lo + (p_hi - p_lo) * frac
                rows.append({
                    "h3_index": h3_idx,
                    "year": yr,
                    "population": max(0.0, pop),
                })

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Mode 2: Country-based estimation (static — no temporal variation)
# ---------------------------------------------------------------------------

def hex_population_multiyear_countries(
    h3_indices: list[str],
    years: list[int],
    ne_path: str,
) -> pd.DataFrame:
    """
    Estimate population by country density. Same value for every year
    since Natural Earth provides only a single population estimate.
    """
    log.info("Loading Natural Earth boundaries ...")
    world = gpd.read_file(ne_path)
    world = world[["ISO_A3", "POP_EST", "geometry"]].copy()
    world.loc[world["ISO_A3"] == "-99", "ISO_A3"] = "UNK"
    world["area_km2"] = world.to_crs("EPSG:6933").geometry.area / 1e6

    log.info(f"Assigning {len(h3_indices):,} hexes to countries ...")
    centroids = []
    for idx in h3_indices:
        lat, lng = h3.cell_to_latlng(idx)
        centroids.append(Point(lng, lat))

    pts = gpd.GeoDataFrame(
        {"h3_index": h3_indices}, geometry=centroids, crs="EPSG:4326"
    )
    joined = gpd.sjoin(pts, world.reset_index(), how="left", predicate="within")

    hex_country: dict[str, str] = {}
    for _, row in joined.iterrows():
        code = row.get("ISO_A3", "UNK")
        if pd.isna(code):
            code = "UNK"
        hex_country[row["h3_index"]] = code

    country_pop: dict[str, float] = {}
    country_area: dict[str, float] = {}
    for _, row in world.iterrows():
        code = row["ISO_A3"]
        pop = row["POP_EST"]
        area = row["area_km2"]
        if pd.notna(pop) and pop > 0:
            country_pop[code] = float(pop)
            country_area[code] = float(area) if pd.notna(area) and area > 0 else 1.0

    country_density = {
        code: country_pop[code] / country_area.get(code, 1.0)
        for code in country_pop
    }

    # Static population — replicate across all years
    rows: list[dict] = []
    for yr in sorted(set(years)):
        for h3_idx in h3_indices:
            code = hex_country.get(h3_idx, "UNK")
            density = country_density.get(code, 0.0)
            rows.append({
                "h3_index": h3_idx,
                "year": yr,
                "population": density * H3_RES5_AREA_KM2,
            })

    assigned = sum(1 for v in hex_country.values() if v != "UNK")
    log.info(f"  Assigned {assigned:,} / {len(h3_indices):,} hexes to countries")
    return pd.DataFrame(rows)


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

    # Load flood data to get unique hexes and years
    flood_df = pd.read_parquet(HEX_FLOOD_MONTHS, columns=["h3_index", "year_month"])
    unique_hexes = flood_df["h3_index"].unique().tolist()
    unique_years = sorted(flood_df["year_month"].str[:4].astype(int).unique().tolist())
    log.info(f"Unique H3 hexes: {len(unique_hexes):,}")
    log.info(f"Year range: {unique_years[0]} - {unique_years[-1]}")

    # Choose mode based on available data
    any_raster = any(p.exists() for p in GHSPOP_TIFFS.values())

    if any_raster:
        available = [e for e in GHSPOP_EPOCHS if GHSPOP_TIFFS[e].exists()]
        log.info(f"Using RASTER mode (GHS-POP epochs: {available})")
        out_df = hex_population_multiyear_raster(unique_hexes, unique_years)
    elif NATURAL_EARTH_GEOJSON.exists():
        log.info("Using COUNTRY mode (Natural Earth POP_EST fallback)")
        log.info("For year-specific population, download GHS-POP epoch rasters:")
        for epoch, url in sorted(GHSPOP_URLS.items()):
            log.info(f"  {epoch}: {url}")
        out_df = hex_population_multiyear_countries(
            unique_hexes, unique_years, str(NATURAL_EARTH_GEOJSON)
        )
    else:
        log.error("No population data source found.")
        sys.exit(1)

    out_df.to_parquet(HEX_POPULATION, index=False)
    log.info(f"Wrote {HEX_POPULATION} ({len(out_df):,} rows)")
    log.info(
        f"Population range per hex-year: "
        f"{out_df['population'].min():,.0f} - {out_df['population'].max():,.0f}"
    )
    log.info(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
