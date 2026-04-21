"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  active: boolean;
  onChange: (x: number) => void;
}

export default function CompareDivider({ active, onChange }: Props) {
  const [x, setX] = useState(0.5);
  const draggingRef = useRef(false);

  const move = useCallback(
    (clientX: number) => {
      const next = Math.min(Math.max(clientX / window.innerWidth, 0.15), 0.85);
      setX(next);
      onChange(next);
    },
    [onChange]
  );

  useEffect(() => {
    const up = () => {
      draggingRef.current = false;
    };
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
  }, [move]);

  if (!active) return null;

  return (
    <>
      <div
        className="fixed top-0 bottom-0 z-30 w-0.5 bg-white/50 pointer-events-none"
        style={{ left: `${x * 100}%` }}
      />
      <button
        aria-label="Drag to compare before and after"
        className="fixed top-1/2 z-30 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-panel border border-border cursor-ew-resize flex items-center justify-center shadow-lg hover:border-border-hover transition-colors"
        style={{ left: `${x * 100}%` }}
        onMouseDown={() => {
          draggingRef.current = true;
        }}
        onTouchStart={() => {
          draggingRef.current = true;
        }}
      >
        <span className="text-white text-xs select-none">⇔</span>
      </button>
      <div
        className="fixed top-8 left-8 z-30 text-[10px] tracking-widest uppercase text-text-tertiary bg-panel/80 backdrop-blur-xl rounded px-2 py-1 border border-border pointer-events-none"
      >
        2000–2012
      </div>
      <div
        className="fixed top-8 right-8 z-30 text-[10px] tracking-widest uppercase text-text-tertiary bg-panel/80 backdrop-blur-xl rounded px-2 py-1 border border-border pointer-events-none"
      >
        2013–2026
      </div>
    </>
  );
}
