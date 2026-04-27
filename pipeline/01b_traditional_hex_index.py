"""
Step 1b: H3 Hexagonal Indexing — Traditional Flood Databases

Builds the hex footprint of what pre-Groundsource catalogs (DFO + GFD + GDACS)
collectively recorded. The output is the "old way" of seeing global floods, at
the same H3 res-5 grid as the Flood Pulse layer so they can be overlaid.

Sources
-------
DFO (Dartmouth Flood Observatory, Zenodo 19288171, v0.9.0):
    ~5500 MultiPolygon flood events, 1985-2024 (last year partial).
    Date field: BeginDate (YYYY-MM-DD string).  Source char = "D".

GFD (Global Flood Database v1 / Tellman 2021, HydroShare QC database):
    913 events, 2000-2018.  Geometry is an inline KML <Polygon>/<MultiGeometry>
    string in the `geometry` column of gfd_qcdatabase_2019_08_01.csv.
    Date field: Began (M/D/YYYY).  Source char = "G".

GDACS (Global Disaster Alert & Coordination System, JRC):
    ~6500 FL events, 2000-2025, fetched per-month from the SEARCH API.
    Geometry is a single Point per event (no polygon footprint is published).
    We buffer each point by a radius derived from the alert level, matching
    GDACS's own qualitative severity tiers:
        Green  -> 10 km
        Orange -> 25 km
        Red    -> 50 km
    Source char = "C" (Copernicus/GDACS).

Output
------
TRAD_HEX_YEARS parquet: columns [h, year, src]
    where src is a concatenation of unique source chars for that (h, year).
    One row per (hex, year, sources) triple.
"""

from __future__ import annotations

import csv
import glob
import json
import logging
import re
import sys
import time
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Iterable

import geopandas as gpd
import h3
import pandas as pd
from shapely import wkb  # noqa: F401 — kept for parity with 01_hex_index.py
from shapely.geometry import MultiPolygon, Point, Polygon, mapping
from shapely.ops import transform as shp_transform

from config import (
    DFO_GPKG,
    GDACS_MONTHLY_DIR,
    GFD_QC_CSV,
    H3_RESOLUTION_TRAD,
    MAX_YEAR,
    TRAD_HEX_YEARS,
    ensure_dirs,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
log = logging.getLogger(__name__)

# Same tunable as 01_hex_index.py: polygons <100 km² use centroid-only.
AREA_THRESHOLD_KM2 = 100.0

# GDACS alert-level -> buffer radius (km). Values chosen so that a "Green"
# event covers roughly 1 hex, Orange ~3-4 hexes, Red ~10-15 hexes, matching
# the qualitative meaning of those alerts and staying below the median DFO
# polygon footprint.
GDACS_BUFFER_KM = {
    "Green": 10.0,
    "Orange": 25.0,
    "Red": 50.0,
}
GDACS_DEFAULT_BUFFER_KM = 10.0


# ---------------------------------------------------------------------------
# Shared polygon -> hex conversion
# ---------------------------------------------------------------------------

def geom_to_h3_cells(geom, resolution: int) -> set[str]:
    """Convert a shapely geometry (Polygon or MultiPolygon) to H3 cells."""
    if geom is None or geom.is_empty:
        return set()

    # Cheap area proxy in km² via equal-area projection.  Using the bounds
    # projected to EPSG:6933 would be more accurate, but the threshold is
    # just a speed-vs-accuracy dial — degrees² * 12391 is close enough near
    # the equator.
    try:
        minx, miny, maxx, maxy = geom.bounds
        lat_mid = (miny + maxy) / 2.0
        import math
        deg_km = 111.0 * math.cos(math.radians(lat_mid))
        approx_area_km2 = (maxx - minx) * deg_km * (maxy - miny) * 111.0
    except Exception:
        approx_area_km2 = 1000.0  # force polyfill on weird geoms

    if approx_area_km2 < AREA_THRESHOLD_KM2:
        c = geom.centroid
        try:
            return {h3.latlng_to_cell(c.y, c.x, resolution)}
        except Exception:
            return set()

    gj = mapping(geom)
    hexes: set[str] = set()
    try:
        if gj["type"] == "MultiPolygon":
            for coords in gj["coordinates"]:
                single = {"type": "Polygon", "coordinates": coords}
                try:
                    hexes.update(h3.geo_to_cells(single, res=resolution))
                except Exception:
                    pass
        else:
            hexes.update(h3.geo_to_cells(gj, res=resolution))
    except Exception:
        pass

    if not hexes:
        # Polyfill returned nothing (very thin polygon crossing no cell center)
        try:
            c = geom.centroid
            hexes.add(h3.latlng_to_cell(c.y, c.x, resolution))
        except Exception:
            pass
    return hexes


# ---------------------------------------------------------------------------
# DFO loader
# ---------------------------------------------------------------------------

def iter_dfo_events() -> Iterable[tuple[set[str], int]]:
    """Yield (hex_set, year) for each DFO event whose year is <= MAX_YEAR."""
    if not DFO_GPKG.exists():
        log.warning(f"DFO gpkg missing: {DFO_GPKG}")
        return

    log.info(f"Loading DFO polygons from {DFO_GPKG} ...")
    gdf = gpd.read_file(DFO_GPKG)
    log.info(f"  {len(gdf):,} DFO events loaded")

    gdf["year"] = pd.to_datetime(gdf["BeginDate"], errors="coerce").dt.year
    before = len(gdf)
    gdf = gdf[(gdf["year"].notna()) & (gdf["year"] <= MAX_YEAR)].copy()
    log.info(f"  filtered by year<={MAX_YEAR}: {before:,} -> {len(gdf):,}")

    for idx, row in enumerate(gdf.itertuples(index=False), start=1):
        year = int(row.year)
        hexes = geom_to_h3_cells(row.geometry, H3_RESOLUTION_TRAD)
        if hexes:
            yield hexes, year
        if idx % 500 == 0:
            log.info(f"  DFO processed {idx:,}/{len(gdf):,}")


# ---------------------------------------------------------------------------
# GFD loader — parse inline KML polygon geometry
# ---------------------------------------------------------------------------

_COORD_RE = re.compile(r"([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)")


def _parse_kml_geom(kml_text: str):
    """Parse the inline KML <Polygon>/<MultiGeometry> in the GFD QC DB."""
    if not kml_text or not kml_text.strip():
        return None
    try:
        # KML has no namespace in this file; wrap for etree
        root = ET.fromstring(f"<root>{kml_text}</root>")
    except ET.ParseError:
        return None

    polys: list[Polygon] = []
    for poly_el in root.iter("Polygon"):
        outer = poly_el.find(".//outerBoundaryIs/LinearRing/coordinates")
        if outer is None or not outer.text:
            continue
        coords = [(float(lng), float(lat)) for lng, lat in _COORD_RE.findall(outer.text)]
        if len(coords) >= 3:
            try:
                polys.append(Polygon(coords))
            except Exception:
                pass

    if not polys:
        return None
    if len(polys) == 1:
        return polys[0]
    return MultiPolygon(polys)


def iter_gfd_events() -> Iterable[tuple[set[str], int]]:
    if not GFD_QC_CSV.exists():
        log.warning(f"GFD QC CSV missing: {GFD_QC_CSV}")
        return

    log.info(f"Loading GFD QC database from {GFD_QC_CSV} ...")
    rows_processed = 0
    rows_geom_ok = 0
    with open(GFD_QC_CSV, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows_processed += 1
            began = row.get("Began", "").strip()
            try:
                year = pd.to_datetime(began, errors="coerce").year
            except Exception:
                year = None
            if not year or year > MAX_YEAR:
                continue

            geom = _parse_kml_geom(row.get("geometry", ""))
            if geom is None:
                continue
            hexes = geom_to_h3_cells(geom, H3_RESOLUTION_TRAD)
            if hexes:
                rows_geom_ok += 1
                yield hexes, int(year)
    log.info(f"  GFD rows read: {rows_processed:,}  with usable geom: {rows_geom_ok:,}")


# ---------------------------------------------------------------------------
# GDACS loader — point + alert-level buffer
# ---------------------------------------------------------------------------

def _buffer_point_hexes(lon: float, lat: float, radius_km: float) -> set[str]:
    """Return the set of H3 cells within radius_km of (lon, lat).

    Uses h3.grid_disk on the seed cell.  At res 5 (~252 km² per hex, edge
    length ~8.5 km), the rings of a grid_disk cover approximately:
        k=1 -> radius ~15 km   (7 cells)
        k=2 -> radius ~25 km   (19 cells)
        k=3 -> radius ~35 km   (37 cells)
        k=4 -> radius ~45 km   (61 cells)
        k=5 -> radius ~55 km   (91 cells)
    """
    try:
        seed = h3.latlng_to_cell(lat, lon, H3_RESOLUTION_TRAD)
    except Exception:
        return set()

    # Mean hex edge length at the configured trad resolution.
    try:
        HEX_EDGE_KM = h3.average_hexagon_edge_length(H3_RESOLUTION_TRAD, unit="km")
    except (TypeError, AttributeError):
        # h3-py v3 fallback / hardcoded values per resolution
        HEX_EDGE_KM = {5: 9.854, 6: 3.724, 7: 1.406}.get(H3_RESOLUTION_TRAD, 9.854)
    k = max(0, int(round(radius_km / HEX_EDGE_KM)))
    try:
        return set(h3.grid_disk(seed, k))
    except Exception:
        return {seed}


def iter_gdacs_events() -> Iterable[tuple[set[str], int]]:
    if not GDACS_MONTHLY_DIR.exists():
        log.warning(f"GDACS dir missing: {GDACS_MONTHLY_DIR}")
        return

    paths = sorted(Path(GDACS_MONTHLY_DIR).glob("fl_*.json"))
    log.info(f"Loading GDACS events from {len(paths)} monthly files ...")

    seen_eventids: set[int] = set()
    total = 0
    for p in paths:
        if p.stat().st_size == 0:
            continue
        try:
            with open(p) as f:
                fc = json.load(f)
        except Exception as e:
            log.warning(f"  bad json {p.name}: {e}")
            continue
        for feat in fc.get("features", []):
            props = feat.get("properties", {}) or {}
            eid = props.get("eventid")
            if eid in seen_eventids:
                continue
            if eid is not None:
                seen_eventids.add(eid)

            fromdate = props.get("fromdate") or ""
            try:
                year = int(fromdate[:4])
            except Exception:
                continue
            if year > MAX_YEAR:
                continue

            alert = (props.get("alertlevel") or "").strip()
            radius_km = GDACS_BUFFER_KM.get(alert, GDACS_DEFAULT_BUFFER_KM)

            geom = feat.get("geometry") or {}
            gtype = geom.get("type")
            coords = geom.get("coordinates")
            if gtype != "Point" or not coords or len(coords) < 2:
                continue
            lon, lat = float(coords[0]), float(coords[1])

            hexes = _buffer_point_hexes(lon, lat, radius_km)
            if hexes:
                total += 1
                yield hexes, year
    log.info(f"  GDACS unique events with hexes: {total:,}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    ensure_dirs()
    t0 = time.time()

    # (hex, year) -> set of source chars
    hy_sources: dict[tuple[str, int], set[str]] = defaultdict(set)

    sources = [
        ("D", "DFO",   iter_dfo_events),
        ("G", "GFD",   iter_gfd_events),
        ("C", "GDACS", iter_gdacs_events),
    ]

    for src_char, label, iter_fn in sources:
        count_events = 0
        count_hexes_added = 0
        ts = time.time()
        for hexes, year in iter_fn():
            count_events += 1
            for h in hexes:
                hy_sources[(h, year)].add(src_char)
            count_hexes_added += len(hexes)
        log.info(
            f"[{label}] events={count_events:,}  hex-records={count_hexes_added:,}  "
            f"({time.time() - ts:.1f}s)"
        )

    if not hy_sources:
        log.error("No (hex, year) tuples produced. Aborting.")
        sys.exit(1)

    # Flatten to DataFrame: one row per (hex, year) with concatenated src
    rows = []
    for (h, year), srcs in hy_sources.items():
        rows.append({
            "h": h,
            "year": int(year),
            "src": "".join(sorted(srcs)),  # e.g. "D", "DG", "DGC"
        })
    df = pd.DataFrame(rows)
    log.info(f"Unique (hex, year): {len(df):,}")
    log.info(f"Unique hexes:       {df['h'].nunique():,}")
    log.info(f"Year range:         {df['year'].min()} - {df['year'].max()}")
    log.info(f"Source mix at (hex,year) level:")
    for s, n in df["src"].value_counts().head(10).items():
        log.info(f"    {s:<4}  {n:,}")

    df.to_parquet(TRAD_HEX_YEARS, index=False)
    log.info(f"Wrote {TRAD_HEX_YEARS}  ({len(df):,} rows)  in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
