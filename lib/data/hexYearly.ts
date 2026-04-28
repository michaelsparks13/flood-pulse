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
  COMBINED_CACHE.clear();
}

// ---------------------------------------------------------------------------
// Combined per-year data for the /explore Globe view
// ---------------------------------------------------------------------------

import type { HexDatum } from "@/lib/types";

const COMBINED_CACHE = new Map<number, Promise<CombinedHexYearResult>>();

export interface CombinedHexYearResult {
  year: number;
  hexes: HexDatum[];
  /** Per-row build also enriches the country-code → integer index. */
  countryIndex: Record<string, number>;
}

/** OLD's res-6 hexes flood many low-PE rural cells; mirror the home-page
 *  threshold so /explore renders the same "honest" view of OLD coverage. */
const OLD_PE_THRESHOLD = 2000;
/** NEW hexes are only kept if their PE clears this minimum — matches the
 *  pipeline export's MIN_EXPOSED. */
const NEW_PE_THRESHOLD = 50;

/**
 * Build a per-year HexDatum[] for the /explore Globe by merging the OLD
 * (DFO+GFD+GDACS) and NEW (Groundsource) per-year files. Each hex appears
 * once; if it's in both files, FP fields come from NEW and trad_* fields
 * come from OLD. Cached per year so slider scrubbing stays snappy.
 */
export function loadHexDataForYear(
  year: number,
  gfdCountries: Set<string>,
): Promise<CombinedHexYearResult> {
  let entry = COMBINED_CACHE.get(year);
  if (!entry) {
    entry = Promise.all([
      loadHexYear("old", year).catch(() => null),
      loadHexYear("new", year).catch(() => null),
    ]).then(([oldFile, newFile]) => {
      const map = new Map<string, HexDatum>();

      if (oldFile) {
        for (const r of oldFile.rows as HexYearlyRowTrad[]) {
          if (r.p < OLD_PE_THRESHOLD) continue;
          map.set(r.h, {
            h: r.h,
            cc: r.cc,
            // FP fields — empty until NEW pass below
            m: 0,
            yf: 0,
            p: 0,
            y0: 9999,
            y1: 9999,
            ft: 0,
            rp: 0,
            // Trad fields, sourced from OLD
            trad_y0: year,
            trad_y1: year,
            trad_yf: 1,
            trad_p: r.p,
            trad_src: r.src ?? null,
            lat: r.lat,
            lng: r.lng,
          });
        }
      }

      if (newFile) {
        for (const r of newFile.rows) {
          if (r.p < NEW_PE_THRESHOLD) continue;
          const existing = map.get(r.h);
          if (existing) {
            existing.p = r.p;
            existing.y0 = year;
            existing.y1 = year;
            existing.yf = 1;
            existing.m = 1;
          } else {
            map.set(r.h, {
              h: r.h,
              cc: r.cc,
              m: 1,
              yf: 1,
              p: r.p,
              y0: year,
              y1: year,
              ft: 0,
              rp: 0,
              trad_y0: null,
              trad_y1: null,
              trad_yf: null,
              trad_p: null,
              trad_src: null,
              lat: r.lat,
              lng: r.lng,
            });
          }
        }
      }

      // Build the country-code → integer index used by the GPU country filter.
      const countryIndex: Record<string, number> = {};
      let nextCc = 0;
      const hexes: HexDatum[] = [];
      for (const hex of map.values()) {
        let ccIdx = countryIndex[hex.cc];
        if (ccIdx === undefined) {
          ccIdx = nextCc++;
          countryIndex[hex.cc] = ccIdx;
        }
        hex.ccIdx = ccIdx;
        hex.isGfdObserved = gfdCountries.has(hex.cc);
        hexes.push(hex);
      }

      return { year, hexes, countryIndex };
    });
    COMBINED_CACHE.set(year, entry);
  }
  return entry;
}
