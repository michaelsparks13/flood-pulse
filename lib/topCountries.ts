/**
 * Top 10 countries by population, plus Kenya (Act 5 chapter country),
 * with rough label positions (lon, lat). Used by the side-by-side maps
 * to label major countries.
 */
export interface CountryLabel {
  iso3: string;
  name: string;
  lon: number;
  lat: number;
}

export const TOP_COUNTRIES: CountryLabel[] = [
  { iso3: "CHN", name: "China", lon: 104, lat: 35 },
  { iso3: "IND", name: "India", lon: 79, lat: 22 },
  { iso3: "USA", name: "United States", lon: -99, lat: 39 },
  { iso3: "IDN", name: "Indonesia", lon: 117, lat: -2 },
  { iso3: "PAK", name: "Pakistan", lon: 70, lat: 30 },
  { iso3: "NGA", name: "Nigeria", lon: 8, lat: 9 },
  { iso3: "BRA", name: "Brazil", lon: -53, lat: -10 },
  { iso3: "BGD", name: "Bangladesh", lon: 90, lat: 23.7 },
  { iso3: "RUS", name: "Russia", lon: 95, lat: 62 },
  { iso3: "MEX", name: "Mexico", lon: -102, lat: 23.6 },
  { iso3: "KEN", name: "Kenya", lon: 38, lat: 0.5 },
];
