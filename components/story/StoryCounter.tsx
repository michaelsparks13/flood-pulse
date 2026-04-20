"use client";

import type { GlobalSummary } from "@/lib/types";

interface Props {
  summary: GlobalSummary | null;
  year: number;
  /** Visibility controlled by active act — only show from Act 2 onward. */
  visible: boolean;
}

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export default function StoryCounter({ summary, year, visible }: Props) {
  const entry = summary?.byYear.find((y) => y.year === year);
  const pop = entry?.populationExposed ?? 0;

  return (
    <div
      className={`fixed top-8 left-8 z-20 transition-opacity duration-500 pointer-events-none ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div
        className="bg-panel/80 backdrop-blur-xl rounded-2xl border border-border p-5"
        aria-live={visible ? "polite" : "off"}
      >
        <div className="text-[10px] tracking-widest uppercase text-text-tertiary mb-1">
          Population exposed — {year}
        </div>
        <div className="text-4xl font-semibold text-accent-highlight tabular-nums">
          {formatPop(pop)}
        </div>
      </div>
    </div>
  );
}
