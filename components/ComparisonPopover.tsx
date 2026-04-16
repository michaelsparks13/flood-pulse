"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ComparisonChart from "./ComparisonChart";
import type { ComparisonData } from "@/lib/types";

export default function ComparisonPopover() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ComparisonData | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Lazy fetch on first open
  useEffect(() => {
    if (open && !data) {
      fetch("/data/comparison.json")
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    }
  }, [open, data]);

  // Click/tap outside to close (pointerdown works for both mouse and touch)
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  return (
    <div ref={panelRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
          open
            ? "bg-white/10 border-border-hover text-text-primary"
            : "bg-surface border-border text-text-tertiary hover:text-text-secondary hover:bg-surface-hover"
        }`}
        aria-label="Dataset comparison"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="1.5" y="7" width="2.5" height="5.5" rx="0.5" />
          <rect x="5.75" y="4" width="2.5" height="8.5" rx="0.5" />
          <rect x="10" y="1.5" width="2.5" height="11" rx="0.5" />
        </svg>
        <span className="hidden sm:inline">Compare</span>
      </button>

      {/* Popover panel */}
      {open && (
        <div
          data-testid="comparison-popover"
          className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-72 max-w-60 sm:max-w-none bg-panel-solid backdrop-blur-xl rounded-xl border border-border shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-4 animate-[fadeScaleIn_0.15s_ease-out]"
        >
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-3">
            Dataset Comparison
          </div>

          {data ? (
            <ComparisonChart data={data} compact />
          ) : (
            <div className="h-[140px] rounded-lg bg-surface animate-pulse" />
          )}

          <p className="text-[9px] text-text-tertiary/60 mt-2 leading-relaxed">
            Annual population exposed: FloodPulse (news-derived) vs. GFD
            (satellite) and EM-DAT (curated reports)
          </p>

          <div className="pt-2.5 mt-2.5 border-t border-border">
            <Link
              href="/compare"
              className="text-accent-bright text-xs underline underline-offset-2
                         hover:text-accent-bright/80 transition-colors"
            >
              View full comparison &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
