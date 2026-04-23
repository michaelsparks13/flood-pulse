"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { getExposureRGBA } from "@/lib/colors";
import {
  loadHexYear,
  type HexYearlyRow,
  type HexYearlySource,
} from "@/lib/data/hexYearly";

interface GlobePaneProps {
  source: HexYearlySource;
  year: number;
  /** ISO-A3. When set, hexes outside this country are filtered out on the GPU. */
  countryFilter?: string;
  /** Fired once the underlying MapLibre instance is created. The parent uses
   *  this to wire bidirectional camera sync across two panes. */
  onMapReady?: (map: maplibregl.Map) => void;
  /** Fired on every camera `move` event so the parent can mirror it. */
  onCameraMove?: (
    state: { center: [number, number]; zoom: number; bearing: number; pitch: number },
  ) => void;
}

function buildPopupHTML(d: HexYearlyRow, year: number): string {
  const pop = d.p;
  let popText: string;
  if (pop >= 1_000_000) popText = `${(pop / 1_000_000).toFixed(1)}M`;
  else if (pop >= 1_000) popText = `${Math.round(pop / 1_000)}K`;
  else popText = `${pop.toLocaleString()}`;
  const src = (d as { src?: string | null }).src;
  let html = `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.6;">`;
  html += `<div style="font-weight: 600; color: #f1f5f9;">${popText} people</div>`;
  html += `<div style="color: #94a3b8; margin-top: 2px;">Exposed in ${year}</div>`;
  if (src) html += `<div style="color: #94a3b8; margin-top: 2px;">Source: ${src}</div>`;
  html += `</div>`;
  return html;
}

/**
 * Single-catalog, single-year map pane. Owns its MapLibre + deck.gl overlay.
 * Two of these render side-by-side; the parent syncs their cameras.
 */
export default function GlobePane({
  source,
  year,
  countryFilter,
  onMapReady,
  onCameraMove,
}: GlobePaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const hexDataRef = useRef<HexYearlyRow[] | null>(null);
  const [basemapReady, setBasemapReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  // ----- Initialize MapLibre once -----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      attributionControl: false,
      style: {
        version: 8,
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
      },
      center: [20, 5],
      zoom: 1.2,
      pitch: 0,
      maxZoom: 6,
      renderWorldCopies: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      setBasemapReady(true);
      onMapReady?.(map);
    });
    map.on("move", (e: maplibregl.MapLibreEvent) => {
      // Only forward user-initiated moves — programmatic moves from the
      // sibling pane have no originalEvent and would otherwise feedback-loop.
      if (!(e as unknown as { originalEvent?: Event }).originalEvent) return;
      if (!onCameraMove) return;
      const c = map.getCenter();
      onCameraMove({
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      });
    });
    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Fetch year data whenever (source, year) changes -----
  useEffect(() => {
    let cancelled = false;
    setDataReady(false);
    loadHexYear(source, year)
      .then((file) => {
        if (cancelled) return;
        hexDataRef.current = file.rows;
        setDataReady(true);
      })
      .catch((err) => {
        console.error(`[GlobePane] load ${source}/${year} failed`, err);
      });
    return () => {
      cancelled = true;
    };
  }, [source, year]);

  // ----- Build / update the deck.gl overlay whenever data or country change -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !basemapReady || !dataReady) return;
    const hexData = hexDataRef.current;
    if (!hexData) return;

    // Per-year data is small (<50k hexes), so CPU-side country filtering is
    // cheap — it just narrows the array before deck.gl builds GPU buffers.
    // Avoids DataFilterExtension's edge-case behavior when no categories are
    // set (which would silently hide everything).
    const data = countryFilter
      ? hexData.filter((d) => d.cc === countryFilter)
      : hexData;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layer = new (H3HexagonLayer as any)({
      id: `h3-${source}`,
      data,
      getHexagon: (d: HexYearlyRow) => d.h,
      getFillColor: (d: HexYearlyRow): [number, number, number, number] => {
        const [r, g, b] = getExposureRGBA(d.p);
        return [r, g, b, 235];
      },
      filled: true,
      stroked: false,
      extruded: false,
      pickable: true,
      autoHighlight: true,
      highlightColor: [252, 255, 164, 77],
      onHover: (info: { object?: HexYearlyRow; coordinate?: number[] }) => {
        if (!info.object) {
          popupRef.current?.remove();
          return;
        }
        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: "240px",
            offset: 12,
          });
        }
        popupRef.current
          .setLngLat(info.coordinate as [number, number])
          .setHTML(buildPopupHTML(info.object, year))
          .addTo(map);
      },
      onClick: (info: { object?: HexYearlyRow; coordinate?: number[] }) => {
        if (!info.object) {
          popupRef.current?.remove();
          return;
        }
        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: "240px",
            offset: 12,
          });
        }
        popupRef.current
          .setLngLat(info.coordinate as [number, number])
          .setHTML(buildPopupHTML(info.object, year))
          .addTo(map);
      },
    });

    if (!overlayRef.current) {
      const overlay = new MapboxOverlay({
        interleaved: false,
        layers: [layer],
      });
      map.addControl(overlay as unknown as maplibregl.IControl);
      overlayRef.current = overlay;
    } else {
      overlayRef.current.setProps({ layers: [layer] });
    }
  }, [basemapReady, dataReady, source, year, countryFilter]);

  return (
    <div
      ref={containerRef}
      data-pane={source}
      style={{
        position: "absolute",
        inset: 0,
      }}
    />
  );
}

/** Helper the parent can call when syncing camera from another pane. */
export function applyCameraState(
  map: maplibregl.Map,
  state: { center: [number, number]; zoom: number; bearing: number; pitch: number },
): void {
  map.jumpTo({
    center: state.center,
    zoom: state.zoom,
    bearing: state.bearing,
    pitch: state.pitch,
  });
}
