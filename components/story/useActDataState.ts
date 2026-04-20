"use client";

import { useMemo, useState, useCallback } from "react";
import { ACTS } from "@/lib/story/acts";
import type { ActDataState } from "@/lib/story/storyTypes";

export function useActDataState() {
  const [activeActId, setActiveActId] = useState<string>(ACTS[0].id);
  const [actProgress, setActProgress] = useState<number>(0);

  const handleActChange = useCallback((id: string, progress: number) => {
    setActiveActId(id);
    setActProgress(progress);
  }, []);

  const dataState: ActDataState = useMemo(() => {
    const act = ACTS.find((a) => a.id === activeActId) ?? ACTS[0];
    return act.data;
  }, [activeActId]);

  return { activeActId, actProgress, dataState, handleActChange };
}
