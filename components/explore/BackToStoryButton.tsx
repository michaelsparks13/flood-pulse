"use client";

import { useRouter } from "next/navigation";

const RETURN_KEY = "floodpulse:returnToAct";

export default function BackToStoryButton() {
  const router = useRouter();

  const handleClick = () => {
    // Signal to the story page that it should scroll the user back to where
    // they left off. Handoff is the natural re-entry point — they just came
    // from there when they hit "Take control →".
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(RETURN_KEY, "handoff");
      } catch {
        // sessionStorage can throw in private mode / with storage disabled —
        // just navigate without the restore hint.
      }
    }
    router.push("/");
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Back to the story"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-panel/80 backdrop-blur-xl text-[12px] text-text-secondary hover:text-text-primary hover:bg-panel transition-colors cursor-pointer pointer-events-auto"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7.5 3L4 6L7.5 9" />
      </svg>
      Back to the story
    </button>
  );
}
