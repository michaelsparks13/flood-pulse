"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import ExposureCounter from "@/components/ExposureCounter";
import TimelineSlider from "@/components/TimelineSlider";
import MethodologyDrawer from "@/components/MethodologyDrawer";
import type { GlobalSummary } from "@/lib/types";

// Load Globe client-side only (MapLibre needs DOM)
const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

export default function Home() {
  const [year, setYear] = useState(2000);
  const [playing, setPlaying] = useState(true);
  const [summary, setSummary] = useState<GlobalSummary | null>(null);

  // Load global summary data
  useEffect(() => {
    fetch("/data/global_summary.json")
      .then((r) => r.json())
      .then((d) => setSummary(d))
      .catch(() => {});
  }, []);

  const handleYearChange = useCallback((y: number) => {
    setYear(y);
  }, []);

  const handlePlayToggle = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      {/* Globe fills the viewport */}
      <Globe year={year} />

      {/* Top-left: counter + title */}
      <div className="absolute top-5 left-5 sm:top-8 sm:left-8 z-10 max-w-sm bg-panel/80 backdrop-blur-xl rounded-2xl border border-border shadow-[0_4px_24px_rgba(0,0,0,0.3)] p-5 sm:p-6">
        <h1 className="text-text-primary text-xl font-semibold mb-1 tracking-tight">
          FloodPulse
        </h1>
        <p className="text-text-tertiary text-xs mb-5">
          Global flood exposure from 2.6M news-derived events
        </p>
        <ExposureCounter summary={summary} year={year} />
      </div>

      {/* Top-right: methodology button */}
      <div className="absolute top-5 right-5 z-10 flex items-center gap-2">
        <MethodologyDrawer />
      </div>

      {/* Bottom: unified timeline + legend panel */}
      <div className="absolute bottom-5 left-5 right-5 sm:bottom-8 sm:left-8 sm:right-8 z-10">
        <div className="bg-panel/80 backdrop-blur-xl rounded-2xl border border-border shadow-[0_4px_24px_rgba(0,0,0,0.3)] px-5 sm:px-6 py-4 sm:py-5">
          <div className="flex items-end gap-6">
            <div className="flex-1 min-w-0">
              <TimelineSlider
                year={year}
                playing={playing}
                onYearChange={handleYearChange}
                onPlayToggle={handlePlayToggle}
                summary={summary}
              />
            </div>

            {/* Legend — hidden on mobile */}
            <div className="hidden sm:flex flex-col items-end shrink-0 pb-1">
              <div className="text-[10px] text-text-secondary mb-1.5 whitespace-nowrap">
                Flood exposure
              </div>
              <div
                className="w-28 h-2 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #0d0829, #2c115f, #711f81, #b63679, #e85a5a, #f8945e, #fdd162, #fcffa4)",
                }}
              />
              <div className="flex justify-between w-28 text-[9px] text-text-tertiary mt-0.5">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
