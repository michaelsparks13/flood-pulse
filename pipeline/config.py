"""
FloodPulse — Pipeline Configuration

Paths, H3 resolution, and data source references.
"""

from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PIPELINE_ROOT = Path(__file__).resolve().parent
DATA_ROOT = PIPELINE_ROOT / "data"

RAW = DATA_ROOT / "raw"
PROCESSED = DATA_ROOT / "processed"
FINAL = DATA_ROOT / "final"

GROUNDSOURCE_PARQUET = RAW / "groundsource_2026.parquet"
NATURAL_EARTH_GEOJSON = RAW / "ne_110m_admin_0_countries.geojson"

# Maximum year to include in client-side outputs. The Groundsource 2026
# parquet contains a partial 2026, which distorts visualizations. Clamp to
# the last fully-observed year.
MAX_YEAR: int = 2025

# GHS-POP R2023A epochs covering 2000-2026
GHSPOP_EPOCHS: list[int] = [2000, 2005, 2010, 2015, 2020, 2025]

GHSPOP_TIFFS: dict[int, Path] = {
    epoch: RAW / f"GHS_POP_E{epoch}_GLOBE_R2023A_4326_30ss_V1_0.tif"
    for epoch in GHSPOP_EPOCHS
}

# Backward compat: single-epoch fallback
GHSPOP_TIFF = GHSPOP_TIFFS[2020]

HEX_FLOOD_MONTHS = PROCESSED / "hex_flood_months.parquet"
HEX_POPULATION = PROCESSED / "hex_population.parquet"

HEX_AGGREGATES_PARQUET = FINAL / "hex_aggregates.parquet"
HEX_AGGREGATES_GEOJSON = FINAL / "hex_aggregates.geojson"
HEX_COMPACT_JSON = FINAL / "hex_compact.json"
COUNTRY_TIMESERIES_JSON = FINAL / "country_timeseries.json"
GLOBAL_SUMMARY_JSON = FINAL / "global_summary.json"
COMPARISON_JSON = FINAL / "comparison.json"
COUNTRY_COMPARISON_JSON = FINAL / "country_comparison.json"

# Reference data (curated / derived)
REFERENCE_DIR = DATA_ROOT / "reference"
GFD_COUNTRY_PE_CSV = REFERENCE_DIR / "gfd_country_pe.csv"
EMDAT_COUNTRY_AFFECTED_CSV = REFERENCE_DIR / "emdat_country_affected.csv"
GFD_OBSERVED_COUNTRIES_JSON = REFERENCE_DIR / "gfd_observed_countries.json"

ALL_DIRS = [RAW, PROCESSED, FINAL, REFERENCE_DIR]


def ensure_dirs() -> None:
    for d in ALL_DIRS:
        d.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# H3
# ---------------------------------------------------------------------------

H3_RESOLUTION: int = 5  # ~252 km² per hex — good for global view

# Area of a single H3 res-5 hexagon in km²
H3_RES5_AREA_KM2: float = 252.903858

# ---------------------------------------------------------------------------
# Data sources
# ---------------------------------------------------------------------------

GHSPOP_URLS: dict[int, str] = {
    epoch: (
        f"https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/"
        f"GHS_POP_GLOBE_R2023A/GHS_POP_E{epoch}_GLOBE_R2023A_4326_30ss/V1-0/"
        f"GHS_POP_E{epoch}_GLOBE_R2023A_4326_30ss_V1_0.zip"
    )
    for epoch in GHSPOP_EPOCHS
}

NATURAL_EARTH_URL = (
    "https://naciscdn.org/naturalearth/110m/cultural/"
    "ne_110m_admin_0_countries.zip"
)
