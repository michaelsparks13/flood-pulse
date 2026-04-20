"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { ACTS } from "@/lib/story/acts";
import type { ActDataState } from "@/lib/story/storyTypes";
import type { GlobalSummary } from "@/lib/types";

export function useActDataState() {
  const [activeActId, setActiveActId] = useState<string>(ACTS[0].id);
  const [actProgress, setActProgress] = useState<number>(0);
  const [summary, setSummary] = useState<GlobalSummary | null>(null);

  useEffect(() => {
    fetch("/data/global_summary.json")
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  }, []);

  const handleActChange = useCallback((id: string, progress: number) => {
    setActiveActId(id);
    setActProgress(progress);
  }, []);

  const dataState: ActDataState = useMemo(() => {
    const act = ACTS.find((a) => a.id === activeActId) ?? ACTS[0];
    if (act.id === "counter" && act.progressDriven) {
      // Year advances 2000 → 2026 linearly across Act 2's scroll span
      const y = Math.round(2000 + actProgress * 26);
      return { ...act.data, year: Math.min(Math.max(y, 2000), 2026) };
    }
    return act.data;
  }, [activeActId, actProgress]);

  return { activeActId, actProgress, dataState, summary, handleActChange };
}
