/**
 * Per-(catalog, year) hex loader for the side-by-side view.
 *
 * The pipeline step `05f_hex_yearly_export.py` emits one JSON file per
 * (source, year) tuple at `/public/data/{source}/hex_years/{year}.json`. Each
 * file is self-contained — the rows are ONLY the hexes that catalog flagged
 * in that year, and `p` is the year-specific population exposed (area-weighted
 * to match the pipeline's 10% inundation ratio).
 *
 * This module fetches those files lazily and caches them. Adjacent years can
 * be prefetched so scrubbing the year slider stays snappy.
 */

import { cellToLatLng } from "h3-js";

export type HexYearlySource = "old" | "new";

export interface HexYearlyRowTrad {
  h: string;
  cc: string;
  p: number;
  src: string | null;
  lat: number;
  lng: number;
}

export interface HexYearlyRowFP {
  h: string;
  cc: string;
  p: number;
  lat: number;
  lng: number;
}

export type HexYearlyRow = HexYearlyRowTrad | HexYearlyRowFP;

export interface HexYearlyFile {
  year: number;
  source: HexYearlySource;
  columns: string[];
  rows: HexYearlyRow[];
}

interface HexYearlyWireFile {
  year: number;
  source: HexYearlySource;
  columns: string[];
  // old files: [h, cc, p, src?]; new files: [h, cc, p]
  rows: Array<(string | number | null)[]>;
}

export interface HexYearlyYearSummary {
  year: number;
  hexCount: number;
  exposed: number;
  sizeKb: number;
}

export interface HexYearlyIndex {
  generated: string;
  source: HexYearlySource;
  inundationRatio: number;
  years: HexYearlyYearSummary[];
}

const CACHE = new Map<string, Promise<HexYearlyFile>>();
const INDEX_CACHE = new Map<HexYearlySource, Promise<HexYearlyIndex>>();

function parseFile(raw: HexYearlyWireFile): HexYearlyFile {
  const cols = raw.columns;
  const hIdx = cols.indexOf("h");
  const ccIdx = cols.indexOf("cc");
  const pIdx = cols.indexOf("p");
  const srcIdx = cols.indexOf("src");

  const rows: HexYearlyRow[] = new Array(raw.rows.length);
  for (let i = 0; i < raw.rows.length; i++) {
    const r = raw.rows[i];
    const h = r[hIdx] as string;
    const [lat, lng] = cellToLatLng(h);
    const common = {
      h,
      cc: r[ccIdx] as string,
      p: (r[pIdx] as number) ?? 0,
      lat,
      lng,
    };
    if (srcIdx >= 0) {
      (rows as HexYearlyRowTrad[])[i] = {
        ...common,
        src: (r[srcIdx] as string | null) ?? null,
      };
    } else {
      (rows as HexYearlyRowFP[])[i] = common;
    }
  }
  return { year: raw.year, source: raw.source, columns: cols, rows };
}

export function loadHexYear(
  source: HexYearlySource,
  year: number,
): Promise<HexYearlyFile> {
  const key = `${source}:${year}`;
  let entry = CACHE.get(key);
  if (!entry) {
    entry = fetch(`/data/${source}/hex_years/${year}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`hex_years ${source}/${year} ${r.status}`);
        return r.json() as Promise<HexYearlyWireFile>;
      })
      .then(parseFile);
    CACHE.set(key, entry);
  }
  return entry;
}

export function prefetchHexYears(
  source: HexYearlySource,
  years: number[],
): void {
  for (const year of years) loadHexYear(source, year);
}

export function loadHexYearIndex(source: HexYearlySource): Promise<HexYearlyIndex> {
  let entry = INDEX_CACHE.get(source);
  if (!entry) {
    entry = fetch(`/data/${source}/hex_years/index.json`).then((r) => {
      if (!r.ok) throw new Error(`hex_years ${source} index ${r.status}`);
      return r.json() as Promise<HexYearlyIndex>;
    });
    INDEX_CACHE.set(source, entry);
  }
  return entry;
}

/** Clear caches — test-only. */
export function __resetHexYearlyCache(): void {
  CACHE.clear();
  INDEX_CACHE.clear();
}
