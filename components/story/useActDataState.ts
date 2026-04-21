"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { ACTS, COUNTRY_SEQUENCE } from "@/lib/story/acts";
import type { ActDataState } from "@/lib/story/storyTypes";
import type {
  GlobalSummary,
  CountryComparisonData,
  ComparisonData,
} from "@/lib/types";
import { loadCountryComparison } from "@/lib/story/countryComparison";

export function useActDataState() {
  const [activeActId, setActiveActId] = useState<string>(ACTS[0].id);
  const [actProgress, setActProgress] = useState<number>(0);
  const [summary, setSummary] = useState<GlobalSummary | null>(null);
  const [comparison, setComparison] = useState<CountryComparisonData | null>(null);
  const [ratio, setRatio] = useState<ComparisonData | null>(null);

  useEffect(() => {
    fetch("/data/global_summary.json")
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
    fetch("/data/comparison.json")
      .then((r) => r.json())
      .then(setRatio)
      .catch(() => {});
    loadCountryComparison().then(setComparison).catch(() => {});
  }, []);

  const handleActChange = useCallback((id: string, progress: number) => {
    setActiveActId(id);
    setActProgress(progress);
  }, []);

  const dataState: ActDataState = useMemo(() => {
    const act = ACTS.find((a) => a.id === activeActId) ?? ACTS[0];
    const base = { ...act.data };
    if (!act.progressDriven) return base;
    const clamped = Math.max(0, Math.min(1, actProgress));
    if (act.id === "reveal") return { ...base, revealProgress: clamped };
    if (act.id === "ratio") return { ...base, ratioProgress: clamped };
    if (act.id === "ladder") return { ...base, ladderProgress: clamped };
    return base;
  }, [activeActId, actProgress]);

  /** For Act 6: the active country index (0..2). */
  const activeCountryIndex = useMemo(() => {
    if (activeActId !== "three-stories") return -1;
    return Math.min(
      Math.floor(actProgress * COUNTRY_SEQUENCE.length),
      COUNTRY_SEQUENCE.length - 1,
    );
  }, [activeActId, actProgress]);

  return {
    activeActId,
    actProgress,
    dataState,
    summary,
    comparison,
    ratio,
    activeCountryIndex,
    handleActChange,
  };
}
