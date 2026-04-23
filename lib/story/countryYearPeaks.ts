/**
 * Per-country peak-year data for the Act 6 old-vs-new comparison.
 *
 * Each country's three peak years are the top 3 FloodPulse population-exposed
 * years in 2000–2018 (the GFD coverage window). Yearly GFD values aren't in
 * the current pipeline output, so we compare FP yearly peaks against the GFD
 * 2000–2018 country total. The resulting contrast is the point: "in 2017
 * alone, Flood Pulse caught X — more than traditional catalogs caught in
 * nineteen years."
 *
 * Numbers derived from public/data/country_timeseries.json and
 * public/data/country_comparison.json, regenerable via scripts/peak-years.js.
 */
export interface PeakYear {
  year: number;
  /** FloodPulse population-exposed for that year. */
  fp: number;
  /** Flooded hex count for that year (scale indicator). */
  hexes: number;
}

export interface CountryPeaks {
  iso3: string;
  name: string;
  /** GFD cumulative PE 2000–2018. Null means no GFD coverage in this country. */
  tradTotal2000_2018: number | null;
  /** FloodPulse cumulative PE 2000–2018. */
  fpTotal2000_2018: number;
  /** FP-to-GFD ratio over 2000–2018. Null if GFD reported zero coverage. */
  ratio: number | null;
  /** Sorted chronologically, 3 entries. */
  peakYears: PeakYear[];
}

export const COUNTRY_PEAKS: Record<string, CountryPeaks> = {
  COD: {
    iso3: "COD",
    name: "Democratic Republic of the Congo",
    tradTotal2000_2018: null,
    fpTotal2000_2018: 8_607_961,
    ratio: null,
    peakYears: [
      { year: 2014, fp: 1_167_551, hexes: 33 },
      { year: 2016, fp: 1_111_163, hexes: 19 },
      { year: 2018, fp: 1_144_618, hexes: 16 },
    ],
  },
  BGD: {
    iso3: "BGD",
    name: "Bangladesh",
    tradTotal2000_2018: 44_333_706,
    fpTotal2000_2018: 96_643_329,
    ratio: 2.18,
    peakYears: [
      { year: 2007, fp: 12_244_242, hexes: 286 },
      { year: 2016, fp: 13_376_656, hexes: 314 },
      { year: 2017, fp: 18_518_216, hexes: 386 },
    ],
  },
  BRA: {
    iso3: "BRA",
    name: "Brazil",
    tradTotal2000_2018: 339_846,
    fpTotal2000_2018: 96_201_676,
    ratio: 283.074,
    peakYears: [
      { year: 2016, fp: 10_647_196, hexes: 2033 },
      { year: 2017, fp: 10_326_131, hexes: 1990 },
      { year: 2018, fp: 10_396_920, hexes: 2182 },
    ],
  },
};

export function peaksByIso3(iso3: string | null): CountryPeaks | null {
  if (!iso3) return null;
  return COUNTRY_PEAKS[iso3] ?? null;
}
