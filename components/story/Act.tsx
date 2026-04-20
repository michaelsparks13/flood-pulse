"use client";

import { forwardRef, ReactNode } from "react";

interface ActProps {
  id: string;
  ariaTitle: string;
  children: ReactNode;
  /** Total scroll height for this act, in viewport heights. Default 1. */
  heightVh?: number;
}

export const Act = forwardRef<HTMLElement, ActProps>(function Act(
  { id, ariaTitle, children, heightVh = 1 },
  ref
) {
  return (
    <section
      ref={ref}
      data-story-step={id}
      aria-label={ariaTitle}
      style={{ minHeight: `${heightVh * 100}vh` }}
      className="relative flex items-end justify-center pb-24 px-5 sm:px-10"
    >
      <div className="max-w-xl w-full bg-panel/70 backdrop-blur-xl rounded-2xl border border-border p-6">
        {children}
      </div>
    </section>
  );
});
