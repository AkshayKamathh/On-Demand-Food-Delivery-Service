// src/components/MapComponent.tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import type mapboxgl from "mapbox-gl";  

const START_LNG = -121.895;
const START_LAT = 37.3497;

interface MapComponentProps {
  endLng: number;
  endLat: number;
  onReady: (updateFn: (progress: number) => void) => void;
}

export default function MapComponent({ endLng, endLat, onReady }: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  // Store coords and cumulative distances as refs so interpolateRoute never goes stale
  const routeCoordsRef = useRef<[number, number][]>([]);
  const cumDistRef = useRef<number[]>([]);
  const totalDistRef = useRef<number>(0);

  // Pure interpolation — no deps on anything that changes, reads only from refs
  const interpolateRoute = useCallback((progress: number) => {
    const map = mapRef.current;
    const coords = routeCoordsRef.current;
    const cumDist = cumDistRef.current;
    const totalDist = totalDistRef.current;

    if (!map || coords.length < 2) return;

    const p = Math.max(0, Math.min(1, progress));
    const targetDist = p * totalDist;

    let driverPos: [number, number];
    let splitIdx: number;

    if (p <= 0) {
      driverPos = coords[0];
      splitIdx = 0;
    } else if (p >= 1) {
      driverPos = coords[coords.length - 1];
      splitIdx = coords.length - 1;
    } else {
      // Find the segment containing targetDist
      splitIdx = 0;
      for (let i = 0; i < cumDist.length - 1; i++) {
        if (targetDist <= cumDist[i + 1]) {
          splitIdx = i;
          const segLen = cumDist[i + 1] - cumDist[i];
          const t = segLen > 0 ? (targetDist - cumDist[i]) / segLen : 0;
          driverPos = [
            coords[i][0] + t * (coords[i + 1][0] - coords[i][0]),
            coords[i][1] + t * (coords[i + 1][1] - coords[i][1]),
          ];
          break;
        }
        // Fallback if we somehow overshoot
        driverPos = coords[coords.length - 1];
        splitIdx = coords.length - 1;
      }
      driverPos = driverPos!;
    }

    // Move the driver dot
    driverMarkerRef.current?.setLngLat(driverPos);

    // Build the two line segments
    const traveledCoords: [number, number][] =
      p <= 0 ? [] : [...coords.slice(0, splitIdx + 1), driverPos];

    const remainingCoords: [number, number][] =
      p >= 1 ? [] : [driverPos, ...coords.slice(splitIdx + 1)];

    const traveledSrc = map.getSource("route-traveled") as mapboxgl.GeoJSONSource | undefined;
    const remainingSrc = map.getSource("route-remaining") as mapboxgl.GeoJSONSource | undefined;

    traveledSrc?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: traveledCoords },
    });

    remainingSrc?.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: remainingCoords.length >= 2 ? remainingCoords : coords,
      },
    });
  }, []); // stable — reads only from refs

  useEffect(() => {
    if (!mapContainer.current) return;

    let map: mapboxgl.Map;
    let destroyed = false;

    const initMap = async () => {
      const mapboxgl = (await import("mapbox-gl")).default;

      if (destroyed) return;

      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

      map = new mapboxgl.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        bounds: new mapboxgl.LngLatBounds(
          [Math.min(START_LNG, endLng) - 0.02, Math.min(START_LAT, endLat) - 0.02],
          [Math.max(START_LNG, endLng) + 0.02, Math.max(START_LAT, endLat) + 0.02]
        ),
        fitBoundsOptions: { padding: 60 },
      });

      mapRef.current = map;

      map.on("load", async () => {
        if (destroyed) return;

        // Start pin
        new mapboxgl.Marker({ color: "#0f172a" })
          .setLngLat([START_LNG, START_LAT])
          .setPopup(new mapboxgl.Popup().setText("OFS Grocery"))
          .addTo(map);

        // End pin
        new mapboxgl.Marker({ color: "#16a34a" })
          .setLngLat([endLng, endLat])
          .setPopup(new mapboxgl.Popup().setText("Delivery Location"))
          .addTo(map);

        // Fetch route with full geometry so interpolation is accurate
        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/` +
            `${START_LNG},${START_LAT};${endLng},${endLat}` +
            `?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`
        );
        const data = await res.json();

        if (destroyed || !data.routes?.length) return;

        const coords: [number, number][] = data.routes[0].geometry.coordinates;
        routeCoordsRef.current = coords;

        // Precompute cumulative distances (simple Euclidean in degrees — fine for interpolation)
        const cumDist: number[] = [0];
        for (let i = 1; i < coords.length; i++) {
          const dx = coords[i][0] - coords[i - 1][0];
          const dy = coords[i][1] - coords[i - 1][1];
          cumDist.push(cumDist[i - 1] + Math.sqrt(dx * dx + dy * dy));
        }
        cumDistRef.current = cumDist;
        totalDistRef.current = cumDist[cumDist.length - 1];

        // Traveled segment (gray) — starts empty
        map.addSource("route-traveled", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [] },
          },
        });

        // Remaining segment (green) — starts as the full route
        map.addSource("route-remaining", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coords },
          },
        });

        map.addLayer({
          id: "route-traveled-layer",
          type: "line",
          source: "route-traveled",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#9ca3af", "line-width": 5, "line-opacity": 0.7 },
        });

        map.addLayer({
          id: "route-remaining-layer",
          type: "line",
          source: "route-remaining",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#16a34a", "line-width": 5, "line-opacity": 0.85 },
        });

        // Driver marker (orange dot)
        const el = document.createElement("div");
        el.style.cssText =
          "width:16px;height:16px;background:#f97316;border-radius:50%;" +
          "border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);";

        driverMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([START_LNG, START_LAT])
          .addTo(map);

        // Tell the parent we're ready and hand it the update function
        onReady(interpolateRoute);
      });
    };

    initMap().catch(console.error);

    return () => {
      destroyed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [endLng, endLat, onReady, interpolateRoute]);

  return <div ref={mapContainer} className="h-full w-full" />;
}