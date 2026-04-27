import type { ActDefinition } from "./storyTypes";
import {
  GLOBE_NEUTRAL,
  GLOBE_PULLED_BACK,
  BANGLADESH,
  COUNTRY_SEQUENCE,
} from "./cameraKeyframes";

export const ACTS: ActDefinition[] = [
  {
    id: "old-map",
    ariaTitle: "Act 1: Same year, two data worlds",
    copy: [
      "The same year of floods, side-by-side. On the left, every hex the three traditional catalogs — DFO, the Global Flood Database, GDACS — flagged that year.",
      "Each hex is colored by how many people the flood polygons caught. On the right, the same year read out of local news by Google Research's Groundsource model.",
      "Scroll to fly into the places where the gap matters most.",
    ],
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
    copy: [
      "By 2018, the merged traditional catalogs caught 215 million people in flooded areas worldwide. Groundsource caught 387 million in the same year.",
      "The gap is widest where it matters most: countries with sparse satellite coverage, thin government reporting, news the rest of the world never sees.",
      "The older methods aren't getting worse. The world is just bigger than what they can see.",
    ],
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
    id: "ladder",
    ariaTitle: "Act 4: Where the gap is widest",
    copy: [
      "The biggest gaps are in the countries where a flood isn't news unless it kills people in a capital city.",
      "Where weather services don't publish their gauge readings, and satellite passes have nothing to re-pass.",
    ],
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
    ariaTitle: "Act 5: Three stories",
    copy: [
      "Bangladesh — the world's most satellite-observable delta, with dense gauge networks. Even here, Groundsource caught 2.9× more people in flooded areas than the merged catalogs logged across 2014–2025.",
      "Brazil — across 2014–2025, the merged catalogs counted 65 million people in flooded areas. Groundsource, reading local Portuguese news, found 147 million — more than twice as many.",
      "Kenya — older catalogs anchor on 2010's Tana basin floods. Across 2014–2025, Groundsource caught nearly twice the people in flooded areas — Turkana drought-flood whiplash, urban Nairobi, coastal Mombasa.",
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
    ariaTitle: "Act 6: Explore",
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
