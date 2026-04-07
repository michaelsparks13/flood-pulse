"""
Step 5: External Dataset Comparison

Reads FloodPulse global_summary.json and curated reference data, then
produces comparison.json with aligned time series, calibration ratios,
and literature benchmarks.

Output is consumed by the /compare page and the Methodology drawer chart.
"""

from __future__ import annotations

import json
import logging
import shutil
import time
from datetime import date
from pathlib import Path

from config import COMPARISON_JSON, GLOBAL_SUMMARY_JSON, ensure_dirs
from reference_data import (
    DFO,
    EMDAT,
    GDACS,
    GFD_TELLMAN,
    LITERATURE_BENCHMARKS,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
log = logging.getLogger(__name__)

# Records below this threshold are flagged as low-confidence
LOW_CONFIDENCE_THRESHOLD = 5_000


def main() -> None:
    ensure_dirs()
    t0 = time.time()

    # ---- Load FloodPulse data ----
    if not GLOBAL_SUMMARY_JSON.exists():
        log.error(f"global_summary.json not found at {GLOBAL_SUMMARY_JSON}")
        log.error("Run steps 01-03 first.")
        return

    with open(GLOBAL_SUMMARY_JSON) as f:
        summary = json.load(f)

    fp_by_year: dict[int, dict] = {}
    for entry in summary["byYear"]:
        fp_by_year[entry["year"]] = entry

    all_years = sorted(fp_by_year.keys())
    log.info(f"FloodPulse data: {all_years[0]}-{all_years[-1]} ({len(all_years)} years)")

    # ---- Build aligned annual PE comparison ----
    annual_pe: dict = {
        "years": all_years,
        "floodpulse": [],
        "gfd": [],
        "emdat": [],
    }

    for yr in all_years:
        annual_pe["floodpulse"].append(fp_by_year[yr]["populationExposed"])
        annual_pe["gfd"].append(
            GFD_TELLMAN["annual_pe"].get(yr) if GFD_TELLMAN["coverage"][0] <= yr <= GFD_TELLMAN["coverage"][1] else None
        )
        annual_pe["emdat"].append(
            EMDAT["annual_affected"].get(yr)
        )

    log.info(f"Annual PE: {len(annual_pe['years'])} years")

    # ---- Build aligned annual event count comparison ----
    annual_events: dict = {
        "years": all_years,
        "floodpulse_records": [],
        "gfd": [],
        "dfo": [],
        "gdacs": [],
    }

    for yr in all_years:
        annual_events["floodpulse_records"].append(fp_by_year[yr]["rawRecordCount"])
        annual_events["gfd"].append(
            GFD_TELLMAN["annual_events"].get(yr) if GFD_TELLMAN["coverage"][0] <= yr <= GFD_TELLMAN["coverage"][1] else None
        )
        annual_events["dfo"].append(DFO["annual_events"].get(yr))
        annual_events["gdacs"].append(GDACS["annual_events"].get(yr))

    log.info(f"Annual events: {len(annual_events['years'])} years")

    # ---- Build cumulative PE trajectories ----
    cumulative_pe: dict = {
        "years": all_years,
        "floodpulse": [],
        "gfd": [],
        "emdat": [],
    }

    fp_cum = 0
    gfd_cum = 0
    emdat_cum = 0

    for yr in all_years:
        fp_cum += fp_by_year[yr]["populationExposed"]
        cumulative_pe["floodpulse"].append(round(fp_cum))

        gfd_val = GFD_TELLMAN["annual_pe"].get(yr)
        if gfd_val is not None:
            gfd_cum += gfd_val
            cumulative_pe["gfd"].append(round(gfd_cum))
        else:
            cumulative_pe["gfd"].append(None)

        emdat_val = EMDAT["annual_affected"].get(yr)
        if emdat_val is not None:
            emdat_cum += emdat_val
            cumulative_pe["emdat"].append(round(emdat_cum))
        else:
            cumulative_pe["emdat"].append(None)

    # ---- Calibration: FloodPulse / GFD ratio ----
    gfd_start, gfd_end = GFD_TELLMAN["coverage"]
    cal_years = [yr for yr in all_years if gfd_start <= yr <= gfd_end]
    pe_ratios = []

    for yr in cal_years:
        fp_pe = fp_by_year[yr]["populationExposed"]
        gfd_pe = GFD_TELLMAN["annual_pe"].get(yr)
        if gfd_pe and gfd_pe > 0:
            pe_ratios.append(round(fp_pe / gfd_pe, 3))
        else:
            pe_ratios.append(None)

    valid_ratios = [r for r in pe_ratios if r is not None]
    mean_ratio = round(sum(valid_ratios) / len(valid_ratios), 3) if valid_ratios else None

    # Median ratio (more robust to outliers in sparse early years)
    sorted_ratios = sorted(valid_ratios)
    median_ratio = None
    if sorted_ratios:
        mid = len(sorted_ratios) // 2
        median_ratio = round(
            (sorted_ratios[mid] + sorted_ratios[~mid]) / 2, 3
        )

    calibration: dict = {
        "years": cal_years,
        "pe_ratio": pe_ratios,
        "mean_ratio": mean_ratio,
        "median_ratio": median_ratio,
        "notes": (
            "Ratio = FloodPulse PE / GFD PE per year. "
            "Ratio < 1 means FloodPulse underestimates relative to satellite observation. "
            "Ratio > 1 means overestimate. Early years (2000-2006) are unreliable due to "
            "sparse Groundsource coverage (<3,000 records/year)."
        ),
    }

    log.info(f"Calibration: mean ratio = {mean_ratio}, median = {median_ratio}")

    # ---- EM-DAT vs FloodPulse ratio ----
    emdat_start, emdat_end = EMDAT["coverage"]
    emdat_cal_years = [yr for yr in all_years if emdat_start <= yr <= emdat_end]
    emdat_ratios = []

    for yr in emdat_cal_years:
        fp_pe = fp_by_year[yr]["populationExposed"]
        em_val = EMDAT["annual_affected"].get(yr)
        if em_val and em_val > 0:
            emdat_ratios.append(round(fp_pe / em_val, 3))
        else:
            emdat_ratios.append(None)

    valid_emdat_ratios = [r for r in emdat_ratios if r is not None]
    emdat_mean_ratio = round(sum(valid_emdat_ratios) / len(valid_emdat_ratios), 3) if valid_emdat_ratios else None

    emdat_calibration: dict = {
        "years": emdat_cal_years,
        "pe_ratio": emdat_ratios,
        "mean_ratio": emdat_mean_ratio,
        "notes": (
            "Ratio = FloodPulse PE / EM-DAT affected. "
            "EM-DAT measures 'total affected' (broader definition) for large disasters only. "
            "FloodPulse measures population in reported flood areas with 10% inundation ratio."
        ),
    }

    # ---- Low-confidence years ----
    low_confidence = [
        yr for yr in all_years
        if fp_by_year[yr]["rawRecordCount"] < LOW_CONFIDENCE_THRESHOLD
    ]
    log.info(f"Low-confidence years (<{LOW_CONFIDENCE_THRESHOLD:,} records): {low_confidence}")

    # ---- Assemble output ----
    comparison = {
        "generated": date.today().isoformat(),
        "floodpulse_data_through": summary["dataThrough"],
        "annual_pe": annual_pe,
        "annual_events": annual_events,
        "cumulative_pe": cumulative_pe,
        "calibration_gfd": calibration,
        "calibration_emdat": emdat_calibration,
        "benchmarks": LITERATURE_BENCHMARKS,
        "low_confidence_years": low_confidence,
        "methodology_notes": {
            "apples_to_oranges": (
                "These datasets measure fundamentally different things. "
                "GFD uses satellite-observed inundation (MODIS 250m) for 913 large events. "
                "FloodPulse uses 2.6M news-derived polygons with a 10% inundation ratio. "
                "EM-DAT counts 'total affected' from curated disaster reports. "
                "DFO and GDACS track event counts, not population. "
                "Direct PE comparison is most meaningful between FloodPulse and GFD."
            ),
            "temporal_bias": (
                "FloodPulse early years (2000-2006) have <3,000 records/year vs. "
                "200,000+ after 2020. Comparisons before 2007 are unreliable. "
                "64% of Groundsource records are from 2020-2025."
            ),
            "polygon_fractions": (
                "Polygon fraction corrections are internal to FloodPulse's PE calculation "
                "(10% INUNDATION_RATIO in 03_aggregate.py). For aggregate PE/year comparison, "
                "corrections are already baked into the final numbers. No additional "
                "correction needed for these comparisons."
            ),
            "gfd_satellite_limitation": (
                "GFD's 2000-2001 data has reduced detection — only one MODIS sensor "
                "(Terra) was operational. Aqua launched mid-2002, increasing flood "
                "mapping probability from 5% to 30%. Both FloodPulse and GFD undercount "
                "early years, but for different reasons."
            ),
            "emdat_threshold": (
                "EM-DAT only records disasters meeting severity thresholds "
                "(10+ deaths, 100+ affected, emergency declaration, or international "
                "assistance call). Smaller floods are excluded."
            ),
        },
        "sources": {
            "gfd": {
                "citation": "Tellman, B. et al. (2021). Nature 596, 80-86.",
                "doi": "10.1038/s41586-021-03695-w",
            },
            "emdat": {
                "citation": "Hu, P. et al. (2024). Sci Rep 14, 11705.",
                "doi": "10.1038/s41598-024-62425-2",
            },
            "dfo": {
                "citation": "Dartmouth Flood Observatory Active Archive.",
                "url": "https://floodobservatory.colorado.edu/Archives/",
            },
            "gdacs": {
                "citation": "GDACS (UN/EC).",
                "url": "https://www.gdacs.org/",
            },
            "rentschler": {
                "citation": "Rentschler, J. et al. (2022). Nat Commun 13, 3527.",
                "doi": "10.1038/s41467-022-30727-4",
            },
            "undrr": {
                "citation": "UNDRR GAR 2025 Hazard Explorations: Floods.",
                "url": "https://www.undrr.org/gar/gar2025/hazard-exploration/floods",
            },
        },
    }

    with open(COMPARISON_JSON, "w") as f:
        json.dump(comparison, f, indent=2)
    log.info(f"Wrote {COMPARISON_JSON}")

    # Copy to public/data/ for frontend
    public_dir = Path(__file__).resolve().parent.parent / "public" / "data"
    public_dir.mkdir(parents=True, exist_ok=True)
    public_path = public_dir / "comparison.json"
    shutil.copy2(COMPARISON_JSON, public_path)
    log.info(f"Copied to {public_path}")

    # ---- Summary report ----
    log.info("=== COMPARISON SUMMARY ===")
    log.info(f"  FloodPulse 2000-2018 cumulative PE: {cumulative_pe['floodpulse'][all_years.index(2018)]:,}")
    log.info(f"  GFD 2000-2018 cumulative PE:        {cumulative_pe['gfd'][all_years.index(2018)]:,}")
    log.info(f"  EM-DAT 2000-2018 cumulative:        {cumulative_pe['emdat'][all_years.index(2018)]:,}")
    log.info(f"  FP/GFD ratio: mean={mean_ratio}, median={median_ratio}")
    log.info(f"  FP/EM-DAT ratio: mean={emdat_mean_ratio}")
    log.info(f"  Low-confidence years: {low_confidence}")
    log.info(f"  Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
