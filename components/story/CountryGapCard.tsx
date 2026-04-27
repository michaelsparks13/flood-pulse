"use client";

import { useEffect, useState } from "react";
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

function formatRatio(r: number): string {
  return r >= 10 ? `${Math.round(r)}×` : `${r.toFixed(1)}×`;
}

export default function CountryGapCard({ iso3, entry, visible }: CountryGapCardProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Prefer the per-country peaks data (merged DFO+GFD+GDACS over 2014–2025) —
  // it matches what the side-by-side map shows, so card numbers align with
  // the geography on screen.
  const peaks = peaksByIso3(iso3);

  const name = peaks?.name ?? entry?.name ?? "";
  const tradVal = peaks ? peaks.tradTotal : entry?.gfd_pe_2000_2018 ?? null;
  const fpVal = peaks ? peaks.fpTotal : entry?.floodpulse_pe_2000_2018 ?? null;
  const ratio = peaks ? peaks.ratio : entry?.fp_gfd_ratio ?? null;
  const windowLabel = peaks
    ? `${peaks.windowStart}–${peaks.windowEnd}`
    : "2000–2018";

  const show = Boolean(visible && iso3 && (peaks || entry));

  // Mobile: minimal pill — just the country + the headline gap multiplier.
  if (isMobile) {
    return (
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          top: 56,
          right: 12,
          zIndex: 20,
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(-8px)",
          transition: "opacity 300ms ease, transform 300ms ease",
          pointerEvents: "none",
        }}
        className="bg-panel-solid/85 backdrop-blur-md rounded-full border border-border px-3 py-1.5 flex items-baseline gap-2"
      >
        {show && iso3 ? (
          <>
            <span className="text-xs text-text-secondary">{name}</span>
            {ratio != null && ratio > 0 && (
              <span className="text-sm font-semibold font-mono text-text-primary">
                {formatRatio(ratio)}
              </span>
            )}
          </>
        ) : (
          <span style={{ width: 1 }} />
        )}
      </div>
    );
  }

  // Desktop: compact card (~40% smaller than before).
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        top: 80,
        right: 24,
        zIndex: 20,
        width: "min(200px, 60vw)",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(-12px)",
        transition: "opacity 300ms ease, transform 300ms ease",
        pointerEvents: "none",
      }}
      className="bg-panel-solid/85 backdrop-blur-md rounded-xl border border-border p-3"
    >
      {show && iso3 ? (
        <>
          <div className="text-sm font-semibold text-text-primary">{name}</div>
          <div className="text-[9px] uppercase tracking-[0.14em] text-text-tertiary mt-0.5">
            {windowLabel}
          </div>
          <div className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#22d3ee]">Traditional</span>
              <span className="font-mono text-text-primary">{formatPE(tradVal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#ef8a62]">Groundsource</span>
              <span className="font-mono text-text-primary">{formatPE(fpVal)}</span>
            </div>
            {ratio != null && ratio > 0 && (
              <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
                <span className="text-text-secondary">Gap</span>
                <span className="font-mono text-text-primary font-semibold">
                  {formatRatio(ratio)} more
                </span>
              </div>
            )}
            {tradVal === null && (
              <div className="pt-1.5 border-t border-border/50 text-text-tertiary text-[10px]">
                Zero in traditional catalogs, {windowLabel}.
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
