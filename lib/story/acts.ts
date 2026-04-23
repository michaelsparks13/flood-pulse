import type { ActDefinition } from "./storyTypes";
import {
  GLOBE_NEUTRAL,
  GLOBE_PULLED_BACK,
  CONGO_BASIN,
  DRC,
  COUNTRY_SEQUENCE,
} from "./cameraKeyframes";

export const ACTS: ActDefinition[] = [
  {
    id: "old-map",
    ariaTitle: "Act 1: What the old catalogs saw",
    copy: "For the first quarter of this century, three catalogs tried to keep track of every flood on Earth — Dartmouth Flood Observatory, the Global Flood Database, and GDACS. Every lit cell below is a hex their polygons touched, colored by how many people live there. Across twenty-five years, the three catalogs collectively flagged the areas of about 290 million people — mostly big river basins that remote sensing had already learned to watch.",
    camera: GLOBE_NEUTRAL,
    data: {
      year: 2025,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "trad",
    },
  },
  {
    id: "reveal",
    ariaTitle: "Act 2: What the news revealed",
    copy: [
      "Then Google Research trained a model to read local news in forty languages.",
      "It found floods the satellites missed, in villages the curators never logged.",
      "2.88 billion people in flooded areas — roughly ten times what the old catalogs caught.",
    ],
    camera: GLOBE_NEUTRAL,
    data: {
      year: 2025,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
      revealProgress: 0,
    },
    progressDriven: true,
  },
  {
    id: "ratio",
    ariaTitle: "Act 3: The gap, year by year",
    copy: "The gap gets bigger every year. By 2018, Flood Pulse was finding thirty-two times more people in flooded areas than the satellite catalog could see — and the older methods aren't getting worse. They're just holding steady as the world keeps flooding.",
    camera: GLOBE_NEUTRAL,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
      ratioProgress: 0,
    },
    progressDriven: true,
  },
  {
    id: "why",
    ariaTitle: "Act 4: Why the old methods miss so much",
    copy: "The Congo basin sits under near-permanent cloud cover. MODIS can't see through it for weeks at a time. Government reporting here is thin, and the floods themselves move fast — up overnight, gone by the time a satellite returns.",
    camera: CONGO_BASIN,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "fp",
    },
  },
  {
    id: "ladder",
    ariaTitle: "Act 5: Where the gap is widest",
    copy: "The biggest gaps are in the countries where a flood isn't news unless it kills people in a capital city — where weather services don't publish their gauge readings, and satellite passes have nothing to re-pass.",
    camera: GLOBE_PULLED_BACK,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
      ladderProgress: 0,
    },
    progressDriven: true,
  },
  {
    id: "three-stories",
    ariaTitle: "Act 6: Three stories",
    copy: [
      "DRC — zero floods in the satellite catalog, 2000 to 2018. The Congo basin is under clouds, under canopy, and under-reported. A perfect storm of invisibility.",
      "Bangladesh — the world's most satellite-observable delta, with one of the densest gauge networks in the Global South. Even here, Flood Pulse found twice the exposure the satellites logged.",
      "Brazil — satellites attributed 340,000 people flooded across 2000–2018. Flood Pulse read local Portuguese news in every state and found 96 million. A 283× gap, almost all of it in the Amazon and the interior.",
    ],
    camera: DRC,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
      countryGapIso3: "COD",
    },
  },
  {
    id: "handoff",
    ariaTitle: "Act 7: Explore",
    copy: "Explore the map. Twenty-six years of floods — switch between what the traditional catalogs saw and what the news revealed, anywhere on Earth.",
    camera: GLOBE_NEUTRAL,
    data: {
      year: 2025,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
    },
  },
];

export { COUNTRY_SEQUENCE };
