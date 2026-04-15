/**
 * Color system for FloodPulse.
 *
 * Exposure heatmap uses a magma-inspired sequential palette:
 * dark purple (low) → orange → bright yellow (high)
 */

/** Magma-inspired stops for cumulative exposure */
export const EXPOSURE_STOPS: [number, string][] = [
  [0, "#0d0829"],
  [0.15, "#2c115f"],
  [0.3, "#711f81"],
  [0.45, "#b63679"],
  [0.6, "#e85a5a"],
  [0.75, "#f8945e"],
  [0.9, "#fdd162"],
  [1.0, "#fcffa4"],
];

/** Get MapLibre fill-color expression for exposure */
export function exposureColorExpression(
  property: string,
  maxValue: number,
): unknown[] {
  return [
    "interpolate",
    ["linear"],
    ["get", property],
    0,
    EXPOSURE_STOPS[0][1],
    maxValue * 0.15,
    EXPOSURE_STOPS[1][1],
    maxValue * 0.3,
    EXPOSURE_STOPS[2][1],
    maxValue * 0.45,
    EXPOSURE_STOPS[3][1],
    maxValue * 0.6,
    EXPOSURE_STOPS[4][1],
    maxValue * 0.75,
    EXPOSURE_STOPS[5][1],
    maxValue * 0.9,
    EXPOSURE_STOPS[6][1],
    maxValue,
    EXPOSURE_STOPS[7][1],
  ];
}

/** Hex color interpolation */
export function interpolateHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

/** Sample color from exposure scale */
export function exposureColor(normalized: number): string {
  const clamped = Math.max(0, Math.min(1, normalized));
  for (let i = EXPOSURE_STOPS.length - 1; i >= 0; i--) {
    if (clamped >= EXPOSURE_STOPS[i][0]) {
      if (i === EXPOSURE_STOPS.length - 1) return EXPOSURE_STOPS[i][1];
      const lo = EXPOSURE_STOPS[i];
      const hi = EXPOSURE_STOPS[i + 1];
      const t = (clamped - lo[0]) / (hi[0] - lo[0]);
      return interpolateHex(lo[1], hi[1], t);
    }
  }
  return EXPOSURE_STOPS[0][1];
}

// ─── deck.gl RGBA color scales ──────────────────────────────────────────

type RGBStop = [number, [number, number, number]];

function interpolateRGBA(
  value: number,
  stops: RGBStop[],
): [number, number, number] {
  if (value <= stops[0][0]) return stops[0][1];
  if (value >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (value <= stops[i + 1][0]) {
      const t = (value - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      return [
        Math.round(stops[i][1][0] + t * (stops[i + 1][1][0] - stops[i][1][0])),
        Math.round(stops[i][1][1] + t * (stops[i + 1][1][1] - stops[i][1][1])),
        Math.round(stops[i][1][2] + t * (stops[i + 1][1][2] - stops[i][1][2])),
      ];
    }
  }
  return stops[0][1];
}

/** Exposure: population → magma-style RGB (same stops as Globe.tsx EXPOSURE_PAINT) */
const EXPOSURE_RGBA_STOPS: RGBStop[] = [
  [0, [44, 17, 95]],
  [1000, [113, 31, 129]],
  [10000, [182, 54, 121]],
  [50000, [232, 90, 90]],
  [200000, [248, 148, 94]],
  [1000000, [253, 209, 98]],
  [5000000, [252, 255, 164]],
  [20000000, [255, 255, 255]],
];

/** Frequency: trend → diverging RdBu RGB (same stops as Globe.tsx FREQUENCY_PAINT) */
const FREQUENCY_RGBA_STOPS: RGBStop[] = [
  [-50, [33, 102, 172]],
  [-25, [103, 169, 207]],
  [0, [240, 240, 240]],
  [25, [239, 138, 98]],
  [50, [178, 24, 43]],
];

export function getExposureRGBA(population: number): [number, number, number] {
  return interpolateRGBA(population, EXPOSURE_RGBA_STOPS);
}

export function getFrequencyRGBA(trend: number): [number, number, number] {
  return interpolateRGBA(trend, FREQUENCY_RGBA_STOPS);
}
