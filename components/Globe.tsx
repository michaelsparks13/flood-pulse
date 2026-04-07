"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapMode } from "@/lib/types";

/** Population exposure: magma-inspired sequential palette */
const EXPOSURE_PAINT: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "p"],
  0, "#2c115f",
  1000, "#711f81",
  10000, "#b63679",
  50000, "#e85a5a",
  200000, "#f8945e",
  1000000, "#fdd162",
  5000000, "#fcffa4",
  20000000, "#ffffff",
];

/** Frequency trend: diverging blue -> white -> red (RdBu) */
const FREQUENCY_PAINT: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "ft"],
  -50, "#2166ac",
  -25, "#67a9cf",
  0, "#f0f0f0",
  25, "#ef8a62",
  50, "#b2182b",
];

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

interface GlobeProps {
  year: number;
  mapMode: MapMode;
  showBoundaries?: boolean;
  showLabels?: boolean;
  satellite?: boolean;
  hexOpacity?: number;
  onBasemapReady?: () => void;
  onDataReady?: () => void;
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
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [loaded, setLoaded] = useState(false);
  const rotationRef = useRef<number | null>(null);

  // Hover popup handler
  const handleHover = useCallback(
    (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const map = mapRef.current;
      if (!map || !e.features?.[0]) return;

      const props = e.features[0].properties;
      if (!props) return;

      map.setFilter("hex-hover", ["==", ["get", "h"], props.h ?? ""]);

      const pop = Number(props.p ?? 0);
      const yf = Number(props.yf ?? 0);
      const m = Number(props.m ?? 0);
      const ft = Number(props.ft ?? 0);
      const rp = Number(props.rp ?? 0);
      const y0 = Number(props.y0 ?? 0);
      const y1 = Number(props.y1 ?? 0);

      let html = `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.6;">`;
      html += `<div style="font-weight: 600; margin-bottom: 4px; color: #f1f5f9;">${formatPopulation(pop)} people</div>`;
      html += `<div style="color: #94a3b8;">Flooded <strong style="color:#f1f5f9">${yf}</strong> of ${y1 - y0 + 1} years (${m} months total)</div>`;

      const trendColor = ft > 5 ? "#ef8a62" : ft < -5 ? "#67a9cf" : "#94a3b8";
      html += `<div style="color: ${trendColor}; margin-top: 4px;">Trend: ${trendLabel(ft)}</div>`;

      if (rp > 0) {
        html += `<div style="color: #94a3b8; margin-top: 2px;">Floods roughly every <strong style="color:#f1f5f9">${rp < 2 ? rp.toFixed(1) : Math.round(rp)}</strong> years</div>`;
      }

      html += `</div>`;

      if (!popupRef.current) {
        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: "260px",
          offset: 12,
        });
      }

      popupRef.current.setLngLat(e.lngLat).setHTML(html).addTo(map);
    },
    [],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const container = containerRef.current;
    let cancelled = false;

    // Register PMTiles protocol for maplibre
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

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
        zoom: 1.8,
        maxZoom: 6,
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
        // Disable globe atmosphere/horizon glow
        map.setSky({
          "sky-color": "#07060d",
          "horizon-color": "#07060d",
          "fog-color": "#07060d",
          "sky-horizon-blend": 0,
          "horizon-fog-blend": 0,
          "fog-ground-blend": 1,
        });

        // Country boundaries (GeoJSON)
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

        // In dev, Next.js doesn't support range requests on static files,
        // so we proxy through an API route. On Vercel, serve directly from CDN.
        const isDev = process.env.NODE_ENV === "development";
        const origin = window.location.origin;
        const pmtilesUrl = isDev
          ? `${origin}/api/tiles`
          : `${origin}/data/flood_pulse.pmtiles`;

        map.addSource("hexes", {
          type: "vector",
          url: `pmtiles://${pmtilesUrl}`,
        });

        map.addLayer({
          id: "hex-fill",
          type: "fill",
          source: "hexes",
          "source-layer": "hexes",
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["get", "p"],
              0, "#2c115f",
              1000, "#711f81",
              10000, "#b63679",
              50000, "#e85a5a",
              200000, "#f8945e",
              1000000, "#fdd162",
              5000000, "#fcffa4",
              20000000, "#ffffff",
            ],
            "fill-antialias": false,
            "fill-opacity": 0.9,
          },
          filter: ["<=", ["get", "y0"], year],
        });

        map.addLayer({
          id: "hex-hover",
          type: "fill",
          source: "hexes",
          "source-layer": "hexes",
          paint: {
            "fill-color": "#fcffa4",
            "fill-opacity": 0.3,
          },
          filter: ["==", ["get", "h"], ""],
        });

        // Labels on top of everything — subdued opacity, cap zoom to reduce clutter
        map.addLayer({
          id: "labels",
          type: "raster",
          source: "labels",
          maxzoom: 4,
          paint: {
            "raster-opacity": 0.4,
          },
          layout: {
            visibility: "none",
          },
        });

        setLoaded(true);
        onBasemapReady?.();

        // Fire once hex tiles finish rendering
        map.once("idle", () => {
          onDataReady?.();
        });

        // Slow auto-rotation
        const rotate = () => {
          if (!mapRef.current) return;
          const center = map.getCenter();
          map.jumpTo({ center: [center.lng + 0.015, center.lat] });
          rotationRef.current = requestAnimationFrame(rotate);
        };
        rotationRef.current = requestAnimationFrame(rotate);
      });

      // Hover with tooltip
      map.on("mousemove", "hex-fill", handleHover);
      map.on("mouseleave", "hex-fill", () => {
        map.setFilter("hex-hover", ["==", ["get", "h"], ""]);
        popupRef.current?.remove();
      });

      // Stop rotation on interaction
      const stopRotation = () => {
        if (rotationRef.current !== null) {
          cancelAnimationFrame(rotationRef.current);
          rotationRef.current = null;
        }
      };
      map.on("mousedown", stopRotation);
      map.on("touchstart", stopRotation);
      map.on("wheel", stopRotation);

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (rotationRef.current !== null) {
        cancelAnimationFrame(rotationRef.current);
        rotationRef.current = null;
      }
      popupRef.current?.remove();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      maplibregl.removeProtocol("pmtiles");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update year filter
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const filter: maplibregl.FilterSpecification = ["<=", ["get", "y0"], year];
    map.setFilter("hex-fill", filter);
    map.triggerRepaint();
  }, [year, loaded]);

  // Toggle country boundaries via paint opacity (more reliable than layout visibility)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const opacity = showBoundaries ? (satellite ? 0.35 : 0.15) : 0;
    map.setPaintProperty("country-boundaries", "line-opacity", opacity);
  }, [showBoundaries, satellite, loaded]);

  // Toggle labels
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    map.setLayoutProperty(
      "labels",
      "visibility",
      showLabels ? "visible" : "none"
    );
  }, [showLabels, loaded]);

  // Toggle satellite basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

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
  }, [satellite, loaded]);

  // Update hex data opacity
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    map.setPaintProperty("hex-fill", "fill-opacity", hexOpacity);
  }, [hexOpacity, loaded]);

  // Update color paint when map mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const paint = mapMode === "frequency" ? FREQUENCY_PAINT : EXPOSURE_PAINT;
    map.setPaintProperty("hex-fill", "fill-color", paint as any);
    map.triggerRepaint();
  }, [mapMode, loaded]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
    />
  );
}
