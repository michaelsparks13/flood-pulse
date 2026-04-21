/**
 * Configuration for dataset-filtered H3 layers used by Acts 1, 2, and 4.
 *
 * - "gfd": only hexes whose country is in Tellman 2021's 118-country list (cyan).
 * - "fp": only hexes whose country is NOT in that list (warm orange).
 * - "all": default explorer view; no dataset filter.
 */

export type DatasetFilter = "all" | "gfd" | "fp";

/** Cyan: matches /compare's GFD color. */
export const GFD_COLOR: [number, number, number] = [0x22, 0xd3, 0xee];

/** Warm orange: matches the existing hex palette. */
export const FP_ONLY_COLOR: [number, number, number] = [0xef, 0x8a, 0x62];
