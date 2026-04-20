"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { DataFilterExtension } from "@deck.gl/extensions";
import type { MapMode, HexDatum, HexCompactJSON } from "@/lib/types";
import { getExposureRGBA, getFrequencyRGBA } from "@/lib/colors";
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
  onBasemapReady,
  onDataReady,
  onRevealStart,
}: GlobeProps) {
  const {
    containerRef,
    mapRef,
    overlayRef,
    hexDataRef,
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
    fetch("/data/hex_compact.json")
      .then((r) => r.json())
      .then((json: HexCompactJSON) => {
        const { columns, rows } = json;
        const data: HexDatum[] = rows.map((row) => {
          const obj: Record<string, string | number> = {};
          columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj as unknown as HexDatum;
        });
        console.log(`[FloodPulse] Loaded ${data.length} hexes`);
        hexDataRef.current = data;
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
      projection: { type: "globe" },
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
        center: [20, 15],
        zoom: 0.8,
        pitch: 20,
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
        map.setSky({
          "sky-color": "#07060d",
          "horizon-color": "#07060d",
          "fog-color": "#07060d",
          "sky-horizon-blend": 0,
          "horizon-fog-blend": 0,
          "fog-ground-blend": 1,
        });

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

    const colorFn =
      mapMode === "frequency"
        ? (d: HexDatum) => getFrequencyRGBA(d.ft)
        : (d: HexDatum) => getExposureRGBA(d.p);

    const alpha = Math.round(hexOpacity * 255);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layer = new (H3HexagonLayer as any)({
      id: "h3-hexes",
      data: hexData,
      getHexagon: (d: HexDatum) => d.h,
      getFillColor: (d: HexDatum) => {
        const [r, g, b] = colorFn(d);
        return [r, g, b, alpha];
      },
      filled: true,
      stroked: false,
      extruded: false,
      pickable: true,
      autoHighlight: true,
      highlightColor: [252, 255, 164, 77],

      // GPU year filter
      extensions: [new DataFilterExtension({ filterSize: 1 })],
      getFilterValue: (d: HexDatum) => d.y0,
      filterRange: [0, year],

      updateTriggers: {
        getFillColor: [mapMode, hexOpacity],
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
      // Skip reveal if the map has already been zoomed in by a previous route mount.
      // flyInDoneRef is local to this component and resets on remount; the camera
      // state is the ground truth.
      if (map.getZoom() > 1.2) {
        flyInDoneRef.current = true;
        onRevealStart?.();
        return;
      }
      flyInDoneRef.current = true;
      onRevealStart?.();
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reducedMotion) {
        map.flyTo({
          center: [20, 15],
          zoom: 1.8,
          pitch: 0,
          duration: 2800,
          easing: (t: number) => 1 - Math.pow(1 - t, 4), // easeOutQuart
        });
      } else {
        map.jumpTo({ center: [20, 15], zoom: 1.8, pitch: 0 });
      }
    };

    if (!overlayRef.current) {
      const overlay = new MapboxOverlay({
        interleaved: false,
        layers: [layer],
      });
      map.addControl(overlay as unknown as maplibregl.IControl);
      overlayRef.current = overlay;
      console.log("[FloodPulse] deck.gl overlay added (overlaid)");
      onDataReady?.();
      triggerReveal();
    } else {
      overlayRef.current.setProps({ layers: [layer] });
      // Overlay already existed (navigated back to this route). Fire the
      // readiness callback so consuming pages can unblock their UI.
      onDataReady?.();
    }
  }, [dataReady, year, mapMode, hexOpacity, basemapReady]); // eslint-disable-line react-hooks/exhaustive-deps

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
