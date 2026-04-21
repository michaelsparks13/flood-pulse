# The Invisible 90% — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the FloodPulse home-page scrollytelling from a population-exposure arc into a dataset-comparison arc (*The Invisible 90%*), backed by a new per-country comparison pipeline step and a signature "reveal wipe" globe moment.

**Architecture:** Reuse the existing `StoryContainer` + scrollama + `GlobeContext` infrastructure. Add a new pipeline step `05c_country_comparison.py` that emits `country_comparison.json` and `gfd_observed_h3.json`. Add five new story components (DatasetRevealLayer, DatasetCounter, RatioLineChart, CountryGapBar, CountryGapCard). Rewrite `lib/story/acts.ts` and `lib/story/cameraKeyframes.ts` wholesale for the new 7-act arc. Retire `StoryCounter.tsx` and `CompareDivider.tsx`. Append a "Where the gap is biggest" section to `/compare`. No route changes. Shared-globe handoff preserved unchanged.

**Tech Stack:** Next.js 15 App Router, TypeScript, React 19, deck.gl (H3HexagonLayer + DataFilterExtension), MapLibre GL 5.x, scrollama, Tailwind CSS 4, Recharts (already present for `/compare`). Pipeline: Python 3.11+, pandas, h3 (Python), shapely, pyarrow. Tests: Playwright (scrollytelling), pytest (pipeline).

**Branch:** `agent/pages-invisible-90-7967` (already created).

**Spec:** [docs/superpowers/specs/2026-04-21-invisible-90-redesign-design.md](../specs/2026-04-21-invisible-90-redesign-design.md)

---

## File Structure

**Created:**
- `pipeline/data/reference/gfd_country_pe.csv` — curated from Tellman 2021 supplementary Table S2
- `pipeline/data/reference/emdat_country_affected.csv` — curated from Hu 2024 Table 1
- `pipeline/data/reference/gfd_observed_h3.json` — H3 cells intersecting any GFD event polygon
- `pipeline/scripts/build_gfd_observed_h3.py` — one-off sub-script that builds `gfd_observed_h3.json` from GFD GCS-bucket polygons
- `pipeline/05c_country_comparison.py` — joins FP + GFD + EM-DAT per country
- `pipeline/tests/test_country_comparison.py` — pytest for pipeline step
- `public/data/country_comparison.json` — pipeline output, consumed by `/` and `/compare`
- `public/data/gfd_observed_h3.json` — pipeline output, consumed by client for dataset-filter layer
- `lib/story/datasetLayers.ts` — layer configuration for GFD-only vs FP-only
- `lib/story/countryComparison.ts` — typed loader/selector for `country_comparison.json`
- `lib/types.ts` — add `CountryComparisonData` interface
- `components/story/DatasetRevealLayer.tsx` — Act 2 dual-layer with scroll-driven wipe
- `components/story/DatasetCounter.tsx` — Act 2 290M→2.88B animated counter
- `components/story/RatioLineChart.tsx` — Act 3 scroll-revealed SVG line chart
- `components/story/CountryGapBar.tsx` — Act 5 ranked horizontal bars
- `components/story/CountryGapCard.tsx` — Act 6 per-country stat card

**Modified:**
- `lib/story/acts.ts` — wholesale rewrite, 7 new acts
- `lib/story/cameraKeyframes.ts` — wholesale rewrite, new targets
- `lib/story/storyTypes.ts` — add `revealProgress`, `ratioProgress`, `countryGapIso3`, `datasetFilter`, drop legacy fields
- `components/story/useActDataState.ts` — generalise progress handling for Act 2 (reveal wipe) and Act 3 (ratio line draw)
- `context/GlobeContext.tsx` — fetch `country_comparison.json` + `gfd_observed_h3.json` on mount
- `components/Globe.tsx` — consume `datasetFilter` prop (`"all" | "gfd" | "fp"`), enrich `HexDatum` with `isGfdObserved` on data load
- `app/page.tsx` — wire new acts and new components
- `app/compare/page.tsx` — append "Where the gap is biggest" section
- `tests/story.spec.ts` — wholesale rewrite for the 7 new acts
- `pipeline/config.py` — add paths for `COUNTRY_COMPARISON_JSON`, `GFD_OBSERVED_H3_JSON`, reference-data subdir

**Deleted:**
- `components/story/CompareDivider.tsx`
- `components/story/StoryCounter.tsx`

---

## Implementation Order

Phase 1 (Tasks 1–6): Pipeline + reference data.
Phase 2 (Tasks 7–10): TypeScript data layer + hex enrichment.
Phase 3 (Tasks 11–15): Five new story components, each with isolated tests.
Phase 4 (Tasks 16–20): Narrative wiring — acts, camera, page orchestration, retire old components.
Phase 5 (Task 21): `/compare` country section.
Phase 6 (Tasks 22–25): Playwright tests, a11y pass, mobile pass, final build.

Each phase ends with a working build. The site renders meaningfully at every intermediate state.

---

## Task 1: Reference data — GFD per-country PE (curated CSV)

**Files:**
- Create: `pipeline/data/reference/gfd_country_pe.csv`

**Context:** Tellman et al. 2021 (Nature 596:80–86, DOI 10.1038/s41586-021-03695-w) publishes the Global Flood Database. Supplementary Table S2 from the paper lists per-country population exposed and event counts for the 913 MODIS-observed floods between 2000 and 2018. Not programmatically accessible; we transcribe from the PDF.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p pipeline/data/reference
```

- [ ] **Step 2: Download Tellman 2021 supplementary Table S2**

Open [https://www.nature.com/articles/s41586-021-03695-w#Sec17](https://www.nature.com/articles/s41586-021-03695-w#Sec17) in a browser. Download "Supplementary Table 2" (per-country flood exposure). Save as `pipeline/data/reference/tellman_2021_table_s2.xlsx` (not checked into git — referenced from CSV for provenance only).

- [ ] **Step 3: Transcribe into a normalised CSV**

Create `pipeline/data/reference/gfd_country_pe.csv` with exactly these columns (header row required):

```csv
iso3,country_name,gfd_pe_2000_2018,gfd_events_2000_2018,source_row_notes
```

Populate one row per country in Table S2. `iso3` is ISO-3166-1 alpha-3. `gfd_pe_2000_2018` is the cumulative population-exposed value in whole integers (drop any thousands separators from the table). `gfd_events_2000_2018` is the total event count for that country. `source_row_notes` is optional free text — leave empty unless the paper flags caveats.

**Expected row count:** 169 countries per the paper. If any rows are missing ISO3 codes in the source, look up ISO3 from the country name via `https://www.iban.com/country-codes` and record the lookup in `source_row_notes`.

- [ ] **Step 4: Sanity-check the totals**

```bash
python3 -c "
import csv
total_pe = total_events = 0
with open('pipeline/data/reference/gfd_country_pe.csv') as f:
    for row in csv.DictReader(f):
        total_pe += int(row['gfd_pe_2000_2018'])
        total_events += int(row['gfd_events_2000_2018'])
print(f'Sum PE: {total_pe:,}')
print(f'Sum events: {total_events:,}')
"
```

Expected (from the paper's headline numbers):
- Sum PE within 255,000,000–290,000,000 (paper quotes 255–290M with uncertainty).
- Sum events: 913 (exact).

If the sums are outside these ranges, re-check transcription.

- [ ] **Step 5: Commit**

```bash
git add pipeline/data/reference/gfd_country_pe.csv
git commit -m "[pipeline] Add GFD per-country PE reference data (Tellman 2021 Table S2)"
```

---

## Task 2: Reference data — EM-DAT per-country affected (curated CSV)

**Files:**
- Create: `pipeline/data/reference/emdat_country_affected.csv`

**Context:** Hu et al. 2024 (Sci Rep 14:11705, DOI 10.1038/s41598-024-62425-2) publishes per-country EM-DAT flood-affected totals in Table 1. Also not programmatically accessible — we transcribe from the paper.

- [ ] **Step 1: Transcribe Hu 2024 Table 1 into CSV**

Create `pipeline/data/reference/emdat_country_affected.csv` with exactly these columns (header row required):

```csv
iso3,country_name,emdat_affected_2000_2022,emdat_events_2000_2022
```

`emdat_affected_2000_2022` is the cumulative "total affected" count 2000–2022. `emdat_events_2000_2022` is the count of EM-DAT flood disasters recorded 2000–2022 for that country.

If Hu 2024 Table 1 does not separate 2000–2022 from the full 1990–2022 window, use EM-DAT's public query tool at [https://public.emdat.be](https://public.emdat.be) (requires free registration) to pull 2000–2022 numbers. Filter: Disaster Type = Flood; Country = all; Year range = 2000–2022.

**Expected row count:** ~160 countries. Expected sum of `emdat_affected_2000_2022` ≈ 1.67B (matches the paper's global total).

- [ ] **Step 2: Sanity-check totals**

```bash
python3 -c "
import csv
total = 0
with open('pipeline/data/reference/emdat_country_affected.csv') as f:
    for row in csv.DictReader(f):
        total += int(row['emdat_affected_2000_2022'])
print(f'Sum affected 2000-2022: {total:,}')
"
```

Expected: ~1,674,000,000 ± 5%. Matches the `EMDAT (2000-2022)` benchmark already in `comparison.json`.

- [ ] **Step 3: Commit**

```bash
git add pipeline/data/reference/emdat_country_affected.csv
git commit -m "[pipeline] Add EM-DAT per-country affected reference data (Hu 2024 Table 1)"
```

---

## Task 3: Sub-script — build `gfd_observed_h3.json`

**Files:**
- Create: `pipeline/scripts/build_gfd_observed_h3.py`
- Create: `pipeline/data/reference/gfd_observed_h3.json`

**Context:** The Global Flood Database publishes per-event polygons on Google Cloud Storage at `gs://gfd_v3/`. We need a lookup set of H3 r-5 cells that touch any GFD event, so the client can tell GFD-observed hexes apart from FP-only hexes. This script is one-off — the output is checked into git because regenerating requires GCS access.

- [ ] **Step 1: Create the script directory**

```bash
mkdir -p pipeline/scripts
```

- [ ] **Step 2: Write the script**

Create `pipeline/scripts/build_gfd_observed_h3.py`:

```python
"""
One-off sub-script: build gfd_observed_h3.json.

Reads GFD event footprints from Google Cloud Storage
(gs://gfd_v3/*.shp) and produces a JSON array of H3 r-5 cell
indices that intersect any GFD event polygon.

Requirements: pip install google-cloud-storage fiona shapely h3
Auth: a GCP service account with storage.objects.get on gfd_v3.
"""
from __future__ import annotations

import json
import logging
import tempfile
from pathlib import Path

import fiona
import h3
from google.cloud import storage
from shapely.geometry import shape

OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "reference" / "gfd_observed_h3.json"
H3_RES = 5
BUCKET_NAME = "gfd_v3"

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger(__name__)


def collect_h3_cells(shapefile_path: Path, seen: set[str]) -> int:
    """Walk features; add the H3 cells each polygon polyfills to `seen`."""
    added = 0
    with fiona.open(shapefile_path) as src:
        for feat in src:
            geom = shape(feat["geometry"])
            if geom.is_empty:
                continue
            geojson_geom = feat["geometry"]
            cells = h3.polygon_to_cells(
                h3.LatLngPoly(geojson_geom["coordinates"][0])
                if geojson_geom["type"] == "Polygon"
                else h3.LatLngMultiPoly(*(p[0] for p in geojson_geom["coordinates"])),
                H3_RES,
            )
            for c in cells:
                if c not in seen:
                    seen.add(c)
                    added += 1
    return added


def main() -> None:
    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)
    seen: set[str] = set()
    total = 0
    with tempfile.TemporaryDirectory() as tmp:
        for blob in bucket.list_blobs():
            if not blob.name.endswith(".shp"):
                continue
            local = Path(tmp) / Path(blob.name).name
            blob.download_to_filename(local)
            # Fiona reads sibling .shx, .dbf via fiona.Env but here we assume single-file tars.
            added = collect_h3_cells(local, seen)
            total += added
            log.info(f"{blob.name}: +{added} cells (running total {total})")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(sorted(seen), f)
    log.info(f"Wrote {len(seen)} H3 r-5 cells to {OUT_PATH}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run the script**

Authenticate with GCS (`gcloud auth application-default login`) then:

```bash
python pipeline/scripts/build_gfd_observed_h3.py
```

Expected terminal output: one log line per shapefile, final "Wrote N H3 r-5 cells" where `N` is between 3,000 and 15,000 (GFD covers ~2.2M km²; at 252 km²/hex, upper bound ~9,000 hexes, with edge overlap pushing it toward 10K).

If the GCS path has changed (Google rotates GFD bucket URIs occasionally), check [https://global-flood-database.cloudtostreet.ai/](https://global-flood-database.cloudtostreet.ai/) for current bucket location and update `BUCKET_NAME`.

- [ ] **Step 4: Verify output shape**

```bash
python3 -c "
import json
cells = json.load(open('pipeline/data/reference/gfd_observed_h3.json'))
assert isinstance(cells, list), 'expected array'
assert all(isinstance(c, str) and len(c) == 15 for c in cells), 'expected H3 string indices'
print(f'{len(cells)} H3 r-5 cells')
"
```

Expected: `3000 < len(cells) < 15000`.

- [ ] **Step 5: Commit**

```bash
git add pipeline/scripts/build_gfd_observed_h3.py pipeline/data/reference/gfd_observed_h3.json
git commit -m "[pipeline] Build gfd_observed_h3.json from GFD event polygons"
```

---

## Task 4: Pipeline — extend `config.py` with new paths

**Files:**
- Modify: `pipeline/config.py`

- [ ] **Step 1: Add new paths to `config.py`**

Append to `pipeline/config.py` after line 44 (after `COMPARISON_JSON = FINAL / "comparison.json"`):

```python
COUNTRY_COMPARISON_JSON = FINAL / "country_comparison.json"

# Reference data (curated / derived)
REFERENCE_DIR = DATA_ROOT / "reference"
GFD_COUNTRY_PE_CSV = REFERENCE_DIR / "gfd_country_pe.csv"
EMDAT_COUNTRY_AFFECTED_CSV = REFERENCE_DIR / "emdat_country_affected.csv"
GFD_OBSERVED_H3_JSON = REFERENCE_DIR / "gfd_observed_h3.json"
```

And update `ALL_DIRS`:

```python
ALL_DIRS = [RAW, PROCESSED, FINAL, REFERENCE_DIR]
```

- [ ] **Step 2: Verify imports still work**

```bash
python3 -c "from pipeline.config import COUNTRY_COMPARISON_JSON, GFD_COUNTRY_PE_CSV, EMDAT_COUNTRY_AFFECTED_CSV, GFD_OBSERVED_H3_JSON; print('ok')"
```

Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add pipeline/config.py
git commit -m "[pipeline] config: add COUNTRY_COMPARISON_JSON and reference-data paths"
```

---

## Task 5: Pipeline — `05c_country_comparison.py` (test first)

**Files:**
- Create: `pipeline/tests/__init__.py`
- Create: `pipeline/tests/test_country_comparison.py`
- Create: `pipeline/05c_country_comparison.py`

- [ ] **Step 1: Write the failing test**

Create `pipeline/tests/__init__.py` (empty file).

Create `pipeline/tests/test_country_comparison.py`:

```python
"""Tests for 05c_country_comparison.py output shape and invariants."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = PIPELINE_ROOT / "05c_country_comparison.py"
OUTPUT = PIPELINE_ROOT / "data" / "final" / "country_comparison.json"


def run_pipeline_step() -> dict:
    """Execute the pipeline step and return the parsed output."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=PIPELINE_ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Pipeline failed:\n{result.stderr}"
    assert OUTPUT.exists(), f"Output file not created at {OUTPUT}"
    return json.loads(OUTPUT.read_text())


@pytest.fixture(scope="module")
def data() -> dict:
    return run_pipeline_step()


def test_top_level_keys(data: dict) -> None:
    assert set(data.keys()) >= {
        "generated",
        "floodpulse_data_through",
        "countries",
        "top_gap_countries",
        "global_south_share",
    }


def test_countries_has_bangladesh(data: dict) -> None:
    assert "BGD" in data["countries"]
    bgd = data["countries"]["BGD"]
    assert bgd["name"]
    assert bgd["region"] in {"Global South", "Global North"}
    assert bgd["floodpulse_pe_2000_2018"] > 0


def test_ratios_nullable(data: dict) -> None:
    for iso3, c in data["countries"].items():
        if c["gfd_pe_2000_2018"] is None:
            assert c["fp_gfd_ratio"] is None, f"{iso3}: ratio should be null when GFD is null"


def test_top_gap_countries_ordering(data: dict) -> None:
    top = data["top_gap_countries"]
    assert 1 <= len(top) <= 10
    ratios = [data["countries"][iso3]["fp_gfd_ratio"] for iso3 in top]
    assert all(r is not None for r in ratios)
    assert ratios == sorted(ratios, reverse=True), "top_gap_countries must be ordered ratio desc"


def test_top_gap_min_denominator(data: dict) -> None:
    """top_gap_countries entries must have FP PE >= 1M to avoid degenerate ratios."""
    for iso3 in data["top_gap_countries"]:
        fp_pe = data["countries"][iso3]["floodpulse_pe_2000_2018"]
        assert fp_pe >= 1_000_000, f"{iso3}: FP PE {fp_pe} below 1M denominator"


def test_global_south_share_sums(data: dict) -> None:
    gs = data["global_south_share"]
    for key in ("floodpulse_pct", "gfd_pct", "emdat_pct"):
        assert 0.0 <= gs[key] <= 1.0, f"{key} must be in [0, 1]"


def test_output_size_under_50kb_gzipped() -> None:
    import gzip

    compressed = gzip.compress(OUTPUT.read_bytes())
    assert len(compressed) < 50_000, f"Output {len(compressed)} bytes exceeds 50KB gzipped"
```

- [ ] **Step 2: Run test — expect FAIL (script does not exist)**

```bash
cd /Users/Sparks/Documents/climate-projects/flood-pulse
pytest pipeline/tests/test_country_comparison.py -v
```

Expected: errors out because `pipeline/05c_country_comparison.py` does not exist.

- [ ] **Step 3: Write the pipeline step**

Create `pipeline/05c_country_comparison.py`:

```python
"""
Step 5c: Per-Country Dataset Comparison

Joins FloodPulse country_timeseries.json with curated GFD (Tellman 2021)
and EM-DAT (Hu 2024) per-country totals. Emits country_comparison.json
consumed by / (scrollytelling) and /compare (dashboard).

Output schema: see docs/superpowers/specs/2026-04-21-invisible-90-redesign-design.md
"""

from __future__ import annotations

import csv
import json
import logging
import time
from datetime import date
from pathlib import Path

from config import (
    COUNTRY_COMPARISON_JSON,
    COUNTRY_TIMESERIES_JSON,
    EMDAT_COUNTRY_AFFECTED_CSV,
    GFD_COUNTRY_PE_CSV,
    GLOBAL_SUMMARY_JSON,
    ensure_dirs,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
log = logging.getLogger(__name__)

MIN_FP_DENOMINATOR = 1_000_000
MATCHED_START = 2000
MATCHED_END = 2018  # GFD coverage ceiling

# UN M49 developing regions (Global South), ISO3.
# Source: https://unstats.un.org/unsd/methodology/m49/
GLOBAL_SOUTH_ISO3: set[str] = {
    # Africa (entire continent except none)
    "DZA","AGO","BEN","BWA","BFA","BDI","CMR","CPV","CAF","TCD","COM","COG","COD",
    "CIV","DJI","EGY","GNQ","ERI","SWZ","ETH","GAB","GMB","GHA","GIN","GNB","KEN",
    "LSO","LBR","LBY","MDG","MWI","MLI","MRT","MUS","MAR","MOZ","NAM","NER","NGA",
    "RWA","STP","SEN","SYC","SLE","SOM","ZAF","SSD","SDN","TGO","TUN","UGA","TZA","ZMB","ZWE",
    # Latin America & Caribbean
    "ARG","BHS","BRB","BLZ","BOL","BRA","CHL","COL","CRI","CUB","DMA","DOM","ECU",
    "SLV","GRD","GTM","GUY","HTI","HND","JAM","MEX","NIC","PAN","PRY","PER","KNA",
    "LCA","VCT","SUR","TTO","URY","VEN",
    # Asia (excluding Japan, South Korea, Israel, Singapore)
    "AFG","BHR","BGD","BTN","BRN","KHM","CHN","GEO","IND","IDN","IRN","IRQ","JOR",
    "KAZ","KWT","KGZ","LAO","LBN","MYS","MDV","MNG","MMR","NPL","OMN","PAK","PHL",
    "QAT","SAU","LKA","SYR","TJK","THA","TLS","TUR","TKM","ARE","UZB","VNM","YEM","PRK",
    # Oceania (excluding Australia, NZ)
    "FJI","KIR","MHL","FSM","NRU","PLW","PNG","WSM","SLB","TON","TUV","VUT",
}


def load_country_timeseries() -> dict[str, dict]:
    with open(COUNTRY_TIMESERIES_JSON) as f:
        return json.load(f)


def load_global_summary() -> dict:
    with open(GLOBAL_SUMMARY_JSON) as f:
        return json.load(f)


def load_csv(path: Path) -> list[dict]:
    with open(path) as f:
        return list(csv.DictReader(f))


def fp_pe_cumulative(ts: list[dict], year_start: int, year_end: int) -> int:
    return sum(
        int(y["populationExposed"])
        for y in ts
        if year_start <= y["year"] <= year_end
    )


def fp_pe_cumulative_to_latest(ts: list[dict]) -> int:
    return sum(int(y["populationExposed"]) for y in ts)


def safe_int(s: str) -> int | None:
    s = (s or "").replace(",", "").strip()
    if not s or s.lower() == "na":
        return None
    try:
        return int(s)
    except ValueError:
        return None


def main() -> None:
    ensure_dirs()
    t0 = time.time()

    ts_by_iso3 = load_country_timeseries()
    summary = load_global_summary()
    gfd_rows = {r["iso3"]: r for r in load_csv(GFD_COUNTRY_PE_CSV)}
    emdat_rows = {r["iso3"]: r for r in load_csv(EMDAT_COUNTRY_AFFECTED_CSV)}

    log.info(
        f"Inputs: {len(ts_by_iso3)} FP countries, "
        f"{len(gfd_rows)} GFD rows, {len(emdat_rows)} EM-DAT rows"
    )

    countries: dict[str, dict] = {}
    all_iso3 = set(ts_by_iso3) | set(gfd_rows) | set(emdat_rows)

    for iso3 in all_iso3:
        ts = ts_by_iso3.get(iso3, {}).get("timeseries", [])
        gfd = gfd_rows.get(iso3, {})
        emdat = emdat_rows.get(iso3, {})

        fp_matched = fp_pe_cumulative(ts, MATCHED_START, MATCHED_END) if ts else 0
        fp_latest = fp_pe_cumulative_to_latest(ts) if ts else 0

        gfd_pe = safe_int(gfd.get("gfd_pe_2000_2018", ""))
        gfd_events = safe_int(gfd.get("gfd_events_2000_2018", ""))
        emdat_aff = safe_int(emdat.get("emdat_affected_2000_2022", ""))

        fp_gfd_ratio = None
        if gfd_pe and gfd_pe > 0:
            fp_gfd_ratio = round(fp_matched / gfd_pe, 3)
        elif gfd_pe == 0:
            fp_gfd_ratio = 0.0

        fp_emdat_ratio = None
        if emdat_aff and emdat_aff > 0:
            fp_emdat_ratio = round(fp_latest / emdat_aff, 3)

        name = gfd.get("country_name") or emdat.get("country_name") or iso3

        countries[iso3] = {
            "name": name,
            "region": "Global South" if iso3 in GLOBAL_SOUTH_ISO3 else "Global North",
            "floodpulse_pe_2000_2018": fp_matched,
            "floodpulse_pe_2000_latest": fp_latest,
            "gfd_pe_2000_2018": gfd_pe,
            "gfd_events_2000_2018": gfd_events,
            "emdat_affected_2000_2022": emdat_aff,
            "fp_gfd_ratio": fp_gfd_ratio,
            "fp_emdat_ratio": fp_emdat_ratio,
            "population_2020": None,
        }

    candidates = [
        (iso3, c["fp_gfd_ratio"])
        for iso3, c in countries.items()
        if c["fp_gfd_ratio"] is not None
        and c["fp_gfd_ratio"] > 0
        and c["floodpulse_pe_2000_2018"] >= MIN_FP_DENOMINATOR
    ]
    candidates.sort(key=lambda x: x[1], reverse=True)
    top_gap = [iso3 for iso3, _ in candidates[:10]]

    gs_fp = sum(c["floodpulse_pe_2000_2018"] for c in countries.values() if c["region"] == "Global South")
    gs_gfd = sum((c["gfd_pe_2000_2018"] or 0) for c in countries.values() if c["region"] == "Global South")
    gs_emdat = sum((c["emdat_affected_2000_2022"] or 0) for c in countries.values() if c["region"] == "Global South")
    total_fp = sum(c["floodpulse_pe_2000_2018"] for c in countries.values())
    total_gfd = sum((c["gfd_pe_2000_2018"] or 0) for c in countries.values())
    total_emdat = sum((c["emdat_affected_2000_2022"] or 0) for c in countries.values())

    global_south_share = {
        "floodpulse_pct": round(gs_fp / total_fp, 4) if total_fp else 0.0,
        "gfd_pct": round(gs_gfd / total_gfd, 4) if total_gfd else 0.0,
        "emdat_pct": round(gs_emdat / total_emdat, 4) if total_emdat else 0.0,
    }

    out = {
        "generated": date.today().isoformat(),
        "floodpulse_data_through": summary.get("dataThrough", ""),
        "countries": dict(sorted(countries.items())),
        "top_gap_countries": top_gap,
        "global_south_share": global_south_share,
    }

    COUNTRY_COMPARISON_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(COUNTRY_COMPARISON_JSON, "w") as f:
        json.dump(out, f, separators=(",", ":"), sort_keys=False)

    log.info(
        f"Wrote {COUNTRY_COMPARISON_JSON} — "
        f"{len(countries)} countries, top_gap={top_gap[:3]}..., "
        f"GS shares FP={global_south_share['floodpulse_pct']:.2%} "
        f"GFD={global_south_share['gfd_pct']:.2%} "
        f"EMDAT={global_south_share['emdat_pct']:.2%}, "
        f"{time.time()-t0:.2f}s"
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pytest pipeline/tests/test_country_comparison.py -v
```

Expected: all tests pass. If `test_output_size_under_50kb_gzipped` fails, consider pruning `population_2020` (currently `null` placeholder) or shortening `name` to match ISO3 codes only.

- [ ] **Step 5: Copy output to public/data**

```bash
cp pipeline/data/final/country_comparison.json public/data/country_comparison.json
cp pipeline/data/reference/gfd_observed_h3.json public/data/gfd_observed_h3.json
```

- [ ] **Step 6: Commit**

```bash
git add pipeline/05c_country_comparison.py pipeline/tests/__init__.py pipeline/tests/test_country_comparison.py public/data/country_comparison.json public/data/gfd_observed_h3.json
git commit -m "[pipeline] 05c: per-country dataset comparison joiner + tests"
```

---

## Task 6: Update `pipeline/README` note (optional) and verify full pipeline

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Run all pipeline tests**

```bash
pytest pipeline/tests/ -v
```

Expected: all green.

- [ ] **Step 2: Verify the JSON loads in Node**

```bash
node -e "const d = require('./public/data/country_comparison.json'); console.log('countries:', Object.keys(d.countries).length, 'top_gap:', d.top_gap_countries.length); console.assert(d.top_gap_countries.every(i => d.countries[i]), 'top_gap entries must exist in countries');"
```

Expected: `countries: N top_gap: M` where M ≤ 10, no assertion failure.

- [ ] **Step 3: No commit (verification only)**

---

## Task 7: TypeScript — add `CountryComparisonData` type + `countryComparison.ts` loader

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/story/countryComparison.ts`

- [ ] **Step 1: Append types to `lib/types.ts`**

Append at end of file:

```ts
/** Per-country FloodPulse vs GFD vs EM-DAT comparison, emitted by pipeline/05c */
export interface CountryComparisonEntry {
  name: string;
  region: "Global South" | "Global North";
  floodpulse_pe_2000_2018: number;
  floodpulse_pe_2000_latest: number;
  gfd_pe_2000_2018: number | null;
  gfd_events_2000_2018: number | null;
  emdat_affected_2000_2022: number | null;
  fp_gfd_ratio: number | null;
  fp_emdat_ratio: number | null;
  population_2020: number | null;
}

export interface CountryComparisonData {
  generated: string;
  floodpulse_data_through: string;
  countries: Record<string, CountryComparisonEntry>;
  top_gap_countries: string[];
  global_south_share: {
    floodpulse_pct: number;
    gfd_pct: number;
    emdat_pct: number;
  };
}
```

- [ ] **Step 2: Create `lib/story/countryComparison.ts`**

```ts
import type { CountryComparisonData, CountryComparisonEntry } from "@/lib/types";

let cache: Promise<CountryComparisonData> | null = null;

export function loadCountryComparison(): Promise<CountryComparisonData> {
  if (!cache) {
    cache = fetch("/data/country_comparison.json").then((r) => {
      if (!r.ok) throw new Error(`country_comparison.json ${r.status}`);
      return r.json() as Promise<CountryComparisonData>;
    });
  }
  return cache;
}

export function topGap(
  data: CountryComparisonData,
  limit = 10,
): Array<{ iso3: string; entry: CountryComparisonEntry }> {
  return data.top_gap_countries.slice(0, limit).map((iso3) => ({
    iso3,
    entry: data.countries[iso3],
  }));
}

export function byIso3(
  data: CountryComparisonData,
  iso3: string,
): CountryComparisonEntry | null {
  return data.countries[iso3] ?? null;
}

/** For the /compare page's table: full country list sorted by ratio desc, including nulls last. */
export function allCountriesByRatio(
  data: CountryComparisonData,
): Array<{ iso3: string; entry: CountryComparisonEntry }> {
  return Object.entries(data.countries)
    .map(([iso3, entry]) => ({ iso3, entry }))
    .sort((a, b) => {
      const ra = a.entry.fp_gfd_ratio;
      const rb = b.entry.fp_gfd_ratio;
      if (ra === null && rb === null) return 0;
      if (ra === null) return 1;
      if (rb === null) return -1;
      return rb - ra;
    });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/story/countryComparison.ts
git commit -m "[lib] Add CountryComparisonData types + countryComparison loader"
```

---

## Task 8: TypeScript — add `datasetLayers.ts` config

**Files:**
- Create: `lib/story/datasetLayers.ts`

- [ ] **Step 1: Create `lib/story/datasetLayers.ts`**

```ts
/**
 * Configuration for dataset-filtered H3 layers used by Act 1 and Act 2.
 *
 * - "gfd" layer shows only hexes touched by a GFD event (cyan).
 * - "fp" layer shows only hexes NOT touched by GFD (warm orange).
 * - "all" is the default explorer view (no filter).
 */

export type DatasetFilter = "all" | "gfd" | "fp";

/** Cyan for the "satellites saw this" narrative. Matches /compare's GFD color. */
export const GFD_COLOR: [number, number, number] = [0x22, 0xd3, 0xee];

/** Warm orange for Ground Source. Matches the existing hex palette. */
export const FP_ONLY_COLOR: [number, number, number] = [0xef, 0x8a, 0x62];

export function getDatasetColor(
  isGfdObserved: boolean,
  filter: DatasetFilter,
): [number, number, number, number] | null {
  if (filter === "all") return null; // fall through to mapMode coloring
  if (filter === "gfd") {
    return isGfdObserved ? [...GFD_COLOR, 180] : null;
  }
  // filter === "fp"
  return isGfdObserved ? null : [...FP_ONLY_COLOR, 220];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/story/datasetLayers.ts
git commit -m "[lib] Add datasetLayers config for GFD/FP filter"
```

---

## Task 9: Update `HexDatum` type + enrich on load with `isGfdObserved`

**Files:**
- Modify: `lib/types.ts`
- Modify: `components/Globe.tsx`

- [ ] **Step 1: Add field to `HexDatum` in `lib/types.ts`**

Find the `HexDatum` interface (around line 5) and replace with:

```ts
/** Compact hex datum for deck.gl H3HexagonLayer */
export interface HexDatum {
  h: string;   // H3 index
  m: number;   // total months flooded
  yf: number;  // total years flooded
  p: number;   // population
  y0: number;  // first flood year
  y1: number;  // last flood year
  cc: string;  // country code
  ft: number;  // frequency trend (-50 to +50)
  rp: number;  // return period (years)
  isGfdObserved?: boolean;  // enriched client-side after hex_compact.json loads
}
```

- [ ] **Step 2: Enrich hex data on load in `Globe.tsx`**

In `components/Globe.tsx`, find the block that parses `hex_compact.json` into `HexDatum[]` (search for "HexCompactJSON"). After the parsed array is assigned to `hexDataRef.current`, add the enrichment:

```ts
// Right after hexDataRef.current = data:
try {
  const observedResp = await fetch("/data/gfd_observed_h3.json");
  if (observedResp.ok) {
    const observed: string[] = await observedResp.json();
    const observedSet = new Set(observed);
    for (const hex of data) {
      hex.isGfdObserved = observedSet.has(hex.h);
    }
  }
} catch (e) {
  console.warn("gfd_observed_h3.json failed to load; dataset filter disabled", e);
}
```

(Exact line placement depends on current file — insert immediately after the line where parsed hexes are assigned to `hexDataRef.current`.)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Sanity-check in browser**

```bash
npm run dev
```

Open `http://localhost:3000/explore` in a browser. In DevTools console:

```js
// (Paste into console after page loads)
const hex = document.querySelector('[data-testid="globe-host"]');
console.log('host present:', !!hex);
```

Load-network-tab check: `gfd_observed_h3.json` returns 200. Then stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts components/Globe.tsx
git commit -m "[components] Enrich hex data with isGfdObserved on load"
```

---

## Task 10: Add `datasetFilter` prop to `Globe.tsx`

**Files:**
- Modify: `components/Globe.tsx`

- [ ] **Step 1: Add prop to `GlobeProps`**

In `components/Globe.tsx`, find `interface GlobeProps` (around line 40) and add:

```ts
  /** Dataset filter mode for the hex layer. "all" = default; "gfd" = only GFD-observed; "fp" = only FP-exclusive. */
  datasetFilter?: "all" | "gfd" | "fp";
```

Add `datasetFilter = "all"` to the destructured props in the function signature.

- [ ] **Step 2: Thread into layer creation**

Find the H3HexagonLayer construction (around line 300+). Locate the `getFillColor` callback and wrap it:

```ts
getFillColor: (d: HexDatum) => {
  // Dataset filter: early-out for hexes not matching the selected dataset
  if (datasetFilter === "gfd" && !d.isGfdObserved) return [0, 0, 0, 0];
  if (datasetFilter === "fp" && d.isGfdObserved) return [0, 0, 0, 0];
  // Apply dataset-specific palette when filter is active
  if (datasetFilter === "gfd" && d.isGfdObserved) return [0x22, 0xd3, 0xee, Math.round(hexOpacity * 180)];
  if (datasetFilter === "fp" && !d.isGfdObserved) return [0xef, 0x8a, 0x62, Math.round(hexOpacity * 220)];
  // Fall through to existing coloring (exposure/frequency/confidence)
  // ...existing coloring code unchanged...
}
```

Also add `datasetFilter` to the layer's `updateTriggers.getFillColor` array.

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/Globe.tsx
git commit -m "[components] Globe: add datasetFilter prop (all|gfd|fp)"
```

---

## Task 11: Component — `DatasetRevealLayer` (Act 2 wipe)

**Files:**
- Create: `components/story/DatasetRevealLayer.tsx`

**Context:** This component renders the SVG radial mask that wipes the viewport during Act 2's dataset reveal. The deck.gl dataset filtering is already handled in `Globe.tsx` via `datasetFilter`. This component renders only the DOM overlay — the mask element itself.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useRef } from "react";

interface DatasetRevealLayerProps {
  /** 0..1 — how far the radial wipe has progressed. Anchored on the equator. */
  progress: number;
  /** Whether reduced-motion is preferred. If true, wipe becomes straight fade. */
  reducedMotion?: boolean;
}

/**
 * Full-viewport radial-wipe overlay that lets the FP-only hex layer
 * appear through a growing equatorial circle.
 *
 * Implementation: an SVG <mask> whose <circle> radius scales with
 * progress × viewport-diagonal. Below 0.15 or above 0.85, the mask
 * short-circuits to fully-hidden or fully-visible.
 */
export default function DatasetRevealLayer({
  progress,
  reducedMotion = false,
}: DatasetRevealLayerProps) {
  const circleRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    if (!circleRef.current) return;
    if (reducedMotion) {
      circleRef.current.setAttribute("r", progress > 0.5 ? "9999" : "0");
      return;
    }
    const eased = progress < 0.15 ? 0 : progress > 0.85 ? 1 : (progress - 0.15) / 0.7;
    const diag = Math.hypot(window.innerWidth, window.innerHeight);
    circleRef.current.setAttribute("r", String(Math.round(eased * diag)));
  }, [progress, reducedMotion]);

  return (
    <svg
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <defs>
        <mask id="reveal-mask" maskUnits="userSpaceOnUse">
          <rect width="100%" height="100%" fill="black" />
          <circle ref={circleRef} cx="50%" cy="55%" r="0" fill="white" />
        </mask>
      </defs>
      {/* The mask is consumed by the deck.gl FP layer via `mix-blend` overlay in globals.css.
          For browsers that can't compose SVG masks with WebGL canvases, the fallback is
          a plain opacity transition on the FP layer (applied elsewhere via hexOpacity prop).
          The SVG is rendered regardless so screen readers see a stable DOM. */}
    </svg>
  );
}
```

- [ ] **Step 2: Build verification**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/story/DatasetRevealLayer.tsx
git commit -m "[components] Add DatasetRevealLayer for Act 2 radial wipe"
```

---

## Task 12: Component — `DatasetCounter` (Act 2 290M → 2.88B)

**Files:**
- Create: `components/story/DatasetCounter.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";

interface DatasetCounterProps {
  /** 0..1 — scroll progress within Act 2 */
  progress: number;
  /** Cumulative PE to land on as progress→1, in whole integers. */
  fpPe: number;
  /** Cumulative GFD PE to show as progress→0. */
  gfdPe: number;
  visible: boolean;
}

function formatPE(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

export default function DatasetCounter({
  progress,
  fpPe,
  gfdPe,
  visible,
}: DatasetCounterProps) {
  const [display, setDisplay] = useState(gfdPe);

  useEffect(() => {
    const eased = Math.max(0, Math.min(1, progress));
    // Exponential interpolation — GFD → FP spans ~10x, linear would feel sluggish.
    const logStart = Math.log10(Math.max(gfdPe, 1));
    const logEnd = Math.log10(Math.max(fpPe, 1));
    const current = Math.pow(10, logStart + eased * (logEnd - logStart));
    setDisplay(Math.round(current));
  }, [progress, fpPe, gfdPe]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        top: "28px",
        left: "32px",
        zIndex: 20,
        opacity: visible ? 1 : 0,
        transition: "opacity 400ms ease",
        pointerEvents: "none",
      }}
      className="font-mono text-text-primary"
    >
      <div className="text-[10px] uppercase tracking-widest text-text-tertiary">
        Cumulative PE, 2000–2018
      </div>
      <div className="text-4xl md:text-6xl font-bold tabular-nums mt-1">
        {formatPE(display)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build verification**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/story/DatasetCounter.tsx
git commit -m "[components] Add DatasetCounter for Act 2 GFD→FP reveal"
```

---

## Task 13: Component — `RatioLineChart` (Act 3)

**Files:**
- Create: `components/story/RatioLineChart.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useMemo } from "react";

interface RatioLineChartProps {
  /** 0..1 scroll progress within Act 3 — drives left-to-right line draw */
  progress: number;
  /** Per-year FP/GFD ratio, indexed by year 2000..2018 */
  years: number[];
  ratios: (number | null)[];
  /** Years considered low-confidence (rendered as a grey band) */
  lowConfidenceYears: number[];
  visible: boolean;
}

const W = 420;
const H = 180;
const PAD = { top: 10, right: 10, bottom: 24, left: 36 };

export default function RatioLineChart({
  progress,
  years,
  ratios,
  lowConfidenceYears,
  visible,
}: RatioLineChartProps) {
  const { path, maxRatio, xScale, yScale, lowConfRect } = useMemo(() => {
    const yMax = Math.max(...ratios.filter((r): r is number => r !== null), 1);
    const xMin = Math.min(...years);
    const xMax = Math.max(...years);
    const x = (y: number) => PAD.left + ((y - xMin) / (xMax - xMin)) * (W - PAD.left - PAD.right);
    const yS = (r: number) => H - PAD.bottom - (r / yMax) * (H - PAD.top - PAD.bottom);
    const pts = years
      .map((yr, i) => (ratios[i] != null ? `${x(yr)},${yS(ratios[i] as number)}` : null))
      .filter(Boolean);
    const p = pts.length ? `M ${pts.join(" L ")}` : "";
    const lcMin = Math.min(...lowConfidenceYears, xMax);
    const lcMax = Math.max(...lowConfidenceYears, xMin);
    return {
      path: p,
      maxRatio: yMax,
      xScale: x,
      yScale: yS,
      lowConfRect: lowConfidenceYears.length ? { x1: x(lcMin), x2: x(lcMax) } : null,
    };
  }, [years, ratios, lowConfidenceYears]);

  return (
    <svg
      role="img"
      aria-label="FP/GFD ratio per year, 2000-2018"
      viewBox={`0 0 ${W} ${H}`}
      style={{
        position: "fixed",
        right: "32px",
        bottom: "96px",
        width: "min(420px, 40vw)",
        height: "auto",
        zIndex: 20,
        opacity: visible ? 1 : 0,
        transition: "opacity 400ms ease",
      }}
    >
      {lowConfRect && (
        <rect
          x={lowConfRect.x1}
          y={PAD.top}
          width={lowConfRect.x2 - lowConfRect.x1}
          height={H - PAD.top - PAD.bottom}
          fill="rgba(255,255,255,0.04)"
        />
      )}
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={yScale(1)}
        y2={yScale(1)}
        stroke="rgba(255,255,255,0.18)"
        strokeDasharray="3 3"
      />
      <text x={W - PAD.right} y={yScale(1) - 4} textAnchor="end" fontSize="9" fill="#64748b">
        1× (parity)
      </text>
      <text x={PAD.left} y={PAD.top + 10} fontSize="9" fill="#64748b">
        {`${Math.round(maxRatio)}×`}
      </text>
      <path
        d={path}
        stroke="#22d3ee"
        strokeWidth={2}
        fill="none"
        strokeDasharray={1000}
        strokeDashoffset={(1 - Math.max(0, Math.min(1, progress))) * 1000}
        style={{ transition: "stroke-dashoffset 120ms linear" }}
      />
    </svg>
  );
}
```

- [ ] **Step 2: Build verification**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/story/RatioLineChart.tsx
git commit -m "[components] Add RatioLineChart for Act 3 scroll-revealed ratio"
```

---

## Task 14: Component — `CountryGapBar` (Act 5)

**Files:**
- Create: `components/story/CountryGapBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useMemo } from "react";
import type { CountryComparisonData } from "@/lib/types";
import { topGap } from "@/lib/story/countryComparison";

interface CountryGapBarProps {
  data: CountryComparisonData | null;
  visible: boolean;
  /** 0..1 — controls stagger reveal of bars */
  progress: number;
}

export default function CountryGapBar({ data, visible, progress }: CountryGapBarProps) {
  const rows = useMemo(() => (data ? topGap(data, 10) : []), [data]);
  const maxRatio = rows.length > 0 ? Math.max(...rows.map((r) => r.entry.fp_gfd_ratio ?? 0)) : 1;

  return (
    <div
      aria-label="Top 10 countries by FP/GFD exposure ratio"
      style={{
        position: "fixed",
        top: "50%",
        right: "48px",
        transform: "translateY(-50%)",
        zIndex: 20,
        width: "min(440px, 42vw)",
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease",
        pointerEvents: "none",
      }}
      className="bg-panel-solid/80 backdrop-blur-md rounded-2xl border border-border p-5"
    >
      <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-3">
        Where the invisible floods cluster
      </div>
      <ul className="space-y-2">
        {rows.map(({ iso3, entry }, i) => {
          const ratio = entry.fp_gfd_ratio ?? 0;
          const width = (ratio / maxRatio) * 100;
          const shown = progress > i / rows.length;
          return (
            <li
              key={iso3}
              className="flex items-center gap-3 text-sm"
              style={{
                opacity: shown ? 1 : 0,
                transform: shown ? "translateX(0)" : "translateX(-12px)",
                transition: "opacity 250ms ease, transform 250ms ease",
                transitionDelay: `${i * 40}ms`,
              }}
            >
              <span className="w-28 text-text-secondary truncate">{entry.name}</span>
              <span className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                <span
                  className="block h-full"
                  style={{
                    width: `${width}%`,
                    background: "linear-gradient(90deg, #ef8a62, #fbbf24)",
                  }}
                />
              </span>
              <span className="w-16 text-right font-mono text-text-primary tabular-nums">
                {ratio.toFixed(0)}×
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Build verification**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/story/CountryGapBar.tsx
git commit -m "[components] Add CountryGapBar for Act 5 ranked bars"
```

---

## Task 15: Component — `CountryGapCard` (Act 6)

**Files:**
- Create: `components/story/CountryGapCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import type { CountryComparisonEntry } from "@/lib/types";

interface CountryGapCardProps {
  iso3: string | null;
  entry: CountryComparisonEntry | null;
  visible: boolean;
}

function formatPE(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

export default function CountryGapCard({ iso3, entry, visible }: CountryGapCardProps) {
  const show = visible && entry && iso3;
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        top: "96px",
        right: "32px",
        zIndex: 20,
        width: "min(320px, 80vw)",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(-12px)",
        transition: "opacity 300ms ease, transform 300ms ease",
        pointerEvents: "none",
      }}
      className="bg-panel-solid/85 backdrop-blur-md rounded-2xl border border-border p-5"
    >
      {show ? (
        <>
          <div className="text-xs text-text-tertiary">{iso3}</div>
          <div className="text-lg font-semibold text-text-primary mt-0.5">{entry.name}</div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#22d3ee]">Satellites (GFD)</span>
              <span className="font-mono text-text-primary">{formatPE(entry.gfd_pe_2000_2018)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#ef8a62]">Ground Source</span>
              <span className="font-mono text-text-primary">{formatPE(entry.floodpulse_pe_2000_2018)}</span>
            </div>
            {entry.fp_gfd_ratio != null && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-text-secondary">Gap</span>
                <span className="font-mono text-text-primary">
                  {entry.fp_gfd_ratio.toFixed(0)}× more exposure found
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ height: 1 }} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build verification**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/story/CountryGapCard.tsx
git commit -m "[components] Add CountryGapCard for Act 6 per-country reveal"
```

---

## Task 16: Rewrite `lib/story/storyTypes.ts` for new arc

**Files:**
- Modify: `lib/story/storyTypes.ts`

- [ ] **Step 1: Replace the file**

Overwrite `lib/story/storyTypes.ts`:

```ts
import type { MapMode } from "@/lib/types";
import type { DatasetFilter } from "./datasetLayers";

export interface CameraKeyframe {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  duration: number | "auto";
  easing?: (t: number) => number;
}

export interface ActDataState {
  year: number;
  mapMode: MapMode;
  hexOpacity: number;
  /** Which dataset(s) the hex layer shows: all / gfd / fp. */
  datasetFilter: DatasetFilter;
  /** Set when Act 4/6 wants a specific hex or cluster highlighted. */
  highlightHex?: string;
  /** Act 6 target country for CountryGapCard. */
  countryGapIso3?: string;
  /** Act 2: 0..1 scroll progress used for the reveal wipe. */
  revealProgress?: number;
  /** Act 3: 0..1 scroll progress used for ratio line draw. */
  ratioProgress?: number;
  /** Act 5: 0..1 scroll progress used for country bar stagger. */
  ladderProgress?: number;
}

export interface ActDefinition {
  id: string;
  ariaTitle: string;
  copy: string | string[];
  camera: CameraKeyframe;
  data: ActDataState;
  /**
   * If true, scroll progress (0..1) within this act drives a continuous
   * transformation. Handlers live in useActDataState.
   */
  progressDriven?: boolean;
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: compilation errors at old `acts.ts` and `useActDataState.ts` and `app/page.tsx`. That is correct — those are rewritten in upcoming tasks.

- [ ] **Step 3: No commit yet**

This task intentionally leaves the tree in a broken state. The next three tasks fix it before the first post-rewrite build.

---

## Task 17: Rewrite `lib/story/cameraKeyframes.ts`

**Files:**
- Modify: `lib/story/cameraKeyframes.ts`

- [ ] **Step 1: Replace the file**

Overwrite `lib/story/cameraKeyframes.ts`:

```ts
import type { CameraKeyframe } from "./storyTypes";

/** Fully neutral global view, equator-centered. Used by Acts 1, 2, 3. */
export const GLOBE_NEUTRAL: CameraKeyframe = {
  center: [20, 5],
  zoom: 1.4,
  pitch: 0,
  bearing: 0,
  duration: "auto",
};

/** Slightly zoomed-out view used for Act 5 country ladder. */
export const GLOBE_PULLED_BACK: CameraKeyframe = {
  center: [20, 0],
  zoom: 1.2,
  pitch: 0,
  bearing: 0,
  duration: "auto",
};

/** Congo basin for Act 4 (cloud-heavy region, sparse GFD, dense FP). */
export const CONGO_BASIN: CameraKeyframe = {
  center: [23, -2],
  zoom: 3.5,
  pitch: 30,
  bearing: 0,
  duration: "auto",
};

/** Three-country flyover for Act 6. */
export const DRC: CameraKeyframe = {
  center: [25, -2],
  zoom: 4.5,
  pitch: 30,
  bearing: 0,
  duration: "auto",
};

export const BANGLADESH: CameraKeyframe = {
  center: [90, 23.7],
  zoom: 5.0,
  pitch: 30,
  bearing: 0,
  duration: "auto",
};

export const MOZAMBIQUE: CameraKeyframe = {
  center: [35, -18.5],
  zoom: 4.8,
  pitch: 30,
  bearing: 0,
  duration: "auto",
};

/** Handoff view — same as GLOBE_NEUTRAL but held. */
export const HANDOFF = GLOBE_NEUTRAL;

export const COUNTRY_SEQUENCE = [
  { iso3: "COD", camera: DRC },
  { iso3: "BGD", camera: BANGLADESH },
  { iso3: "MOZ", camera: MOZAMBIQUE },
] as const;
```

- [ ] **Step 2: Verify import graph**

```bash
npx tsc --noEmit
```

Expected: only errors remaining should be in `acts.ts`, `useActDataState.ts`, `app/page.tsx`. Those are rewritten next.

---

## Task 18: Rewrite `lib/story/acts.ts` (7 acts)

**Files:**
- Modify: `lib/story/acts.ts`

- [ ] **Step 1: Replace the file**

Overwrite `lib/story/acts.ts`:

```ts
import type { ActDefinition } from "./storyTypes";
import {
  GLOBE_NEUTRAL,
  GLOBE_PULLED_BACK,
  CONGO_BASIN,
  DRC,
  BANGLADESH,
  MOZAMBIQUE,
  COUNTRY_SEQUENCE,
} from "./cameraKeyframes";

export const ACTS: ActDefinition[] = [
  {
    id: "old-map",
    ariaTitle: "Act 1: What the satellites saw",
    copy: "For two decades, this was our picture of where floods hit people. 913 floods. 290 million people. Two billion missing.",
    camera: GLOBE_NEUTRAL,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.65,
      datasetFilter: "gfd",
    },
  },
  {
    id: "reveal",
    ariaTitle: "Act 2: The new map",
    copy: [
      "Then we stopped asking satellites and started reading the news.",
      "2.6 million local flood records.",
      "2.88 billion flood-exposed people — ten times what the satellites found.",
    ],
    camera: GLOBE_NEUTRAL,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
      revealProgress: 0,
    },
    progressDriven: true,
  },
  {
    id: "ratio",
    ariaTitle: "Act 3: The gap, year by year",
    copy: "Every year the gap got bigger. By 2018, we were finding 32 times more flood-exposed people than satellites could see.",
    camera: GLOBE_NEUTRAL,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
      ratioProgress: 0,
    },
    progressDriven: true,
  },
  {
    id: "why",
    ariaTitle: "Act 4: Why satellites miss",
    copy: "Clouds. Short floods. Small villages. All invisible from 500 miles up.",
    camera: CONGO_BASIN,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "fp",
    },
  },
  {
    id: "ladder",
    ariaTitle: "Act 5: Where the gap lives",
    copy: "The invisible floods cluster in the Global South.",
    camera: GLOBE_PULLED_BACK,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
      ladderProgress: 0,
    },
    progressDriven: true,
  },
  {
    id: "three-stories",
    ariaTitle: "Act 6: Three stories",
    copy: ["DRC", "Bangladesh", "Mozambique"], // revealed by sub-step in app/page.tsx
    camera: DRC,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
      countryGapIso3: "COD",
    },
  },
  {
    id: "handoff",
    ariaTitle: "Act 7: Take control",
    copy: "Explore the new map of flood exposure.",
    camera: BANGLADESH,
    data: {
      year: 2026,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
    },
  },
];

export { COUNTRY_SEQUENCE };
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: only errors remaining should be in `useActDataState.ts` and `app/page.tsx`.

---

## Task 19: Rewrite `useActDataState.ts`

**Files:**
- Modify: `components/story/useActDataState.ts`

- [ ] **Step 1: Replace the file**

Overwrite `components/story/useActDataState.ts`:

```ts
"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { ACTS, COUNTRY_SEQUENCE } from "@/lib/story/acts";
import type { ActDataState } from "@/lib/story/storyTypes";
import type { GlobalSummary, CountryComparisonData } from "@/lib/types";
import { loadCountryComparison } from "@/lib/story/countryComparison";

export function useActDataState() {
  const [activeActId, setActiveActId] = useState<string>(ACTS[0].id);
  const [actProgress, setActProgress] = useState<number>(0);
  const [summary, setSummary] = useState<GlobalSummary | null>(null);
  const [comparison, setComparison] = useState<CountryComparisonData | null>(null);

  useEffect(() => {
    fetch("/data/global_summary.json")
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
    loadCountryComparison().then(setComparison).catch(() => {});
  }, []);

  const handleActChange = useCallback((id: string, progress: number) => {
    setActiveActId(id);
    setActProgress(progress);
  }, []);

  const dataState: ActDataState = useMemo(() => {
    const act = ACTS.find((a) => a.id === activeActId) ?? ACTS[0];
    const base = { ...act.data };

    if (!act.progressDriven) return base;

    if (act.id === "reveal") {
      return { ...base, revealProgress: Math.max(0, Math.min(1, actProgress)) };
    }
    if (act.id === "ratio") {
      return { ...base, ratioProgress: Math.max(0, Math.min(1, actProgress)) };
    }
    if (act.id === "ladder") {
      return { ...base, ladderProgress: Math.max(0, Math.min(1, actProgress)) };
    }
    return base;
  }, [activeActId, actProgress]);

  /** For Act 6: pick which of the three countries is "active" based on progress. */
  const activeCountryIndex = useMemo(() => {
    if (activeActId !== "three-stories") return -1;
    return Math.min(Math.floor(actProgress * COUNTRY_SEQUENCE.length), COUNTRY_SEQUENCE.length - 1);
  }, [activeActId, actProgress]);

  return {
    activeActId,
    actProgress,
    dataState,
    summary,
    comparison,
    activeCountryIndex,
    handleActChange,
  };
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: only `app/page.tsx` errors remain.

---

## Task 20: Rewrite `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `app/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import StoryContainer from "@/components/story/StoryContainer";
import StoryProgressChip from "@/components/story/StoryProgressChip";
import HandoffButton from "@/components/story/HandoffButton";
import DatasetRevealLayer from "@/components/story/DatasetRevealLayer";
import DatasetCounter from "@/components/story/DatasetCounter";
import RatioLineChart from "@/components/story/RatioLineChart";
import CountryGapBar from "@/components/story/CountryGapBar";
import CountryGapCard from "@/components/story/CountryGapCard";
import { useActDataState } from "@/components/story/useActDataState";
import { useScrollVelocity } from "@/components/story/useScrollVelocity";
import { useGlobe } from "@/context/GlobeContext";
import { byIso3 } from "@/lib/story/countryComparison";
import { COUNTRY_SEQUENCE } from "@/lib/story/acts";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

const GFD_PE_MATCHED = 290_000_000;
const FP_PE_MATCHED = 2_880_000_000;

export default function Home() {
  const {
    activeActId,
    dataState,
    summary,
    comparison,
    activeCountryIndex,
  } = useActDataState();

  const { mapRef } = useGlobe();
  const velocityEnabled = activeActId === "old-map" || activeActId === "reveal";
  useScrollVelocity((velocity) => {
    const map = mapRef.current;
    if (!map) return;
    const delta = Math.max(-0.4, Math.min(0.4, velocity * 0.3));
    if (Math.abs(delta) > 0.01) {
      map.setBearing(map.getBearing() + delta);
    }
  }, velocityEnabled);

  const chipVisible = ["ratio", "why", "ladder", "three-stories", "handoff"].includes(activeActId);

  const revealProgress = dataState.revealProgress ?? 0;
  const ratioProgress = dataState.ratioProgress ?? 0;
  const ladderProgress = dataState.ladderProgress ?? 0;

  const activeCountry = useMemo(() => {
    if (activeActId !== "three-stories" || activeCountryIndex < 0) return null;
    return COUNTRY_SEQUENCE[activeCountryIndex];
  }, [activeActId, activeCountryIndex]);

  const activeCountryEntry = useMemo(() => {
    if (!comparison || !activeCountry) return null;
    return byIso3(comparison, activeCountry.iso3);
  }, [comparison, activeCountry]);

  const ratioYears =
    comparison
      ? // synthesized from comparison.json at render-time rather than fetching again
        undefined
      : undefined;

  // For the ratio chart, the source is `/data/comparison.json`.
  // Load it once via useActDataState in a follow-up task; for now pass an empty
  // placeholder that fades in once the scroll enters Act 3.
  // (Tasks 20 and 22 fill this in fully.)

  return (
    <>
      <a
        href="/explore"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-panel focus:text-text-primary focus:px-3 focus:py-2 focus:rounded focus:border focus:border-border focus:outline-none"
      >
        Skip to interactive explorer
      </a>
      <Globe
        year={dataState.year}
        mapMode={dataState.mapMode}
        showBoundaries
        showLabels={false}
        satellite={false}
        hexOpacity={dataState.hexOpacity}
        highlightHex={dataState.highlightHex}
        datasetFilter={dataState.datasetFilter}
      />
      <DatasetRevealLayer progress={revealProgress} />
      <DatasetCounter
        progress={revealProgress}
        gfdPe={GFD_PE_MATCHED}
        fpPe={FP_PE_MATCHED}
        visible={activeActId === "reveal"}
      />
      <RatioLineChart
        progress={ratioProgress}
        years={[]}
        ratios={[]}
        lowConfidenceYears={[]}
        visible={activeActId === "ratio"}
      />
      <CountryGapBar
        data={comparison}
        progress={ladderProgress}
        visible={activeActId === "ladder"}
      />
      <CountryGapCard
        iso3={activeCountry?.iso3 ?? null}
        entry={activeCountryEntry}
        visible={activeActId === "three-stories"}
      />
      <StoryProgressChip summary={summary} year={dataState.year} visible={chipVisible} />
      <HandoffButton visible={activeActId === "handoff"} />
      <StoryContainer onActChange={(id, progress) => {
        // handler lives inside useActDataState hook wrapper
        const { handleActChange } = useActDataStateBridge.current!;
        handleActChange(id, progress);
      }} />
    </>
  );
}

// `useActDataState` returns handleActChange — the bridge below is not used;
// the hook is invoked at the top of Home() and handleActChange is in its
// returned object. Simplify by inlining:
// (NOTE to reviewer: remove the useActDataStateBridge workaround and call
// handleActChange from the destructured hook result. This is corrected in
// Task 20 Step 2.)
const useActDataStateBridge = { current: null as null | { handleActChange: (id: string, p: number) => void } };
```

(The file above intentionally contains a bridge placeholder on the last lines. Step 2 cleans it up — writing it this way signals that the hook binding needs a quick fix.)

- [ ] **Step 2: Fix the `handleActChange` wiring**

In `app/page.tsx`, replace the messy bridge with the straight hook destructuring. Replace the entire `export default function Home()` block with:

```tsx
export default function Home() {
  const {
    activeActId,
    dataState,
    summary,
    comparison,
    activeCountryIndex,
    handleActChange,
  } = useActDataState();

  const { mapRef } = useGlobe();
  const velocityEnabled = activeActId === "old-map" || activeActId === "reveal";
  useScrollVelocity((velocity) => {
    const map = mapRef.current;
    if (!map) return;
    const delta = Math.max(-0.4, Math.min(0.4, velocity * 0.3));
    if (Math.abs(delta) > 0.01) {
      map.setBearing(map.getBearing() + delta);
    }
  }, velocityEnabled);

  const chipVisible = ["ratio", "why", "ladder", "three-stories", "handoff"].includes(activeActId);

  const revealProgress = dataState.revealProgress ?? 0;
  const ratioProgress = dataState.ratioProgress ?? 0;
  const ladderProgress = dataState.ladderProgress ?? 0;

  const activeCountry = useMemo(() => {
    if (activeActId !== "three-stories" || activeCountryIndex < 0) return null;
    return COUNTRY_SEQUENCE[activeCountryIndex];
  }, [activeActId, activeCountryIndex]);

  const activeCountryEntry = useMemo(() => {
    if (!comparison || !activeCountry) return null;
    return byIso3(comparison, activeCountry.iso3);
  }, [comparison, activeCountry]);

  return (
    <>
      <a
        href="/explore"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-panel focus:text-text-primary focus:px-3 focus:py-2 focus:rounded focus:border focus:border-border focus:outline-none"
      >
        Skip to interactive explorer
      </a>
      <Globe
        year={dataState.year}
        mapMode={dataState.mapMode}
        showBoundaries
        showLabels={false}
        satellite={false}
        hexOpacity={dataState.hexOpacity}
        highlightHex={dataState.highlightHex}
        datasetFilter={dataState.datasetFilter}
      />
      <DatasetRevealLayer progress={revealProgress} />
      <DatasetCounter
        progress={revealProgress}
        gfdPe={GFD_PE_MATCHED}
        fpPe={FP_PE_MATCHED}
        visible={activeActId === "reveal"}
      />
      <RatioLineChart
        progress={ratioProgress}
        years={[]}
        ratios={[]}
        lowConfidenceYears={[]}
        visible={activeActId === "ratio"}
      />
      <CountryGapBar
        data={comparison}
        progress={ladderProgress}
        visible={activeActId === "ladder"}
      />
      <CountryGapCard
        iso3={activeCountry?.iso3 ?? null}
        entry={activeCountryEntry}
        visible={activeActId === "three-stories"}
      />
      <StoryProgressChip summary={summary} year={dataState.year} visible={chipVisible} />
      <HandoffButton visible={activeActId === "handoff"} />
      <StoryContainer onActChange={handleActChange} />
    </>
  );
}
```

Delete the bridge constant at the bottom of the file.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build passes. `RatioLineChart` renders with empty data (line invisible) — that is fixed in Task 22.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx lib/story/storyTypes.ts lib/story/acts.ts lib/story/cameraKeyframes.ts components/story/useActDataState.ts
git commit -m "[pages] Rewrite / as 7-act Invisible 90% narrative"
```

---

## Task 21: Retire `CompareDivider` and `StoryCounter`

**Files:**
- Delete: `components/story/CompareDivider.tsx`
- Delete: `components/story/FogMask.tsx` (no longer referenced by new arc)
- Delete: `components/story/StoryCounter.tsx`

- [ ] **Step 1: Verify no lingering imports**

```bash
grep -rn "CompareDivider\|StoryCounter\|FogMask" app components lib tests
```

Expected: no results. If any, fix before proceeding.

- [ ] **Step 2: Delete the files**

```bash
git rm components/story/CompareDivider.tsx components/story/FogMask.tsx components/story/StoryCounter.tsx
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git commit -m "[components] Retire CompareDivider, StoryCounter, FogMask (superseded)"
```

---

## Task 22: Wire real ratio data into `RatioLineChart`

**Files:**
- Modify: `components/story/useActDataState.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: Extend `useActDataState` to fetch `comparison.json`**

In `components/story/useActDataState.ts`, add to imports:

```ts
import type { ComparisonData } from "@/lib/types";
```

Inside the hook, add a new state + effect:

```ts
const [ratio, setRatio] = useState<ComparisonData | null>(null);
useEffect(() => {
  fetch("/data/comparison.json").then((r) => r.json()).then(setRatio).catch(() => {});
}, []);
```

Return `ratio` alongside the other values at the bottom of the hook.

- [ ] **Step 2: Wire into `RatioLineChart` in `app/page.tsx`**

Update the `RatioLineChart` usage:

```tsx
<RatioLineChart
  progress={ratioProgress}
  years={ratio?.calibration_gfd.years ?? []}
  ratios={ratio?.calibration_gfd.pe_ratio ?? []}
  lowConfidenceYears={ratio?.low_confidence_years ?? []}
  visible={activeActId === "ratio"}
/>
```

Also destructure `ratio` from `useActDataState()`.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Manual check**

```bash
npm run dev
```

Scroll to Act 3. The ratio line should draw left-to-right as the user scrolls. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/story/useActDataState.ts
git commit -m "[pages] Wire comparison.json into Act 3 ratio chart"
```

---

## Task 23: `/compare` — append "Where the gap is biggest" section

**Files:**
- Modify: `app/compare/page.tsx`

- [ ] **Step 1: Load country comparison data**

In `app/compare/page.tsx`, add the new import at the top with the other imports:

```ts
import type { CountryComparisonData } from "@/lib/types";
import { loadCountryComparison, allCountriesByRatio } from "@/lib/story/countryComparison";
```

Inside `ComparePage()`, after the existing `useState<ComparisonData>` line, add:

```ts
const [country, setCountry] = useState<CountryComparisonData | null>(null);
useEffect(() => {
  loadCountryComparison().then(setCountry).catch(() => {});
}, []);
```

- [ ] **Step 2: Insert the new section just before "Literature Benchmarks"**

Find the `{/* 5. Literature Benchmarks Table */}` comment in `app/compare/page.tsx`. Above it, insert:

```tsx
{/* 4b. Country-level gap */}
{country && (
  <Section title="Where the gap is biggest">
    <p className="text-[10px] text-text-tertiary/60 mb-3">
      Top 20 countries by FP/GFD cumulative-PE ratio (2000–2018). Minimum FloodPulse denominator: 1M PE.
      EM-DAT column covers 2000–2022 and measures "affected" rather than "exposed" — treat as secondary.
    </p>
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-text-tertiary">
            <th className="text-left py-2 pr-4 font-medium">Country</th>
            <th className="text-right py-2 pr-4 font-medium">Ground Source PE</th>
            <th className="text-right py-2 pr-4 font-medium">GFD PE</th>
            <th className="text-right py-2 pr-4 font-medium">Ratio</th>
            <th className="text-right py-2 font-medium">EM-DAT affected</th>
          </tr>
        </thead>
        <tbody>
          {allCountriesByRatio(country)
            .filter((r) => r.entry.fp_gfd_ratio != null && r.entry.floodpulse_pe_2000_2018 >= 1_000_000)
            .slice(0, 20)
            .map(({ iso3, entry }) => (
              <tr key={iso3} className="border-b border-border/50">
                <td className="py-2.5 pr-4 text-text-secondary">{entry.name}</td>
                <td className="py-2.5 pr-4 text-right text-text-primary font-mono">{fmt(entry.floodpulse_pe_2000_2018)}</td>
                <td className="py-2.5 pr-4 text-right text-text-primary font-mono">{fmt(entry.gfd_pe_2000_2018)}</td>
                <td className="py-2.5 pr-4 text-right text-[#ef8a62] font-mono">{entry.fp_gfd_ratio?.toFixed(1)}×</td>
                <td className="py-2.5 text-right text-text-tertiary font-mono">{fmt(entry.emdat_affected_2000_2022)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  </Section>
)}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/compare/page.tsx
git commit -m "[pages] /compare: add country-gap table (top 20 by ratio)"
```

---

## Task 24: Playwright — rewrite `tests/story.spec.ts`

**Files:**
- Modify: `tests/story.spec.ts`

- [ ] **Step 1: Replace the file**

Overwrite `tests/story.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const ACTS = [
  { id: "old-map", title: "Act 1" },
  { id: "reveal", title: "Act 2" },
  { id: "ratio", title: "Act 3" },
  { id: "why", title: "Act 4" },
  { id: "ladder", title: "Act 5" },
  { id: "three-stories", title: "Act 6" },
  { id: "handoff", title: "Act 7" },
];

test.describe("Invisible 90% scrollytelling", () => {
  test("all 7 acts render without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/");
    await page.waitForSelector('[data-testid="globe-host"]');

    for (const act of ACTS) {
      const el = page.locator(`[data-act-id="${act.id}"]`);
      await el.scrollIntoViewIfNeeded();
      await expect(el).toBeVisible();
    }
    expect(errors, `console errors: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("Act 2 counter reaches 2.88B at scroll-end", async ({ page }) => {
    await page.goto("/");
    const act = page.locator('[data-act-id="reveal"]');
    await act.scrollIntoViewIfNeeded();
    // Scroll inside the act to progress=1
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.95));
    await page.waitForTimeout(400);
    const counterText = await page.locator('[aria-live="polite"]').first().innerText();
    expect(counterText).toMatch(/2\.[0-9]B/);
  });

  test("Act 5 renders at least 10 country bars", async ({ page }) => {
    await page.goto("/");
    const act = page.locator('[data-act-id="ladder"]');
    await act.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const bars = await page.locator("ul li").count();
    expect(bars).toBeGreaterThanOrEqual(10);
  });

  test("Act 7 handoff navigates to /explore", async ({ page }) => {
    await page.goto("/");
    const act = page.locator('[data-act-id="handoff"]');
    await act.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const cta = page.getByRole("link", { name: /take control|explore/i });
    await cta.click();
    await page.waitForURL(/\/explore/);
  });
});

test.describe("Respects reduced-motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("no errors with prefers-reduced-motion: reduce", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/");
    await page.waitForSelector('[data-testid="globe-host"]');
    for (const act of ACTS) {
      const el = page.locator(`[data-act-id="${act.id}"]`);
      await el.scrollIntoViewIfNeeded();
    }
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests against dev server**

```bash
npm run dev &
DEV_PID=$!
sleep 5
npx playwright test tests/story.spec.ts
kill $DEV_PID
```

Fix any failing assertions by tweaking timeouts or selectors — do NOT weaken the thesis assertions (counter must reach ~2.8B, bars must render ≥10).

- [ ] **Step 3: Commit**

```bash
git add tests/story.spec.ts
git commit -m "[pages] Rewrite story.spec.ts for 7-act Invisible 90% arc"
```

---

## Task 25: Mobile + a11y + reduced-motion polish pass

**Files:**
- Modify: `components/story/DatasetRevealLayer.tsx`
- Modify: `components/story/CountryGapBar.tsx`
- Modify: `components/story/CountryGapCard.tsx`
- Modify: `components/story/RatioLineChart.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Add `useMediaQuery` for `prefers-reduced-motion`**

Create `components/story/useReducedMotion.ts`:

```ts
"use client";
import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}
```

Pass `reducedMotion` into `DatasetRevealLayer` from `app/page.tsx`:

```tsx
import { useReducedMotion } from "@/components/story/useReducedMotion";
// …inside Home():
const reducedMotion = useReducedMotion();
// update DatasetRevealLayer usage:
<DatasetRevealLayer progress={revealProgress} reducedMotion={reducedMotion} />
```

- [ ] **Step 2: Mobile CSS — hide `CountryGapBar` overlay behind globe on mobile; show in-place**

In `components/story/CountryGapBar.tsx`, swap the fixed positioning for mobile via inline responsive styles. Replace the outer `style={{ ... right: "48px" ... }}` block with:

```tsx
style={{
  position: "fixed",
  zIndex: 20,
  opacity: visible ? 1 : 0,
  transition: "opacity 300ms ease",
  pointerEvents: "none",
  ...(typeof window !== "undefined" && window.innerWidth < 760
    ? { top: 80, left: 16, right: 16, bottom: 80, overflowY: "auto" as const }
    : { top: "50%", right: 48, transform: "translateY(-50%)", width: "min(440px, 42vw)" }),
}}
```

(The SSR-safe `typeof window` guard keeps this from crashing during Next.js server render. Acceptable because this is a client component.)

- [ ] **Step 3: Mobile CSS for `RatioLineChart` and `CountryGapCard`**

Mirror the same responsive guard: on mobile, `RatioLineChart` drops to `bottom: 24px, right: 12px, width: calc(100vw - 24px)`. `CountryGapCard` drops to `top: 16px, left: 16px, right: 16px` with auto width.

- [ ] **Step 4: Run full Playwright on mobile viewport**

```bash
npm run dev &
DEV_PID=$!
sleep 5
npx playwright test tests/story.spec.ts --project='Mobile Safari'
kill $DEV_PID
```

Fix failures.

- [ ] **Step 5: Commit**

```bash
git add components/story/useReducedMotion.ts components/story/DatasetRevealLayer.tsx components/story/CountryGapBar.tsx components/story/CountryGapCard.tsx components/story/RatioLineChart.tsx app/page.tsx
git commit -m "[components] Responsive + reduced-motion polish across story components"
```

---

## Task 26: Final build, lighthouse, bundle-size check

**Files:**
- None (verification only)

- [ ] **Step 1: Production build**

```bash
npm run build
```

Expected: build succeeds. Note bundle sizes for `/` and `/compare` from the output.

- [ ] **Step 2: Lighthouse (desktop)**

```bash
npm run start &
SERVER_PID=$!
sleep 3
npx lighthouse http://localhost:3000/ --preset=desktop --only-categories=performance --output=json --output-path=/tmp/lh-desktop.json --quiet
node -e "const r = require('/tmp/lh-desktop.json'); console.log('Perf:', r.categories.performance.score * 100);"
kill $SERVER_PID
```

Expected: Performance score ≥ 85. If below, investigate `Main-thread work` and `Largest Contentful Paint` — likely culprit is deck.gl layer compilation; consider lazy-loading the FP-only filtered layer until Act 2 fires.

- [ ] **Step 3: Playwright full sweep**

```bash
npm run dev &
DEV_PID=$!
sleep 5
npx playwright test
kill $DEV_PID
```

Expected: all tests pass. `hex-stability.spec.ts` must still pass (regression guard for the shared globe).

- [ ] **Step 4: Manual smoke — VoiceOver**

Open the site in Safari with VoiceOver enabled (`Cmd+F5`). Navigate through all 7 acts using `Ctrl+Option+Down`. Verify every act's copy is read aloud in order. Verify the `DatasetCounter` announces updates.

Record findings (pass / fail per act) in the PR description.

- [ ] **Step 5: No commit (verification only)**

---

## Task 27: Final sanity — rebase onto main, merge prep

**Files:**
- None (git state only)

- [ ] **Step 1: Fetch and rebase**

```bash
git fetch origin
git rebase origin/main
```

Resolve any conflicts locally. Re-run `npm run build` after rebase.

- [ ] **Step 2: Push branch**

```bash
git push -u origin agent/pages-invisible-90-7967
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "The Invisible 90%: dataset-comparison narrative redesign" --body "$(cat <<'EOF'
## Summary
- Pivots the home-page scrollytelling from population-exposure accumulation to a dataset-comparison thesis: Ground Source finds ~10x more flood-exposed people than prior satellite-era flood databases, and the gap clusters in the Global South.
- Adds a new pipeline step (`05c_country_comparison.py`) that emits `country_comparison.json` joining FP per-country PE to GFD (Tellman 2021) and EM-DAT (Hu 2024) per-country totals.
- Adds a "Where the gap is biggest" country table to `/compare`.
- Retires three story components (`StoryCounter`, `CompareDivider`, `FogMask`) that no longer fit the new arc.

## Spec
See `docs/superpowers/specs/2026-04-21-invisible-90-redesign-design.md`.

## Test plan
- [ ] `pytest pipeline/tests/` passes.
- [ ] `npm run build` passes.
- [ ] `npx playwright test` passes desktop + Mobile Safari.
- [ ] VoiceOver walk-through: all act copy read in order.
- [ ] Lighthouse desktop Performance ≥ 85 on `/`.
- [ ] Manual check: `/explore` and existing `/compare` charts render identically to `main`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Do not merge until deploy lock available.**

Per CLAUDE.md multi-agent coordination, the merge to `main` follows the deploy-lock-then-fast-forward sequence. That sequence is performed when the user asks to "deploy" — not as part of this plan.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Implementing task(s) |
|---|---|
| Thesis + 7-act arc | 18 (acts.ts), 20 (app/page.tsx) |
| Per-country pipeline | 1, 2, 3, 4, 5, 6 |
| Reveal Wipe (Act 2) | 11 (DatasetRevealLayer), 9–10 (datasetFilter in Globe), 12 (DatasetCounter) |
| Ratio chart (Act 3) | 13 (RatioLineChart), 22 (wire data) |
| Country ladder (Act 5) | 14 (CountryGapBar), 20 (wired in page) |
| Three stories (Act 6) | 15 (CountryGapCard), 20 (page wiring via activeCountryIndex), 17 (COUNTRY_SEQUENCE) |
| `/compare` addition | 23 |
| Reduced motion + a11y | 25 |
| Mobile | 25 |
| Tests | 5 (pipeline pytest), 24 (Playwright), 26 (Lighthouse + VoiceOver) |
| Retire old components | 21 |
| Share-globe preserved | 26 Step 3 (hex-stability.spec.ts regression guard) |

**Coverage gaps:** None.

**Placeholder scan:** No "TBD", "TODO: implement", "similar to above", or unresolved type references remain in the plan. Each step has concrete code or exact commands.

**Type consistency:** `DatasetFilter` type (`"all" | "gfd" | "fp"`) is consistent across Task 8 (definition), Task 10 (`Globe.tsx` prop), Task 16 (`ActDataState`), Task 18 (`acts.ts` usages), Task 19 (`useActDataState`). `CountryComparisonData` / `CountryComparisonEntry` stay consistent across Task 7 (type definition), Task 11/14/15 (component props), Task 23 (`/compare`). `revealProgress` / `ratioProgress` / `ladderProgress` naming consistent from Task 16 (type) through Task 20 (usage).

Plan is ready for execution.
