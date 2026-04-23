"use client";

import { useMemo } from "react";
import { peaksByIso3 } from "@/lib/story/countryYearPeaks";

interface CountryYearCompareProps {
  iso3: string | null;
  visible: boolean;
}

function formatPE(n: number | null): string {
  if (n == null) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

/**
 * Act 6 — per-country old-vs-new comparison card. For each of three peak
 * FloodPulse years in 2000–2018, render a side-by-side "Traditional catalogs"
 * vs "Flood Pulse" row for the same country-region. The trad column is
 * anchored by the country's GFD 2000–2018 total; the FP column shows the
 * year's FP population exposed. Picking the three FP peaks makes the gap
 * numeric and year-specific, which is what the narrative is trying to make
 * feel real.
 */
export default function CountryYearCompare({
  iso3,
  visible,
}: CountryYearCompareProps) {
  const peaks = useMemo(() => peaksByIso3(iso3), [iso3]);

  if (!peaks) {
    return null;
  }

  // Per-year relative bar width. Normalize against the largest FP peak across
  // the three rows so the bars share a scale.
  const maxFp = Math.max(...peaks.peakYears.map((p) => p.fp));
  const tradTotal = peaks.tradTotal2000_2018 ?? 0;

  const show = visible;
  const tradUnavailable = peaks.tradTotal2000_2018 == null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "18vh",
        transform: show
          ? "translate(-50%, 0)"
          : "translate(-50%, 16px)",
        zIndex: 22,
        width: "min(620px, calc(100vw - 24px))",
        opacity: show ? 1 : 0,
        transition: "opacity 350ms ease, transform 350ms ease",
        pointerEvents: show ? "auto" : "none",
      }}
      className="bg-panel-solid/90 backdrop-blur-xl rounded-2xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.45)] overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-border/60 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
            Same country, same years — two data worlds
          </div>
          <div className="text-text-primary text-base sm:text-lg font-semibold mt-0.5">
            {peaks.name}
          </div>
        </div>
        {peaks.ratio != null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
              Gap
            </div>
            <div className="text-text-primary font-mono text-sm sm:text-base">
              {peaks.ratio >= 100
                ? `${Math.round(peaks.ratio)}×`
                : `${peaks.ratio.toFixed(1)}×`}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-2 px-5 py-4 text-[12px]">
        <div />
        <div className="text-[10px] uppercase tracking-[0.14em] text-[#22d3ee]">
          Traditional catalogs
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-[#ef8a62]">
          Flood Pulse
        </div>

        {peaks.peakYears.map((p) => {
          const fpBar = Math.max(0.03, p.fp / maxFp);
          const tradBar =
            tradTotal > 0 ? Math.max(0.02, Math.min(1, tradTotal / maxFp)) : 0;
          const yearFraction = tradTotal > 0 ? tradTotal / 19 : 0;
          const tradYearBar =
            yearFraction > 0
              ? Math.max(0.02, Math.min(1, yearFraction / maxFp))
              : 0;
          return (
            <div key={p.year} className="contents">
              <div className="text-text-secondary font-mono tabular-nums self-center">
                {p.year}
              </div>

              <div className="self-center">
                {tradUnavailable ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[#22d3ee]/60 text-[11px]">—</span>
                    <span className="text-text-tertiary text-[11px]">
                      no coverage
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="relative w-full h-[8px] bg-[#22d3ee]/10 rounded-sm overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-[#22d3ee]/80 rounded-sm"
                        style={{ width: `${tradYearBar * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-text-secondary whitespace-nowrap">
                      ~{formatPE(yearFraction)}
                    </span>
                  </div>
                )}
              </div>

              <div className="self-center">
                <div className="flex items-center gap-2">
                  <div className="relative w-full h-[8px] bg-[#ef8a62]/10 rounded-sm overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-[#ef8a62] rounded-sm"
                      style={{ width: `${fpBar * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-text-primary whitespace-nowrap">
                    {formatPE(p.fp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 pb-4 pt-2 border-t border-border/60 flex items-center justify-between gap-4 text-[11px]">
        <div className="text-text-tertiary">
          2000–2018 totals
          {tradUnavailable ? null : ` · annualized trad = total ÷ 19`}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-[#22d3ee]" />
            <span className="text-text-secondary font-mono">
              {tradUnavailable ? "—" : formatPE(tradTotal)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-[#ef8a62]" />
            <span className="text-text-primary font-mono">
              {formatPE(peaks.fpTotal2000_2018)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
