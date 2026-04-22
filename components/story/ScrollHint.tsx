"use client";

import { useEffect, useState } from "react";

interface ScrollHintProps {
  visible: boolean;
}

export default function ScrollHint({ visible }: ScrollHintProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!visible || dismissed) return;
    const onScroll = () => setDismissed(true);
    window.addEventListener("scroll", onScroll, { passive: true, once: true });
    window.addEventListener("wheel", onScroll, { passive: true, once: true });
    window.addEventListener("touchmove", onScroll, { passive: true, once: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("touchmove", onScroll);
    };
  }, [visible, dismissed]);

  const show = visible && !dismissed;

  return (
    <div
      aria-hidden={!show}
      style={{
        position: "fixed",
        bottom: "32px",
        right: "32px",
        transform: show ? "translateY(0)" : "translateY(12px)",
        zIndex: 20,
        opacity: show ? 0.75 : 0,
        transition: "opacity 400ms ease, transform 400ms ease",
        pointerEvents: "none",
      }}
      className="flex flex-col items-center gap-1 text-text-tertiary"
    >
      <span className="text-[11px] uppercase tracking-[0.18em]">Scroll</span>
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animation: "scroll-hint-bob 1.8s ease-in-out infinite" }}
      >
        <path d="M3 8l5 5 5-5" />
        <path d="M3 2l5 5 5-5" opacity="0.4" />
      </svg>
      <style jsx>{`
        @keyframes scroll-hint-bob {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50%      { transform: translateY(4px); opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
