"use client";

import dynamic from "next/dynamic";
import StoryContainer from "@/components/story/StoryContainer";
import StoryCounter from "@/components/story/StoryCounter";
import FogMask from "@/components/story/FogMask";
import { useActDataState } from "@/components/story/useActDataState";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

export default function Home() {
  const { dataState, summary, activeActId, handleActChange } = useActDataState();
  const counterVisible = activeActId !== "breath";

  return (
    <>
      <Globe
        year={dataState.year}
        mapMode={dataState.mapMode}
        showBoundaries={true}
        showLabels={false}
        satellite={false}
        hexOpacity={dataState.hexOpacity}
      />
      <FogMask active={!!dataState.fogMask} />
      <StoryCounter summary={summary} year={dataState.year} visible={counterVisible} />
      <StoryContainer onActChange={handleActChange} />
    </>
  );
}
