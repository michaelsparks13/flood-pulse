"use client";

import dynamic from "next/dynamic";
import StoryContainer from "@/components/story/StoryContainer";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

export default function Home() {
  return (
    <>
      <Globe
        year={2026}
        mapMode="exposure"
        showBoundaries={true}
        showLabels={false}
        satellite={false}
        hexOpacity={0.9}
      />
      <StoryContainer />
    </>
  );
}
