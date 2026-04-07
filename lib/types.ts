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
