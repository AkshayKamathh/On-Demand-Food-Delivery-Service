"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ManagerNavbar from "@/components/manager/ManagerNavbar";
import TripMap from "@/components/manager/dispatch/TripMap";

type ReadyOrder = {
  order_id: number;
  recipient_name: string;
  delivery_address: string;
  latitude: number;
  longitude: number;
  weight: number;
  total: number;
  created_at: string;
};

type ReadyDispatchSummary = {
  orders: ReadyOrder[];
  total_weight: number;
  order_count: number;
};

type TripSummary = {
  id: number;
  robot_id: number;
  robot_name: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  order_count: number;
  total_weight: number;
  current_stop: number;
  route_optimized: boolean;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type TripStop = {
  stop_sequence: number;
  order_id: number;
  recipient_name: string;
  delivery_address: string;
  latitude: number;
  longitude: number;
  weight: number;
  delivered: boolean;
};

type TripDetail = TripSummary & { stops: TripStop[] };

type DispatchRunResponse = {
  trips: TripSummary[];
  skipped_overweight_order_ids: number[];
  deferred_order_count: number;
  message: string;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CAPACITY_ORDERS = 10;
const CAPACITY_WEIGHT = 200;

const STATUS_LABEL: Record<TripSummary["status"], string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function statusBadge(status: TripSummary["status"]) {
  const base =
    "inline-flex items-center px-2.5 py-1 rounded-full text-xs border font-medium";
  switch (status) {
    case "planned":
      return `${base} border-blue-300/80 dark:border-blue-500/40 text-blue-700 dark:text-blue-200 bg-blue-50/60 dark:bg-blue-900/20`;
    case "in_progress":
      return `${base} border-orange-300/80 dark:border-orange-500/40 text-orange-700 dark:text-orange-200 bg-orange-50/60 dark:bg-orange-900/20`;
    case "completed":
      return `${base} border-emerald-300/80 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/20`;
    case "cancelled":
      return `${base} border-red-300/80 dark:border-red-500/40 text-red-600 dark:text-red-300 bg-red-50/60 dark:bg-red-900/20`;
  }
}

function CapacityBar({ weight, orders }: { weight: number; orders: number }) {
  const weightPct = Math.min(100, (weight / CAPACITY_WEIGHT) * 100);
  const ordersPct = Math.min(100, (orders / CAPACITY_ORDERS) * 100);
  return (
    <div className="space-y-2">
      <div>
        <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
          <span>Weight</span>
          <span>
            {weight.toFixed(1)} / {CAPACITY_WEIGHT} lbs
          </span>
        </div>
        <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden mt-1">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${weightPct}%` }}
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
          <span>Orders</span>
          <span>
            {orders} / {CAPACITY_ORDERS}
          </span>
        </div>
        <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden mt-1">
          <div
            className="h-full bg-blue-500"
            style={{ width: `${ordersPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TripCard({
  trip,
  onCancel,
  busy,
  onLiveStateChange,
}: {
  trip: TripSummary;
  onCancel: (tripId: number) => Promise<void>;
  busy: boolean;
  onLiveStateChange: () => void;
}) {
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [detailError, setDetailError] = useState("");

  const loadDetail = useCallback(async () => {
    try {
      setDetailError("");
      const res = await fetch(`${BASE_URL}/manager/trips/${trip.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as TripDetail;
      setDetail(data);
    } catch (e: any) {
      setDetailError(e?.message ?? "Failed to load trip detail");
    }
  }, [trip.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail, trip.status, trip.current_stop]);

  const canCancel = trip.status === "planned" || trip.status === "in_progress";

  // Whenever the live trip state ticks past a stop, re-pull detail so the
  // sidebar list (delivered checkmarks) stays in sync without polling itself.
  const handleStateChange = useCallback(
    (status: string, currentStop: number) => {
      if (status !== trip.status || currentStop !== trip.current_stop) {
        loadDetail();
        onLiveStateChange();
      }
    },
    [trip.status, trip.current_stop, loadDetail, onLiveStateChange],
  );

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700/60 bg-white/70 dark:bg-zinc-900/40 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              🤖 {trip.robot_name}
            </h3>
            <span className={statusBadge(trip.status)}>
              {STATUS_LABEL[trip.status]}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Trip #{trip.id}
            {trip.route_optimized ? " · route optimized" : " · fallback route"}
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
          <div>Stop {trip.current_stop} / {trip.order_count}</div>
        </div>
      </div>

      <div className="mt-4">
        <CapacityBar weight={trip.total_weight} orders={trip.order_count} />
      </div>

      <div className="mt-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700/60">
        <TripMap tripId={trip.id} onStatusChange={handleStateChange} />
      </div>

      {detail && (
        <ol className="mt-4 space-y-1.5 text-sm">
          {detail.stops.map((stop) => (
            <li
              key={stop.order_id}
              className={`flex items-start gap-2 ${
                stop.delivered
                  ? "text-zinc-400 dark:text-zinc-500 line-through"
                  : "text-zinc-800 dark:text-zinc-200"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  stop.delivered
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
                }`}
              >
                {stop.delivered ? "✓" : stop.stop_sequence}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  #{stop.order_id} · {stop.recipient_name}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {stop.delivery_address} · {stop.weight.toFixed(1)} lbs
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {detailError && (
        <p className="mt-2 text-xs text-red-600">{detailError}</p>
      )}

      {canCancel && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => onCancel(trip.id)}
            className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-500/60 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            Cancel Trip
          </button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 self-center">
            Robot auto-advances through stops · cancel marks any undelivered orders as cancelled.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ManagerDispatch() {
  const [ready, setReady] = useState<ReadyDispatchSummary | null>(null);
  const [activeTrips, setActiveTrips] = useState<TripSummary[]>([]);
  const [historyTrips, setHistoryTrips] = useState<TripSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [busyTripId, setBusyTripId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const loadAll = useCallback(async () => {
    try {
      setError("");
      const [readyRes, activeRes, historyRes] = await Promise.all([
        fetch(`${BASE_URL}/manager/dispatch/ready`),
        fetch(`${BASE_URL}/manager/trips?status=planned&status=in_progress`),
        fetch(`${BASE_URL}/manager/trips?status=completed&status=cancelled`),
      ]);
      if (!readyRes.ok) throw new Error(`Ready orders: HTTP ${readyRes.status}`);
      if (!activeRes.ok) throw new Error(`Active trips: HTTP ${activeRes.status}`);
      if (!historyRes.ok) throw new Error(`History trips: HTTP ${historyRes.status}`);

      setReady((await readyRes.json()) as ReadyDispatchSummary);
      setActiveTrips((await activeRes.json()) as TripSummary[]);
      setHistoryTrips((await historyRes.json()) as TripSummary[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load dispatch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function runDispatch() {
    try {
      setDispatching(true);
      setError("");
      setFlash("");
      const res = await fetch(`${BASE_URL}/manager/dispatch/run`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as DispatchRunResponse;
      setFlash(data.message);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? "Failed to run dispatch");
    } finally {
      setDispatching(false);
    }
  }

  const cancelTrip = useCallback(
    async (tripId: number) => {
      if (!confirm("Cancel this trip? Any undelivered orders on it will be cancelled.")) {
        return;
      }
      try {
        setBusyTripId(tripId);
        setError("");
        setFlash("");
        const res = await fetch(`${BASE_URL}/manager/trips/${tripId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.detail ?? `HTTP ${res.status}`);
        }
        await loadAll();
      } catch (e: any) {
        setError(e?.message ?? "Cancel failed");
      } finally {
        setBusyTripId(null);
      }
    },
    [loadAll],
  );

  const readyTotalWeight = ready?.total_weight ?? 0;
  const readyCount = ready?.orders.length ?? 0;

  const projectedTrips = useMemo(() => {
    if (!ready || ready.orders.length === 0) return 0;
    const sorted = [...ready.orders].sort((a, b) => b.weight - a.weight);
    const bins: { weight: number; count: number }[] = [];
    for (const o of sorted) {
      if (o.weight > CAPACITY_WEIGHT) continue;
      let placed = false;
      for (const b of bins) {
        if (b.count < CAPACITY_ORDERS && b.weight + o.weight <= CAPACITY_WEIGHT) {
          b.weight += o.weight;
          b.count += 1;
          placed = true;
          break;
        }
      }
      if (!placed) bins.push({ weight: o.weight, count: 1 });
    }
    return bins.length;
  }, [ready]);

  return (
    <>
      <ManagerNavbar />
      <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 p-6">
        <div className="mx-auto w-full max-w-7xl space-y-6">

          {/* Header */}
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 dark:shadow-black/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Robot Dispatch
                </h1>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300 text-sm">
                  Group ready orders into optimized robot trips (≤ {CAPACITY_ORDERS} orders / ≤ {CAPACITY_WEIGHT} lbs each).
                </p>
              </div>
              <button
                onClick={loadAll}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-white/60 dark:hover:bg-zinc-900/30 transition-colors self-start disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
            {flash && (
              <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                {flash}
              </p>
            )}
          </div>

          {/* Ready Orders */}
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 dark:shadow-black/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Ready to Dispatch
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-0.5">
                  {readyCount} order{readyCount === 1 ? "" : "s"} · {readyTotalWeight.toFixed(1)} lbs total
                  {readyCount > 0 && projectedTrips > 0 && (
                    <> · estimated {projectedTrips} trip{projectedTrips === 1 ? "" : "s"}</>
                  )}
                </p>
              </div>
              <button
                onClick={runDispatch}
                disabled={dispatching || readyCount === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors"
              >
                {dispatching ? "Dispatching…" : "Run Dispatch"}
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700/50">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50/60 dark:bg-zinc-900/40">
                  <tr className="text-left text-zinc-600 dark:text-zinc-300">
                    {["Order #", "Customer", "Address", "Weight", "Total", "Created"].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700/50">
                  {loading && (
                    <tr>
                      <td className="px-4 py-6 text-zinc-500 dark:text-zinc-400" colSpan={6}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && readyCount === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-zinc-500 dark:text-zinc-400" colSpan={6}>
                        No orders ready. Move orders to &quot;Preparing&quot; from the Orders page.
                      </td>
                    </tr>
                  )}
                  {ready?.orders.map((o) => {
                    const overweight = o.weight > CAPACITY_WEIGHT;
                    return (
                      <tr
                        key={o.order_id}
                        className={`text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50/40 dark:hover:bg-zinc-900/20 transition-colors ${
                          overweight ? "bg-red-50/40 dark:bg-red-900/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap font-medium">#{o.order_id}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{o.recipient_name}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 max-w-[240px] truncate">
                          {o.delivery_address}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium">
                          {o.weight.toFixed(1)} lbs
                          {overweight && (
                            <span className="ml-2 text-xs text-red-600 dark:text-red-300">
                              over 200 lbs
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">${o.total.toFixed(2)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                          {new Date(o.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Trips */}
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 dark:shadow-black/30">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Active Trips
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-0.5">
              {activeTrips.length} trip{activeTrips.length === 1 ? "" : "s"} in flight
            </p>

            {activeTrips.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                No active trips.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onCancel={cancelTrip}
                    busy={busyTripId === trip.id}
                    onLiveStateChange={loadAll}
                  />
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 dark:shadow-black/30">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full flex items-center justify-between"
            >
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 text-left">
                  Trip History
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-0.5 text-left">
                  {historyTrips.length} completed or cancelled trip{historyTrips.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-zinc-500 dark:text-zinc-400 text-sm">
                {showHistory ? "Hide" : "Show"}
              </span>
            </button>

            {showHistory && (
              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50/60 dark:bg-zinc-900/40">
                    <tr className="text-left text-zinc-600 dark:text-zinc-300">
                      {["Trip #", "Robot", "Status", "Stops", "Weight", "Created", "Completed"].map((h) => (
                        <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700/50">
                    {historyTrips.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-zinc-500 dark:text-zinc-400" colSpan={7}>
                          No historical trips.
                        </td>
                      </tr>
                    )}
                    {historyTrips.map((t) => (
                      <tr key={t.id} className="text-zinc-900 dark:text-zinc-100">
                        <td className="px-4 py-3 whitespace-nowrap font-medium">#{t.id}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{t.robot_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={statusBadge(t.status)}>{STATUS_LABEL[t.status]}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{t.order_count}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{t.total_weight.toFixed(1)} lbs</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                          {new Date(t.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                          {t.completed_at ? new Date(t.completed_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </main>
    </>
  );
}
