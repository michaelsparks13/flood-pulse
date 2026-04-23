"use client";

import { useEffect, useState } from "react";

interface DatasetCounterProps {
  progress: number;
  /** Value shown at progress = 0. */
  fromValue: number;
  /** Value shown at progress = 1. */
  toValue: number;
  /** Short label rendered above the number. */
  label?: string;
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
  fromValue,
  toValue,
  label = "Cumulative PE, 2000–2018",
  visible,
}: DatasetCounterProps) {
  const [display, setDisplay] = useState(fromValue);

  useEffect(() => {
    const eased = Math.max(0, Math.min(1, progress));
    // Exponential interpolation — the span is ~10x, so linear feels sluggish.
    const logStart = Math.log10(Math.max(fromValue, 1));
    const logEnd = Math.log10(Math.max(toValue, 1));
    const current = Math.pow(10, logStart + eased * (logEnd - logStart));
    setDisplay(Math.round(current));
  }, [progress, fromValue, toValue]);

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
        {label}
      </div>
      <div className="text-4xl md:text-6xl font-bold tabular-nums mt-1">
        {formatPE(display)}
      </div>
    </div>
  );
}
