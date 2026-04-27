"use client";

import { useCallback, useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
import GlobePane, { applyCameraState } from "./GlobePane";
import type { CameraKeyframe } from "@/lib/story/storyTypes";

interface DualGlobeProps {
  year: number;
  /** ISO-A3; when set, both panes filter to this country. */
  countryFilter?: string;
  /** Camera keyframe — each new value animates both maps via easeTo. */
  camera?: CameraKeyframe | null;
}

/**
 * Two side-by-side map panes — old catalog (DFO + GFD + GDACS) on the left,
 * new catalog (Flood Pulse / Groundsource) on the right. Cameras stay in
 * lockstep: user-initiated pan/zoom on either pane mirrors to the other, and
 * a `camera` prop change animates both via easeTo.
 */
export default function DualGlobe({
  year,
  countryFilter,
  camera,
}: DualGlobeProps) {
  const leftMapRef = useRef<maplibregl.Map | null>(null);
  const rightMapRef = useRef<maplibregl.Map | null>(null);

  const onLeftReady = useCallback((map: maplibregl.Map) => {
    leftMapRef.current = map;
  }, []);
  const onRightReady = useCallback((map: maplibregl.Map) => {
    rightMapRef.current = map;
  }, []);

  // User-driven camera sync: one pane moves → mirror to the other without
  // re-entering the move handler (jumpTo has no originalEvent).
  const syncFromLeft = useCallback(
    (s: { center: [number, number]; zoom: number; bearing: number; pitch: number }) => {
      const target = rightMapRef.current;
      if (target) applyCameraState(target, s);
    },
    [],
  );
  const syncFromRight = useCallback(
    (s: { center: [number, number]; zoom: number; bearing: number; pitch: number }) => {
      const target = leftMapRef.current;
      if (target) applyCameraState(target, s);
    },
    [],
  );

  // Scrollytelling-driven camera changes — animate both maps in parallel.
  useEffect(() => {
    if (!camera) return;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = camera.duration === "auto" ? 2500 : camera.duration;

    for (const map of [leftMapRef.current, rightMapRef.current]) {
      if (!map) continue;
      if (reducedMotion) {
        map.jumpTo({
          center: camera.center,
          zoom: camera.zoom,
          pitch: camera.pitch,
          bearing: camera.bearing,
        });
      } else {
        if (map.getPitch() !== camera.pitch) {
          map.jumpTo({ pitch: camera.pitch });
        }
        map.easeTo({
          center: camera.center,
          zoom: camera.zoom,
          pitch: camera.pitch,
          bearing: camera.bearing,
          duration,
          essential: true,
          ...(camera.easing ? { easing: camera.easing } : {}),
        });
      }
    }
  }, [camera]);

  return (
    <div
      className="fixed inset-0 grid grid-cols-1 md:grid-cols-2"
      style={{ zIndex: 0 }}
    >
      <div className="relative min-h-0">
        <GlobePane
          source="old"
          year={year}
          countryFilter={countryFilter}
          onMapReady={onLeftReady}
          onCameraMove={syncFromLeft}
        />
        <PaneBadge label="Old catalogs" sub="DFO · GFD · GDACS" side="left" />
      </div>
      <div className="relative min-h-0">
        <GlobePane
          source="new"
          year={year}
          countryFilter={countryFilter}
          onMapReady={onRightReady}
          onCameraMove={syncFromRight}
        />
        <PaneBadge label="Groundsource" sub="Google Research news ingestion" side="right" />
      </div>
      {/* Visible divider between panes. Rendered as its own layer so it sits
          on top of both map canvases. */}
      <div
        aria-hidden
        className="absolute pointer-events-none bg-text-tertiary/50 hidden md:block"
        style={{ left: "calc(50% - 0.5px)", top: 0, bottom: 0, width: "1px" }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none bg-text-tertiary/50 block md:hidden"
        style={{ top: "calc(50% - 0.5px)", left: 0, right: 0, height: "1px" }}
      />
    </div>
  );
}

function PaneBadge({
  label,
  sub,
  side,
}: {
  label: string;
  sub: string;
  side: "left" | "right";
}) {
  return (
    <div
      className={`absolute top-3 z-10 pointer-events-none select-none ${
        side === "left" ? "right-3 md:right-4 text-right" : "left-3 md:left-4"
      }`}
    >
      <div className="bg-panel-solid/85 backdrop-blur-md rounded-lg border border-border px-2.5 py-1.5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary leading-none">
          {sub}
        </div>
        <div className="text-[13px] font-semibold text-text-primary mt-1.5 leading-none">
          {label}
        </div>
      </div>
    </div>
  );
}
