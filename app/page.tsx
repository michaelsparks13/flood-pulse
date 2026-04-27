"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import StoryContainer from "@/components/story/StoryContainer";
import HandoffButton from "@/components/story/HandoffButton";
import CountryGapCard from "@/components/story/CountryGapCard";
import IntroPanel from "@/components/story/IntroPanel";
import ScrollHint from "@/components/story/ScrollHint";
import YearTitle from "@/components/story/YearTitle";
import { useActDataState } from "@/components/story/useActDataState";
import { byIso3 } from "@/lib/story/countryComparison";
import { COUNTRY_SEQUENCE, ACTS } from "@/lib/story/acts";
import { peaksByIso3 } from "@/lib/story/countryYearPeaks";

const DualGlobe = dynamic(() => import("@/components/DualGlobe"), { ssr: false });

const DEFAULT_YEAR = 2020;

export default function Home() {
  const {
    activeActId,
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

  // Drive the displayed year from the active act. Act 5 (three-stories)
  // overrides per-country to each country's strongest FP year so the
  // side-by-side map shows the year with the most dramatic OLD-vs-NEW gap.
  useEffect(() => {
    if (activeActId === "three-stories" && activeCountry) {
      const peaks = peaksByIso3(activeCountry.iso3);
      if (peaks && peaks.peakYears.length > 0) {
        const peakYear = peaks.peakYears.reduce((a, b) => (a.fp > b.fp ? a : b)).year;
        setYear(peakYear);
        return;
      }
    }
    const act = ACTS.find((a) => a.id === activeActId);
    if (act?.data?.year) setYear(act.data.year);
  }, [activeActId, activeCountry]);

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
      <IntroPanel visible={activeActId === "old-map"} />
      <ScrollHint visible={activeActId === "old-map"} />
      <YearTitle year={year} />
      <StoryContainer onActChange={handleActChange} />
      <HandoffButton visible={activeActId === "handoff"} />
    </>
  );
}
