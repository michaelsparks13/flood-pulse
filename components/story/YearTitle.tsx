"use client";

interface YearTitleProps {
  year: number;
}

/**
 * Small top-center label showing the year currently displayed on the
 * side-by-side maps. Replaces the slider as the temporal anchor — the year
 * advances automatically as the user scrolls through chapters.
 */
export default function YearTitle({ year }: YearTitleProps) {
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 21,
        pointerEvents: "none",
      }}
      className="bg-panel-solid/85 backdrop-blur-md rounded-full border border-border px-3 py-1 sm:px-4 sm:py-1.5 flex items-baseline gap-2"
    >
      <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        Year
      </span>
      <span className="text-sm sm:text-base font-semibold text-text-primary tabular-nums leading-none">
        {year}
      </span>
    </div>
  );
}
