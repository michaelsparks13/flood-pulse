"""Smoke tests for 05c_country_comparison output shape and invariants."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = PIPELINE_ROOT / "05c_country_comparison.py"
OUTPUT = PIPELINE_ROOT / "data" / "final" / "country_comparison.json"


@pytest.fixture(scope="module")
def data() -> dict:
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=PIPELINE_ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Pipeline failed:\n{result.stderr}"
    assert OUTPUT.exists(), f"Output not created at {OUTPUT}"
    return json.loads(OUTPUT.read_text())


def test_top_level_keys(data: dict) -> None:
    assert set(data.keys()) >= {
        "generated", "floodpulse_data_through", "countries",
        "top_gap_countries", "global_south_share",
    }


def test_bangladesh_present(data: dict) -> None:
    bgd = data["countries"].get("BGD")
    assert bgd, "Bangladesh must be in output"
    assert bgd["floodpulse_pe_2000_2018"] > 0
    assert bgd["region"] == "Global South"


def test_ratios_nullable(data: dict) -> None:
    for iso3, c in data["countries"].items():
        if c["gfd_pe_2000_2018"] is None:
            assert c["fp_gfd_ratio"] is None, f"{iso3}: ratio should be null when GFD is null"


def test_top_gap_ordering(data: dict) -> None:
    top = data["top_gap_countries"]
    assert 1 <= len(top) <= 10
    ratios = [data["countries"][iso3]["fp_gfd_ratio"] for iso3 in top]
    assert all(r is not None and r > 0 for r in ratios)
    assert ratios == sorted(ratios, reverse=True), "top_gap_countries must be ordered desc"


def test_top_gap_min_denominator(data: dict) -> None:
    for iso3 in data["top_gap_countries"]:
        assert data["countries"][iso3]["floodpulse_pe_2000_2018"] >= 1_000_000


def test_global_south_share_in_range(data: dict) -> None:
    for key in ("floodpulse_pct", "gfd_pct", "emdat_pct"):
        v = data["global_south_share"][key]
        assert 0.0 <= v <= 1.0, f"{key}={v}"


def test_output_size_gzipped_under_55kb() -> None:
    import gzip
    assert len(gzip.compress(OUTPUT.read_bytes())) < 55_000
