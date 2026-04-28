"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { DataFilterExtension } from "@deck.gl/extensions";
import type { MapMode, HexDatum } from "@/lib/types";
import { getExposureRGBA, getFrequencyRGBA, getConfidenceBlendedRGBA } from "@/lib/colors";
import { useGlobe } from "@/context/GlobeContext";
import { loadHexDataForYear, prefetchHexYears } from "@/lib/data/hexYearly";

function formatPopulation(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function trendLabel(ft: number): string {
  if (ft > 15) return "Strongly increasing";
  if (ft > 5) return "Increasing";
  if (ft > -5) return "Stable";
  if (ft > -15) return "Decreasing";
  return "Strongly decreasing";
}

function buildPopupHTML(d: HexDatum): string {
  const trendColor = d.ft > 5 ? "#ef8a62" : d.ft < -5 ? "#67a9cf" : "#94a3b8";
  let html = `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.6;">`;
  html += `<div style="font-weight: 600; margin-bottom: 4px; color: #f1f5f9;">${formatPopulation(d.p)} people</div>`;
  html += `<div style="color: #94a3b8;">Flooded <strong style="color:#f1f5f9">${d.yf}</strong> of ${d.y1 - d.y0 + 1} years (${d.m} months total)</div>`;
  html += `<div style="color: ${trendColor}; margin-top: 4px;">Trend: ${trendLabel(d.ft)}</div>`;
  if (d.rp > 0) {
    html += `<div style="color: #94a3b8; margin-top: 2px;">Floods roughly every <strong style="color:#f1f5f9">${d.rp < 2 ? d.rp.toFixed(1) : Math.round(d.rp)}</strong> years</div>`;
  }
  html += `</div>`;
  return html;
}

interface GlobeProps {
  year: number;
  mapMode: MapMode;
  showBoundaries?: boolean;
  showLabels?: boolean;
  satellite?: boolean;
  hexOpacity?: number;
  highlightHex?: string;
  splitCompare?: boolean;
  confidenceMode?: boolean;
  /** Screen-space X position of the divider (0..1, relative to viewport width). Default 0.5. */
  dividerX?: number;
  /** Dataset filter mode:
   *  - "all"  (default) — Flood Pulse hexes in the full exposure/frequency palette.
   *  - "trad" — hexes that any traditional flood DB (DFO / GFD / GDACS) flagged,
   *             colored by trad_p on a blue exposure ramp.
   *  - "fp"   — Flood Pulse hexes that NO traditional DB ever flagged
   *             (news-only), on the magma exposure ramp.
   *  - "trad-split" — trad hexes blue, news-only FP hexes magma, painted
   *             inside the primary layer so entering/leaving Act 6 doesn't
   *             force a full deck.gl layer rebuild.
   */
  datasetFilter?: "all" | "trad" | "fp" | "trad-split";
  /** Restrict the hex layer to a single ISO3 country. Hexes outside the country are hidden. */
  countryFilter?: string;
  onBasemapReady?: () => void;
  onDataReady?: () => void;
  onRevealStart?: () => void;
}

export default function Globe({
  year,
  mapMode,
  showBoundaries = false,
  showLabels = false,
  satellite = false,
  hexOpacity = 0.9,
  highlightHex,
  splitCompare = false,
  confidenceMode = false,
  dividerX = 0.5,
  datasetFilter = "all",
  countryFilter,
  onBasemapReady,
  onDataReady,
  onRevealStart,
}: GlobeProps) {
  const {
    containerRef,
    mapRef,
    overlayRef,
    hexDataRef,
    countryIndexRef,
    basemapReady,
    dataReady,
    setBasemapReady,
    setDataReady,
  } = useGlobe();
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const flyInDoneRef = useRef(false);


  // GFD country list (used to flag which hexes' countries had any GFD events)
  // is loaded once and reused across years.
  const gfdSetRef = useRef<Set<string> | null>(null);
  // Bumps each time fresh year data lands. Used to nudge the layer-rebuild
  // effect without blanking the map while a fetch is in flight.
  const [dataVersion, setDataVersion] = useState(0);

  // Per-year data load. Re-runs when `year` changes — each year is fetched
  // and cached lazily by lib/data/hexYearly.ts. We deliberately do NOT clear
  // dataReady while a new year is loading: that would blank the map and make
  // slider scrubbing feel laggier than the network actually is. Instead, the
  // previous year stays on screen until the new one is parsed and ready.
  useEffect(() => {
    let cancelled = false;

    const ensureGfdSet = async (): Promise<Set<string>> => {
      if (gfdSetRef.current) return gfdSetRef.current;
      const list = await fetch("/data/gfd_observed_countries.json")
        .then((r) => (r.ok ? (r.json() as Promise<string[]>) : ([] as string[])))
        .catch(() => [] as string[]);
      const s = new Set(list);
      gfdSetRef.current = s;
      return s;
    };

    ensureGfdSet()
      .then((gfdSet) => loadHexDataForYear(year, gfdSet))
      .then((result) => {
        if (cancelled) return;
        hexDataRef.current = result.hexes;
        countryIndexRef.current = result.countryIndex;
        setDataVersion((v) => v + 1);
        if (!dataReady) setDataReady(true);
      })
      .catch((err) =>
        console.error(`[FloodPulse] year ${year} data load failed:`, err)
      );

    // Prefetch ±3 years so a fast slider drag has data ready before the user
    // gets there. Caches dedupe so this is cheap if a year is already loaded.
    for (const offset of [-3, -2, -1, 1, 2, 3]) {
      const y = year + offset;
      prefetchHexYears("old", [y]);
      prefetchHexYears("new", [y]);
    }

    return () => {
      cancelled = true;
    };
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize MapLibre map
  useEffect(() => {
    // If the map already exists (user navigated back from another route),
    // the persistent GlobeContext has retained it. Fire the readiness
    // callbacks and return early — do NOT reinitialize.
    if (mapRef.current) {
      if (!basemapReady) setBasemapReady(true);
      onBasemapReady?.();
      return;
    }
    if (!containerRef.current) return;

    const container = containerRef.current;
    let cancelled = false;

    const style: maplibregl.StyleSpecification = {
      version: 8,
      // Mercator (not globe). deck.gl's H3HexagonLayer doesn't project through
      // MapLibre's globe camera — the hex overlay stayed in Mercator space
      // while the basemap rotated in globe space, so hexes visibly drifted off
      // every country during scroll-triggered pans. Mercator keeps basemap and
      // hexes in the same projection, so they stay glued together.
      sources: {
        basemap: {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
          ],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        },
        labels: {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
          ],
          tileSize: 256,
        },
        satellite: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
          maxzoom: 17,
        },
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#07060d" },
        },
        {
          id: "basemap",
          type: "raster",
          source: "basemap",
          paint: { "raster-opacity": 0.6, "raster-brightness-max": 0.5 },
        },
        {
          id: "satellite-layer",
          type: "raster",
          source: "satellite",
          paint: {
            "raster-opacity": 0.85,
            "raster-brightness-max": 0.7,
            "raster-saturation": -0.2,
          },
          layout: { visibility: "none" },
        },
      ],
    };

    requestAnimationFrame(() => {
      if (cancelled || mapRef.current) return;

      const map = new maplibregl.Map({
        container,
        style,
        // Open at the Act 1 camera so there's no mid-load zoom jolt when the
        // hex data finishes loading and the reveal fires.
        center: [20, 5],
        zoom: 1.4,
        pitch: 0,
        maxZoom: 6,
        renderWorldCopies: false,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true }),
        "bottom-right"
      );
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-left"
      );

      map.on("load", () => {
        map.addSource("countries", {
          type: "geojson",
          data: "/data/ne_countries.geojson",
        });

        map.addLayer({
          id: "country-boundaries",
          type: "line",
          source: "countries",
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0,
            "line-width": 0.8,
          },
        });

        map.addLayer({
          id: "labels",
          type: "raster",
          source: "labels",
          maxzoom: 4,
          paint: { "raster-opacity": 0.4 },
          layout: { visibility: "none" },
        });

        setBasemapReady(true);
        onBasemapReady?.();
      });

      mapRef.current = map;

      // Expose on window for Playwright tests
      if (typeof window !== "undefined") {
        (window as unknown as { __map: maplibregl.Map }).__map = map;
      }
    });

    return () => {
      cancelled = true;
      // NOTE: Do not destroy the map — it lives in GlobeContext and persists
      // across route transitions. Only clean up route-scoped listeners/popups.
      popupRef.current?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── deck.gl overlay: create once, update layers on prop changes ──────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !basemapReady || !dataReady) return;

    const hexData = hexDataRef.current;
    if (!hexData) return;

    const alpha = Math.round(hexOpacity * 255);

    // GPU country filter: flipping `countryFilter` rewrites a filterRange
    // uniform rather than re-running getFillColor across 430k hexes, which is
    // the difference between scroll hitching on Act 6 and not. Non-data
    // countries get a no-op range [0, N] so every hex passes.
    const ccIndex = countryIndexRef.current ?? {};
    const ccIdxForFilter =
      countryFilter !== undefined && ccIndex[countryFilter] !== undefined
        ? ccIndex[countryFilter]
        : -1;
    const maxCcIdx = Object.keys(ccIndex).length;
    const countryRange: [number, number] = ccIdxForFilter >= 0
      ? [ccIdxForFilter, ccIdxForFilter]
      : [0, maxCcIdx];

    // Dataset-filter range. filterValue is stable across modes (filterSize=3:
    // [minYear, ccIdx, isTradFlag]); mode selection happens via a uniform on
    // the trad-flag dimension. "trad" narrows to trad-flagged hexes only;
    // "fp" narrows to news-only; everything else lets both through. This
    // avoids the several-hundred-ms main-thread stall that a color/filter
    // accessor rerun across 400k hexes would otherwise trigger on every
    // dataset mode change.
    const datasetRange: [number, number] =
      datasetFilter === "trad"
        ? [1, 1]
        : datasetFilter === "fp"
        ? [0, 0]
        : [0, 1];

    // Frequency / confidence modes still need the per-hex color accessor
    // since their values depend on per-hex fields. For the exposure mode
    // (Acts 1–6) both catalogs share the magma ramp so visuals compare
    // apples-to-apples — the old view reads as dim because the trad
    // catalogs flagged far fewer hexes, not because the color scheme
    // pretends their populations are smaller.
    const staticExposurePaint = (d: HexDatum): [number, number, number, number] => {
      const pop = d.trad_y0 != null ? d.trad_p ?? 0 : d.p;
      const [r, g, b] = getExposureRGBA(pop);
      return [r, g, b, alpha];
    };
    const dynamicPaint = (d: HexDatum): [number, number, number, number] => {
      if (mapMode === "frequency") {
        const [r, g, b] = getFrequencyRGBA(d.ft);
        return [r, g, b, alpha];
      }
      if (confidenceMode) {
        const [r, g, b] = getConfidenceBlendedRGBA(d.p, d.m);
        return [r, g, b, alpha];
      }
      return staticExposurePaint(d);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layer = new (H3HexagonLayer as any)({
      id: "h3-hexes",
      data: hexData,
      getHexagon: (d: HexDatum) => d.h,
      getFillColor: dynamicPaint,
      filled: true,
      stroked: false,
      extruded: false,
      pickable: true,
      autoHighlight: true,
      highlightColor: [252, 255, 164, 77],

      // GPU filter dimensions [minYear, ccIdx, isTradFlag]. All three are
      // uniform flips — datasetFilter, countryFilter, and year changes never
      // force the color accessor to rerun across 400k hexes.
      extensions: [new DataFilterExtension({ filterSize: 3 })],
      getFilterValue: (d: HexDatum) => [
        Math.min(d.trad_y0 ?? 9999, d.y0 ?? 9999),
        d.ccIdx ?? 0,
        d.trad_y0 != null ? 1 : 0,
      ],
      filterRange: [[0, year], countryRange, datasetRange],

      updateTriggers: {
        // Only dynamic-paint inputs change the fill; plain exposure mode is
        // stable across dataset/country/year changes.
        getFillColor: [mapMode, hexOpacity, confidenceMode],
      },

      onHover: (info: any) => {
        if (!info.object) {
          popupRef.current?.remove();
          return;
        }
        const d = info.object as HexDatum;
        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: "260px",
            offset: 12,
          });
        }
        popupRef.current
          .setLngLat(info.coordinate as [number, number])
          .setHTML(buildPopupHTML(d))
          .addTo(map);
      },

      // Touch tap support — show the same popup on click for mobile users
      onClick: (info: any) => {
        if (!info.object) {
          popupRef.current?.remove();
          return;
        }
        const d = info.object as HexDatum;
        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: "260px",
            offset: 12,
          });
        }
        popupRef.current
          .setLngLat(info.coordinate as [number, number])
          .setHTML(buildPopupHTML(d))
          .addTo(map);
      },
    });

    const triggerReveal = () => {
      if (flyInDoneRef.current) return;
      flyInDoneRef.current = true;
      // No camera fly-in: the map is already parked at the Act 1 keyframe
      // (center [20, 5], zoom 1.4). Just signal the scrollytelling that hexes
      // are ready so any reveal copy/overlay can unblock.
      onRevealStart?.();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let layers: any[];
    if (splitCompare) {
      // Legacy before/after year split — kept for potential future use. Not
      // currently wired into any scrollytelling act.
      const canvas = document.querySelector("canvas.deck-canvas") as HTMLCanvasElement | null;
      const width = canvas?.width ?? window.innerWidth;
      const height = canvas?.height ?? window.innerHeight;
      const splitPx = Math.round(width * dividerX);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buildSplit = (
        id: string,
        filterRange: [number, number],
        getFilterValue: (d: HexDatum) => number,
        scissor: [number, number, number, number]
      ) =>
        new (H3HexagonLayer as any)({
          id,
          data: hexData,
          getHexagon: (d: HexDatum) => d.h,
          getFillColor: (d: HexDatum) => {
            const [r, g, b] = getExposureRGBA(d.p);
            return [r, g, b, alpha];
          },
          filled: true,
          stroked: false,
          pickable: false,
          extensions: [new DataFilterExtension({ filterSize: 1 })],
          getFilterValue,
          filterRange,
          parameters: { scissor },
          updateTriggers: {
            getFillColor: [hexOpacity],
          },
        });

      const before = buildSplit(
        "h3-before",
        [2000, 2012],
        (d: HexDatum) => d.y1,
        [0, 0, splitPx, height]
      );
      const after = buildSplit(
        "h3-after",
        [2013, 2026],
        (d: HexDatum) => d.y0,
        [splitPx, 0, width - splitPx, height]
      );
      layers = [before, after];
    } else {
      layers = [layer];
    }

    if (!overlayRef.current) {
      // Tried `interleaved: true` to share the MapLibre globe projection —
      // made things worse (hexes detach to the horizon). deck.gl's
      // H3HexagonLayer doesn't currently project through MapLibre's globe
      // camera. Mitigation: scrollytelling cameras use pitch 0 during the
      // zoomed acts. Deeper fix = swap to a MapLibre native fill layer fed
      // by per-hex polygon geometry, or wait for deck.gl to gain globe-view
      // support. See issue #4.
      const overlay = new MapboxOverlay({
        interleaved: false,
        layers,
      });
      map.addControl(overlay as unknown as maplibregl.IControl);
      overlayRef.current = overlay;
      console.log("[FloodPulse] deck.gl overlay added (overlaid)");
      onDataReady?.();
      triggerReveal();
    } else {
      overlayRef.current.setProps({ layers });
      // Overlay already existed (navigated back to this route). Fire both
      // readiness callbacks — the new page has no way to know the globe
      // was already revealed on a prior mount.
      onDataReady?.();
      onRevealStart?.();
    }
  }, [dataReady, dataVersion, year, mapMode, hexOpacity, basemapReady, highlightHex, splitCompare, confidenceMode, dividerX, datasetFilter, countryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pulse layer animation — runs independently of the main layer effect
  // so 30k hexes don't get rebuilt every frame.
  useEffect(() => {
    if (!highlightHex) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    let rafId: number | null = null;
    const tick = () => {
      const phase = (performance.now() / 1000) % 1.0;
      const pulseAlpha = 120 + Math.round(Math.sin(phase * 2 * Math.PI) * 80);
      const pulseLayer = new (H3HexagonLayer as any)({
        id: "h3-pulse",
        data: [{ h: highlightHex }],
        getHexagon: (d: { h: string }) => d.h,
        getFillColor: [252, 255, 164, pulseAlpha],
        filled: true,
        stroked: true,
        getLineColor: [252, 255, 164, 230],
        getLineWidth: 2,
        lineWidthUnits: "pixels",
        pickable: false,
        updateTriggers: { getFillColor: [phase] },
      });
      // Read the current base layers from the overlay and append the pulse.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const overlayProps = (overlay as unknown as { props?: { layers?: any[] } }).props;
      if (!overlayProps) { rafId = requestAnimationFrame(tick); return; }
      const baseLayers = (overlayProps.layers ?? []).filter((l: any) => l?.id !== "h3-pulse");
      overlay.setProps({ layers: [...baseLayers, pulseLayer] });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      // Clear the pulse from the overlay on unmount / highlightHex change
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const overlayProps = (overlay as unknown as { props?: { layers?: any[] } }).props;
      if (!overlayProps) return;
      const baseLayers = (overlayProps.layers ?? []).filter((l: any) => l?.id !== "h3-pulse");
      overlay.setProps({ layers: baseLayers });
    };
  }, [highlightHex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle country boundaries
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !basemapReady) return;
    const opacity = showBoundaries ? (satellite ? 0.35 : 0.15) : 0;
    map.setPaintProperty("country-boundaries", "line-opacity", opacity);
  }, [showBoundaries, satellite, basemapReady]);

  // Toggle labels
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !basemapReady) return;
    map.setLayoutProperty("labels", "visibility", showLabels ? "visible" : "none");
  }, [showLabels, basemapReady]);

  // Toggle satellite basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !basemapReady) return;

    if (satellite) {
      map.setLayoutProperty("basemap", "visibility", "none");
      map.setLayoutProperty("satellite-layer", "visibility", "visible");
      map.setPaintProperty("country-boundaries", "line-width", 1.0);
      map.setPaintProperty("background", "background-color", "#000000");
    } else {
      map.setLayoutProperty("basemap", "visibility", "visible");
      map.setLayoutProperty("satellite-layer", "visibility", "none");
      map.setPaintProperty("country-boundaries", "line-width", 0.8);
      map.setPaintProperty("background", "background-color", "#07060d");
    }
  }, [satellite, basemapReady]);

  // The map canvas lives in GlobeProvider's persistent fixed host, so the
  // component itself renders nothing.
  return null;
}
