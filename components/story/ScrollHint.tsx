"use client";

import { useEffect, useState } from "react";

interface ScrollHintProps {
  visible: boolean;
}

export default function ScrollHint({ visible }: ScrollHintProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!visible || dismissed) return;
    const dismiss = () => setDismissed(true);
    // Only user-initiated input. Listening to plain `scroll` also dismisses
    // on router scroll-restoration / programmatic scrollTo — fine on desktop
    // where the hint is in the corner, but on mobile it lives in the center
    // and must not vanish before the user has seen it.
    window.addEventListener("wheel", dismiss, { passive: true, once: true });
    window.addEventListener("touchmove", dismiss, { passive: true, once: true });
    window.addEventListener("keydown", dismiss, { once: true });
    return () => {
      window.removeEventListener("wheel", dismiss);
      window.removeEventListener("touchmove", dismiss);
      window.removeEventListener("keydown", dismiss);
    };
  }, [visible, dismissed]);

  const show = visible && !dismissed;

  // Mobile: horizontally + vertically centered on the viewport so the
  // scroll affordance sits over the globe, above the fold, where thumbs
  // live. Desktop: bottom-right corner, out of the reading path.
  const positionStyle: React.CSSProperties = isMobile
    ? {
        left: "50%",
        top: "50%",
        transform: show
          ? "translate(-50%, -50%)"
          : "translate(-50%, calc(-50% + 12px))",
      }
    : {
        right: "32px",
        bottom: "32px",
        transform: show ? "translateY(0)" : "translateY(12px)",
      };

  return (
    <div
      aria-hidden={!show}
      style={{
        position: "fixed",
        ...positionStyle,
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
