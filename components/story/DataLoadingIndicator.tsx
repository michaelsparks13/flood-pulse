"use client";

import { useEffect, useState } from "react";
import { useGlobe } from "@/context/GlobeContext";

/**
 * Shows a subtle progress pill while the ~35 MB hex dataset is streaming in.
 * Fades out once `dataReady` flips true in GlobeContext. The indicator lives
 * in the top-right corner so it doesn't fight with the intro panel on mobile.
 */
export default function DataLoadingIndicator() {
  const { dataReady } = useGlobe();
  const [hidden, setHidden] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (dataReady) {
      const t = window.setTimeout(() => setHidden(true), 500);
      return () => window.clearTimeout(t);
    }
    const start = performance.now();
    const id = window.setInterval(() => {
      setElapsed((performance.now() - start) / 1000);
    }, 250);
    return () => window.clearInterval(id);
  }, [dataReady]);

  if (hidden) return null;

  const progress = Math.min(0.95, 1 - Math.exp(-elapsed / 12));
  const show = !dataReady;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 30,
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 400ms ease, transform 400ms ease",
        pointerEvents: "none",
      }}
      className="bg-panel/85 backdrop-blur-md rounded-full border border-border px-3 py-1.5 flex items-center gap-2"
    >
      <span
        className="w-1.5 h-1.5 rounded-full bg-[#ef8a62]"
        style={{ animation: "dli-pulse 1.2s ease-in-out infinite" }}
      />
      <span className="text-[11px] text-text-secondary whitespace-nowrap">
        Loading {Math.round(progress * 100)}%
      </span>
      <style jsx>{`
        @keyframes dli-pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.35;
            transform: scale(0.7);
          }
        }
      `}</style>
    </div>
  );
}
