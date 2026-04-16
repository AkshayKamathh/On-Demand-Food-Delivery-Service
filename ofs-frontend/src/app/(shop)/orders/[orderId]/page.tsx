"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAuthHeaders } from "@/lib/authHeaders";

type OrderItem = {
  item_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  unit_weight: number;
  line_total: number;
};

type OrderDetail = {
  id: number;
  status: string;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  recipient_name: string;
  email: string;
  delivery_address: string;
  delivery_address_latitude: number;
  delivery_address_longitude: number;
  delivery_notes?: string | null;
  created_at: string;
  delivered_at?: string | null;
  items: OrderItem[];
};

type StepKey = "received" | "preparing" | "out" | "delivered";

const stepLabel: Record<StepKey, string> = {
  received: "Order received",
  preparing: "Preparing order",
  out: "Out for delivery",
  delivered: "Delivered",
};

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} min`;
}

export default function OrderStatusPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = Number(params?.orderId);
  const router = useRouter();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [etaSeconds, setEtaSeconds] = useState<number>(0);
  const [deliveredBanner, setDeliveredBanner] = useState(false);

  const [activeSteps, setActiveSteps] = useState<Record<StepKey, boolean>>({
    received: false,
    preparing: false,
    out: false,
    delivered: false,
  });

  const [driverProgress, setDriverProgress] = useState(0);
  const simulationStarted = useRef(false);
  const deliveryMarked = useRef(false);
  const [mapObjectUrl, setMapObjectUrl] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string>("");
  const lastMapUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
      const result = await Promise.race([supabase.auth.getUser(), timeout]);
      if (!result || !("data" in result) || !result.data.user) {
        router.replace("/");
        return false;
      }
      return true;
    };

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        if (!orderId || Number.isNaN(orderId)) {
          throw new Error("Invalid order id");
        }

        const ok = await checkAuth();
        if (!ok || cancelled) return;

        const headers = await getAuthHeaders();

        const [orderRes, etaRes] = await Promise.all([
          fetch(`http://localhost:8000/checkout/orders/${orderId}`, { headers }),
          fetch(`http://localhost:8000/checkout/orders/${orderId}/eta`, { headers }),
        ]);

        if (!orderRes.ok) {
          const text = await orderRes.text().catch(() => "");
          throw new Error(text || "Failed to load order");
        }

        if (!etaRes.ok) {
          // ETA nice-to-have; don't hard fail.
          setEtaSeconds(0);
        } else {
          const payload = (await etaRes.json()) as any;
          setEtaSeconds(Number(payload?.eta_seconds ?? 0));
        }

        const data = (await orderRes.json()) as OrderDetail;
        if (!cancelled) setOrder(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load order");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  useEffect(() => {
    if (!orderId || !order) return;

    let cancelled = false;
    let aborter: AbortController | null = null;
    const debounceId = window.setTimeout(async () => {
      try {
        setMapLoading(true);
        setMapError("");
        aborter = new AbortController();

        const headers = await getAuthHeaders();
        const ts = Date.now();
        const url = `http://localhost:8000/checkout/orders/${orderId}/map?progress=${driverProgress}&t=${ts}`;
        const res = await fetch(url, {
          headers,
          signal: aborter.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          setMapError(text || `Map request failed (${res.status})`);
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;

        const objectUrl = URL.createObjectURL(blob);
        if (lastMapUrl.current) URL.revokeObjectURL(lastMapUrl.current);
        lastMapUrl.current = objectUrl;
        setMapObjectUrl(objectUrl);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    }, activeSteps.out ? 250 : 0); // update frequently only during animation

    return () => {
      cancelled = true;
      window.clearTimeout(debounceId);
      if (aborter) aborter.abort();
    };
  }, [orderId, order, driverProgress, activeSteps.out]);

  useEffect(() => {
    if (!order || simulationStarted.current) return;

    // If already delivered in DB, show completed state immediately.
    if ((order.status ?? "").toLowerCase() === "delivered") {
      setActiveSteps({ received: true, preparing: true, out: true, delivered: true });
      setDriverProgress(1);
      setDeliveredBanner(true);
      simulationStarted.current = true;
      return;
    }

    simulationStarted.current = true;

    const timers: number[] = [];

    const t1 = window.setTimeout(() => {
      setActiveSteps((s) => ({ ...s, received: true }));
    }, 3000);
    timers.push(t1);

    const t2 = window.setTimeout(() => {
      setActiveSteps((s) => ({ ...s, preparing: true }));
    }, 6000);
    timers.push(t2);

    const intervalRef = { current: 0 };
    const t3 = window.setTimeout(() => {
      setActiveSteps((s) => ({ ...s, out: true }));
    
      const start = Date.now();
      const durationMs = 12000;
      intervalRef.current = window.setInterval(() => {
        const pct = Math.min(1, (Date.now() - start) / durationMs);
        setDriverProgress(Number(pct.toFixed(3)));
        if (pct >= 1) {
          window.clearInterval(intervalRef.current);
          setActiveSteps((s) => ({ ...s, delivered: true }));
          setDeliveredBanner(true);
        }
      }, 500);
    }, 11000);
    timers.push(t3);
    
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.clearInterval(intervalRef.current);
    };
  }, [order]);

  useEffect(() => {
    if (!order) return;
    if (!activeSteps.delivered) return;
    if (deliveryMarked.current) return;

    deliveryMarked.current = true;

    const mark = async () => {
      try {
        const res = await fetch(`http://localhost:8000/checkout/orders/${orderId}/delivered`, {
          method: "POST",
          headers: await getAuthHeaders(),
        });
        if (res.ok) {
          const payload = (await res.json()) as any;
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  status: payload?.status ?? "delivered",
                  delivered_at: payload?.delivered_at ?? prev.delivered_at ?? null,
                }
              : prev
          );
        }
      } catch {
        // If this fails, the UI still completes; the DB update can be retried later.
      }
    };

    mark();
  }, [activeSteps.delivered, order, orderId]);

  const receiptPlacedAt = order?.created_at ? new Date(order.created_at) : null;
  const placedLabel = receiptPlacedAt ? receiptPlacedAt.toLocaleString() : "—";

  const totalItems = order?.items?.reduce((sum, i) => sum + (i.quantity ?? 0), 0) ?? 0;

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 p-6 flex items-center justify-center">
        <div className="text-lg text-zinc-600 dark:text-zinc-300">Loading order…</div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 dark:border-red-900/40 bg-white/70 dark:bg-zinc-900/30 p-6 text-red-700 dark:text-red-300">
          {error || "Order not found"}
          <div className="mt-4">
            <Link
              href="/orders"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
            >
              Back to orders
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 text-zinc-900 dark:text-violet-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Order #{order.id}</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-200">
                Placed {placedLabel} • {totalItems} item{totalItems === 1 ? "" : "s"}
              </p>
            </div>
            <Link
              href="/orders"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/30 px-4 py-2 text-sm font-medium hover:bg-white/80 dark:hover:bg-zinc-900/50 transition"
            >
              Back to orders
            </Link>
          </div>
  
          {deliveredBanner && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-200">
              <div className="font-semibold">Your order has been delivered!</div>
              <div className="text-sm opacity-90">
                Thanks for shopping with OFS. Your delivery is complete.
              </div>
            </div>
          )}
        </header>
  
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/40 p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Delivery status</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Estimated time of delivery:{" "}
                <span className="font-medium">{formatDuration(etaSeconds)}</span>
              </p>
  
              <ol className="mt-5 grid gap-3">
                {(Object.keys(stepLabel) as StepKey[]).map((key, idx) => {
                  const done = activeSteps[key];
                  return (
                    <li key={key} className="flex items-center gap-3">
                      <span
                        className={[
                          "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                          done
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-950/20 text-zinc-600 dark:text-zinc-300",
                        ].join(" ")}
                      >
                        {done ? "✓" : idx + 1}
                      </span>
                      <span
                        className={[
                          "text-sm",
                          done
                            ? "text-emerald-700 dark:text-emerald-300 font-medium"
                            : "text-zinc-600 dark:text-zinc-300",
                        ].join(" ")}
                      >
                        {stepLabel[key]}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
  
            <div className="relative">
              <div className="absolute -inset-4 bg-emerald-500/10 dark:bg-emerald-500/10 blur-3xl rounded-3xl" />
  
              <div className="relative rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 overflow-hidden shadow-xl">
                <div className="relative w-full aspect-[16/9] bg-zinc-100/70 dark:bg-zinc-900/50">
                  {mapObjectUrl ? (
                    <img
                      src={mapObjectUrl}
                      alt="Map showing route from OFS Grocery to delivery location"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-sm text-zinc-600 dark:text-zinc-300">
                      {mapError ? `Map error: ${mapError}` : "Loading map…"}
                    </div>
                  )}
  
                  <div className="absolute left-4 top-4 flex flex-col gap-2">
                    <span className="rounded-full bg-white/90 dark:bg-zinc-950/80 px-2 py-0.5 text-[10px] font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
                      OFS Grocery (start)
                    </span>
                    <span className="rounded-full bg-white/90 dark:bg-zinc-950/80 px-2 py-0.5 text-[10px] font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
                      Destination
                    </span>
                  </div>
                </div>
  
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">Delivery address</p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {order.delivery_address}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-500/15 px-3 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                      {activeSteps.delivered
                        ? "Delivered"
                        : activeSteps.out
                          ? "Out for delivery"
                          : activeSteps.preparing
                            ? "Preparing"
                            : "Order received"}
                    </span>
                  </div>
  
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="rounded-xl bg-zinc-100/80 dark:bg-zinc-900/70 px-3 py-2">
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-500">ETA</p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {formatDuration(etaSeconds)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-zinc-100/80 dark:bg-zinc-900/70 px-3 py-2">
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-500">Total</p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        ${Number(order.total).toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-zinc-100/80 dark:bg-zinc-900/70 px-3 py-2">
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-500">Map</p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {mapLoading ? "Updating…" : activeSteps.out ? "Live" : "Ready"}
                      </p>
                    </div>
                  </div>
  
                  {!activeSteps.out && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      Route is shown now. The driver starts moving once the order is out for delivery.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
  
          <aside className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/40 p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Receipt</h2>
  
              <div className="mt-4 space-y-3">
                {order.items.map((item) => (
                  <div key={`${item.item_id}-${item.description}`} className="flex justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.description}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">
                        Qty: {item.quantity} • ${Number(item.unit_price).toFixed(2)} each
                      </div>
                    </div>
                    <div className="font-semibold">${Number(item.line_total).toFixed(2)}</div>
                  </div>
                ))}
              </div>
  
              <div className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">Subtotal</span>
                  <span className="font-medium">${Number(order.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">Delivery fee</span>
                  <span className="font-medium">${Number(order.delivery_fee).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 text-base">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold">${Number(order.total).toFixed(2)}</span>
                </div>
              </div>
  
              <div className="mt-6 rounded-2xl bg-zinc-100/70 dark:bg-zinc-950/30 p-4 text-sm">
                <div className="font-semibold">Delivery to</div>
                <div className="text-zinc-700 dark:text-zinc-200">{order.recipient_name}</div>
                <div className="text-zinc-600 dark:text-zinc-300">{order.email}</div>
                <div className="mt-2 text-zinc-700 dark:text-zinc-200">{order.delivery_address}</div>
                {order.delivery_notes && (
                  <div className="mt-2 text-zinc-600 dark:text-zinc-300">
                    Notes: {order.delivery_notes}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
