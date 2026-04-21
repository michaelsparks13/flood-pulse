"""
Build gfd_observed_countries.json — ISO3 list of countries with GFD-observed
PE > 0, sourced from Tellman 2021's gfd_popsummary.csv (cloudtostreet repo).

Input: pipeline/data/reference/gfd_country_pe.csv (curated via Task 1).
Output: pipeline/data/reference/gfd_observed_countries.json.
"""
from __future__ import annotations

import csv
import json
import logging
from pathlib import Path

IN_PATH = Path(__file__).resolve().parent.parent / "data" / "reference" / "gfd_country_pe.csv"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "reference" / "gfd_observed_countries.json"

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger(__name__)


def main() -> None:
    iso3_list = []
    with open(IN_PATH) as f:
        for row in csv.DictReader(f):
            pe = int(row["gfd_pe_2000_2018"] or 0)
            if pe > 0:
                iso3_list.append(row["iso3"])
    iso3_list.sort()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(iso3_list, f)
    log.info(f"Wrote {len(iso3_list)} ISO3 codes to {OUT_PATH}")


if __name__ == "__main__":
    main()
