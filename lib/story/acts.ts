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
    ariaTitle: "Act 1: What the satellites saw",
    copy: "For two decades, this was our picture of where floods hit people. 913 floods. 290 million people. The rest of the world was invisible.",
    camera: GLOBE_NEUTRAL,
    data: {
      year: 2018,
      mapMode: "exposure",
      hexOpacity: 0.65,
      datasetFilter: "gfd",
    },
  },
  {
    id: "reveal",
    ariaTitle: "Act 2: The new map",
    copy: [
      "Then we stopped asking satellites and started reading the news.",
      "2.6 million local flood records.",
      "2.88 billion flood-exposed people — ten times what the satellites found.",
    ],
    camera: GLOBE_NEUTRAL,
    data: {
      year: 2018,
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
    copy: "Every year the gap grew. By 2018, we were finding 32 times more flood-exposed people than satellites could see.",
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
    ariaTitle: "Act 4: Why satellites miss",
    copy: "Clouds. Short floods. Small villages. All invisible from 500 miles up.",
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
    ariaTitle: "Act 5: Where the gap lives",
    copy: "The invisible floods cluster in the Global South.",
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
      "Democratic Republic of Congo",
      "Bangladesh",
      "Mozambique",
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
    ariaTitle: "Act 7: Take control",
    copy: "Explore the new map of flood exposure.",
    camera: GLOBE_NEUTRAL,
    data: {
      year: 2026,
      mapMode: "exposure",
      hexOpacity: 0.9,
      datasetFilter: "all",
    },
  },
];

export { COUNTRY_SEQUENCE };
