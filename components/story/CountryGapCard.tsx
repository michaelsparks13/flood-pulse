"use client";

import type { CountryComparisonEntry } from "@/lib/types";

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
  const show = Boolean(visible && entry && iso3);
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
      {show && entry && iso3 ? (
        <>
          <div className="text-xs text-text-tertiary">{iso3}</div>
          <div className="text-lg font-semibold text-text-primary mt-0.5">{entry.name}</div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#22d3ee]">Traditional catalogs</span>
              <span className="font-mono text-text-primary">{formatPE(entry.gfd_pe_2000_2018)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#ef8a62]">Flood Pulse</span>
              <span className="font-mono text-text-primary">{formatPE(entry.floodpulse_pe_2000_2018)}</span>
            </div>
            {entry.fp_gfd_ratio != null && entry.fp_gfd_ratio > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-text-secondary">Gap</span>
                <span className="font-mono text-text-primary">
                  {entry.fp_gfd_ratio.toFixed(0)}× more found
                </span>
              </div>
            )}
            {entry.gfd_pe_2000_2018 === null && (
              <div className="pt-2 border-t border-border/50 text-text-secondary text-xs">
                Zero events in the satellite catalog, 2000–2018.
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
