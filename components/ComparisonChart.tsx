"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Legend,
} from "recharts";
import type { ComparisonData } from "@/lib/types";

interface ComparisonChartProps {
  data: ComparisonData | null;
  /** Compact mode for embedding in the Methodology drawer */
  compact?: boolean;
}

interface ChartPoint {
  year: number;
  floodpulse: number;
  gfd: number | null;
  emdat: number | null;
  lowConfidence: boolean;
}

function formatMillions(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

const TOOLTIP_STYLE = {
  background: "rgba(15,14,26,0.95)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  fontSize: "11px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};

export default function ComparisonChart({
  data,
  compact = false,
}: ComparisonChartProps) {
  const points = useMemo<ChartPoint[]>(() => {
    if (!data) return [];
    const { years, floodpulse, gfd, emdat } = data.annual_pe;
    return years.map((yr, i) => ({
      year: yr,
      floodpulse: floodpulse[i],
      gfd: gfd[i],
      emdat: emdat[i],
      lowConfidence: data.low_confidence_years.includes(yr),
    }));
  }, [data]);

  if (!data || points.length === 0) return null;

  const maxVal = Math.max(
    ...points.map((p) =>
      Math.max(p.floodpulse, p.gfd ?? 0, p.emdat ?? 0)
    )
  );

  const lowConfEnd = data.low_confidence_years.length > 0
    ? Math.max(...data.low_confidence_years)
    : null;

  const chartHeight = compact ? 140 : 320;

  return (
    <div>
      {!compact && (
        <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-medium mb-2">
          Population Exposed / Year — FloodPulse vs. External Datasets
        </div>
      )}

      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={
              compact
                ? { top: 2, right: 0, bottom: 0, left: 0 }
                : { top: 8, right: 12, bottom: 0, left: 4 }
            }
          >
            <defs>
              <linearGradient id="fpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef8a62" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#ef8a62" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            {lowConfEnd && (
              <ReferenceArea
                x1={points[0]?.year}
                x2={lowConfEnd}
                fill="rgba(255,255,255,0.03)"
                stroke="none"
              />
            )}

            <XAxis
              dataKey="year"
              tick={compact ? false : { fontSize: 10, fill: "#64748b" }}
              axisLine={!compact}
              tickLine={false}
              stroke="rgba(255,255,255,0.08)"
            />
            <YAxis
              domain={[0, maxVal * 1.1]}
              tick={
                compact
                  ? false
                  : { fontSize: 10, fill: "#64748b" }
              }
              tickFormatter={compact ? undefined : formatMillions}
              axisLine={false}
              tickLine={false}
              width={compact ? 0 : 48}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "#f1f5f9", fontWeight: 600 }}
              formatter={(value: unknown, name: string) => {
                if (value == null) return ["-", name];
                const label =
                  name === "floodpulse"
                    ? "FloodPulse"
                    : name === "gfd"
                    ? "GFD (satellite)"
                    : "EM-DAT (affected)";
                return [formatMillions(value as number), label];
              }}
            />

            {!compact && (
              <Legend
                verticalAlign="top"
                height={28}
                iconSize={10}
                formatter={(value: string) =>
                  value === "floodpulse"
                    ? "FloodPulse"
                    : value === "gfd"
                    ? "GFD (Tellman 2021)"
                    : "EM-DAT"
                }
                wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
              />
            )}

            <Area
              type="monotone"
              dataKey="floodpulse"
              stroke="#ef8a62"
              strokeWidth={1.5}
              fill="url(#fpGrad)"
              dot={false}
              activeDot={{ r: 3, fill: "#ef8a62", strokeWidth: 0 }}
              name="floodpulse"
            />

            <Line
              type="monotone"
              dataKey="gfd"
              stroke="#22d3ee"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 2.5, fill: "#22d3ee", strokeWidth: 0 }}
              activeDot={{ r: 4, fill: "#22d3ee", strokeWidth: 0 }}
              connectNulls={false}
              name="gfd"
            />

            <Line
              type="monotone"
              dataKey="emdat"
              stroke="#a78bfa"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              activeDot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
              connectNulls={false}
              name="emdat"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {compact && (
        <>
          <div className="flex justify-between text-[9px] text-text-tertiary mt-0.5 px-0.5">
            <span>{points[0]?.year}</span>
            <span>{points[points.length - 1]?.year}</span>
          </div>
          <div className="flex gap-3 mt-1.5 text-[9px] text-text-tertiary/70">
            <span>
              <span className="inline-block w-2.5 h-0.5 bg-[#ef8a62] rounded mr-1 align-middle" />
              FloodPulse
            </span>
            <span>
              <span className="inline-block w-2.5 h-0.5 bg-[#22d3ee] rounded mr-1 align-middle" />
              GFD
            </span>
            <span>
              <span className="inline-block w-2.5 h-0.5 bg-[#a78bfa] rounded mr-1 align-middle" />
              EM-DAT
            </span>
          </div>
        </>
      )}
    </div>
  );
}
