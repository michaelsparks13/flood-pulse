/** Map color mode */
export type MapMode = "exposure" | "frequency";

/** Compact hex datum for deck.gl H3HexagonLayer */
export interface HexDatum {
  h: string;            // H3 index
  m: number;            // total months flooded (Flood Pulse)
  yf: number;           // total years flooded (Flood Pulse)
  p: number;            // population (Flood Pulse)
  y0: number;           // first flood year (Flood Pulse)
  y1: number;           // last flood year (Flood Pulse)
  cc: string;           // country code
  ft: number;           // frequency trend (-50 to +50)
  rp: number;           // return period (years)
  // Traditional flood databases (DFO + GFD + GDACS, unioned). Null if the hex
  // wasn't inside any traditional-DB footprint.
  trad_y0: number | null;   // first year a traditional DB flagged this hex
  trad_y1: number | null;   // last year a traditional DB flagged this hex
  trad_yf: number | null;   // count of distinct trad-flagged years
  trad_p:  number | null;   // population within hex at most recent trad year
  trad_src: string | null;  // source flags: "D"=DFO, "G"=GFD, "C"=GDACS (concat, e.g. "DG", "DGC")
  isGfdObserved?: boolean;  // kept for backward-compat with older country-level logic
}

/** Wire format for hex_compact.json */
export interface HexCompactJSON {
  columns: string[];
  rows: (string | number)[][];
}

/** Hex-level aggregate for the map layer */
export interface HexAggregate {
  h3Index: string;
  totalMonthsFlooded: number;
  totalYearsFlooded: number;
  population: number;
  firstFloodYear: number;
  lastFloodYear: number;
  countryCode: string;
}

/** Country-level time series for drill-down */
export interface CountryYear {
  year: number;
  populationExposed: number;
  hexesFlooded: number;
  areaKm2Flooded: number;
}

export interface CountryData {
  code: string;
  name: string;
  totalPopulation: number;
  timeseries: CountryYear[];
}

/** Global summary for the animated counter */
export interface GlobalSummary {
  /** Latest year-month in the dataset, e.g. "2025-12" */
  dataThrough: string;
  byYear: {
    year: number;
    populationExposed: number;
    cumulativePopulationExposed: number;
    rawRecordCount: number;
    countriesAffected: number;
    hexesFlooded: number;
  }[];
  totals: {
    populationExposed: number;
    countries: number;
    hexesEverFlooded: number;
    areaKm2: number;
  };
}

/** Timeline state */
export interface TimelineState {
  year: number;
  playing: boolean;
}

/** External dataset comparison data */
export interface ComparisonData {
  generated: string;
  floodpulse_data_through: string;
  annual_pe: {
    years: number[];
    floodpulse: number[];
    gfd: (number | null)[];
    emdat: (number | null)[];
  };
  annual_events: {
    years: number[];
    floodpulse_records: number[];
    gfd: (number | null)[];
    dfo: (number | null)[];
    gdacs: (number | null)[];
  };
  cumulative_pe: {
    years: number[];
    floodpulse: number[];
    gfd: (number | null)[];
    emdat: (number | null)[];
  };
  calibration_gfd: {
    years: number[];
    pe_ratio: (number | null)[];
    mean_ratio: number | null;
    median_ratio: number | null;
    notes: string;
  };
  calibration_emdat: {
    years: number[];
    pe_ratio: (number | null)[];
    mean_ratio: number | null;
    notes: string;
  };
  benchmarks: {
    label: string;
    type: string;
    year_range?: [number, number];
    year?: number;
    value: number;
    value_low?: number;
    description: string;
    doi?: string;
    url?: string;
  }[];
  low_confidence_years: number[];
  methodology_notes: Record<string, string>;
  sources: Record<string, { citation: string; doi?: string; url?: string }>;
}

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
