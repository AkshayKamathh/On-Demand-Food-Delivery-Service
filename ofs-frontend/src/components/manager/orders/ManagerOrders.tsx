"use client";

import { useEffect, useState } from "react";
import ManagerNavbar from "@/components/manager/ManagerNavbar";

type ManagerOrder = {
  id: number;
  created_at: string;
  total: number;
  status: string;
  recipient_name: string;
  email: string;
  delivery_address: string;
};

const ORDER_STATUSES = [
  { value: "pending_payment", label: "Pending Payment" },
  { value: "submitted",       label: "Order Received" },
  { value: "preparing",       label: "Preparing" },
  { value: "out_for_delivery",label: "Out for Delivery" },
  { value: "delivered",       label: "Delivered" },
  { value: "cancelled",       label: "Cancelled" },
];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function statusLabel(status: string) {
  return ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function statusBadge(status: string) {
  const base = "inline-flex items-center px-2.5 py-1 rounded-full text-xs border font-medium";
  switch (status) {
    case "pending_payment":   return `${base} border-amber-300/80 dark:border-amber-500/40 text-amber-700 dark:text-amber-200 bg-amber-50/60 dark:bg-amber-900/20`;
    case "submitted":         return `${base} border-blue-300/80 dark:border-blue-500/40 text-blue-700 dark:text-blue-200 bg-blue-50/60 dark:bg-blue-900/20`;
    case "preparing":         return `${base} border-violet-300/80 dark:border-violet-500/40 text-violet-700 dark:text-violet-200 bg-violet-50/60 dark:bg-violet-900/20`;
    case "out_for_delivery":  return `${base} border-orange-300/80 dark:border-orange-500/40 text-orange-700 dark:text-orange-200 bg-orange-50/60 dark:bg-orange-900/20`;
    case "delivered":         return `${base} border-emerald-300/80 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/20`;
    case "cancelled":         return `${base} border-red-300/80 dark:border-red-500/40 text-red-600 dark:text-red-300 bg-red-50/60 dark:bg-red-900/20`;
    default:                  return `${base} border-zinc-300/80 dark:border-zinc-500/40 text-zinc-600 dark:text-zinc-300 bg-zinc-50/60 dark:bg-zinc-900/20`;
  }
}

export default function ManagerOrdersPage() {
  const [orders, setOrders] = useState<ManagerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${BASE_URL}/manager/orders`);
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = (await res.json()) as ManagerOrder[];
      setOrders(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  async function updateOrderStatus(orderId: number, newStatus: string) {
    try {
      setUpdatingOrderId(orderId);
      const res = await fetch(`${BASE_URL}/manager/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail ?? `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o)));
    } catch (e: any) {
      setError(`Failed to update order ${orderId}: ${e?.message ?? "Unknown error"}`);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  useEffect(() => { loadOrders(); }, []);

  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      o.recipient_name.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      String(o.id).includes(q);
    return matchStatus && matchSearch;
  });

  // Summary counts
  const counts = ORDER_STATUSES.reduce((acc, s) => {
    acc[s.value] = orders.filter((o) => o.status === s.value).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <ManagerNavbar />
      <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-zinc-100 to-zinc-100 dark:from-zinc-950 dark:via-emerald-950/20 dark:to-zinc-950 p-6">
        <div className="mx-auto w-full max-w-6xl">
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-7 shadow-xl shadow-black/10 dark:shadow-black/30">

            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Orders &amp; History
                </h1>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                  View and manage all customer orders
                </p>
              </div>
              <button
                onClick={loadOrders}
                className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-white/60 dark:hover:bg-zinc-900/30 transition-colors self-start"
              >
                Refresh
              </button>
            </div>

            {/* Status summary pills */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                  filterStatus === "all"
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                    : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                }`}
              >
                All ({orders.length})
              </button>
              {ORDER_STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setFilterStatus(s.value)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                    filterStatus === s.value
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                      : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  {s.label} ({counts[s.value] ?? 0})
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="mt-4">
              <input
                className="w-full md:w-80 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 text-sm"
                placeholder="Search by name, email, or order ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Error */}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            {/* Orders table */}
            <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700/50">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50/60 dark:bg-zinc-900/40">
                  <tr className="text-left text-zinc-600 dark:text-zinc-300">
                    {["Order #", "Customer", "Email", "Address", "Date", "Total", "Status", "Update"].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700/50">
                  {loading && (
                    <tr>
                      <td className="px-4 py-6 text-zinc-500 dark:text-zinc-400" colSpan={8}>
                        Loading orders…
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-zinc-500 dark:text-zinc-400" colSpan={8}>
                        No orders found.
                      </td>
                    </tr>
                  )}
                  {filtered.map((o) => (
                    <tr key={o.id} className="text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50/40 dark:hover:bg-zinc-900/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-medium">#{o.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{o.recipient_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300 text-xs">{o.email}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 max-w-[160px] truncate">{o.delivery_address}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">${o.total.toFixed(2)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={statusBadge(o.status)}>{statusLabel(o.status)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          disabled={updatingOrderId === o.id}
                          value={o.status}
                          onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                          className="px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm disabled:opacity-50 transition-colors"
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s.value} value={s.value} className="bg-white dark:bg-zinc-800">
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer count */}
            {!loading && (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Showing {filtered.length} of {orders.length} orders
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}