import type { CameraKeyframe } from "./storyTypes";

/** Neutral global view, equator-centered. Used by Acts 1, 2, 3. */
export const GLOBE_NEUTRAL: CameraKeyframe = {
  center: [20, 5],
  zoom: 1.4,
  pitch: 0,
  bearing: 0,
  duration: "auto",
};

/** Slightly zoomed-out view for Act 5 country ladder. */
export const GLOBE_PULLED_BACK: CameraKeyframe = {
  center: [20, 0],
  zoom: 1.2,
  pitch: 0,
  bearing: 0,
  duration: "auto",
};

/** Congo basin: cloud-heavy region, sparse GFD, dense FP. Act 4. */
export const CONGO_BASIN: CameraKeyframe = {
  center: [23, -2],
  zoom: 3.5,
  pitch: 30,
  bearing: 0,
  duration: "auto",
};

/** Act 6 three-country flyover. */
export const DRC: CameraKeyframe = {
  center: [25, -2],
  zoom: 4.5,
  pitch: 30,
  bearing: 0,
  duration: 2500,
};

export const BANGLADESH: CameraKeyframe = {
  center: [90, 23.7],
  zoom: 5.0,
  pitch: 30,
  bearing: 0,
  duration: 2500,
};

/** Brazil — centered on the Amazon / interior where the FP-vs-trad gap is largest. */
export const BRAZIL: CameraKeyframe = {
  center: [-53, -10],
  zoom: 3.4,
  pitch: 30,
  bearing: 0,
  duration: 2500,
};

/** Handoff view — same as neutral, held. */
export const HANDOFF = GLOBE_NEUTRAL;

/** Three-country sequence consumed by StoryContainer for the three-stories act. */
export const COUNTRY_SEQUENCE = [
  { iso3: "COD", camera: DRC },
  { iso3: "BGD", camera: BANGLADESH },
  { iso3: "BRA", camera: BRAZIL },
] as const;
