"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  active: boolean;
  onChange: (x: number) => void;
}

export default function CompareDivider({ active, onChange }: Props) {
  const [x, setX] = useState(0.5);
  const [isMobile, setIsMobile] = useState(false);
  const draggingRef = useRef(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const move = useCallback(
    (clientX: number) => {
      const next = Math.min(Math.max(clientX / window.innerWidth, 0.15), 0.85);
      setX(next);
      onChange(next);
    },
    [onChange]
  );

  useEffect(() => {
    if (isMobile) return;
    const up = () => { draggingRef.current = false; };
    const mouseMove = (e: MouseEvent) => {
      if (draggingRef.current) move(e.clientX);
    };
    const touchMove = (e: TouchEvent) => {
      if (draggingRef.current && e.touches[0]) move(e.touches[0].clientX);
    };
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("touchend", up);
    window.addEventListener("touchmove", touchMove);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchmove", touchMove);
    };
  }, [move, isMobile]);

  if (!active) return null;

  if (isMobile) {
    // Tap-to-toggle: x=1 → splitPx=width → before layer full, after zero → before shown
    // x=0 → splitPx=0 → before layer zero, after full → after shown
    const showBefore = x > 0.5;
    return (
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-30 flex rounded-lg border border-border overflow-hidden text-[11px]">
        <button
          aria-label="Show 2000 through 2012"
          onClick={() => { setX(1); onChange(1); }}
          className={`px-3 py-2 cursor-pointer transition-colors ${
            showBefore ? "bg-white/10 text-text-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          2000–2012
        </button>
        <button
          aria-label="Show 2013 through 2026"
          onClick={() => { setX(0); onChange(0); }}
          className={`px-3 py-2 cursor-pointer transition-colors border-l border-border ${
            !showBefore ? "bg-white/10 text-text-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          2013–2026
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed top-0 bottom-0 z-30 w-[2px] bg-white/50 pointer-events-none"
        style={{ left: `${x * 100}%` }}
      />
      <button
        aria-label="Drag to compare before and after"
        className="fixed top-1/2 z-30 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-panel border border-border cursor-ew-resize flex items-center justify-center"
        style={{ left: `${x * 100}%` }}
        onMouseDown={() => { draggingRef.current = true; }}
        onTouchStart={() => { draggingRef.current = true; }}
      >
        <span className="text-white text-xs">⇔</span>
      </button>
      <div
        className="fixed top-8 left-8 z-30 text-[10px] tracking-widest uppercase text-text-tertiary bg-panel/80 backdrop-blur-xl rounded px-2 py-1 border border-border"
      >
        2000–2012
      </div>
      <div
        className="fixed top-8 right-8 z-30 text-[10px] tracking-widest uppercase text-text-tertiary bg-panel/80 backdrop-blur-xl rounded px-2 py-1 border border-border"
      >
        2013–2026
      </div>
    </>
  );
}
