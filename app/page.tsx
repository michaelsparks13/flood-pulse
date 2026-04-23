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
import CountryHeadlines from "@/components/story/CountryHeadlines";
import CountryYearCompare from "@/components/story/CountryYearCompare";
import DataLoadingIndicator from "@/components/story/DataLoadingIndicator";
import { useActDataState } from "@/components/story/useActDataState";
import { useReducedMotion } from "@/components/story/useReducedMotion";
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
        countryFilter={dataState.countryFilter}
      />
      <DatasetRevealLayer progress={revealProgress} reducedMotion={reducedMotion} />
      <DatasetCounter
        progress={revealProgress}
        fromValue={GFD_PE_MATCHED}
        toValue={FP_PE_MATCHED}
        label="People in flooded areas, 2000–2025"
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
      <CountryHeadlines
        iso3={activeCountry?.iso3 ?? null}
        visible={activeActId === "three-stories"}
      />
      <IntroPanel visible={activeActId === "old-map"} />
      <ScrollHint visible={activeActId === "old-map"} />
      <CountryYearCompare
        iso3={activeCountry?.iso3 ?? null}
        visible={activeActId === "three-stories"}
      />
      <StoryProgressChip summary={summary} year={dataState.year} visible={chipVisible} />
      <StoryContainer onActChange={handleActChange} />
      <HandoffButton visible={activeActId === "handoff"} />
      <DataLoadingIndicator />
    </>
  );
}
