"use client";

import { createContext, useContext, useRef, useState, useMemo, ReactNode } from "react";
import type maplibregl from "maplibre-gl";
import type { MapboxOverlay } from "@deck.gl/mapbox";
import type { HexDatum } from "@/lib/types";

interface GlobeContextValue {
  // mapRef, overlayRef, and hexDataRef are mutated directly by Globe.tsx
  // (writing .current). MutableRefObject reflects that intent.
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
  overlayRef: React.MutableRefObject<MapboxOverlay | null>;
  hexDataRef: React.MutableRefObject<HexDatum[] | null>;
  // containerRef is only read by Globe; it stays as RefObject.
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

  // Memoize so consumers only re-render when basemapReady/dataReady change.
  // Ref identities and state setters are stable, so they are safe to omit from deps.
  const value = useMemo(
    () => ({
      mapRef,
      overlayRef,
      hexDataRef,
      containerRef,
      basemapReady,
      dataReady,
      setBasemapReady,
      setDataReady,
    }),
    [basemapReady, dataReady]
  );

  return (
    <GlobeContext.Provider value={value}>
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
