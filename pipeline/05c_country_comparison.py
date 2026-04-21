"""
Step 5c: Per-Country Dataset Comparison

Joins FloodPulse country_timeseries.json with curated GFD (Tellman 2021) and
EM-DAT (aggregated from OWID) per-country totals. Emits country_comparison.json
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
GLOBAL_SOUTH_ISO3: set[str] = {
    # Africa
    "DZA","AGO","BEN","BWA","BFA","BDI","CMR","CPV","CAF","TCD","COM","COG","COD",
    "CIV","DJI","EGY","GNQ","ERI","SWZ","ETH","GAB","GMB","GHA","GIN","GNB","KEN",
    "LSO","LBR","LBY","MDG","MWI","MLI","MRT","MUS","MAR","MOZ","NAM","NER","NGA",
    "RWA","STP","SEN","SYC","SLE","SOM","ZAF","SSD","SDN","TGO","TUN","UGA","TZA","ZMB","ZWE",
    # Latin America & Caribbean
    "ARG","BHS","BRB","BLZ","BOL","BRA","CHL","COL","CRI","CUB","DMA","DOM","ECU",
    "SLV","GRD","GTM","GUY","HTI","HND","JAM","MEX","NIC","PAN","PRY","PER","KNA",
    "LCA","VCT","SUR","TTO","URY","VEN",
    # Asia (excluding Japan, S Korea, Israel, Singapore)
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


def safe_int(s: str | None) -> int | None:
    if not s:
        return None
    s = s.replace(",", "").strip()
    if not s or s.lower() == "na":
        return None
    try:
        return int(float(s))
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

        gfd_pe = safe_int(gfd.get("gfd_pe_2000_2018"))
        gfd_events = safe_int(gfd.get("gfd_events_2000_2018"))
        emdat_aff = safe_int(emdat.get("emdat_affected_2000_2022"))

        fp_gfd_ratio: float | None = None
        if gfd_pe is not None and gfd_pe > 0:
            fp_gfd_ratio = round(fp_matched / gfd_pe, 3)
        elif gfd_pe == 0:
            fp_gfd_ratio = 0.0

        fp_emdat_ratio: float | None = None
        if emdat_aff is not None and emdat_aff > 0:
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
        f"Wrote {COUNTRY_COMPARISON_JSON} - "
        f"{len(countries)} countries, top_gap={top_gap[:3]}..., "
        f"GS shares FP={global_south_share['floodpulse_pct']:.2%} "
        f"GFD={global_south_share['gfd_pct']:.2%} "
        f"EMDAT={global_south_share['emdat_pct']:.2%}, "
        f"{time.time()-t0:.2f}s"
    )


if __name__ == "__main__":
    main()
