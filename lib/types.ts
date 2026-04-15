/** Map color mode */
export type MapMode = "exposure" | "frequency";

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
  /** Latest year-month in the dataset, e.g. "2026-02" */
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
