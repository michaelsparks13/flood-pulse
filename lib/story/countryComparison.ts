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
