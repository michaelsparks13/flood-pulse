"use client";

import { useEffect, useState } from "react";

interface DatasetCounterProps {
  progress: number;
  fpPe: number;
  gfdPe: number;
  visible: boolean;
}

function formatPE(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

export default function DatasetCounter({
  progress,
  fpPe,
  gfdPe,
  visible,
}: DatasetCounterProps) {
  const [display, setDisplay] = useState(gfdPe);

  useEffect(() => {
    const eased = Math.max(0, Math.min(1, progress));
    // Exponential interpolation — GFD → FP spans ~10x, linear feels sluggish.
    const logStart = Math.log10(Math.max(gfdPe, 1));
    const logEnd = Math.log10(Math.max(fpPe, 1));
    const current = Math.pow(10, logStart + eased * (logEnd - logStart));
    setDisplay(Math.round(current));
  }, [progress, fpPe, gfdPe]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        top: "28px",
        left: "32px",
        zIndex: 20,
        opacity: visible ? 1 : 0,
        transition: "opacity 400ms ease",
        pointerEvents: "none",
      }}
      className="font-mono text-text-primary"
    >
      <div className="text-[10px] uppercase tracking-widest text-text-tertiary">
        Cumulative PE, 2000&ndash;2018
      </div>
      <div className="text-4xl md:text-6xl font-bold tabular-nums mt-1">
        {formatPE(display)}
      </div>
    </div>
  );
}
