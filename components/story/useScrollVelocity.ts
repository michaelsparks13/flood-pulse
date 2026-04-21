"use client";

import { useEffect, useRef } from "react";

/**
 * Starts an rAF-driven scroll velocity calculator and calls `onUpdate` with
 * a smoothed px/ms velocity on every frame. Avoids React state to prevent
 * per-frame re-renders of consumers.
 *
 * Short-circuits (no rAF loop) on reduced-motion preference or low-core
 * hardware — consumers should treat absence of calls as "velocity = 0".
 */
export function useScrollVelocity(
  onUpdate: (velocity: number) => void,
  enabled: boolean = true
): void {
  const lastY = useRef(0);
  const lastT = useRef(0);
  const velocityRef = useRef(0);
  const rafId = useRef<number | null>(null);
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) < 4) return;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    lastT.current = performance.now();
    lastY.current = window.scrollY;

    const tick = () => {
      const now = performance.now();
      const dt = now - lastT.current;
      const dy = window.scrollY - lastY.current;
      const v = dt > 0 ? dy / dt : 0;
      velocityRef.current = velocityRef.current * 0.85 + v * 0.15;
      lastY.current = window.scrollY;
      lastT.current = now;
      cbRef.current(velocityRef.current);
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, [enabled]);
}
