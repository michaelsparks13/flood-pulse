"""
Step 3: Aggregation — Population Exposed

Joins flood hex-months with year-specific population data and produces:
1. hex_aggregates.parquet — per-hex summary for the map
2. country_timeseries.json — per-country yearly data for drill-down
3. global_summary.json — headline numbers for the counter

Metric: Population Exposed — the number of people living in areas that
experienced flooding in a given year. Each person is counted once per year
regardless of how many months their hex flooded.

Follows the methodology of Tellman et al. (2021), Nature 596, 80-86.
"""

from __future__ import annotations

import json
import logging
import sys
import time
from collections import defaultdict
from pathlib import Path

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
    MAX_YEAR,
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
    world.loc[world["ISO_A3"] == "-99", "ISO_A3"] = "UNK"
    world = world.set_index("ISO_A3")

    log.info(f"Assigning {len(h3_indices):,} hexes to countries ...")
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
    log.info(f"Population hex-years: {len(pop_df):,}")

    flood_df["year"] = flood_df["year_month"].str[:4].astype(int)

    # Clamp to last fully-observed year (drop partial 2026 data)
    before = len(flood_df)
    flood_df = flood_df[flood_df["year"] <= MAX_YEAR].copy()
    log.info(
        f"Filtered to year <= {MAX_YEAR}: "
        f"{before:,} -> {len(flood_df):,} rows (dropped {before - len(flood_df):,})"
    )

    # ----- Per-hex, per-year: unique flooded hexes with year-specific pop -----
    # Deduplicate: one row per (hex, year) regardless of how many months flooded.
    # Keep the max event area across months for area-weighting.
    agg_dict: dict = {"year_month": "nunique"}
    has_area = "area_km2" in flood_df.columns
    if has_area:
        agg_dict["area_km2"] = "max"

    hex_year = (
        flood_df.groupby(["h3_index", "year"])
        .agg(**{
            "months_flooded": ("year_month", "nunique"),
            **({"area_km2": ("area_km2", "max")} if has_area else {}),
        })
        .reset_index()
    )

    # Join year-specific population
    hex_year = hex_year.merge(pop_df, on=["h3_index", "year"], how="left")
    hex_year["population"] = hex_year["population"].fillna(0)

    # Area-weight: only count the fraction of each hex that actually flooded.
    # Without this, a 2 km² flood claims the full population of a 252 km² hex.
    #
    # Groundsource area_km2 is the LOCATION POLYGON area (administrative
    # boundary of the reported place), not actual inundation area. A flood
    # reported "in Dhaka" gets Dhaka's full city polygon. We apply an
    # inundation ratio to estimate what fraction was actually underwater.
    # Literature suggests 5-15% of reported affected areas are inundated
    # (varies by event scale and geography).
    INUNDATION_RATIO = 0.10

    if has_area:
        inundation_km2 = hex_year["area_km2"] * INUNDATION_RATIO
        hex_year["fraction_flooded"] = (
            inundation_km2.clip(upper=H3_RES5_AREA_KM2) / H3_RES5_AREA_KM2
        )
    else:
        # Fallback: estimate using median Groundsource event area (~2 km²).
        # Re-run 01_hex_index.py for per-event areas when source data is available.
        MEDIAN_EVENT_AREA_KM2 = 2.0
        log.warning(
            f"No area_km2 column — estimating with median event area "
            f"({MEDIAN_EVENT_AREA_KM2} km²). Re-run 01_hex_index.py for exact areas."
        )
        hex_year["fraction_flooded"] = MEDIAN_EVENT_AREA_KM2 / H3_RES5_AREA_KM2

    hex_year["population_exposed"] = hex_year["population"] * hex_year["fraction_flooded"]
    log.info(
        f"Area-weighted population (inundation ratio={INUNDATION_RATIO}, "
        f"median fraction: {hex_year['fraction_flooded'].median():.4f})"
    )

    # ----- Hex-level aggregates (for map tiles) -----
    hex_agg = (
        hex_year.groupby("h3_index")
        .agg(
            total_months_flooded=("months_flooded", "sum"),
            total_years_flooded=("year", "nunique"),
            first_flood_year=("year", "min"),
            last_flood_year=("year", "max"),
            # Use the most recent year's population for the map
            population=("population", "last"),
        )
        .reset_index()
    )

    # ----- Frequency trend & return period per hex -----
    # For each hex, build a binary yearly flood indicator across the full year
    # range, then fit OLS to get a trend slope.  Positive = flooding more often.
    all_years = sorted(hex_year["year"].unique())
    year_span = len(all_years)
    year_set_by_hex: dict[str, set[int]] = defaultdict(set)
    for h, y in zip(hex_year["h3_index"], hex_year["year"]):
        year_set_by_hex[h].add(y)

    ft_values: list[float] = []
    rp_values: list[float] = []
    for h3_idx in hex_agg["h3_index"]:
        flooded_years = year_set_by_hex.get(h3_idx, set())
        # Binary indicator: 1 if flooded that year, 0 otherwise
        xs = np.array(all_years, dtype=float)
        ys = np.array([1.0 if y in flooded_years else 0.0 for y in all_years])

        # OLS slope (trend per year), scaled to approx -50..+50 range
        if year_span >= 2:
            xm, ym = xs.mean(), ys.mean()
            denom = ((xs - xm) ** 2).sum()
            slope = ((xs - xm) * (ys - ym)).sum() / denom if denom > 0 else 0.0
            # Slope is change-in-probability per year; multiply by year_span
            # to get a total-change score, then scale by 100 for the -50..+50 range
            ft = float(np.clip(slope * year_span * 100, -50, 50))
        else:
            ft = 0.0

        # Return period: average years between floods
        n_flooded = len(flooded_years)
        rp = round(year_span / n_flooded, 1) if n_flooded >= 2 else 0.0

        ft_values.append(round(ft, 1))
        rp_values.append(rp)

    hex_agg["frequency_trend"] = ft_values
    hex_agg["return_period"] = rp_values
    log.info(
        f"Frequency trends: mean={np.mean(ft_values):.2f}, "
        f"std={np.std(ft_values):.2f}, "
        f"hexes with rp>0: {sum(1 for v in rp_values if v > 0):,}"
    )

    # Assign countries
    country_map = assign_countries(
        hex_agg["h3_index"].tolist(), str(NATURAL_EARTH_GEOJSON)
    )
    hex_agg["country_code"] = hex_agg["h3_index"].map(country_map).fillna("UNK")

    hex_agg.to_parquet(HEX_AGGREGATES_PARQUET, index=False)
    log.info(f"Wrote hex aggregates: {len(hex_agg):,} hexes")

    # ----- Country time series -----
    hex_year_with_country = hex_year.merge(
        hex_agg[["h3_index", "country_code"]], on="h3_index", how="left"
    )

    country_year = (
        hex_year_with_country.groupby(["country_code", "year"])
        .agg(
            population_exposed=("population_exposed", "sum"),
            unique_hexes=("h3_index", "nunique"),
        )
        .reset_index()
    )
    country_year["area_km2_flooded"] = country_year["unique_hexes"] * H3_RES5_AREA_KM2

    country_ts: dict = {}
    for code, group in country_year.groupby("country_code"):
        country_ts[code] = {
            "timeseries": [
                {
                    "year": int(row["year"]),
                    "populationExposed": round(float(row["population_exposed"])),
                    "hexesFlooded": int(row["unique_hexes"]),
                    "areaKm2Flooded": round(float(row["area_km2_flooded"]), 1),
                }
                for _, row in group.sort_values("year").iterrows()
            ]
        }

    with open(COUNTRY_TIMESERIES_JSON, "w") as f:
        json.dump(country_ts, f, separators=(",", ":"))
    log.info(f"Wrote country timeseries: {len(country_ts)} countries")

    # ----- Global summary -----
    # Raw record counts per year from original data
    raw_counts: dict[int, int] = {}
    try:
        gs = pd.read_parquet(GROUNDSOURCE_PARQUET, columns=["start_date"])
        gs["year"] = gs["start_date"].str[:4].astype(int)
        gs = gs[gs["year"] <= MAX_YEAR]
        for year, count in gs["year"].value_counts().items():
            raw_counts[int(year)] = int(count)
    except Exception:
        log.warning(
            "Could not read raw record counts from source parquet — "
            "attempting to preserve existing values from previous global_summary.json"
        )
        try:
            prior_public = (
                Path(__file__).resolve().parent.parent
                / "public" / "data" / "global_summary.json"
            )
            if prior_public.exists():
                with open(prior_public) as f:
                    prior = json.load(f)
                for entry in prior.get("byYear", []):
                    yr = int(entry.get("year", 0))
                    if yr and yr <= MAX_YEAR:
                        raw_counts[yr] = int(entry.get("rawRecordCount", 0))
                log.info(
                    f"Preserved rawRecordCount for {len(raw_counts)} years "
                    f"from {prior_public}"
                )
        except Exception as e:
            log.warning(f"Failed to preserve rawRecordCount: {e}")

    # Annual population exposed — each hex counted once per year, area-weighted
    yearly = (
        hex_year_with_country.groupby("year")
        .agg(
            population_exposed=("population_exposed", "sum"),
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
        annual_pe = float(row["population_exposed"])
        cumulative += annual_pe
        by_year.append(
            {
                "year": yr,
                "populationExposed": round(annual_pe),
                "cumulativePopulationExposed": round(cumulative),
                "rawRecordCount": raw_counts.get(yr, 0),
                "countriesAffected": int(row["countries"]),
                "hexesFlooded": int(row["hexes_flooded"]),
            }
        )

    # Determine latest month in the dataset
    data_through = flood_df["year_month"].max()

    global_summary = {
        "dataThrough": data_through,
        "byYear": by_year,
        "totals": {
            "populationExposed": round(cumulative),
            "countries": int(hex_agg["country_code"].nunique()),
            "hexesEverFlooded": int(len(hex_agg)),
            "areaKm2": round(float(len(hex_agg) * H3_RES5_AREA_KM2), 1),
        },
    }

    with open(GLOBAL_SUMMARY_JSON, "w") as f:
        json.dump(global_summary, f, indent=2)
    log.info(f"Wrote global summary")

    # Final report
    peak_year = yearly.loc[yearly["population_exposed"].idxmax()]
    log.info(f"=== SUMMARY ===")
    log.info(f"  Total hexes: {len(hex_agg):,}")
    log.info(f"  Cumulative population exposed: {cumulative:,.0f}")
    log.info(f"  Peak year: {int(peak_year['year'])} ({peak_year['population_exposed']:,.0f} people)")
    log.info(f"  Countries: {hex_agg['country_code'].nunique()}")
    log.info(f"  Year range: {yearly['year'].min()} - {yearly['year'].max()}")
    log.info(f"  Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
