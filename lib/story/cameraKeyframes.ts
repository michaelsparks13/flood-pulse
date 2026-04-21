import type { CameraKeyframe } from "./storyTypes";

// Act 1 — initial wide globe, slight tilt for parallax
export const GLOBE_HOME: CameraKeyframe = {
  center: [20, 15],
  zoom: 0.8,
  pitch: 15,
  bearing: 0,
  duration: "auto",
};

// Acts 2, 5, 6 — mid-zoom globe with subtle tilt
export const GLOBE_MID: CameraKeyframe = {
  center: [20, 15],
  zoom: 1.6,
  pitch: 10,
  bearing: 0,
  duration: "auto",
};

// Acts 8, 9 — flat (no tilt) globe for frequency map + handoff
export const GLOBE_FLAT: CameraKeyframe = {
  center: [20, 15],
  zoom: 1.4,
  pitch: 0,
  bearing: 0,
  duration: "auto",
};

// Act 3 — Bangladesh country-scale reveal
export const BANGLADESH_COUNTRY: CameraKeyframe = {
  center: [90, 23.7],
  zoom: 4.5,
  pitch: 30,
  bearing: 0,
  duration: "auto",
};

// Act 4 — tight zoom on a single Dhaka-area hex (853cf177fffffff)
// centroid derived from h3-js cellToLatLng at implementation time
export const KHULNA_HEX: CameraKeyframe = {
  center: [90.440, 23.663],
  zoom: 5.5,
  pitch: 45,
  bearing: 0,
  duration: "auto",
};

// Act 7 — first of three-city sequence
export const DHAKA: CameraKeyframe = {
  center: [90.4, 23.8],
  zoom: 5.8,
  pitch: 25,
  bearing: 0,
  duration: 2500,
};

// Act 7 — second of three-city sequence
export const JAKARTA: CameraKeyframe = {
  center: [106.8, -6.2],
  zoom: 5.8,
  pitch: 25,
  bearing: 0,
  duration: 2500,
};

// Act 7 — third of three-city sequence
export const NEW_ORLEANS: CameraKeyframe = {
  center: [-90.1, 29.95],
  zoom: 5.8,
  pitch: 25,
  bearing: 0,
  duration: 2500,
};
