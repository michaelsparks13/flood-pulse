"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import StoryContainer from "@/components/story/StoryContainer";
import StoryProgressChip from "@/components/story/StoryProgressChip";
import HandoffButton from "@/components/story/HandoffButton";
import CountryGapCard from "@/components/story/CountryGapCard";
import IntroPanel from "@/components/story/IntroPanel";
import ScrollHint from "@/components/story/ScrollHint";
import CountryHeadlines from "@/components/story/CountryHeadlines";
import YearScrubber from "@/components/story/YearScrubber";
import { useActDataState } from "@/components/story/useActDataState";
import { byIso3 } from "@/lib/story/countryComparison";
import { COUNTRY_SEQUENCE, ACTS } from "@/lib/story/acts";

const DualGlobe = dynamic(() => import("@/components/DualGlobe"), { ssr: false });

const DEFAULT_YEAR = 2020;

export default function Home() {
  const {
    activeActId,
    summary,
    comparison,
    activeCountryIndex,
    handleActChange,
  } = useActDataState();

  const [year, setYear] = useState<number>(DEFAULT_YEAR);

  // Active act → camera keyframe for both panes.
  const activeCamera = useMemo(() => {
    const act = ACTS.find((a) => a.id === activeActId);
    if (!act) return null;
    if (activeActId === "three-stories" && activeCountryIndex >= 0) {
      return COUNTRY_SEQUENCE[activeCountryIndex].camera;
    }
    return act.camera;
  }, [activeActId, activeCountryIndex]);

  // Keep the StoryProgressChip in sync with the scrubber.
  const chipVisible = [
    "ratio",
    "why",
    "ladder",
    "three-stories",
    "handoff",
  ].includes(activeActId);

  const activeCountry = useMemo(() => {
    if (activeActId !== "three-stories" || activeCountryIndex < 0) return null;
    return COUNTRY_SEQUENCE[activeCountryIndex];
  }, [activeActId, activeCountryIndex]);

  const activeCountryEntry = useMemo(() => {
    if (!comparison || !activeCountry) return null;
    return byIso3(comparison, activeCountry.iso3);
  }, [comparison, activeCountry]);

  // Country-scope both panes when Act 6 is in view.
  const paneCountryFilter =
    activeActId === "three-stories" && activeCountry ? activeCountry.iso3 : undefined;

  // Force the /explore link to prefetch on mount so the handoff feels instant.
  useEffect(() => {
    const img = document.createElement("link");
    img.rel = "prefetch";
    img.href = "/explore";
    document.head.appendChild(img);
    return () => {
      img.remove();
    };
  }, []);

  return (
    <>
      <a
        href="/explore"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-panel focus:text-text-primary focus:px-3 focus:py-2 focus:rounded focus:border focus:border-border focus:outline-none"
      >
        Skip to interactive explorer
      </a>
      <DualGlobe
        year={year}
        countryFilter={paneCountryFilter}
        camera={activeCamera}
      />
      <CountryGapCard
        iso3={activeCountry?.iso3 ?? null}
        entry={activeCountryEntry}
        visible={activeActId === "three-stories"}
      />
      <CountryHeadlines
        iso3={activeCountry?.iso3 ?? null}
        visible={activeActId === "three-stories"}
      />
      <IntroPanel visible={activeActId === "old-map"} />
      <ScrollHint visible={activeActId === "old-map"} />
      <StoryProgressChip summary={summary} year={year} visible={chipVisible} />
      <StoryContainer onActChange={handleActChange} />
      <HandoffButton visible={activeActId === "handoff"} />
      <YearScrubber year={year} onYearChange={setYear} />
    </>
  );
}
