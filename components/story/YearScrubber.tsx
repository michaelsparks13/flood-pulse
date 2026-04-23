"use client";

import { useEffect, useState } from "react";
import {
  loadHexYearIndex,
  prefetchHexYears,
  type HexYearlyIndex,
} from "@/lib/data/hexYearly";

interface YearScrubberProps {
  year: number;
  onYearChange: (year: number) => void;
}

function formatPE(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * Pinned-to-bottom timeline control for the dual-pane view. Renders a year
 * slider plus a small readout of exposed-population totals for each catalog
 * in the selected year (pulled from each catalog's index.json).
 */
export default function YearScrubber({ year, onYearChange }: YearScrubberProps) {
  const [oldIndex, setOldIndex] = useState<HexYearlyIndex | null>(null);
  const [newIndex, setNewIndex] = useState<HexYearlyIndex | null>(null);

  useEffect(() => {
    loadHexYearIndex("old").then(setOldIndex).catch(() => {});
    loadHexYearIndex("new").then(setNewIndex).catch(() => {});
  }, []);

  // Prefetch adjacent years so the scrubber feels immediate.
  useEffect(() => {
    prefetchHexYears("old", [year - 1, year + 1]);
    prefetchHexYears("new", [year - 1, year + 1]);
  }, [year]);

  // Year range: union of both indexes, or safe default.
  const allYears = (() => {
    const set = new Set<number>();
    oldIndex?.years.forEach((y) => set.add(y.year));
    newIndex?.years.forEach((y) => set.add(y.year));
    if (set.size === 0) return [2020];
    return [...set].sort((a, b) => a - b);
  })();
  const minYear = allYears[0];
  const maxYear = allYears[allYears.length - 1];

  const oldSummary = oldIndex?.years.find((y) => y.year === year);
  const newSummary = newIndex?.years.find((y) => y.year === year);

  return (
    <div
      className="fixed bottom-3 left-1/2 z-20 -translate-x-1/2 w-[min(720px,calc(100vw-24px))] bg-panel-solid/90 backdrop-blur-xl rounded-2xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
      style={{ pointerEvents: "auto" }}
    >
      <div className="px-4 sm:px-5 py-3 grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <div className="flex flex-col items-start">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary leading-none">
            Year
          </div>
          <div className="text-text-primary text-2xl sm:text-3xl font-bold tabular-nums mt-1 leading-none">
            {year}
          </div>
        </div>
        <input
          type="range"
          min={minYear}
          max={maxYear}
          step={1}
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="w-full h-2 bg-border/40 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-text-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0"
          aria-label="Year"
        />
        <div className="flex flex-col items-end gap-1 text-[11px] font-mono tabular-nums text-text-secondary min-w-[84px]">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#e85a5a]" />
            <span>old {oldSummary ? formatPE(oldSummary.exposed) : "—"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#fdd162]" />
            <span>new {newSummary ? formatPE(newSummary.exposed) : "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
