import type { ActDefinition } from "./storyTypes";
import {
  GLOBE_NEUTRAL,
  GLOBE_PULLED_BACK,
  CONGO_BASIN,
  BANGLADESH,
  COUNTRY_SEQUENCE,
} from "./cameraKeyframes";

export const ACTS: ActDefinition[] = [
  {
    id: "old-map",
    ariaTitle: "Act 1: Same year, two data worlds",
    copy: "The same year of floods, side-by-side. On the left, every hex the three traditional catalogs — Dartmouth Flood Observatory, the Global Flood Database, GDACS — flagged that year, colored by how many people the polygons caught. On the right, the same year read out of local news by Google Research's Groundsource model. Drag the slider to change the year. Scroll to fly into the places where the gap matters most.",
    camera: GLOBE_NEUTRAL,
    data: {
      year: 2020,
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
      "2.6 million flood events — more than two hundred times what the old catalogs flagged in twenty-five years.",
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
    copy: "By 2018, the merged traditional catalogs caught 215 million people in flooded areas worldwide. Flood Pulse caught 387 million in the same year — and the gap is widest where it matters most: countries with sparse satellite coverage, thin government reporting, news the rest of the world never sees. The older methods aren't getting worse. The world is just bigger than what they can see.",
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
      "Bangladesh — the world's most satellite-observable delta, with one of the densest gauge networks in the Global South. Even here, across 2014–2025, Flood Pulse caught 2.9× the people the merged satellite-and-curator catalogs logged.",
      "Brazil — across 2014–2025, the merged traditional catalogs counted 65 million people in flooded areas. Flood Pulse, reading local Portuguese news in every state, found 147 million — more than twice as many, almost all of it in the Amazon and the interior.",
      "Kenya — older catalogs are anchored in 2010's Tana River basin floods, large polygons that look complete from space. But across 2014–2025, Flood Pulse has caught nearly twice the people in flooded areas — drought-flood whiplash in Turkana, urban flooding in Nairobi, coastal storms in Mombasa.",
    ],
    camera: BANGLADESH,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
      countryGapIso3: "BGD",
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
