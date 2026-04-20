"use client";

import dynamic from "next/dynamic";
import StoryContainer from "@/components/story/StoryContainer";
import { useActDataState } from "@/components/story/useActDataState";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

export default function Home() {
  const { dataState, handleActChange } = useActDataState();
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
      <StoryContainer onActChange={handleActChange} />
    </>
  );
}
