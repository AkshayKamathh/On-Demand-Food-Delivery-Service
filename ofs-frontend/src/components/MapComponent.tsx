"use client";

import { useEffect, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";

import { getAuthHeaders } from "@/lib/authHeaders";
import {
  flattenRoute,
  Leg,
  planFromResponse,
  snapshotAt,
  splitRoute,
  TripPlan,
} from "@/lib/tripSimulator";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type CustomerTripView = {
  trip_id: number;
  robot_name: string;
  status: TripPlan["status"];
  started_at: string | null;
  server_now: string;
  speed_multiplier: number;
  legs: Leg[];
  stops: {
    stop_sequence: number;
    longitude: number;
    latitude: number;
    is_you: boolean;
  }[];
  your_stop_sequence: number;
  order_count: number;
  restaurant_lng: number;
  restaurant_lat: number;
};

interface Props {
  orderId: number;
  /** Fallback drop-pin coords when the order isn't on a trip yet. */
  fallbackEndLng: number;
  fallbackEndLat: number;
  /** Updated whenever the live simulator crosses a milestone (used by the page). */
  onTripStateChange?: (snapshot: {
    status: TripPlan["status"];
    completedStops: number;
    onYourLeg: boolean;
    youDelivered: boolean;
  }) => void;
}

const POLL_INTERVAL_MS = 4000;

export default function MapComponent({
  orderId,
  fallbackEndLng,
  fallbackEndLat,
  onTripStateChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const restaurantMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const fallbackMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const planRef = useRef<TripPlan | null>(null);
  const tripRef = useRef<CustomerTripView | null>(null);
  const lastStateRef = useRef<{ status: string; completedStops: number; youDelivered: boolean }>({
    status: "",
    completedStops: -1,
    youDelivered: false,
  });
  const rafRef = useRef<number | null>(null);
  const mapboxModRef = useRef<typeof import("mapbox-gl") | null>(null);

  const [tripView, setTripView] = useState<CustomerTripView | null>(null);
  const [error, setError] = useState("");

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
        center: [fallbackEndLng, fallbackEndLat],
        zoom: 12,
      });
      mapRef.current = map;

      map.on("load", () => {
        if (destroyed) return;

        map.addSource("route-traveled", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
        });
        map.addSource("route-remaining", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
        });
        map.addLayer({
          id: "route-traveled-layer",
          type: "line",
          source: "route-traveled",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#9ca3af", "line-width": 4, "line-opacity": 0.8 },
        });
        map.addLayer({
          id: "route-remaining-layer",
          type: "line",
          source: "route-remaining",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#16a34a", "line-width": 5, "line-opacity": 0.9 },
        });

        // Driver dot.
        const el = document.createElement("div");
        el.style.cssText =
          "width:18px;height:18px;background:#f97316;border-radius:50%;" +
          "border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);";
        driverMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([fallbackEndLng, fallbackEndLat])
          .addTo(map);

        // Initial fallback "delivery here" pin used until we have a real trip.
        fallbackMarkerRef.current = new mapboxgl.Marker({ color: "#16a34a" })
          .setLngLat([fallbackEndLng, fallbackEndLat])
          .setPopup(new mapboxgl.Popup().setText("Delivery location"))
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
      fallbackMarkerRef.current?.remove();
      fallbackMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // We intentionally only init once; fallback coords are seed values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch trip view and re-poll. 409 = not on a trip yet (just keep showing fallback pin).
  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const fetchOnce = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${BASE_URL}/checkout/orders/${orderId}/trip`, { headers });
        if (res.status === 409) {
          if (!cancelled) {
            tripRef.current = null;
            planRef.current = null;
            setTripView(null);
          }
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as CustomerTripView;
        if (cancelled) return;
        tripRef.current = data;
        planRef.current = planFromResponse({
          startedAt: data.started_at,
          serverNow: data.server_now,
          speed: data.speed_multiplier,
          legs: data.legs,
          status: data.status,
        });
        setTripView(data);
        if (data.status === "completed" || data.status === "cancelled") {
          if (intervalId !== null) {
            window.clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load trip");
      }
    };

    fetchOnce();
    intervalId = window.setInterval(fetchOnce, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [orderId]);

  // Whenever a fresh trip view arrives, redraw stops + base route + fit bounds.
  useEffect(() => {
    const map = mapRef.current;
    const mapboxMod = mapboxModRef.current;
    const data = tripView;
    if (!map || !mapboxMod) return;

    const apply = () => {
      // Tear down old stop markers.
      stopMarkersRef.current.forEach((m) => m.remove());
      stopMarkersRef.current = [];

      if (!data) {
        // No active trip — keep showing the fallback delivery pin only.
        const traveledSrc = map.getSource("route-traveled") as mapboxgl.GeoJSONSource | undefined;
        const remainingSrc = map.getSource("route-remaining") as mapboxgl.GeoJSONSource | undefined;
        traveledSrc?.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        });
        remainingSrc?.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        });
        fallbackMarkerRef.current?.addTo(map);
        return;
      }

      // Hide the seed fallback pin once we have real stops.
      fallbackMarkerRef.current?.remove();

      // Restaurant pin (recreate to keep it on top after style reloads).
      restaurantMarkerRef.current?.remove();
      restaurantMarkerRef.current = new mapboxMod.default.Marker({ color: "#0f172a" })
        .setLngLat([data.restaurant_lng, data.restaurant_lat])
        .setPopup(new mapboxMod.default.Popup().setText("OFS Grocery"))
        .addTo(map);

      // Per-stop pins. Other customers are anonymized (pin only); your stop
      // gets a label and a distinct color.
      data.stops.forEach((s) => {
        const isYou = s.is_you;
        const el = document.createElement("div");
        el.textContent = isYou ? "You" : String(s.stop_sequence);
        el.style.cssText = [
          "display:flex",
          "align-items:center",
          "justify-content:center",
          isYou ? "min-width:36px" : "width:24px",
          "height:24px",
          "padding:0 6px",
          "border-radius:12px",
          `background:${isYou ? "#16a34a" : "#1e40af"}`,
          "color:white",
          "font-size:11px",
          "font-weight:600",
          "border:2px solid white",
          "box-shadow:0 2px 4px rgba(0,0,0,0.4)",
        ].join(";");
        const marker = new mapboxMod.default.Marker({ element: el })
          .setLngLat([s.longitude, s.latitude])
          .addTo(map);
        stopMarkersRef.current.push(marker);
      });

      // Fit bounds to the whole route (restaurant + every stop).
      const bounds = new mapboxMod.default.LngLatBounds(
        [data.restaurant_lng, data.restaurant_lat],
        [data.restaurant_lng, data.restaurant_lat],
      );
      data.stops.forEach((s) => bounds.extend([s.longitude, s.latitude]));
      map.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 14 });

      // Seed the route — base layer is full route in green; the RAF tick will
      // immediately repaint with the traveled/remaining split.
      const fullCoords = flattenRoute(data.legs);
      const remainingSrc = map.getSource("route-remaining") as mapboxgl.GeoJSONSource | undefined;
      remainingSrc?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: fullCoords },
      });
      const traveledSrc = map.getSource("route-traveled") as mapboxgl.GeoJSONSource | undefined;
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
  }, [tripView]);

  // Animate driver dot via the shared simulator at 60fps.
  useEffect(() => {
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const map = mapRef.current;
      const plan = planRef.current;
      const trip = tripRef.current;
      if (map && plan && trip && plan.legs.length > 0) {
        const snap = snapshotAt(plan, performance.now());
        driverMarkerRef.current?.setLngLat(snap.pos);

        const { traveled, remaining } = splitRoute(plan.legs, snap);
        const traveledSrc = map.getSource("route-traveled") as mapboxgl.GeoJSONSource | undefined;
        const remainingSrc = map.getSource("route-remaining") as mapboxgl.GeoJSONSource | undefined;
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

        // Notify parent only when something meaningful changes.
        const youDelivered = snap.completedStops >= trip.your_stop_sequence;
        const last = lastStateRef.current;
        if (
          last.status !== plan.status ||
          last.completedStops !== snap.completedStops ||
          last.youDelivered !== youDelivered
        ) {
          lastStateRef.current = {
            status: plan.status,
            completedStops: snap.completedStops,
            youDelivered,
          };
          onTripStateChange?.({
            status: plan.status,
            completedStops: snap.completedStops,
            onYourLeg: snap.legIndex === trip.your_stop_sequence - 1 && !snap.done,
            youDelivered,
          });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [onTripStateChange]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {error && (
        <div className="absolute top-2 left-2 right-2 rounded-md bg-red-600/80 text-white text-xs px-2 py-1">
          {error}
        </div>
      )}
    </div>
  );
}
