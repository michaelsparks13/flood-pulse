"use client";

import { useMemo } from "react";
import type { CountryComparisonData } from "@/lib/types";
import { topGap } from "@/lib/story/countryComparison";

interface CountryGapBarProps {
  data: CountryComparisonData | null;
  visible: boolean;
  progress: number;
}

export default function CountryGapBar({ data, visible, progress }: CountryGapBarProps) {
  const rows = useMemo(() => (data ? topGap(data, 10) : []), [data]);
  const maxRatio =
    rows.length > 0 ? Math.max(...rows.map((r) => r.entry.fp_gfd_ratio ?? 0)) : 1;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 760;

  return (
    <div
      aria-label="Top 10 countries by FP/GFD exposure ratio"
      style={{
        position: "fixed",
        zIndex: 20,
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease",
        pointerEvents: "none",
        ...(isMobile
          ? { top: 80, left: 16, right: 16, bottom: 120, overflowY: "auto" as const }
          : {
              top: "50%",
              right: 48,
              transform: "translateY(-50%)",
              width: "min(440px, 42vw)",
            }),
      }}
      className="bg-panel-solid/80 backdrop-blur-md rounded-2xl border border-border p-5"
    >
      <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-3">
        Where the invisible floods cluster
      </div>
      <ul className="space-y-2">
        {rows.map(({ iso3, entry }, i) => {
          const ratio = entry.fp_gfd_ratio ?? 0;
          const width = (ratio / maxRatio) * 100;
          const shown = progress > i / Math.max(rows.length, 1);
          return (
            <li
              key={iso3}
              className="flex items-center gap-3 text-sm"
              style={{
                opacity: shown ? 1 : 0,
                transform: shown ? "translateX(0)" : "translateX(-12px)",
                transition: "opacity 250ms ease, transform 250ms ease",
                transitionDelay: `${i * 40}ms`,
              }}
            >
              <span className="w-28 text-text-secondary truncate">{entry.name}</span>
              <span className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                <span
                  className="block h-full"
                  style={{
                    width: `${width}%`,
                    background: "linear-gradient(90deg, #ef8a62, #fbbf24)",
                  }}
                />
              </span>
              <span className="w-16 text-right font-mono text-text-primary tabular-nums">
                {ratio.toFixed(0)}×
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
