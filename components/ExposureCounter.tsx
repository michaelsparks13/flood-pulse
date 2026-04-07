"use client";

import { useEffect, useRef, useState } from "react";
import type { GlobalSummary } from "@/lib/types";

interface ExposureCounterProps {
  summary: GlobalSummary | null;
  year: number;
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toFixed(0);
}

function formatFullNumber(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function ExposureCounter({ summary, year }: ExposureCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [countriesCount, setCountriesCount] = useState(0);
  const [hexesCount, setHexesCount] = useState(0);
  const animRef = useRef<number | null>(null);

  // Find the target value for the current year
  const targetEntry = summary?.byYear.find((e) => e.year === year);
  const targetValue = targetEntry?.populationExposed ?? 0;
  const targetCountries = targetEntry?.countriesAffected ?? 0;
  const targetHexes = targetEntry?.hexesFlooded ?? 0;

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const startValue = displayValue;
    const startCountries = countriesCount;
    const startHexes = hexesCount;
    const duration = 800;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(Math.round(startValue + (targetValue - startValue) * eased));
      setCountriesCount(
        Math.round(startCountries + (targetCountries - startCountries) * eased)
      );
      setHexesCount(
        Math.round(startHexes + (targetHexes - startHexes) * eased)
      );

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [targetValue, targetCountries, targetHexes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!summary) {
    return (
      <div className="pointer-events-none select-none">
        <div className="h-8 w-48 rounded bg-surface animate-pulse" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none select-none">
      <div className="text-text-tertiary text-xs font-medium uppercase tracking-widest mb-1">
        Population exposed
      </div>
      <div className="counter-glow font-(--font-mono) text-4xl sm:text-5xl font-bold text-accent-bright leading-none mb-2">
        {formatLargeNumber(displayValue)}
      </div>
      <div className="text-text-secondary text-sm mb-4">
        people in flood-affected areas in {year}
      </div>
      <div className="flex gap-6 text-xs text-text-tertiary">
        <div>
          <span className="font-(--font-mono) text-text-secondary text-sm">
            {countriesCount}
          </span>{" "}
          countries
        </div>
        <div>
          <span className="font-(--font-mono) text-text-secondary text-sm">
            {formatLargeNumber(hexesCount * 253)}
          </span>{" "}
          km² affected
        </div>
      </div>
      <div className="mt-2 text-[10px] text-text-tertiary/60 leading-relaxed max-w-70">
        {formatFullNumber(displayValue)} people lived in areas that experienced
        flooding in {year}
      </div>
    </div>
  );
}
