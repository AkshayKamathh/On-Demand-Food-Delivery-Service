"use client";

import { useEffect, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";

import {
  flattenRoute,
  Leg,
  planFromResponse,
  snapshotAt,
  splitRoute,
  TripPlan,
} from "@/lib/tripSimulator";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const RESTAURANT_LNG = -121.895;
const RESTAURANT_LAT = 37.3497;

type TripStateStop = {
  stop_sequence: number;
  order_id: number;
  recipient_name: string;
  delivery_address: string;
  longitude: number;
  latitude: number;
  delivered: boolean;
  delivered_at: string | null;
};

type TripStateResponse = {
  trip_id: number;
  robot_id: number;
  robot_name: string;
  status: TripPlan["status"];
  started_at: string | null;
  completed_at: string | null;
  server_now: string;
  speed_multiplier: number;
  legs: Leg[];
  stops: TripStateStop[];
  current_stop: number;
  order_count: number;
};

type Props = {
  tripId: number;
  /** When the parent's trip status changes, refetch immediately. */
  externalRev?: number;
  onStatusChange?: (status: TripPlan["status"], currentStop: number) => void;
};

const POLL_INTERVAL_MS = 4000;

export default function TripMap({ tripId, externalRev, onStatusChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const restaurantMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const planRef = useRef<TripPlan | null>(null);
  const stateRef = useRef<TripStateResponse | null>(null);
  const rafRef = useRef<number | null>(null);
  const mapboxModRef = useRef<typeof import("mapbox-gl") | null>(null);

  const [error, setError] = useState("");
  const [stateView, setStateView] = useState<TripStateResponse | null>(null);

  // Fetch + apply state on mount, externalRev change, and on a slow poll.
  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const apply = (data: TripStateResponse) => {
      if (cancelled) return;
      stateRef.current = data;
      planRef.current = planFromResponse({
        startedAt: data.started_at,
        serverNow: data.server_now,
        speed: data.speed_multiplier,
        legs: data.legs,
        status: data.status,
      });
      setStateView(data);
      onStatusChange?.(data.status, data.current_stop);
      // If the trip is over, no point in continuing to poll.
      if (data.status === "completed" || data.status === "cancelled") {
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      }
    };

    const fetchOnce = async () => {
      try {
        const res = await fetch(`${BASE_URL}/manager/trips/${tripId}/state`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as TripStateResponse;
        apply(data);
        setError("");
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load trip state");
      }
    };

    fetchOnce();
    intervalId = window.setInterval(fetchOnce, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [tripId, externalRev, onStatusChange]);

  // Init map once.
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      mapboxModRef.current = await import("mapbox-gl");
      if (destroyed) return;

      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [RESTAURANT_LNG, RESTAURANT_LAT],
        zoom: 11,
      });
      mapRef.current = map;

      map.on("load", () => {
        if (destroyed) return;
        // Two route layers: traveled (gray) + remaining (green). They start
        // empty and are populated once we have a plan.
        map.addSource("trip-traveled", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
        });
        map.addSource("trip-remaining", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
        });
        map.addLayer({
          id: "trip-traveled-layer",
          type: "line",
          source: "trip-traveled",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#9ca3af", "line-width": 4, "line-opacity": 0.8 },
        });
        map.addLayer({
          id: "trip-remaining-layer",
          type: "line",
          source: "trip-remaining",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#16a34a", "line-width": 5, "line-opacity": 0.9 },
        });

        // Restaurant pin.
        restaurantMarkerRef.current = new mapboxgl.Marker({ color: "#0f172a" })
          .setLngLat([RESTAURANT_LNG, RESTAURANT_LAT])
          .setPopup(new mapboxgl.Popup().setText("OFS Grocery"))
          .addTo(map);

        // Driver dot.
        const el = document.createElement("div");
        el.style.cssText =
          "width:18px;height:18px;background:#f97316;border-radius:50%;" +
          "border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);";
        driverMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([RESTAURANT_LNG, RESTAURANT_LAT])
          .addTo(map);
      });
    })().catch((e) => setError(String(e)));

    return () => {
      destroyed = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      stopMarkersRef.current.forEach((m) => m.remove());
      stopMarkersRef.current = [];
      driverMarkerRef.current?.remove();
      driverMarkerRef.current = null;
      restaurantMarkerRef.current?.remove();
      restaurantMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Whenever a new state arrives, redraw stop pins + fit bounds + base route.
  useEffect(() => {
    const map = mapRef.current;
    const mapboxMod = mapboxModRef.current;
    const data = stateView;
    if (!map || !mapboxMod || !data) return;

    const apply = () => {
      // Replace stop markers.
      stopMarkersRef.current.forEach((m) => m.remove());
      stopMarkersRef.current = data.stops.map((s) => {
        const el = document.createElement("div");
        const delivered = s.delivered;
        el.textContent = String(s.stop_sequence);
        el.style.cssText = [
          "display:flex",
          "align-items:center",
          "justify-content:center",
          "width:26px",
          "height:26px",
          "border-radius:50%",
          `background:${delivered ? "#16a34a" : "#1e40af"}`,
          "color:white",
          "font-size:12px",
          "font-weight:600",
          "border:2px solid white",
          "box-shadow:0 2px 4px rgba(0,0,0,0.4)",
        ].join(";");
        return new mapboxMod.default.Marker({ element: el })
          .setLngLat([s.longitude, s.latitude])
          .setPopup(
            new mapboxMod.default.Popup({ offset: 16 }).setHTML(
              `<div style="font-size:12px"><strong>Stop ${s.stop_sequence}</strong><br/>${escapeHtml(
                s.recipient_name,
              )}<br/><span style="color:#6b7280">${escapeHtml(s.delivery_address)}</span></div>`,
            ),
          )
          .addTo(map);
      });

      // Fit bounds to restaurant + all stops on the very first paint
      // (or when externalRev forces a refresh).
      const bounds = new mapboxMod.default.LngLatBounds(
        [RESTAURANT_LNG, RESTAURANT_LAT],
        [RESTAURANT_LNG, RESTAURANT_LAT],
      );
      data.stops.forEach((s) => bounds.extend([s.longitude, s.latitude]));
      map.fitBounds(bounds, { padding: 50, duration: 600, maxZoom: 14 });

      // Draw the full remaining route initially; the RAF loop refines it.
      const fullCoords = flattenRoute(data.legs);
      const remainingSrc = map.getSource("trip-remaining") as mapboxgl.GeoJSONSource | undefined;
      remainingSrc?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: fullCoords },
      });
      const traveledSrc = map.getSource("trip-traveled") as mapboxgl.GeoJSONSource | undefined;
      traveledSrc?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [] },
      });
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
    }
  }, [stateView]);

  // Animate the robot dot at 60fps using the local simulator.
  useEffect(() => {
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const map = mapRef.current;
      const plan = planRef.current;
      if (map && plan && plan.legs.length > 0) {
        const snap = snapshotAt(plan, performance.now());
        driverMarkerRef.current?.setLngLat(snap.pos);

        const { traveled, remaining } = splitRoute(plan.legs, snap);
        const traveledSrc = map.getSource("trip-traveled") as mapboxgl.GeoJSONSource | undefined;
        const remainingSrc = map.getSource("trip-remaining") as mapboxgl.GeoJSONSource | undefined;
        traveledSrc?.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: traveled },
        });
        remainingSrc?.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: remaining },
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="relative w-full">
      <div ref={containerRef} className="h-64 w-full rounded-xl overflow-hidden" />
      {error && (
        <div className="absolute top-2 left-2 right-2 rounded-md bg-red-600/80 text-white text-xs px-2 py-1">
          {error}
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
