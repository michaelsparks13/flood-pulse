"use client";

import { useEffect, useRef, useState } from "react";

interface InteractionHintProps {
  onDismiss: () => void;
}

export default function InteractionHint({ onDismiss }: InteractionHintProps) {
  const [fading, setFading] = useState(false);
  const dismissedRef = useRef(false);
  const isTouch =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFading(true);
    setTimeout(onDismiss, 500);
  };

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(dismiss, 8000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss on any pointer interaction
  useEffect(() => {
    const handler = () => dismiss();
    document.addEventListener("pointerdown", handler, { once: true });
    return () => document.removeEventListener("pointerdown", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
      style={{
        animation: "hint-enter 0.3s ease-out both",
        opacity: fading ? 0 : undefined,
        transition: fading ? "opacity 0.5s ease-out" : undefined,
      }}
      role="status"
      aria-live="polite"
    >
      {/* Pulsing ring behind the card */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-16 h-16 rounded-full border border-accent-bright/25"
          style={{ animation: "ripple-ping 2.5s ease-out infinite" }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-16 h-16 rounded-full border border-accent-bright/15"
          style={{
            animation: "ripple-ping 2.5s ease-out infinite",
            animationDelay: "0.8s",
          }}
        />
      </div>

      {/* Card */}
      <div className="relative bg-panel/60 backdrop-blur-xl border border-border rounded-xl px-4 py-2.5 flex items-center gap-2.5">
        {/* Hand/drag icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          className="text-text-secondary shrink-0"
        >
          <path
            d="M8 13V4.5a1.5 1.5 0 0 1 3 0V12m0-6.5v-1a1.5 1.5 0 0 1 3 0V12m0-5.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6 3.5 3.5 0 0 1 2-3.164"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="font-(--font-mono) text-[11px] text-text-secondary whitespace-nowrap">
          {isTouch ? "Pinch & drag to explore" : "Drag to explore"}
        </span>
      </div>
    </div>
  );
}
