"use client";

import { useEffect, useRef } from "react";
import type { GlobalSummary } from "@/lib/types";

interface TimelineSliderProps {
  year: number;
  playing: boolean;
  onYearChange: (year: number) => void;
  onPlayToggle: () => void;
  summary: GlobalSummary | null;
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2025;
const PLAY_INTERVAL_MS = 600;
const LOOP_PAUSE_MS = 1400; // brief pause at the end before looping back

export default function TimelineSlider({
  year,
  playing,
  onYearChange,
  onPlayToggle,
  summary,
}: TimelineSliderProps) {
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-advance when playing; loop back to MIN_YEAR on reaching MAX_YEAR
  // (with a brief pause at the final frame for visual breathing room).
  useEffect(() => {
    if (!playing) return;
    const delay = year >= MAX_YEAR ? LOOP_PAUSE_MS : PLAY_INTERVAL_MS;
    const nextYear = year >= MAX_YEAR ? MIN_YEAR : year + 1;
    intervalRef.current = setTimeout(() => {
      onYearChange(nextYear);
    }, delay);
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [playing, year, onYearChange]);

  // Sparkline of raw record counts
  const maxRaw = summary
    ? Math.max(...summary.byYear.map((e) => e.rawRecordCount))
    : 1;

  const sparklinePoints = summary
    ? summary.byYear.map((e, i) => {
        const x = (i / (summary.byYear.length - 1)) * 100;
        const y = 100 - (e.rawRecordCount / maxRaw) * 100;
        return `${x},${y}`;
      })
    : [];

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Sparkline showing raw record growth */}
      {summary && (
        <div className="mb-1 px-1">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-6"
            preserveAspectRatio="none"
          >
            <polygon
              points={`0,100 ${sparklinePoints.join(" ")} 100,100`}
              fill="rgba(148, 163, 184, 0.08)"
            />
            <polyline
              points={sparklinePoints.join(" ")}
              fill="none"
              stroke="rgba(148, 163, 184, 0.6)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      )}

      {/* Current year — prominent display */}
      <div className="text-center mb-1">
        <span className="font-(--font-mono) text-xl sm:text-2xl font-bold text-accent-bright tracking-tight">
          {year}
        </span>
      </div>

      {/* Slider row */}
      <div className="flex items-center gap-3">
        {/* Play/pause button */}
        <button
          onClick={onPlayToggle}
          className="shrink-0 w-9 h-9 rounded-full border border-border
                     bg-surface hover:bg-surface-hover transition-colors
                     flex items-center justify-center text-text-secondary
                     hover:text-text-primary cursor-pointer"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="3.5" height="12" rx="1" />
              <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M3 1.5v11l9-5.5z" />
            </svg>
          )}
        </button>

        {/* Start year */}
        <span className="shrink-0 font-(--font-mono) text-xs text-text-tertiary">
          {MIN_YEAR}
        </span>

        {/* Slider */}
        <input
          type="range"
          min={MIN_YEAR}
          max={MAX_YEAR}
          value={year}
          onChange={(e) => onYearChange(parseInt(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer
                     bg-white/10 accent-accent-bright
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-7
                     [&::-webkit-slider-thumb]:h-7
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-accent-bright
                     [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(252,255,164,0.4)]
                     [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:w-7
                     [&::-moz-range-thumb]:h-7
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-accent-bright
                     [&::-moz-range-thumb]:border-0
                     [&::-moz-range-thumb]:cursor-pointer"
        />

        {/* End year */}
        <span className="shrink-0 font-(--font-mono) text-xs text-text-tertiary">
          {MAX_YEAR}
        </span>
      </div>
    </div>
  );
}
