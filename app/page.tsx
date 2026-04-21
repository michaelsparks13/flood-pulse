"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import StoryContainer from "@/components/story/StoryContainer";
import StoryCounter from "@/components/story/StoryCounter";
import StoryProgressChip from "@/components/story/StoryProgressChip";
import FogMask from "@/components/story/FogMask";
import CompareDivider from "@/components/story/CompareDivider";
import HandoffButton from "@/components/story/HandoffButton";
import { useActDataState } from "@/components/story/useActDataState";
import { useScrollVelocity } from "@/components/story/useScrollVelocity";
import { useGlobe } from "@/context/GlobeContext";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

export default function Home() {
  const { dataState, summary, activeActId, handleActChange } = useActDataState();
  const [dividerX, setDividerX] = useState(0.5);
  const counterVisible = activeActId !== "breath" && !dataState.splitCompare;
  const chipVisible = ["confidence", "cities", "frequency", "handoff"].includes(activeActId);

  const velocity = useScrollVelocity();
  const { mapRef } = useGlobe();

  useEffect(() => {
    if (!["breath", "counter"].includes(activeActId)) return;
    const map = mapRef.current;
    if (!map) return;
    // velocity in px/ms; scale to gentle bearing deltas
    const delta = Math.max(-0.4, Math.min(0.4, velocity * 0.3));
    // Only nudge if delta is non-trivial to avoid per-frame thrash
    if (Math.abs(delta) > 0.01) {
      const target = map.getBearing() + delta;
      map.setBearing(target);
    }
  }, [velocity, activeActId, mapRef]);

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
        showBoundaries={true}
        showLabels={false}
        satellite={false}
        hexOpacity={dataState.hexOpacity}
        highlightHex={dataState.highlightHex}
        splitCompare={!!dataState.splitCompare}
        confidenceMode={!!dataState.confidenceMode}
        dividerX={dividerX}
      />
      <FogMask active={!!dataState.fogMask} />
      <StoryCounter summary={summary} year={dataState.year} visible={counterVisible} />
      <StoryProgressChip summary={summary} year={dataState.year} visible={chipVisible} />
      <CompareDivider active={!!dataState.splitCompare} onChange={setDividerX} />
      <HandoffButton visible={activeActId === "handoff"} />
      <StoryContainer onActChange={handleActChange} />
    </>
  );
}
