import type { MapMode } from "@/lib/types";
import type { DatasetFilter } from "./datasetLayers";

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
  /** Which dataset(s) the hex layer shows. */
  datasetFilter: DatasetFilter;
  /** Act 4: specific hex or cluster highlight. */
  highlightHex?: string;
  /** Act 6: current target country for the CountryGapCard. */
  countryGapIso3?: string;
  /** Act 2: 0..1 scroll progress, drives reveal wipe + counter. */
  revealProgress?: number;
  /** Act 3: 0..1 scroll progress, drives ratio line reveal. */
  ratioProgress?: number;
  /** Act 5: 0..1 scroll progress, drives country-bar stagger. */
  ladderProgress?: number;
}

export interface ActDefinition {
  id: string;
  /** Screen-reader title. */
  ariaTitle: string;
  copy: string | string[];
  camera: CameraKeyframe;
  data: ActDataState;
  /**
   * If true, scroll progress drives a continuous transformation. Handlers
   * live in useActDataState.
   */
  progressDriven?: boolean;
}
