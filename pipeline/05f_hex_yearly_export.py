"""
Step 5f: Per-Year Hex Export (two parallel datasets)

Runs the per-(hex, year) population-exposed computation TWICE, once for each
catalog, and emits two parallel directories that the side-by-side UI will
load from:

  public/data/old/hex_years/{year}.json  — DFO + GFD + GDACS polygons only
  public/data/new/hex_years/{year}.json  — Groundsource (Flood Pulse) only

Each file is self-contained: it contains only the hexes that the matching
catalog flagged in that specific year, with that year's population-exposed
figure (area-weighted by the 10% inundation ratio used in 03_aggregate.py so
the numbers match country_timeseries.json).

File shape:
  {
    "year": 2020,
    "source": "old" | "new",
    "columns": ["h", "cc", "p", "src"?],
    "rows": [["85xxxxxx", "BGD", 12500, "DG"], ...]
  }

  h    H3 res-5 index
  cc   ISO-A3 country code (UNK outside any country polygon)
  p    population exposed this year in this hex, rounded to an int
  src  (old only) concatenation of source chars — D=DFO, G=GFD, C=GDACS

A sibling index.json in each directory lists years + per-year summary stats.
"""

from __future__ import annotations

import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import h3
import pandas as pd
from shapely.geometry import Point

from config import (
    FINAL,
    H3_RES5_AREA_KM2,
    HEX_FLOOD_MONTHS,
    HEX_POPULATION,
    MAX_YEAR,
    NATURAL_EARTH_GEOJSON,
    TRAD_HEX_POPULATION,
    TRAD_HEX_YEARS,
    ensure_dirs,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
log = logging.getLogger(__name__)

PUBLIC_DATA = FINAL.parent.parent.parent / "public" / "data"
OLD_DIR = PUBLIC_DATA / "old" / "hex_years"
NEW_DIR = PUBLIC_DATA / "new" / "hex_years"

# Must match 03_aggregate.py so country_timeseries PE numbers and per-year
# map PE numbers stay in the same frame of reference.
INUNDATION_RATIO = 0.10

# Hexes with exposed population below this threshold get dropped — they're
# invisible in either palette and inflate the file for no visual benefit.
MIN_EXPOSED = 50.0


def assign_countries(h3_indices: list[str], ne_path: str) -> dict[str, str]:
    """Map each H3 hex to ISO-A3 via centroid point-in-polygon."""
    world = gpd.read_file(ne_path)
    world = world[["ISO_A3", "geometry"]].copy()
    world.loc[world["ISO_A3"] == "-99", "ISO_A3"] = "UNK"

    centroids = [
        Point(lng, lat)
        for lat, lng in (h3.cell_to_latlng(idx) for idx in h3_indices)
    ]
    pts = gpd.GeoDataFrame({"h3_index": h3_indices}, geometry=centroids, crs="EPSG:4326")
    joined = gpd.sjoin(pts, world, how="left", predicate="within")

    out: dict[str, str] = {}
    for _, row in joined.iterrows():
        code = row.get("ISO_A3", "UNK")
        out[row["h3_index"]] = code if pd.notna(code) else "UNK"
    return out


def is_antimeridian(h3_index: str) -> bool:
    boundary = h3.cell_to_boundary(h3_index)
    lngs = [lng for _, lng in boundary]
    return (max(lngs) - min(lngs)) > 180


def build_fp_yearly() -> pd.DataFrame:
    """[h3_index, year, p] — FP population-exposed per (hex, year)."""
    fm = pd.read_parquet(HEX_FLOOD_MONTHS)
    fm["year"] = fm["year_month"].str[:4].astype(int)
    fm = fm[fm["year"] <= MAX_YEAR].copy()

    has_area = "area_km2" in fm.columns
    agg_map: dict = {"months_flooded": ("year_month", "nunique")}
    if has_area:
        agg_map["area_km2"] = ("area_km2", "max")

    hex_year = fm.groupby(["h3_index", "year"]).agg(**agg_map).reset_index()

    pop = pd.read_parquet(HEX_POPULATION)
    hex_year = hex_year.merge(pop, on=["h3_index", "year"], how="left")
    hex_year["population"] = hex_year["population"].fillna(0)

    if has_area:
        inundation_km2 = hex_year["area_km2"] * INUNDATION_RATIO
        hex_year["fraction"] = (
            inundation_km2.clip(upper=H3_RES5_AREA_KM2) / H3_RES5_AREA_KM2
        )
    else:
        MEDIAN_EVENT_AREA_KM2 = 2.0
        hex_year["fraction"] = MEDIAN_EVENT_AREA_KM2 / H3_RES5_AREA_KM2

    hex_year["p"] = hex_year["population"] * hex_year["fraction"]
    return hex_year[["h3_index", "year", "p"]]


def build_trad_yearly() -> pd.DataFrame:
    """[h3_index, year, p, src] — trad population-exposed per (hex, year)."""
    hy = pd.read_parquet(TRAD_HEX_YEARS)
    hy = hy[hy["year"] <= MAX_YEAR].copy()
    hy = hy.rename(columns={"h": "h3_index"})

    pop = pd.read_parquet(TRAD_HEX_POPULATION)
    joined = hy.merge(pop, on=["h3_index", "year"], how="left")
    joined["population"] = joined["population"].fillna(0)
    # Trad sources don't carry per-event polygon area at hex granularity —
    # apply a flat inundation ratio so the "people in affected areas" figure
    # stays comparable to the FP side's area-weighted 10% calc.
    joined["p"] = joined["population"] * INUNDATION_RATIO

    def _combine_src(series: pd.Series) -> str:
        chars: set[str] = set()
        for s in series:
            chars.update(s)
        return "".join(c for c in "DGC" if c in chars)

    return (
        joined.groupby(["h3_index", "year"])
        .agg(p=("p", "max"), src=("src", _combine_src))
        .reset_index()
    )


def write_dataset(
    name: str,
    out_dir: Path,
    hex_year_df: pd.DataFrame,
    country_map: dict[str, str],
    include_src: bool,
) -> list[dict]:
    """Emit {year}.json files for one catalog and return a list of summaries."""
    out_dir.mkdir(parents=True, exist_ok=True)
    summaries = []

    hex_year_df = hex_year_df[hex_year_df["p"] >= MIN_EXPOSED].copy()
    years = sorted(hex_year_df["year"].unique().tolist())

    columns = ["h", "cc", "p"] + (["src"] if include_src else [])

    for year in years:
        df = hex_year_df[hex_year_df["year"] == year]
        rows = []
        for _, r in df.iterrows():
            h = r["h3_index"]
            if is_antimeridian(h):
                continue
            row = [h, country_map.get(h, "UNK"), round(float(r["p"]))]
            if include_src:
                row.append(r.get("src") if pd.notna(r.get("src")) else None)
            rows.append(row)

        payload = {
            "year": int(year),
            "source": name,
            "columns": columns,
            "rows": rows,
        }
        path = out_dir / f"{year}.json"
        with open(path, "w") as f:
            json.dump(payload, f, separators=(",", ":"))

        summary = {
            "year": int(year),
            "hexCount": len(rows),
            "exposed": round(float(df["p"].sum())),
            "sizeKb": round(path.stat().st_size / 1024, 1),
        }
        summaries.append(summary)
        log.info(
            f"  [{name}] {year}: {summary['hexCount']:,} hexes, "
            f"exposed={summary['exposed']:,} ({summary['sizeKb']:.0f} KB)"
        )

    index = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": name,
        "inundationRatio": INUNDATION_RATIO,
        "years": summaries,
    }
    with open(out_dir / "index.json", "w") as f:
        json.dump(index, f, indent=2)
    log.info(f"Wrote {out_dir / 'index.json'} ({len(summaries)} years)")

    return summaries


def main() -> None:
    ensure_dirs()

    for path, name in [
        (HEX_FLOOD_MONTHS, "hex_flood_months"),
        (HEX_POPULATION, "hex_population"),
        (TRAD_HEX_YEARS, "trad_hex_years"),
        (TRAD_HEX_POPULATION, "trad_hex_population"),
        (NATURAL_EARTH_GEOJSON, "Natural Earth countries"),
    ]:
        if not path.exists():
            log.error(f"Missing {name} ({path}) — run upstream pipeline steps first")
            sys.exit(1)

    t0 = time.time()

    log.info("Building FP per-(hex, year) exposure ...")
    fp_yearly = build_fp_yearly()
    log.info(f"  FP rows: {len(fp_yearly):,}")

    log.info("Building trad per-(hex, year) exposure ...")
    trad_yearly = build_trad_yearly()
    log.info(f"  trad rows: {len(trad_yearly):,}")

    # Union of hexes touched by either catalog — drives country assignment.
    log.info("Assigning countries to unique hexes ...")
    unique_hexes = sorted(
        set(fp_yearly["h3_index"]) | set(trad_yearly["h3_index"])
    )
    country_map = assign_countries(unique_hexes, str(NATURAL_EARTH_GEOJSON))

    log.info("Writing OLD dataset (DFO + GFD + GDACS) ...")
    old_summaries = write_dataset(
        "old", OLD_DIR, trad_yearly, country_map, include_src=True
    )

    log.info("Writing NEW dataset (Flood Pulse / Groundsource) ...")
    new_summaries = write_dataset(
        "new", NEW_DIR, fp_yearly, country_map, include_src=False
    )

    old_total = sum(y["sizeKb"] for y in old_summaries)
    new_total = sum(y["sizeKb"] for y in new_summaries)
    log.info(
        f"Total payload — old: {old_total:,.0f} KB  "
        f"new: {new_total:,.0f} KB  grand: {old_total + new_total:,.0f} KB"
    )
    log.info(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
