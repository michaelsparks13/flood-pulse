"use client";

import { useEffect, useRef } from "react";

interface DatasetRevealLayerProps {
  /** 0..1 — how far the radial wipe has progressed. Anchored on the equator. */
  progress: number;
  reducedMotion?: boolean;
}

/**
 * Full-viewport radial-wipe overlay that conceptually unveils the FP-only hex
 * layer during Act 2. Pure DOM overlay — the deck.gl dataset filtering is
 * handled in Globe.tsx via the datasetFilter prop.
 */
export default function DatasetRevealLayer({
  progress,
  reducedMotion = false,
}: DatasetRevealLayerProps) {
  const circleRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    if (!circleRef.current) return;
    if (reducedMotion) {
      circleRef.current.setAttribute("r", progress > 0.5 ? "9999" : "0");
      return;
    }
    const eased = progress < 0.15 ? 0 : progress > 0.85 ? 1 : (progress - 0.15) / 0.7;
    const diag = Math.hypot(window.innerWidth, window.innerHeight);
    circleRef.current.setAttribute("r", String(Math.round(eased * diag)));
  }, [progress, reducedMotion]);

  return (
    <svg
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 5,
        opacity: 0,
      }}
    >
      <defs>
        <mask id="reveal-mask" maskUnits="userSpaceOnUse">
          <rect width="100%" height="100%" fill="black" />
          <circle ref={circleRef} cx="50%" cy="55%" r="0" fill="white" />
        </mask>
      </defs>
    </svg>
  );
}
