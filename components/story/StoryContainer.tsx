"use client";

import { useEffect, useRef, useState } from "react";
import scrollama from "scrollama";
import { Act } from "./Act";
import { ACTS, COUNTRY_SEQUENCE } from "@/lib/story/acts";
import { useCameraChoreographer } from "./useCameraChoreographer";

interface StoryContainerProps {
  onActChange?: (id: string, progress: number) => void;
}

export default function StoryContainer({ onActChange }: StoryContainerProps) {
  const [activeAct, setActiveAct] = useState<string>(ACTS[0].id);
  const [progressById, setProgressById] = useState<Record<string, number>>({});
  const { flyTo } = useCameraChoreographer();
  const lastCountryIdxRef = useRef<number>(-1);

  useEffect(() => {
    const scroller = scrollama();
    scroller
      .setup({
        step: "[data-story-step]",
        offset: 0.6,
        progress: true,
      })
      .onStepEnter((res) => {
        const id = res.element.getAttribute("data-story-step")!;
        setActiveAct(id);
        if (id === "three-stories") {
          lastCountryIdxRef.current = -1;
        }
        const act = ACTS.find((a) => a.id === id);
        if (act) flyTo(act.camera);
        onActChange?.(id, 0);
      })
      .onStepProgress((res) => {
        const id = res.element.getAttribute("data-story-step")!;
        setProgressById((p) => ({ ...p, [id]: res.progress }));

        if (id === "three-stories") {
          // Map scroll progress (0..1) to country index 0..2
          const idx = Math.min(
            COUNTRY_SEQUENCE.length - 1,
            Math.floor(res.progress * COUNTRY_SEQUENCE.length)
          );
          if (idx !== lastCountryIdxRef.current) {
            lastCountryIdxRef.current = idx;
            flyTo(COUNTRY_SEQUENCE[idx].camera);
          }
        }
        onActChange?.(id, res.progress);
      });

    const handleResize = () => scroller.resize();
    window.addEventListener("resize", handleResize);

    // If the user returned here via "Back to the story" on /explore,
    // scroll them to the act they left from (usually "handoff") so they
    // don't have to re-scroll the entire narrative.
    let restoreTimer: number | null = null;
    try {
      const returnTo = window.sessionStorage.getItem("floodpulse:returnToAct");
      if (returnTo) {
        window.sessionStorage.removeItem("floodpulse:returnToAct");
        restoreTimer = window.setTimeout(() => {
          const target = document.querySelector(
            `[data-story-step="${returnTo}"]`,
          ) as HTMLElement | null;
          target?.scrollIntoView({ behavior: "auto", block: "center" });
        }, 50);
      }
    } catch {
      // sessionStorage may be unavailable — no-op, user starts from the top.
    }

    return () => {
      scroller.destroy();
      window.removeEventListener("resize", handleResize);
      if (restoreTimer !== null) window.clearTimeout(restoreTimer);
    };
  }, [flyTo, onActChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
      // Don't hijack if user is typing in a form field
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      const steps = Array.from(document.querySelectorAll("[data-story-step]"));
      const currentIdx = steps.findIndex(
        (s) => s.getAttribute("data-story-step") === activeAct
      );
      if (currentIdx === -1) return;
      const nextIdx = Math.max(
        0,
        Math.min(steps.length - 1, currentIdx + (e.key === "ArrowDown" ? 1 : -1))
      );
      if (nextIdx === currentIdx) return;
      (steps[nextIdx] as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeAct]);

  return (
    <div className="relative z-10">
      {ACTS.map((act) => (
        <Act
          key={act.id}
          id={act.id}
          ariaTitle={act.ariaTitle}
          heightVh={act.id === "three-stories" ? 3 : 1.2}
        >
          {Array.isArray(act.copy) ? (
            act.copy.map((line, i) => {
              const total = act.copy.length;
              const prog = progressById[act.id] ?? 0;
              const activeIdx = Math.min(total - 1, Math.floor(prog * total));
              const isActive = i === activeIdx;
              return (
                <p
                  key={i}
                  className={`text-lg leading-relaxed mb-2 transition-opacity duration-300 ${
                    isActive
                      ? "text-text-primary opacity-100"
                      : "text-text-tertiary opacity-40"
                  }`}
                >
                  {line}
                </p>
              );
            })
          ) : (
            <p className="text-text-primary text-lg leading-relaxed">{act.copy}</p>
          )}
        </Act>
      ))}
      {/* Invisible data attribute for the currently active act — useful for tests */}
      <div data-testid="active-act" data-act-id={activeAct} style={{ display: "none" }} />
    </div>
  );
}
