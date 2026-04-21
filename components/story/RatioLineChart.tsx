"use client";

import { useMemo } from "react";

interface RatioLineChartProps {
  progress: number;
  years: number[];
  ratios: (number | null)[];
  lowConfidenceYears: number[];
  visible: boolean;
}

const W = 420;
const H = 180;
const PAD = { top: 10, right: 10, bottom: 24, left: 40 };

export default function RatioLineChart({
  progress,
  years,
  ratios,
  lowConfidenceYears,
  visible,
}: RatioLineChartProps) {
  const { path, maxRatio, yScale, lowConfRect } = useMemo(() => {
    if (years.length === 0) {
      return { path: "", maxRatio: 1, yScale: () => 0, lowConfRect: null };
    }
    const yMax = Math.max(...ratios.filter((r): r is number => r !== null), 1);
    const xMin = Math.min(...years);
    const xMax = Math.max(...years);
    const x = (y: number) =>
      PAD.left + ((y - xMin) / (xMax - xMin)) * (W - PAD.left - PAD.right);
    const yS = (r: number) =>
      H - PAD.bottom - (r / yMax) * (H - PAD.top - PAD.bottom);
    const pts = years
      .map((yr, i) => (ratios[i] != null ? `${x(yr)},${yS(ratios[i] as number)}` : null))
      .filter(Boolean);
    const p = pts.length ? `M ${pts.join(" L ")}` : "";
    const lcMin = Math.min(...lowConfidenceYears, xMax);
    const lcMax = Math.max(...lowConfidenceYears, xMin);
    return {
      path: p,
      maxRatio: yMax,
      yScale: yS,
      lowConfRect: lowConfidenceYears.length ? { x1: x(lcMin), x2: x(lcMax) } : null,
    };
  }, [years, ratios, lowConfidenceYears]);

  return (
    <svg
      role="img"
      aria-label="FP/GFD ratio per year, 2000-2018"
      viewBox={`0 0 ${W} ${H}`}
      style={{
        position: "fixed",
        right: "32px",
        bottom: "96px",
        width: "min(420px, 40vw)",
        height: "auto",
        zIndex: 20,
        opacity: visible ? 1 : 0,
        transition: "opacity 400ms ease",
        pointerEvents: "none",
      }}
    >
      {lowConfRect && (
        <rect
          x={lowConfRect.x1}
          y={PAD.top}
          width={lowConfRect.x2 - lowConfRect.x1}
          height={H - PAD.top - PAD.bottom}
          fill="rgba(255,255,255,0.04)"
        />
      )}
      {years.length > 0 && (
        <>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yScale(1)}
            y2={yScale(1)}
            stroke="rgba(255,255,255,0.18)"
            strokeDasharray="3 3"
          />
          <text
            x={W - PAD.right}
            y={yScale(1) - 4}
            textAnchor="end"
            fontSize="9"
            fill="#64748b"
          >
            1× (parity)
          </text>
          <text x={PAD.left} y={PAD.top + 10} fontSize="9" fill="#64748b">
            {`${Math.round(maxRatio)}×`}
          </text>
          <path
            d={path}
            stroke="#22d3ee"
            strokeWidth={2}
            fill="none"
            strokeDasharray={1000}
            strokeDashoffset={(1 - Math.max(0, Math.min(1, progress))) * 1000}
            style={{ transition: "stroke-dashoffset 120ms linear" }}
          />
        </>
      )}
    </svg>
  );
}
