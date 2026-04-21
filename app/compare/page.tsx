"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Legend,
  BarChart,
  LineChart,
} from "recharts";
import type { ComparisonData, CountryComparisonData } from "@/lib/types";
import { loadCountryComparison, allCountriesByRatio } from "@/lib/story/countryComparison";

function fmt(value: number | null): string {
  if (value == null) return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function fmtShort(value: number): string {
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

const LABEL_STYLE = { color: "#f1f5f9", fontWeight: 600 };

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-panel-solid rounded-2xl border border-border p-6">
      <h2 className="text-text-primary font-semibold text-base mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function ComparePage() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [country, setCountry] = useState<CountryComparisonData | null>(null);
  const [useLog, setUseLog] = useState(false);

  useEffect(() => {
    fetch("/data/comparison.json")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
    loadCountryComparison().then(setCountry).catch(console.error);
  }, []);

  // ---- Chart data ----
  const pePoints = useMemo(() => {
    if (!data) return [];
    const { years, floodpulse, gfd, emdat } = data.annual_pe;
    return years.map((yr, i) => ({
      year: yr,
      floodpulse: floodpulse[i],
      gfd: gfd[i],
      emdat: emdat[i],
    }));
  }, [data]);

  const eventPoints = useMemo(() => {
    if (!data) return [];
    const { years, floodpulse_records, dfo, gdacs } = data.annual_events;
    return years.map((yr, i) => ({
      year: yr,
      floodpulse: floodpulse_records[i],
      dfo: dfo[i],
      gdacs: gdacs[i],
    }));
  }, [data]);

  const cumulPoints = useMemo(() => {
    if (!data) return [];
    const { years, floodpulse, gfd, emdat } = data.cumulative_pe;
    return years.map((yr, i) => ({
      year: yr,
      floodpulse: floodpulse[i],
      gfd: gfd[i],
      emdat: emdat[i],
    }));
  }, [data]);

  const ratioPoints = useMemo(() => {
    if (!data) return [];
    return data.calibration_gfd.years.map((yr, i) => ({
      year: yr,
      ratio_gfd: data.calibration_gfd.pe_ratio[i],
      ratio_emdat:
        data.calibration_emdat.years.includes(yr)
          ? data.calibration_emdat.pe_ratio[
              data.calibration_emdat.years.indexOf(yr)
            ]
          : null,
    }));
  }, [data]);

  if (!data) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-tertiary text-sm animate-pulse">
          Loading comparison data...
        </div>
      </div>
    );
  }

  const lowConfEnd =
    data.low_confidence_years.length > 0
      ? Math.max(...data.low_confidence_years)
      : null;

  return (
    <div className="min-h-screen bg-bg text-text-secondary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-text-tertiary text-xs hover:text-text-secondary transition-colors"
            >
              &larr; Back to FloodPulse
            </Link>
            <h1 className="text-text-primary font-semibold text-lg mt-0.5">
              Dataset Comparison
            </h1>
            <p className="text-text-tertiary text-xs mt-0.5">
              FloodPulse PE/year vs. GFD, EM-DAT, DFO, and GDACS
            </p>
          </div>
          <div className="text-[10px] text-text-tertiary/50">
            Generated {data.generated}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* 1. Annual PE Chart */}
        <Section title="Annual Population Exposed">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setUseLog(!useLog)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                useLog
                  ? "bg-accent-bright/20 text-accent-bright"
                  : "bg-surface text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Log scale
            </button>
            <p className="text-[10px] text-text-tertiary/60">
              FloodPulse captures 2.6M events vs. GFD&apos;s 913 satellite-observed large floods.
              Shaded region = low-confidence years (&lt;5K Groundsource records).
            </p>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={pePoints}
                margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
              >
                <defs>
                  <linearGradient id="fpGradFull" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef8a62" stopOpacity={0.35} />
                    <stop
                      offset="100%"
                      stopColor="#ef8a62"
                      stopOpacity={0.03}
                    />
                  </linearGradient>
                </defs>
                {lowConfEnd && (
                  <ReferenceArea
                    x1={pePoints[0]?.year}
                    x2={lowConfEnd}
                    fill="rgba(255,255,255,0.03)"
                    stroke="none"
                    label={{
                      value: "Low confidence",
                      position: "insideTopLeft",
                      fill: "rgba(255,255,255,0.15)",
                      fontSize: 9,
                    }}
                  />
                )}
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                  tickLine={false}
                />
                <YAxis
                  scale={useLog ? "log" : "auto"}
                  domain={useLog ? [1_000_000, "auto"] : [0, "auto"]}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={fmtShort}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  allowDataOverflow={useLog}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={LABEL_STYLE}
                  formatter={(value: unknown, name: string) => [
                    fmt(value as number | null),
                    name === "floodpulse"
                      ? "FloodPulse"
                      : name === "gfd"
                      ? "GFD (satellite)"
                      : "EM-DAT (affected)",
                  ]}
                />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconSize={10}
                  formatter={(v: string) =>
                    v === "floodpulse"
                      ? "FloodPulse"
                      : v === "gfd"
                      ? "GFD (Tellman 2021)"
                      : "EM-DAT"
                  }
                  wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                />
                <Area
                  type="monotone"
                  dataKey="floodpulse"
                  stroke="#ef8a62"
                  strokeWidth={1.5}
                  fill="url(#fpGradFull)"
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
        </Section>

        {/* 2. Event Count Chart */}
        <Section title="Event Detection: Records vs. Curated Events">
          <p className="text-[10px] text-text-tertiary/60 mb-3">
            FloodPulse Groundsource records (bars) vs. DFO and GDACS curated
            large events (lines). Note the log-scale Y-axis — Groundsource
            captures orders of magnitude more events.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={eventPoints}
                margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
              >
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                  tickLine={false}
                />
                <YAxis
                  scale="log"
                  domain={[10, "auto"]}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={fmtShort}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  allowDataOverflow
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={LABEL_STYLE}
                  formatter={(value: unknown, name: string) => [
                    fmt(value as number | null),
                    name === "floodpulse"
                      ? "Groundsource records"
                      : name === "dfo"
                      ? "DFO events"
                      : "GDACS events",
                  ]}
                />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconSize={10}
                  formatter={(v: string) =>
                    v === "floodpulse"
                      ? "Groundsource"
                      : v === "dfo"
                      ? "DFO"
                      : "GDACS"
                  }
                  wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                />
                <Bar
                  dataKey="floodpulse"
                  fill="#ef8a62"
                  fillOpacity={0.25}
                  stroke="#ef8a62"
                  strokeOpacity={0.4}
                  name="floodpulse"
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="dfo"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "#34d399", strokeWidth: 0 }}
                  connectNulls={false}
                  name="dfo"
                />
                <Line
                  type="monotone"
                  dataKey="gdacs"
                  stroke="#fbbf24"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  connectNulls={false}
                  name="gdacs"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* 3. Cumulative PE */}
        <Section title="Cumulative Population Exposed">
          <p className="text-[10px] text-text-tertiary/60 mb-3">
            Running total of annual PE. GFD covers only 2000-2018 (913 large
            events). EM-DAT covers 2000-2022.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={cumulPoints}
                margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
              >
                <defs>
                  <linearGradient
                    id="cumulGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#ef8a62" stopOpacity={0.25} />
                    <stop
                      offset="100%"
                      stopColor="#ef8a62"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={fmtShort}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={LABEL_STYLE}
                  formatter={(value: unknown, name: string) => [
                    fmt(value as number | null),
                    name === "floodpulse"
                      ? "FloodPulse"
                      : name === "gfd"
                      ? "GFD"
                      : "EM-DAT",
                  ]}
                />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconSize={10}
                  formatter={(v: string) =>
                    v === "floodpulse"
                      ? "FloodPulse"
                      : v === "gfd"
                      ? "GFD"
                      : "EM-DAT"
                  }
                  wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                />
                <Area
                  type="monotone"
                  dataKey="floodpulse"
                  stroke="#ef8a62"
                  strokeWidth={1.5}
                  fill="url(#cumulGrad)"
                  dot={false}
                  name="floodpulse"
                />
                <Line
                  type="monotone"
                  dataKey="gfd"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 2, fill: "#22d3ee", strokeWidth: 0 }}
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
                  connectNulls={false}
                  name="emdat"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* 4. Calibration Ratio */}
        <Section title="Calibration: FloodPulse / GFD Ratio">
          <p className="text-[10px] text-text-tertiary/60 mb-3">
            Ratio of FloodPulse PE to GFD PE per year (2000-2018). Values
            &gt;1 mean FloodPulse estimates more exposure than satellite
            observation. Early years are unreliable (sparse Groundsource
            data). Mean ratio:{" "}
            <span className="text-text-primary font-mono">
              {data.calibration_gfd.mean_ratio}x
            </span>
            , Median:{" "}
            <span className="text-text-primary font-mono">
              {data.calibration_gfd.median_ratio}x
            </span>
          </p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={ratioPoints}
                margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
              >
                {lowConfEnd && (
                  <ReferenceArea
                    x1={ratioPoints[0]?.year}
                    x2={lowConfEnd}
                    fill="rgba(255,255,255,0.03)"
                    stroke="none"
                  />
                )}
                <ReferenceLine
                  y={1}
                  stroke="rgba(255,255,255,0.12)"
                  strokeDasharray="3 3"
                  label={{
                    value: "1:1",
                    position: "right",
                    fill: "#64748b",
                    fontSize: 9,
                  }}
                />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v: number) => `${v}x`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={LABEL_STYLE}
                  formatter={(value: unknown, name: string) => [
                    value != null ? `${(value as number).toFixed(1)}x` : "-",
                    name === "ratio_gfd" ? "FP / GFD" : "FP / EM-DAT",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="ratio_gfd"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#22d3ee", strokeWidth: 0 }}
                  connectNulls={false}
                  name="ratio_gfd"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* 4b. Country-level gap */}
        {country && (
          <Section title="Where the gap is biggest">
            <p className="text-[10px] text-text-tertiary/60 mb-3">
              Top 20 countries by FP/GFD cumulative-PE ratio (2000&ndash;2018). Minimum FloodPulse denominator: 1M PE.
              EM-DAT column is 2000&ndash;2022 and measures &ldquo;affected&rdquo; (broader than &ldquo;exposed&rdquo;) &mdash; treat as secondary.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-tertiary">
                    <th className="text-left py-2 pr-4 font-medium">Country</th>
                    <th className="text-right py-2 pr-4 font-medium">Ground Source PE</th>
                    <th className="text-right py-2 pr-4 font-medium">GFD PE</th>
                    <th className="text-right py-2 pr-4 font-medium">Ratio</th>
                    <th className="text-right py-2 font-medium">EM-DAT affected</th>
                  </tr>
                </thead>
                <tbody>
                  {allCountriesByRatio(country)
                    .filter(
                      (r) =>
                        r.entry.fp_gfd_ratio != null &&
                        r.entry.fp_gfd_ratio > 0 &&
                        r.entry.floodpulse_pe_2000_2018 >= 1_000_000
                    )
                    .slice(0, 20)
                    .map(({ iso3, entry }) => (
                      <tr key={iso3} className="border-b border-border/50">
                        <td className="py-2.5 pr-4 text-text-secondary">{entry.name}</td>
                        <td className="py-2.5 pr-4 text-right text-text-primary font-mono">{fmt(entry.floodpulse_pe_2000_2018)}</td>
                        <td className="py-2.5 pr-4 text-right text-text-primary font-mono">{fmt(entry.gfd_pe_2000_2018)}</td>
                        <td className="py-2.5 pr-4 text-right text-[#ef8a62] font-mono">{entry.fp_gfd_ratio?.toFixed(1)}×</td>
                        <td className="py-2.5 text-right text-text-tertiary font-mono">{fmt(entry.emdat_affected_2000_2022)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* 5. Literature Benchmarks Table */}
        <Section title="Literature Benchmarks">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-text-tertiary">
                  <th className="text-left py-2 pr-4 font-medium">Source</th>
                  <th className="text-left py-2 pr-4 font-medium">Metric</th>
                  <th className="text-right py-2 pr-4 font-medium">Value</th>
                  <th className="text-left py-2 font-medium">Period</th>
                </tr>
              </thead>
              <tbody>
                {data.benchmarks.map((b, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 text-text-secondary">
                      {b.doi ? (
                        <a
                          href={`https://doi.org/${b.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-bright underline underline-offset-2"
                        >
                          {b.label}
                        </a>
                      ) : b.url ? (
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-bright underline underline-offset-2"
                        >
                          {b.label}
                        </a>
                      ) : (
                        b.label
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-text-tertiary">
                      {b.type.replace(/_/g, " ")}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-text-primary font-mono">
                      {fmt(b.value)}
                      {b.value_low != null && (
                        <span className="text-text-tertiary ml-1">
                          ({fmt(b.value_low)}&ndash;{fmt(b.value)})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-text-tertiary">
                      {b.year_range
                        ? `${b.year_range[0]}-${b.year_range[1]}`
                        : b.year
                        ? String(b.year)
                        : "Static"}
                    </td>
                  </tr>
                ))}
                {/* Add FloodPulse row for comparison */}
                <tr className="border-b border-border/50 bg-surface/30">
                  <td className="py-2.5 pr-4 text-[#ef8a62] font-medium">
                    FloodPulse
                  </td>
                  <td className="py-2.5 pr-4 text-text-tertiary">
                    cumulative PE
                  </td>
                  <td className="py-2.5 pr-4 text-right text-text-primary font-mono">
                    {fmt(
                      data.cumulative_pe.floodpulse[
                        data.cumulative_pe.floodpulse.length - 1
                      ]
                    )}
                  </td>
                  <td className="py-2.5 text-text-tertiary">
                    2000-{data.annual_pe.years[data.annual_pe.years.length - 1]}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* 6. Methodology Notes */}
        <Section title="Methodology Notes">
          <div className="space-y-4">
            {Object.entries(data.methodology_notes).map(([key, text]) => (
              <div key={key}>
                <h3 className="text-text-primary text-xs font-medium mb-1">
                  {key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </h3>
                <p className="text-text-tertiary text-xs leading-relaxed">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* 7. Sources */}
        <Section title="Sources">
          <ul className="space-y-1.5 text-text-tertiary text-xs">
            {Object.entries(data.sources).map(([key, src]) => (
              <li key={key}>
                {src.citation}{" "}
                {src.doi && (
                  <a
                    href={`https://doi.org/${src.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright underline underline-offset-2"
                  >
                    DOI
                  </a>
                )}
                {src.url && !src.doi && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright underline underline-offset-2"
                  >
                    Link
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}
