"use client";

import type { GlobalSummary } from "@/lib/types";

interface Props {
  summary: GlobalSummary | null;
  year: number;
  visible: boolean;
}

export default function StoryProgressChip({ summary, year, visible }: Props) {
  if (!summary || summary.byYear.length === 0) return null;

  const max = Math.max(...summary.byYear.map((e) => e.populationExposed));
  const points = summary.byYear.map((y, i) => {
    const x = (i / (summary.byYear.length - 1)) * 100;
    const yPos = 32 - (y.populationExposed / max) * 28;
    return `${x.toFixed(2)},${yPos.toFixed(2)}`;
  });
  const idx = summary.byYear.findIndex((y) => y.year === year);
  const dotX = idx >= 0 ? (idx / (summary.byYear.length - 1)) * 100 : 0;
  const dotY = idx >= 0 ? 32 - (summary.byYear[idx].populationExposed / max) * 28 : 0;

  return (
    <div
      aria-hidden={!visible}
      className={`fixed top-8 right-8 z-20 bg-panel/80 backdrop-blur-xl rounded-2xl border border-border p-3 pointer-events-none transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <svg width="120" height="40" viewBox="0 0 100 40">
        <polyline
          fill="none"
          stroke="rgb(252,255,164)"
          strokeOpacity="0.6"
          strokeWidth="1.5"
          points={points.join(" ")}
        />
        <circle cx={dotX} cy={dotY} r="2.5" fill="rgb(252,255,164)" />
      </svg>
      <div className="text-[9px] tracking-widest uppercase text-text-tertiary mt-1">
        2000 — {year} — 2026
      </div>
    </div>
  );
}
