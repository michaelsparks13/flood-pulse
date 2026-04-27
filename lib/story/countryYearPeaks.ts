/**
 * Per-country peak-year data for the Act 6 old-vs-new comparison.
 *
 * Numbers are computed from public/data/{old,new}/hex_years/{year}.json over
 * a per-country window. We use the **merged** OLD catalog (DFO + GFD + GDACS)
 * because that's what the side-by-side map actually renders — keeping the
 * card numbers consistent with what the user is seeing geographically.
 *
 * All three current countries use the 2014–2025 window: it's recent enough
 * that Groundsource has full coverage, and Flood Pulse's gap over the merged
 * traditional catalog holds across the board (1.9–2.7×).
 */
export interface PeakYear {
  year: number;
  fp: number;
  hexes: number;
}

export interface CountryPeaks {
  iso3: string;
  name: string;
  windowStart: number;
  windowEnd: number;
  tradTotal: number;
  fpTotal: number;
  ratio: number;
  peakYears: PeakYear[];
}

export const COUNTRY_PEAKS: Record<string, CountryPeaks> = {
  BGD: {
    iso3: "BGD",
    name: "Bangladesh",
    windowStart: 2014,
    windowEnd: 2025,
    tradTotal: 68_984_677,
    fpTotal: 200_802_678,
    ratio: 2.9,
    peakYears: [
      { year: 2020, fp: 22_786_186, hexes: 444 },
      { year: 2024, fp: 25_102_303, hexes: 476 },
      { year: 2025, fp: 23_882_467, hexes: 462 },
    ],
  },
  BRA: {
    iso3: "BRA",
    name: "Brazil",
    windowStart: 2014,
    windowEnd: 2025,
    tradTotal: 65_190_227,
    fpTotal: 147_180_206,
    ratio: 2.3,
    peakYears: [
      { year: 2023, fp: 15_155_833, hexes: 3537 },
      { year: 2024, fp: 15_356_319, hexes: 3699 },
      { year: 2025, fp: 15_427_186, hexes: 3745 },
    ],
  },
  KEN: {
    iso3: "KEN",
    name: "Kenya",
    windowStart: 2014,
    windowEnd: 2025,
    tradTotal: 13_782_538,
    fpTotal: 27_302_717,
    ratio: 2.0,
    peakYears: [
      { year: 2020, fp: 3_891_991, hexes: 301 },
      { year: 2023, fp: 4_232_493, hexes: 379 },
      { year: 2024, fp: 4_247_679, hexes: 383 },
    ],
  },
};

export function peaksByIso3(iso3: string | null): CountryPeaks | null {
  if (!iso3) return null;
  return COUNTRY_PEAKS[iso3] ?? null;
}
