"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { DataFilterExtension } from "@deck.gl/extensions";
import { cellToLatLng } from "h3-js";
import type { MapMode, HexDatum, HexCompactJSON } from "@/lib/types";
import { getExposureRGBA, getFrequencyRGBA, getConfidenceBlendedRGBA, getBlueExposureRGBA } from "@/lib/colors";
import { useGlobe } from "@/context/GlobeContext";

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


  // Fetch compact hex data once on mount (shared across route transitions)
  useEffect(() => {
    // If data already loaded (e.g., via earlier route), don't refetch
    if (hexDataRef.current) {
      if (!dataReady) setDataReady(true);
      return;
    }
    Promise.all([
      fetch("/data/hex_compact.json").then((r) => r.json() as Promise<HexCompactJSON>),
      fetch("/data/gfd_observed_countries.json")
        .then((r) => (r.ok ? (r.json() as Promise<string[]>) : [] as string[]))
        .catch(() => [] as string[]),
    ])
      .then(async ([json, gfdCountries]) => {
        const { columns, rows } = json;
        const gfdSet = new Set(gfdCountries);
        // Dense country-code → integer, built as we iterate. Lets the deck.gl
        // layer filter by country on the GPU (uniform flip, no buffer rebuild).
        const countryIndex: Record<string, number> = {};
        let nextCc = 0;
        // Column index map — avoid per-row indexOf.
        const idx = Object.fromEntries(columns.map((c, i) => [c, i])) as Record<string, number>;
        // Drop hexes with negligible population on both catalogs — they're
        // invisible in either palette and just inflate the per-hex work
        // deck.gl has to do every time a dataset filter changes.
        const MIN_POP = 100;
        // Growable — we don't know the final size until we filter. Start at
        // ~60% of row count (observed FP+trad retention rate).
        const data: HexDatum[] = [];
        // Chunk the conversion across frames so we don't freeze the main thread
        // while 400k+ rows are materialized. yieldAfter ≈ 8ms per tick keeps
        // scroll + paint responsive.
        const CHUNK = 25_000;
        let i = 0;
        let ccIdxCounter = 0;
        while (i < rows.length) {
          const end = Math.min(i + CHUNK, rows.length);
          for (let k = i; k < end; k++) {
            const row = rows[k];
            const p = row[idx.p] as number;
            const tradP = row[idx.trad_p] as number | null;
            if ((!p || p < MIN_POP) && (!tradP || tradP < MIN_POP)) continue;
            const cc = row[idx.cc] as string;
            let ccIdx = countryIndex[cc];
            if (ccIdx === undefined) {
              ccIdx = ccIdxCounter++;
              countryIndex[cc] = ccIdx;
            }
            const hex = {
              h: row[idx.h] as string,
              m: row[idx.m] as number,
              yf: row[idx.yf] as number,
              p,
              y0: row[idx.y0] as number,
              y1: row[idx.y1] as number,
              cc,
              ft: row[idx.ft] as number,
              rp: row[idx.rp] as number,
              trad_y0: row[idx.trad_y0] as number | null,
              trad_y1: row[idx.trad_y1] as number | null,
              trad_yf: row[idx.trad_yf] as number | null,
              trad_p: tradP,
              trad_src: row[idx.trad_src] as string | null,
              ccIdx,
            } as HexDatum;
            hex.isGfdObserved = gfdSet.has(cc);
            const [lat, lng] = cellToLatLng(hex.h);
            hex.lat = lat;
            hex.lng = lng;
            data.push(hex);
          }
          i = end;
          if (i < rows.length) {
            // Yield to the event loop so scroll, UI, and basemap tiles keep
            // rendering while we're still enriching hex rows.
            await new Promise<void>((resolve) => {
              if (typeof (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback === "function") {
                (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(() => resolve(), { timeout: 50 });
              } else {
                setTimeout(resolve, 0);
              }
            });
          }
        }
        console.log(`[FloodPulse] Loaded ${data.length}/${rows.length} hexes after pop-filter; GFD-observed countries: ${gfdCountries.length}; unique countries: ${ccIdxCounter}`);
        hexDataRef.current = data;
        countryIndexRef.current = countryIndex;
        setDataReady(true);
      })
      .catch((err) => console.error("[FloodPulse] Data load failed:", err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const tradAlpha = Math.round(hexOpacity * 235);
    const fpOnlyAlpha = Math.round(hexOpacity * 230);

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
    // (Acts 1–6) we paint deterministically: isTrad → blue on trad_p, else
    // magma on p. No datasetFilter branching, so mode switches don't force
    // deck.gl to re-run the accessor across every hex.
    const staticExposurePaint = (d: HexDatum): [number, number, number, number] => {
      if (d.trad_y0 != null) {
        const [r, g, b] = getBlueExposureRGBA(d.trad_p ?? 0);
        return [r, g, b, tradAlpha];
      }
      const [r, g, b] = getExposureRGBA(d.p);
      return [r, g, b, fpOnlyAlpha];
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
  }, [dataReady, year, mapMode, hexOpacity, basemapReady, highlightHex, splitCompare, confidenceMode, dividerX, datasetFilter, countryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
