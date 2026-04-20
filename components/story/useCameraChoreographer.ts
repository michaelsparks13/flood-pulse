"use client";

import { useCallback, useRef } from "react";
import { useGlobe } from "@/context/GlobeContext";
import type { CameraKeyframe } from "@/lib/story/storyTypes";

/**
 * Flies the shared globe camera to the given keyframe. Called by StoryContainer
 * on scrollama step.enter events.
 */
export function useCameraChoreographer() {
  const { mapRef } = useGlobe();
  const lastKeyframeRef = useRef<CameraKeyframe | null>(null);

  const flyTo = useCallback((kf: CameraKeyframe) => {
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
    // MapLibre 5.x globe projection has two flyTo bugs not fixed upstream
    // through 5.23:
    //   (1) pitch tween crashes _calcMatrices (null invViewProjMatrix)
    //   (2) long-arc center tween produces Invalid LngLat (NaN, NaN)
    // Mitigation: pre-jump the pitch (sidesteps #1 by making _pitching false),
    // then use easeTo instead of flyTo. easeTo uses a different interpolation
    // code path that avoids the singular zoom-curve that triggers #2.
    if (map.getPitch() !== kf.pitch) {
      map.jumpTo({ pitch: kf.pitch });
    }
    map.easeTo({
      center: kf.center,
      zoom: kf.zoom,
      pitch: kf.pitch,
      bearing: kf.bearing,
      duration: kf.duration === "auto" ? 2500 : kf.duration,
      essential: true,
      ...(kf.easing ? { easing: kf.easing } : {}),
    });
  }, [mapRef]);

  return { flyTo, lastKeyframeRef };
}
