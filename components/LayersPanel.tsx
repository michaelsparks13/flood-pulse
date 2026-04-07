"use client";

import { useEffect, useRef, useState } from "react";

interface LayersPanelProps {
  showBoundaries: boolean;
  onBoundariesChange: (v: boolean) => void;
  showLabels: boolean;
  onLabelsChange: (v: boolean) => void;
  satellite: boolean;
  onSatelliteChange: (v: boolean) => void;
  hexOpacity: number;
  onHexOpacityChange: (v: number) => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer shrink-0 ${
        checked ? "bg-white/20" : "bg-white/[0.06]"
      }`}
    >
      <span
        className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full transition-all duration-150 ${
          checked ? "translate-x-[14px] bg-text-primary" : "bg-text-tertiary"
        }`}
      />
    </button>
  );
}

export default function LayersPanel({
  showBoundaries,
  onBoundariesChange,
  showLabels,
  onLabelsChange,
  satellite,
  onSatelliteChange,
  hexOpacity,
  onHexOpacityChange,
}: LayersPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
        aria-label="Map layers"
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
          <path d="M7 1L13 5L7 9L1 5Z" />
          <path d="M1 7L7 11L13 7" />
          <path d="M1 9L7 13L13 9" />
        </svg>
        Layers
      </button>

      {/* Popover panel */}
      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-56 bg-panel-solid backdrop-blur-xl rounded-xl border border-border shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3 animate-[fadeScaleIn_0.15s_ease-out]"
        >
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-2.5">
            Map layers
          </div>

          {/* Toggle rows */}
          <div className="space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-text-secondary">Country boundaries</span>
              <Toggle checked={showBoundaries} onChange={onBoundariesChange} />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-text-secondary">Place labels</span>
              <Toggle checked={showLabels} onChange={onLabelsChange} />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-text-secondary">Satellite basemap</span>
              <Toggle checked={satellite} onChange={onSatelliteChange} />
            </label>
          </div>

          {/* Divider + opacity slider */}
          <div className="pt-3 mt-3 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-secondary">Data opacity</span>
              <span className="font-mono text-[10px] text-text-tertiary tabular-nums">
                {Math.round(hexOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={hexOpacity}
              onChange={(e) => onHexOpacityChange(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                         bg-white/10
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-3.5
                         [&::-webkit-slider-thumb]:h-3.5
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-accent-bright
                         [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(252,255,164,0.3)]
                         [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-moz-range-thumb]:w-3.5
                         [&::-moz-range-thumb]:h-3.5
                         [&::-moz-range-thumb]:rounded-full
                         [&::-moz-range-thumb]:bg-accent-bright
                         [&::-moz-range-thumb]:border-0
                         [&::-moz-range-thumb]:cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
