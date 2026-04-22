"""
Step 2b: Population Join — Traditional Flood Databases

For each hex that any traditional database (DFO/GFD/GDACS) ever recorded as
flooded, compute a per-year population using the same GHS-POP R2023A epoch
interpolation as step 02, then aggregate to a single per-hex population
(the most recent flagged year's population, matching 03_aggregate.py's "last"
behavior for the Flood Pulse `p` field).

Inputs:
  TRAD_HEX_YEARS (from 01b_traditional_hex_index.py)  — (h, year, src)

Outputs:
  TRAD_HEX_POPULATION  — (h3_index, year, population)   intermediate
  TRAD_HEX_AGGREGATES  — per-hex summary:
      h3_index, trad_y0, trad_y1, trad_yf, trad_src, trad_population
"""

from __future__ import annotations

import importlib.util
import logging
import sys
import time
from pathlib import Path

import pandas as pd

from config import (
    GHSPOP_EPOCHS,
    GHSPOP_TIFFS,
    MAX_YEAR,
    NATURAL_EARTH_GEOJSON,
    TRAD_HEX_AGGREGATES,
    TRAD_HEX_POPULATION,
    TRAD_HEX_YEARS,
    ensure_dirs,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
log = logging.getLogger(__name__)


# Load the 02_pop_join module by path (its filename starts with a digit so
# we can't "import 02_pop_join" directly).
_PJ_PATH = Path(__file__).resolve().parent / "02_pop_join.py"
_spec = importlib.util.spec_from_file_location("_pop_join", _PJ_PATH)
_pj = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_pj)


def main() -> None:
    ensure_dirs()

    if not TRAD_HEX_YEARS.exists():
        log.error(f"Missing {TRAD_HEX_YEARS}. Run 01b_traditional_hex_index.py first.")
        sys.exit(1)

    t0 = time.time()
    hy = pd.read_parquet(TRAD_HEX_YEARS)
    hy = hy[hy["year"] <= MAX_YEAR].copy()

    unique_hexes = hy["h"].unique().tolist()
    unique_years = sorted(hy["year"].unique().tolist())
    log.info(f"Traditional hexes: {len(unique_hexes):,}")
    log.info(f"Year range: {unique_years[0]} - {unique_years[-1]}")

    any_raster = any(p.exists() for p in GHSPOP_TIFFS.values())
    if any_raster:
        available = [e for e in GHSPOP_EPOCHS if GHSPOP_TIFFS[e].exists()]
        log.info(f"Using RASTER mode (GHS-POP epochs: {available})")
        pop_df = _pj.hex_population_multiyear_raster(unique_hexes, unique_years)
    elif NATURAL_EARTH_GEOJSON.exists():
        log.info("Using COUNTRY mode (Natural Earth fallback)")
        pop_df = _pj.hex_population_multiyear_countries(
            unique_hexes, unique_years, str(NATURAL_EARTH_GEOJSON)
        )
    else:
        log.error("No population data source found.")
        sys.exit(1)

    pop_df.to_parquet(TRAD_HEX_POPULATION, index=False)
    log.info(f"Wrote {TRAD_HEX_POPULATION} ({len(pop_df):,} rows)")

    # ----- Per-hex aggregation -----
    # y0, y1, yf come straight from (h, year).
    # src is the union of src-chars across all years for that hex.
    # trad_population = population at the most recent flagged year, matching
    # 03_aggregate.py's "last" behavior for Flood Pulse `p`.
    log.info("Aggregating to per-hex summary ...")

    # Sort so groupby().agg(last) picks the max-year population
    hy_sorted = hy.sort_values(["h", "year"])

    # Merge in year-specific population
    merged = hy_sorted.merge(
        pop_df.rename(columns={"h3_index": "h"}),
        on=["h", "year"],
        how="left",
    )
    merged["population"] = merged["population"].fillna(0.0)

    def _combine_src(series: pd.Series) -> str:
        chars: set[str] = set()
        for s in series:
            chars.update(s)
        # Canonical order: D, G, C
        return "".join(c for c in "DGC" if c in chars)

    agg = (
        merged.groupby("h")
        .agg(
            trad_y0=("year", "min"),
            trad_y1=("year", "max"),
            trad_yf=("year", "nunique"),
            trad_src=("src", _combine_src),
            trad_population=("population", "last"),  # population at last flagged year
        )
        .reset_index()
        .rename(columns={"h": "h3_index"})
    )

    # Clamp y1 defensively (MAX_YEAR already applied to input but be explicit)
    agg["trad_y1"] = agg["trad_y1"].clip(upper=MAX_YEAR)

    agg.to_parquet(TRAD_HEX_AGGREGATES, index=False)
    log.info(f"Wrote {TRAD_HEX_AGGREGATES}  ({len(agg):,} hexes)")
    log.info(
        f"  y0 median {int(agg['trad_y0'].median())}, "
        f"y1 median {int(agg['trad_y1'].median())}, "
        f"yf mean {agg['trad_yf'].mean():.2f}"
    )
    log.info(f"  src flag distribution:")
    for s, n in agg["trad_src"].value_counts().head(10).items():
        log.info(f"    {s:<4}  {n:,}")
    log.info(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
