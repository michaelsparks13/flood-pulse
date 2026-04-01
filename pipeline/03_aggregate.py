"""
Step 3: Aggregation

Joins flood hex-months with population data and produces:
1. hex_aggregates.parquet — per-hex summary for the map
2. country_timeseries.json — per-country yearly data for drill-down
3. global_summary.json — headline numbers for the counter

Requires Natural Earth boundaries for country assignment.
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
    COUNTRY_TIMESERIES_JSON,
    GLOBAL_SUMMARY_JSON,
    GROUNDSOURCE_PARQUET,
    H3_RES5_AREA_KM2,
    HEX_AGGREGATES_PARQUET,
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


def assign_countries(h3_indices: list[str], ne_path: str) -> dict[str, str]:
    """Map each H3 hex to a country ISO_A3 code via centroid point-in-polygon."""
    log.info("Loading Natural Earth boundaries ...")
    world = gpd.read_file(ne_path)
    world = world[["ISO_A3", "NAME", "POP_EST", "geometry"]].copy()
    # Fix -99 codes
    world.loc[world["ISO_A3"] == "-99", "ISO_A3"] = "UNK"
    world = world.set_index("ISO_A3")

    log.info(f"Assigning {len(h3_indices):,} hexes to countries ...")
    # Build centroid points
    centroids = []
    for idx in h3_indices:
        lat, lng = h3.cell_to_latlng(idx)
        centroids.append(Point(lng, lat))

    pts = gpd.GeoDataFrame(
        {"h3_index": h3_indices}, geometry=centroids, crs="EPSG:4326"
    )
    joined = gpd.sjoin(pts, world.reset_index(), how="left", predicate="within")

    result: dict[str, str] = {}
    for _, row in joined.iterrows():
        code = row.get("ISO_A3", "UNK")
        result[row["h3_index"]] = code if pd.notna(code) else "UNK"

    log.info(f"  Assigned {sum(1 for v in result.values() if v != 'UNK'):,} hexes to known countries")
    return result


def main() -> None:
    ensure_dirs()

    for path, name in [
        (HEX_FLOOD_MONTHS, "hex_flood_months"),
        (HEX_POPULATION, "hex_population"),
        (NATURAL_EARTH_GEOJSON, "Natural Earth countries"),
    ]:
        if not path.exists():
            log.error(f"{name} not found at {path}")
            sys.exit(1)

    t0 = time.time()

    # Load data
    flood_df = pd.read_parquet(HEX_FLOOD_MONTHS)
    pop_df = pd.read_parquet(HEX_POPULATION)
    log.info(f"Flood hex-months: {len(flood_df):,}")
    log.info(f"Population hexes: {len(pop_df):,}")

    # Extract year from year_month
    flood_df["year"] = flood_df["year_month"].str[:4].astype(int)

    # ----- Hex-level aggregates -----
    hex_agg = (
        flood_df.groupby("h3_index")
        .agg(
            total_months_flooded=("year_month", "nunique"),
            first_flood_year=("year", "min"),
            last_flood_year=("year", "max"),
            total_flood_count=("flood_count", "sum"),
        )
        .reset_index()
    )

    # Join population
    hex_agg = hex_agg.merge(pop_df, on="h3_index", how="left")
    hex_agg["population"] = hex_agg["population"].fillna(0)
    hex_agg["cumulative_person_months"] = (
        hex_agg["population"] * hex_agg["total_months_flooded"]
    )

    # Assign countries
    country_map = assign_countries(
        hex_agg["h3_index"].tolist(), str(NATURAL_EARTH_GEOJSON)
    )
    hex_agg["country_code"] = hex_agg["h3_index"].map(country_map).fillna("UNK")

    hex_agg.to_parquet(HEX_AGGREGATES_PARQUET, index=False)
    log.info(f"Wrote hex aggregates: {len(hex_agg):,} hexes")

    # ----- Country time series -----
    # Need per-country, per-year stats
    flood_with_country = flood_df.merge(
        hex_agg[["h3_index", "country_code", "population"]], on="h3_index", how="left"
    )

    country_year = (
        flood_with_country.groupby(["country_code", "year"])
        .agg(
            hex_months_flooded=("h3_index", "count"),
            people_exposed=("population", "sum"),
            unique_hexes=("h3_index", "nunique"),
        )
        .reset_index()
    )
    country_year["area_km2_flooded"] = country_year["unique_hexes"] * H3_RES5_AREA_KM2

    # Build JSON structure
    country_ts: dict = {}
    for code, group in country_year.groupby("country_code"):
        country_ts[code] = {
            "timeseries": [
                {
                    "year": int(row["year"]),
                    "hexMonthsFlooded": int(row["hex_months_flooded"]),
                    "peopleExposed": round(float(row["people_exposed"])),
                    "areaKm2Flooded": round(float(row["area_km2_flooded"]), 1),
                }
                for _, row in group.sort_values("year").iterrows()
            ]
        }

    with open(COUNTRY_TIMESERIES_JSON, "w") as f:
        json.dump(country_ts, f, separators=(",", ":"))
    log.info(f"Wrote country timeseries: {len(country_ts)} countries")

    # ----- Global summary -----
    # Get raw record counts per year from the original data
    raw_counts: dict[int, int] = {}
    try:
        gs = pd.read_parquet(GROUNDSOURCE_PARQUET, columns=["start_date"])
        gs["year"] = gs["start_date"].str[:4].astype(int)
        for year, count in gs["year"].value_counts().items():
            raw_counts[int(year)] = int(count)
    except Exception:
        log.warning("Could not read raw record counts")

    # Build per-year global stats
    yearly = (
        flood_with_country.groupby("year")
        .agg(
            person_months=("population", "sum"),
            hexes_flooded=("h3_index", "nunique"),
            countries=("country_code", "nunique"),
        )
        .reset_index()
        .sort_values("year")
    )

    cumulative = 0.0
    by_year = []
    for _, row in yearly.iterrows():
        yr = int(row["year"])
        cumulative += float(row["person_months"])
        by_year.append(
            {
                "year": yr,
                "cumulativePersonMonths": round(cumulative),
                "rawRecordCount": raw_counts.get(yr, 0),
                "countriesAffected": int(row["countries"]),
                "hexesFlooded": int(row["hexes_flooded"]),
            }
        )

    global_summary = {
        "byYear": by_year,
        "totals": {
            "personMonths": round(cumulative),
            "countries": int(hex_agg["country_code"].nunique()),
            "hexesEverFlooded": int(len(hex_agg)),
            "areaKm2": round(float(len(hex_agg) * H3_RES5_AREA_KM2), 1),
        },
    }

    with open(GLOBAL_SUMMARY_JSON, "w") as f:
        json.dump(global_summary, f, indent=2)
    log.info(f"Wrote global summary")

    log.info(f"=== SUMMARY ===")
    log.info(f"  Total hexes: {len(hex_agg):,}")
    log.info(f"  Total person-months: {cumulative:,.0f}")
    log.info(f"  Countries: {hex_agg['country_code'].nunique()}")
    log.info(f"  Year range: {yearly['year'].min()} - {yearly['year'].max()}")
    log.info(f"  Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
