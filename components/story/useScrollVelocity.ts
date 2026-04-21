"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a smoothed scroll velocity in px/ms (positive = scrolling down).
 * Updates via requestAnimationFrame; EMA-smoothed with alpha 0.15. Decays
 * to zero naturally when scrolling stops (empty-velocity samples blend toward 0).
 *
 * Disables on devices with fewer than 4 logical cores (rough proxy for weak
 * mobile hardware) — returns a constant 0 in that case.
 */
export function useScrollVelocity(): number {
  const [velocity, setVelocity] = useState(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) < 4) {
      return;
    }
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
      setVelocity((prev) => prev * 0.85 + v * 0.15);
      lastY.current = window.scrollY;
      lastT.current = now;
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return velocity;
}
