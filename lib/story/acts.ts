import type { ActDefinition } from "./storyTypes";
import {
  GLOBE_HOME,
  GLOBE_MID,
  GLOBE_FLAT,
  BANGLADESH_COUNTRY,
  KHULNA_HEX,
  DHAKA,
  JAKARTA,
  NEW_ORLEANS,
} from "./cameraKeyframes";

export const ACTS: ActDefinition[] = [
  {
    id: "breath",
    ariaTitle: "Act 1: The Breath",
    copy: "Every four years, the number of people living in flooded places doubles.",
    camera: GLOBE_HOME,
    data: { year: 2000, mapMode: "exposure", hexOpacity: 0.3 },
  },
  {
    id: "counter",
    ariaTitle: "Act 2: The Counter Wakes",
    copy: "86 million people. Up from 40 million in the year 2000.",
    camera: GLOBE_MID,
    data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9 },
    progressDriven: true,
  },
  {
    id: "where",
    ariaTitle: "Act 3: Where Are They?",
    copy: "One in four of them lives here — in a country the size of Iowa.",
    camera: BANGLADESH_COUNTRY,
    data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9, fogMask: true },
  },
  {
    id: "hex",
    ariaTitle: "Act 4: One Hex, One Story",
    copy: "This single hexagon. 10,601,000 people. Flooded in 16 of the last 22 years.",
    camera: KHULNA_HEX,
    data: {
      year: 2026,
      mapMode: "exposure",
      hexOpacity: 0.9,
      highlightHex: "853cf177fffffff",
    },
  },
  {
    id: "compare",
    ariaTitle: "Act 5: Before and After",
    copy: "Drag to compare. The last decade versus the one before.",
    camera: GLOBE_MID,
    data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9, splitCompare: true },
  },
  {
    id: "confidence",
    ariaTitle: "Act 6: The Confidence Texture",
    copy: "Not all of these are equally certain. Coastal hexes have ground truth. Inland rivers are inferred.",
    camera: GLOBE_MID,
    data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9, confidenceMode: true },
  },
  {
    id: "cities",
    ariaTitle: "Act 7: The Three Cities",
    copy: ["Dhaka. 2.3 million exposed.", "Jakarta. 1.8 million.", "New Orleans. 460 thousand."],
    camera: DHAKA,
    data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9 },
  },
  {
    id: "frequency",
    ariaTitle: "Act 8: The Frequency Map",
    copy: "This is where it's getting worse.",
    camera: GLOBE_FLAT,
    data: { year: 2026, mapMode: "frequency", hexOpacity: 0.9 },
  },
  {
    id: "handoff",
    ariaTitle: "Act 9: Take Control",
    copy: "This is your map. Take control →",
    camera: GLOBE_FLAT,
    data: { year: 2026, mapMode: "frequency", hexOpacity: 0.9 },
  },
];

export const CITY_SEQUENCE = [DHAKA, JAKARTA, NEW_ORLEANS];
