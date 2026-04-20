import type { MapMode } from "@/lib/types";

export interface CameraKeyframe {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  duration: number | "auto";
  easing?: (t: number) => number;
}

export interface ActDataState {
  year: number;
  mapMode: MapMode;
  hexOpacity: number;
  /** Specific H3 index to pulse, if any (Act 4). */
  highlightHex?: string;
  /** When true, render before/after dual-layer compare (Act 5). */
  splitCompare?: boolean;
  /** When true, recolor hexes by client-computed confidence (Act 6). */
  confidenceMode?: boolean;
  /** When true, render the globe fog mask (Act 3). */
  fogMask?: boolean;
}

export interface ActDefinition {
  id: string;
  /** Short title shown only to screen readers. */
  ariaTitle: string;
  copy: string | string[]; // multi-string = Act 7 city sequence
  camera: CameraKeyframe;
  data: ActDataState;
  /**
   * If true, scroll progress (0..1) within this act drives a continuous
   * transformation (year, bearing) — see lib/story/acts.ts for handlers.
   */
  progressDriven?: boolean;
}
