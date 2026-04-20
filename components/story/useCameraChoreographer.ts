"use client";

import { useRef } from "react";
import { useGlobe } from "@/context/GlobeContext";
import type { CameraKeyframe } from "@/lib/story/storyTypes";

/**
 * Flies the shared globe camera to the given keyframe. Called by StoryContainer
 * on scrollama step.enter events.
 */
export function useCameraChoreographer() {
  const { mapRef } = useGlobe();
  const lastKeyframeRef = useRef<CameraKeyframe | null>(null);

  const flyTo = (kf: CameraKeyframe) => {
    const map = mapRef.current;
    if (!map) return;
    lastKeyframeRef.current = kf;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      map.jumpTo({ center: kf.center, zoom: kf.zoom, pitch: kf.pitch, bearing: kf.bearing });
      return;
    }
    map.flyTo({
      center: kf.center,
      zoom: kf.zoom,
      pitch: kf.pitch,
      bearing: kf.bearing,
      duration: kf.duration === "auto" ? undefined : kf.duration,
      essential: true,
      easing: kf.easing,
    });
  };

  return { flyTo, lastKeyframeRef };
}
