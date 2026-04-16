"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAuthHeaders } from "@/lib/authHeaders";

type OrderListItem = {
  id: number;
  created_at: string;
  total: number;
  status: string;
};

function formatStatus(status: string) {
  const s = status?.toLowerCase?.() ?? "";
  if (s === "pending_payment") return "Pending payment";
  if (s === "submitted") return "Order received";
  if (s === "delivered") return "Delivered";
  return status;
}

function statusPillClasses(status: string) {
  const s = status?.toLowerCase?.() ?? "";
  if (s === "delivered") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (s === "submitted") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

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

        const ok = await checkAuth();
        if (!ok || cancelled) return;

        const res = await fetch("http://localhost:8000/checkout/orders", {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "Failed to load orders");
        }
        const data = (await res.json()) as OrderListItem[];
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load orders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const hasOrders = orders.length > 0;

  const sorted = useMemo(() => {
    return [...orders].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  }, [orders]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 text-zinc-900 dark:text-violet-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Your Orders</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-200">
            Track delivery progress and view receipts for your past orders.
          </p>
        </header>

        {loading && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/30 p-6 text-sm text-zinc-600 dark:text-zinc-300">
            Loading orders…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-white/70 dark:bg-zinc-900/30 p-6 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && !hasOrders && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/30 p-8 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              You don’t have any orders yet.
            </p>
            <Link
              href="/userDashboard"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 transition-colors"
            >
              Browse products
            </Link>
          </div>
        )}

        {!loading && !error && hasOrders && (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((o) => {
              const placed = o.created_at ? new Date(o.created_at) : null;
              const dateLabel = placed ? `${placed.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${placed.toLocaleTimeString([],
               { hour: 'numeric', minute: '2-digit' })}` : "—";
              return (
                <article
                  key={o.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/40 p-6 shadow-sm hover:shadow-xl transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Order ID</p>
                      <p className="text-lg font-semibold">#{o.id}</p>
                    </div>
                    <span
                      className={[
                        "rounded-full px-3 py-1 text-[11px] font-medium",
                        statusPillClasses(o.status),
                      ].join(" ")}
                    >
                      {formatStatus(o.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-zinc-100/80 dark:bg-zinc-950/30 px-3 py-2">
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Date placed</p>
                      <p className="font-medium">{dateLabel}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-100/80 dark:bg-zinc-950/30 px-3 py-2">
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Total</p>
                      <p className="font-medium">${Number(o.total ?? 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <Link
                      href={`/orders/${o.id}`}
                      className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
                    >
                      View Order
                    </Link>
                    <Link
                      href="/userDashboard"
                      className="text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      Continue shopping
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

