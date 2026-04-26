"use client";

import { useEffect, useMemo, useState } from "react";
import ManagerNavbar from "@/components/manager/ManagerNavbar";
import { DollarSign, ShoppingBag, Users, Package } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SalesSummaryResponse = {
  year: number;
  stats: {
    total_revenue: number;
    total_orders: number;
    unique_customers: number;
    items_sold: number;
  };
  monthly_revenue: { month: string; revenue: number }[];
  category_breakdown: { category: string; revenue: number; pct: number }[];
  top_products: { name: string; sku: string; units: number; revenue: number }[];
};

const CATEGORY_COLORS: Record<string, string> = {
  Fruits: "bg-emerald-500",
  Vegetables: "bg-sky-500",
  Dairy: "bg-amber-400",
  Bakery: "bg-violet-500",
  "Meat & Seafood": "bg-rose-500",
  Uncategorized: "bg-zinc-500",
};

export default function ManagerSalesPage() {
  const [summary, setSummary] = useState<SalesSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${BASE_URL}/manager/sales/summary?year=${selectedYear}`);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as SalesSummaryResponse;
        if (!cancelled) setSummary(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load sales summary");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  const monthlyRevenue = summary?.monthly_revenue ?? [];
  const categoryBreakdown =
    summary?.category_breakdown.map((item) => ({
      ...item,
      color: CATEGORY_COLORS[item.category] ?? "bg-zinc-500",
    })) ?? [];
  const topProducts = summary?.top_products ?? [];

  const statCards = [
    {
      label: "Total Revenue (YTD)",
      value: `$${Number(summary?.stats.total_revenue ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      icon: DollarSign,
    },
    {
      label: "Total Orders",
      value: Number(summary?.stats.total_orders ?? 0).toLocaleString(),
      icon: ShoppingBag,
    },
    {
      label: "Unique Customers",
      value: Number(summary?.stats.unique_customers ?? 0).toLocaleString(),
      icon: Users,
    },
    {
      label: "Items Sold",
      value: Number(summary?.stats.items_sold ?? 0).toLocaleString(),
      icon: Package,
    },
  ];

  const maxRevenue = useMemo(
    () => Math.max(1, ...monthlyRevenue.map((m) => m.revenue)),
    [monthlyRevenue],
  );

  return (
    <>
      <ManagerNavbar />
      <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 p-6">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-7 shadow-xl shadow-black/10 dark:shadow-black/30">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Sales &amp; Reports
                </h1>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                  Revenue analytics and product performance for {summary?.year ?? selectedYear}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="sales-year"
                  className="text-sm text-zinc-600 dark:text-zinc-300"
                >
                  Year
                </label>
                <select
                  id="sales-year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white/80 dark:bg-zinc-900/40 text-zinc-900 dark:text-zinc-100 text-sm"
                >
                  {Array.from({ length: 5 }, (_, idx) => currentYear - idx).map((year) => (
                    <option key={year} value={year} className="bg-white dark:bg-zinc-900">
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">{label}</span>
                    <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15">
                      <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 dark:shadow-black/30">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Monthly Revenue</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Full year overview</p>

              <div className="mt-6 flex items-end gap-2 h-48">
                {monthlyRevenue.map(({ month, revenue }) => {
                  const heightPct = Math.round((revenue / maxRevenue) * 100);
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="relative w-full flex justify-center">
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-2 py-0.5 rounded-lg whitespace-nowrap z-10 pointer-events-none">
                          ${revenue.toLocaleString()}
                        </span>
                        <div
                          className="w-full rounded-t-lg bg-emerald-500/80 hover:bg-emerald-500 transition-colors cursor-default"
                          style={{ height: `${heightPct * 1.8}px` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{month}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 dark:shadow-black/30">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">By Category</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Revenue share breakdown</p>

              <div className="mt-6 space-y-4">
                {categoryBreakdown.length === 0 && !loading && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No paid sales data for this year.</p>
                )}
                {categoryBreakdown.map(({ category, pct, color }) => (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-zinc-700 dark:text-zinc-200 font-medium">{category}</span>
                      <span className="text-zinc-500 dark:text-zinc-400">{pct}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-700/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                {categoryBreakdown.map(({ category, color }) => (
                  <div key={category} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
                    {category}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-7 shadow-xl shadow-black/10 dark:shadow-black/30">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Top Selling Products</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Ranked by units sold this period</p>
              </div>
              <button className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors shadow-sm">
                Export CSV
              </button>
            </div>

            <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700/50">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50/60 dark:bg-zinc-900/40">
                  <tr className="text-left text-zinc-600 dark:text-zinc-300">
                    <th className="px-4 py-3 font-medium">Rank</th>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Units Sold</th>
                    <th className="px-4 py-3 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700/50">
                  {!loading && topProducts.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-zinc-500 dark:text-zinc-400" colSpan={5}>
                        No paid product sales for this year.
                      </td>
                    </tr>
                  )}
                  {topProducts.map((p, i) => (
                    <tr key={p.sku} className="text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50/40 dark:hover:bg-zinc-900/20 transition-colors">
                      <td className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">#{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{p.sku}</td>
                      <td className="px-4 py-3">{p.units.toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium text-emerald-600 dark:text-emerald-400">
                        ${p.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {loading && (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Loading sales data…</p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
