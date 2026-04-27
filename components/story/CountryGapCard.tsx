"use client";

import type { CountryComparisonEntry } from "@/lib/types";
import { peaksByIso3 } from "@/lib/story/countryYearPeaks";

interface CountryGapCardProps {
  iso3: string | null;
  entry: CountryComparisonEntry | null;
  visible: boolean;
}

function formatPE(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

export default function CountryGapCard({ iso3, entry, visible }: CountryGapCardProps) {
  // Prefer the per-country peaks data (merged DFO+GFD+GDACS over 2014–2025).
  // It's what the side-by-side map actually shows, so the card numbers align
  // with what the user is seeing geographically.
  const peaks = peaksByIso3(iso3);

  const name = peaks?.name ?? entry?.name ?? "";
  const tradVal = peaks ? peaks.tradTotal : entry?.gfd_pe_2000_2018 ?? null;
  const fpVal = peaks ? peaks.fpTotal : entry?.floodpulse_pe_2000_2018 ?? null;
  const ratio = peaks ? peaks.ratio : entry?.fp_gfd_ratio ?? null;
  const windowLabel = peaks
    ? `${peaks.windowStart}–${peaks.windowEnd}`
    : "2000–2018";

  const show = Boolean(visible && iso3 && (peaks || entry));

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        top: "96px",
        right: "32px",
        zIndex: 20,
        width: "min(320px, 80vw)",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(-12px)",
        transition: "opacity 300ms ease, transform 300ms ease",
        pointerEvents: "none",
      }}
      className="bg-panel-solid/85 backdrop-blur-md rounded-2xl border border-border p-5"
    >
      {show && iso3 ? (
        <>
          <div className="text-xs text-text-tertiary">{iso3}</div>
          <div className="text-lg font-semibold text-text-primary mt-0.5">{name}</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary mt-1">
            {windowLabel} totals
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#22d3ee]">Traditional catalogs</span>
              <span className="font-mono text-text-primary">{formatPE(tradVal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#ef8a62]">Flood Pulse</span>
              <span className="font-mono text-text-primary">{formatPE(fpVal)}</span>
            </div>
            {ratio != null && ratio > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-text-secondary">Gap</span>
                <span className="font-mono text-text-primary">
                  {ratio >= 10 ? `${Math.round(ratio)}×` : `${ratio.toFixed(1)}×`} more found
                </span>
              </div>
            )}
            {tradVal === null && (
              <div className="pt-2 border-t border-border/50 text-text-secondary text-xs">
                Zero events in the traditional catalogs, {windowLabel}.
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ height: 1 }} />
      )}
    </div>
  );
}
