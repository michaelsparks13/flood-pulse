"use client";

import { useEffect, useState } from "react";
import scrollama from "scrollama";
import { Act } from "./Act";
import { ACTS, CITY_SEQUENCE } from "@/lib/story/acts";
import { useCameraChoreographer } from "./useCameraChoreographer";

interface StoryContainerProps {
  onActChange?: (id: string, progress: number) => void;
}

export default function StoryContainer({ onActChange }: StoryContainerProps) {
  const [activeAct, setActiveAct] = useState<string>(ACTS[0].id);
  const [progressById, setProgressById] = useState<Record<string, number>>({});
  const { flyTo } = useCameraChoreographer();

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
        const act = ACTS.find((a) => a.id === id);
        if (act) flyTo(act.camera);
        onActChange?.(id, 0);
      })
      .onStepProgress((res) => {
        const id = res.element.getAttribute("data-story-step")!;
        setProgressById((p) => ({ ...p, [id]: res.progress }));

        if (id === "cities") {
          // Map scroll progress (0..1) to city index 0..2
          const idx = Math.min(
            CITY_SEQUENCE.length - 1,
            Math.floor(res.progress * CITY_SEQUENCE.length)
          );
          flyTo(CITY_SEQUENCE[idx]);
        }
        onActChange?.(id, res.progress);
      });

    const handleResize = () => scroller.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      scroller.destroy();
      window.removeEventListener("resize", handleResize);
    };
  }, [flyTo, onActChange]);

  return (
    <div className="relative z-10">
      {ACTS.map((act) => (
        <Act
          key={act.id}
          id={act.id}
          ariaTitle={act.ariaTitle}
          heightVh={act.id === "cities" ? 3 : 1.2}
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
