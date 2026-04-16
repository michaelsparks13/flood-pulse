"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import ExposureCounter from "@/components/ExposureCounter";
import FrequencyChart from "@/components/FrequencyChart";
import TimelineSlider from "@/components/TimelineSlider";
import MethodologyDrawer from "@/components/MethodologyDrawer";
import LayersPanel from "@/components/LayersPanel";
import ComparisonPopover from "@/components/ComparisonPopover";
import InteractionHint from "@/components/InteractionHint";
import type { GlobalSummary, MapMode } from "@/lib/types";

// Load Globe client-side only (MapLibre needs DOM)
const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

export default function Home() {
  const [year, setYear] = useState(2026);
  const [playing, setPlaying] = useState(false);
  const [summary, setSummary] = useState<GlobalSummary | null>(null);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [basemapReady, setBasemapReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [hexOpacity, setHexOpacity] = useState(0.9);
  const [mapMode, setMapMode] = useState<MapMode>("exposure");
  const [infoExpanded, setInfoExpanded] = useState(false);

  // Living Globe state
  const [revealStarted, setRevealStarted] = useState(false);
  const [effectiveOpacity, setEffectiveOpacity] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const prefersReducedMotion = useRef(false);
  const revealComplete = useRef(false);
  const cursorRafRef = useRef<number | null>(null);
  const pendingCursor = useRef<{ x: number; y: number } | null>(null);

  // Load global summary data
  useEffect(() => {
    fetch("/data/global_summary.json")
      .then((r) => r.json())
      .then((d) => setSummary(d))
      .catch(() => {});
  }, []);

  // Detect reduced motion preference
  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion.current) {
      setEffectiveOpacity(hexOpacity);
      revealComplete.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cinematic opacity reveal — animate 0 → hexOpacity over 2s
  useEffect(() => {
    if (!revealStarted || prefersReducedMotion.current) {
      if (revealStarted && prefersReducedMotion.current) {
        setEffectiveOpacity(hexOpacity);
        revealComplete.current = true;
        setHintVisible(true);
      }
      return;
    }

    const duration = 2800;
    const target = hexOpacity;
    const start = performance.now();
    let raf: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setEffectiveOpacity(eased * target);

      if (t < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        revealComplete.current = true;
        // Show interaction hint after a brief pause
        setTimeout(() => setHintVisible(true), 800);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [revealStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync user opacity changes (from LayersPanel) after reveal completes
  useEffect(() => {
    if (revealComplete.current) {
      setEffectiveOpacity(hexOpacity);
    }
  }, [hexOpacity]);

  // Throttled cursor tracking for cursor glow (~30fps)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    pendingCursor.current = { x: e.clientX, y: e.clientY };
    if (cursorRafRef.current === null) {
      cursorRafRef.current = requestAnimationFrame(() => {
        setCursorPos(pendingCursor.current);
        cursorRafRef.current = null;
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (cursorRafRef.current !== null) {
      cancelAnimationFrame(cursorRafRef.current);
      cursorRafRef.current = null;
    }
    setCursorPos(null);
  }, []);

  const handleBasemapReady = useCallback(() => {
    setBasemapReady(true);
  }, []);

  const handleDataReady = useCallback(() => {
    setDataReady(true);
  }, []);

  const handleRevealStart = useCallback(() => {
    setRevealStarted(true);
  }, []);

  const handleYearChange = useCallback((y: number) => {
    setYear(y);
  }, []);

  const handlePlayToggle = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-bg"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Globe fills the viewport */}
      <Globe
        year={year}
        mapMode={mapMode}
        showBoundaries={showBoundaries}
        showLabels={showLabels}
        satellite={satellite}
        hexOpacity={effectiveOpacity}
        onBasemapReady={handleBasemapReady}
        onDataReady={handleDataReady}
        onRevealStart={handleRevealStart}
      />

      {/* Atmospheric rim glow */}
      <div className="atmosphere-glow absolute inset-0 z-1 pointer-events-none" />

      {/* Cursor-reactive glow (desktop only) */}
      {cursorPos && (
        <div
          className="absolute z-2 pointer-events-none rounded-full"
          style={{
            left: cursorPos.x - 150,
            top: cursorPos.y - 150,
            width: 300,
            height: 300,
            background:
              "radial-gradient(circle, rgba(252,255,164,0.06) 0%, transparent 70%)",
          }}
        />
      )}

      {/* Interaction hint — auto-dismisses on first touch or after 8s */}
      {hintVisible && (
        <InteractionHint onDismiss={() => setHintVisible(false)} />
      )}

      {/* Loading indicator — fades in after globe renders, fades out when hex data arrives */}
      <div
        className={`absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${
          basemapReady && !dataReady ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-6 w-6 text-text-tertiary"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-text-tertiary text-xs tracking-wide">Loading map data</span>
        </div>
      </div>

      {/* Top-left: counter + title — collapsible on mobile */}
      <div data-testid="info-panel" className="absolute top-14 left-5 sm:top-8 sm:left-8 z-10 max-w-[calc(100vw-2.5rem)] sm:max-w-sm bg-panel/80 backdrop-blur-xl rounded-2xl border border-border shadow-[0_4px_24px_rgba(0,0,0,0.3)] p-4 sm:p-6">
        <h1 className="text-text-primary text-xl font-semibold mb-1 tracking-tight">
          FloodPulse
        </h1>
        <p className="text-text-tertiary text-xs mb-3 sm:mb-5">
          Global flood exposure from 2.6M news-derived events
        </p>
        <ExposureCounter summary={summary} year={year} compact={!infoExpanded} />

        {/* FrequencyChart — hidden on mobile when collapsed, always visible on desktop */}
        <div className={`${infoExpanded ? "block" : "hidden"} sm:block`}>
          <FrequencyChart summary={summary} />
        </div>

        {/* Mobile expand/collapse toggle */}
        <button
          onClick={() => setInfoExpanded((v) => !v)}
          className="sm:hidden flex items-center gap-1 mt-3 text-[11px] text-text-tertiary
                     hover:text-text-secondary transition-colors cursor-pointer"
          aria-expanded={infoExpanded}
        >
          <span>{infoExpanded ? "Show less" : "Show more"}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${infoExpanded ? "rotate-180" : ""}`}
          >
            <path d="M3 4.5L6 7.5L9 4.5" />
          </svg>
        </button>
      </div>

      {/* Top-right: compare + layers + methodology */}
      <div className="absolute top-5 right-5 z-10 flex items-center gap-2">
        <ComparisonPopover />
        <LayersPanel
          showBoundaries={showBoundaries}
          onBoundariesChange={setShowBoundaries}
          showLabels={showLabels}
          onLabelsChange={setShowLabels}
          satellite={satellite}
          onSatelliteChange={setSatellite}
          hexOpacity={hexOpacity}
          onHexOpacityChange={setHexOpacity}
        />
        <MethodologyDrawer open={methodologyOpen} onOpenChange={setMethodologyOpen} />
      </div>

      {/* Bottom: unified timeline + legend panel */}
      {!methodologyOpen && (
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-full max-w-3xl px-5 sm:bottom-8 z-10">
        <div className="bg-panel/80 backdrop-blur-xl rounded-2xl border border-border shadow-[0_4px_24px_rgba(0,0,0,0.3)] px-5 sm:px-6 py-3 sm:py-4">
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

            {/* Mode toggle + Legend — hidden on mobile */}
            <div className="hidden sm:flex flex-col items-end shrink-0 pb-1 gap-2">
              {/* Segmented toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden text-[10px]">
                <button
                  onClick={() => setMapMode("exposure")}
                  className={`px-2.5 py-1 transition-colors cursor-pointer ${
                    mapMode === "exposure"
                      ? "bg-white/10 text-text-primary"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  Exposure
                </button>
                <button
                  onClick={() => setMapMode("frequency")}
                  className={`px-2.5 py-1 transition-colors cursor-pointer border-l border-border ${
                    mapMode === "frequency"
                      ? "bg-white/10 text-text-primary"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  Frequency
                </button>
              </div>

              {/* Dynamic legend */}
              {mapMode === "exposure" ? (
                <>
                  <div
                    className="w-28 h-2 rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, #0d0829, #2c115f, #711f81, #b63679, #e85a5a, #f8945e, #fdd162, #fcffa4)",
                    }}
                  />
                  <div className="flex justify-between w-28 text-[9px] text-text-tertiary">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="w-28 h-2 rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, #2166ac, #67a9cf, #f0f0f0, #ef8a62, #b2182b)",
                    }}
                  />
                  <div className="flex justify-between w-28 text-[9px] text-text-tertiary">
                    <span>Less</span>
                    <span className="text-[8px]">Stable</span>
                    <span>More</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
