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
GHSPOP_TIFF = RAW / "GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.tif"
NATURAL_EARTH_GEOJSON = RAW / "ne_110m_admin_0_countries.geojson"

HEX_FLOOD_MONTHS = PROCESSED / "hex_flood_months.parquet"
HEX_POPULATION = PROCESSED / "hex_population.parquet"

HEX_AGGREGATES_PARQUET = FINAL / "hex_aggregates.parquet"
HEX_AGGREGATES_GEOJSON = FINAL / "hex_aggregates.geojson"
COUNTRY_TIMESERIES_JSON = FINAL / "country_timeseries.json"
GLOBAL_SUMMARY_JSON = FINAL / "global_summary.json"

ALL_DIRS = [RAW, PROCESSED, FINAL]


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

GHSPOP_URL = (
    "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/"
    "GHS_POP_GLOBE_R2023A/GHS_POP_E2020_GLOBE_R2023A_4326_30ss/V1-0/"
    "GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.zip"
)

NATURAL_EARTH_URL = (
    "https://naciscdn.org/naturalearth/110m/cultural/"
    "ne_110m_admin_0_countries.zip"
)
