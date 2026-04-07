"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { GlobalSummary } from "@/lib/types";

interface FrequencyChartProps {
  summary: GlobalSummary | null;
}

interface ChartPoint {
  year: number;
  hexes: number;
  trend: number;
}

/** Simple linear regression: returns [slope, intercept] */
function linreg(xs: number[], ys: number[]): [number, number] {
  const n = xs.length;
  if (n < 2) return [0, 0];
  const xm = xs.reduce((a, b) => a + b, 0) / n;
  const ym = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xm) * (ys[i] - ym);
    den += (xs[i] - xm) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return [slope, ym - slope * xm];
}

export default function FrequencyChart({ summary }: FrequencyChartProps) {
  const data = useMemo<ChartPoint[]>(() => {
    if (!summary) return [];

    const years = summary.byYear.map((e) => e.year);
    const hexes = summary.byYear.map((e) => e.hexesFlooded);
    const [slope, intercept] = linreg(years, hexes);

    return summary.byYear.map((e) => ({
      year: e.year,
      hexes: e.hexesFlooded,
      trend: Math.round(slope * e.year + intercept),
    }));
  }, [summary]);

  if (!summary || data.length === 0) return null;

  const maxHexes = Math.max(...data.map((d) => d.hexes));

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-medium">
          Unique hexes flooded / year
        </div>
      </div>

      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="hexGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef8a62" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#ef8a62" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="year"
              tick={false}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, maxHexes * 1.1]}
              tick={false}
              axisLine={false}
              tickLine={false}
              width={0}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,14,26,0.95)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                fontSize: "11px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
              labelStyle={{ color: "#f1f5f9", fontWeight: 600 }}
              formatter={(value: number, name: string) => {
                if (name === "hexes")
                  return [value.toLocaleString(), "Hexes flooded"];
                return [value.toLocaleString(), "Trend"];
              }}
            />
            <Area
              type="monotone"
              dataKey="hexes"
              stroke="#ef8a62"
              strokeWidth={1.5}
              fill="url(#hexGrad)"
              dot={false}
              activeDot={{ r: 3, fill: "#ef8a62", strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="trend"
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="4 3"
              fill="none"
              dot={false}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between text-[9px] text-text-tertiary mt-0.5 px-0.5">
        <span>{data[0]?.year}</span>
        <span>{data[data.length - 1]?.year}</span>
      </div>
      <p className="text-[9px] text-text-tertiary/50 mt-1.5 leading-relaxed">
        Dashed line = linear trend. Detection bias: 64% of Groundsource records
        are from 2020&ndash;2025 due to news coverage growth.
      </p>
    </div>
  );
}
