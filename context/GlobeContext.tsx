"use client";

import { createContext, useContext, useRef, useState, ReactNode } from "react";
import type maplibregl from "maplibre-gl";
import type { MapboxOverlay } from "@deck.gl/mapbox";
import type { HexDatum } from "@/lib/types";

interface GlobeContextValue {
  mapRef: React.RefObject<maplibregl.Map | null>;
  overlayRef: React.RefObject<MapboxOverlay | null>;
  hexDataRef: React.RefObject<HexDatum[] | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  basemapReady: boolean;
  dataReady: boolean;
  setBasemapReady: (v: boolean) => void;
  setDataReady: (v: boolean) => void;
}

const GlobeContext = createContext<GlobeContextValue | null>(null);

export function GlobeProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const hexDataRef = useRef<HexDatum[] | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [basemapReady, setBasemapReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  return (
    <GlobeContext.Provider
      value={{
        mapRef,
        overlayRef,
        hexDataRef,
        containerRef,
        basemapReady,
        dataReady,
        setBasemapReady,
        setDataReady,
      }}
    >
      {/* Persistent globe host — positioned by route via CSS, never unmounted.
          MapLibre's stylesheet forces `.maplibregl-map { position: relative }`,
          which would collapse this host to zero height. Use inline styles so
          the fixed positioning survives after MapLibre attaches its classes. */}
      <div
        ref={containerRef}
        data-testid="globe-host"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          pointerEvents: "auto",
        }}
      />
      {children}
    </GlobeContext.Provider>
  );
}

export function useGlobe() {
  const ctx = useContext(GlobeContext);
  if (!ctx) throw new Error("useGlobe must be used inside GlobeProvider");
  return ctx;
}
