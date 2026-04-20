"use client";

import { useEffect, useState } from "react";
import scrollama from "scrollama";
import { Act } from "./Act";
import { ACTS } from "@/lib/story/acts";
import { useCameraChoreographer } from "./useCameraChoreographer";

interface StoryContainerProps {
  onActChange?: (id: string, progress: number) => void;
}

export default function StoryContainer({ onActChange }: StoryContainerProps) {
  const [activeAct, setActiveAct] = useState<string>(ACTS[0].id);
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
        <Act key={act.id} id={act.id} ariaTitle={act.ariaTitle} heightVh={1.2}>
          {Array.isArray(act.copy) ? (
            act.copy.map((line, i) => (
              <p key={i} className="text-text-primary text-lg leading-relaxed mb-2">
                {line}
              </p>
            ))
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
