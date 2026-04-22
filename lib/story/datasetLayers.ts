/**
 * Configuration for dataset-filtered H3 layers used by the scrollytelling acts.
 *
 * - "trad": hexes inside any traditional flood-database footprint
 *           (DFO + GFD + GDACS, unioned and population-joined via the pipeline).
 *           Painted cyan. Driven by `trad_y0 != null` on the hex record.
 * - "fp":   Flood Pulse hexes that NO traditional database ever flagged —
 *           the news-only geography. Painted warm orange.
 * - "all":  default explorer view; no dataset filter, full exposure palette.
 */

export type DatasetFilter = "all" | "trad" | "fp";

/** Cyan: the "traditional catalogs saw this" color. */
export const TRAD_COLOR: [number, number, number] = [0x22, 0xd3, 0xee];

/** Warm orange: Flood Pulse's news-derived color. */
export const FP_ONLY_COLOR: [number, number, number] = [0xef, 0x8a, 0x62];
