"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

interface GlobeProps {
  year: number;
  onBasemapReady?: () => void;
  onDataReady?: () => void;
}

export default function Globe({ year, onBasemapReady, onDataReady }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const rotationRef = useRef<number | null>(null);

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

      // Hover
      map.on("mousemove", "hex-fill", (e) => {
        if (e.features?.[0]) {
          map.setFilter("hex-hover", [
            "==",
            ["get", "h"],
            e.features[0].properties?.h ?? "",
          ]);
        }
      });
      map.on("mouseleave", "hex-fill", () => {
        map.setFilter("hex-hover", ["==", ["get", "h"], ""]);
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

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
    />
  );
}
