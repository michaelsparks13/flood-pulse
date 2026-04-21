"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import StoryContainer from "@/components/story/StoryContainer";
import StoryCounter from "@/components/story/StoryCounter";
import FogMask from "@/components/story/FogMask";
import CompareDivider from "@/components/story/CompareDivider";
import { useActDataState } from "@/components/story/useActDataState";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

export default function Home() {
  const { dataState, summary, activeActId, handleActChange } = useActDataState();
  const [dividerX, setDividerX] = useState(0.5);
  const counterVisible = activeActId !== "breath" && !dataState.splitCompare;

  return (
    <>
      <Globe
        year={dataState.year}
        mapMode={dataState.mapMode}
        showBoundaries={true}
        showLabels={false}
        satellite={false}
        hexOpacity={dataState.hexOpacity}
        highlightHex={dataState.highlightHex}
        splitCompare={!!dataState.splitCompare}
        dividerX={dividerX}
      />
      <FogMask active={!!dataState.fogMask} />
      <StoryCounter summary={summary} year={dataState.year} visible={counterVisible} />
      <CompareDivider active={!!dataState.splitCompare} onChange={setDividerX} />
      <StoryContainer onActChange={handleActChange} />
    </>
  );
}
