"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import StoryContainer from "@/components/story/StoryContainer";
import StoryProgressChip from "@/components/story/StoryProgressChip";
import HandoffButton from "@/components/story/HandoffButton";
import DatasetRevealLayer from "@/components/story/DatasetRevealLayer";
import DatasetCounter from "@/components/story/DatasetCounter";
import RatioLineChart from "@/components/story/RatioLineChart";
import CountryGapBar from "@/components/story/CountryGapBar";
import CountryGapCard from "@/components/story/CountryGapCard";
import IntroPanel from "@/components/story/IntroPanel";
import ScrollHint from "@/components/story/ScrollHint";
import { useActDataState } from "@/components/story/useActDataState";
import { useScrollVelocity } from "@/components/story/useScrollVelocity";
import { useReducedMotion } from "@/components/story/useReducedMotion";
import { useGlobe } from "@/context/GlobeContext";
import { byIso3 } from "@/lib/story/countryComparison";
import { COUNTRY_SEQUENCE } from "@/lib/story/acts";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

const GFD_PE_MATCHED = 290_000_000;
const FP_PE_MATCHED = 2_880_000_000;

export default function Home() {
  const {
    activeActId,
    dataState,
    summary,
    comparison,
    ratio,
    activeCountryIndex,
    handleActChange,
  } = useActDataState();

  const reducedMotion = useReducedMotion();

  const { mapRef } = useGlobe();
  const velocityEnabled = activeActId === "old-map" || activeActId === "reveal";
  useScrollVelocity((velocity) => {
    const map = mapRef.current;
    if (!map) return;
    const delta = Math.max(-0.4, Math.min(0.4, velocity * 0.3));
    if (Math.abs(delta) > 0.01) {
      map.setBearing(map.getBearing() + delta);
    }
  }, velocityEnabled);

  const chipVisible = [
    "ratio",
    "why",
    "ladder",
    "three-stories",
    "handoff",
  ].includes(activeActId);

  const revealProgress = dataState.revealProgress ?? 0;
  const ratioProgress = dataState.ratioProgress ?? 0;
  const ladderProgress = dataState.ladderProgress ?? 0;

  const activeCountry = useMemo(() => {
    if (activeActId !== "three-stories" || activeCountryIndex < 0) return null;
    return COUNTRY_SEQUENCE[activeCountryIndex];
  }, [activeActId, activeCountryIndex]);

  const activeCountryEntry = useMemo(() => {
    if (!comparison || !activeCountry) return null;
    return byIso3(comparison, activeCountry.iso3);
  }, [comparison, activeCountry]);

  return (
    <>
      <a
        href="/explore"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-panel focus:text-text-primary focus:px-3 focus:py-2 focus:rounded focus:border focus:border-border focus:outline-none"
      >
        Skip to interactive explorer
      </a>
      <Globe
        year={dataState.year}
        mapMode={dataState.mapMode}
        showBoundaries
        showLabels={false}
        satellite={false}
        hexOpacity={dataState.hexOpacity}
        highlightHex={dataState.highlightHex}
        datasetFilter={dataState.datasetFilter}
      />
      <DatasetRevealLayer progress={revealProgress} reducedMotion={reducedMotion} />
      <DatasetCounter
        progress={revealProgress}
        gfdPe={GFD_PE_MATCHED}
        fpPe={FP_PE_MATCHED}
        visible={activeActId === "reveal"}
      />
      <RatioLineChart
        progress={ratioProgress}
        years={ratio?.calibration_gfd.years ?? []}
        ratios={ratio?.calibration_gfd.pe_ratio ?? []}
        lowConfidenceYears={ratio?.low_confidence_years ?? []}
        visible={activeActId === "ratio"}
      />
      <CountryGapBar
        data={comparison}
        progress={ladderProgress}
        visible={activeActId === "ladder"}
      />
      <CountryGapCard
        iso3={activeCountry?.iso3 ?? null}
        entry={activeCountryEntry}
        visible={activeActId === "three-stories"}
      />
      <IntroPanel visible={activeActId === "old-map"} />
      <ScrollHint visible={activeActId === "old-map"} />
      <StoryProgressChip summary={summary} year={dataState.year} visible={chipVisible} />
      <StoryContainer onActChange={handleActChange} />
      <HandoffButton visible={activeActId === "handoff"} />
    </>
  );
}
