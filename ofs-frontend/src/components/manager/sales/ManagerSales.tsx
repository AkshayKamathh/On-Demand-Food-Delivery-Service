"use client";

import { useState } from "react";
import ManagerNavbar from "@/components/manager/ManagerNavbar";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Package,
} from "lucide-react";

// ── Placeholder / mock data 
// Replace with real API calls to backend later

const MONTHLY_REVENUE = [
  { month: "Jan", revenue: 4200 },
  { month: "Feb", revenue: 5100 },
  { month: "Mar", revenue: 4750 },
  { month: "Apr", revenue: 6300 },
  { month: "May", revenue: 7200 },
  { month: "Jun", revenue: 6800 },
  { month: "Jul", revenue: 8100 },
  { month: "Aug", revenue: 7600 },
  { month: "Sep", revenue: 8900 },
  { month: "Oct", revenue: 9400 },
  { month: "Nov", revenue: 10200 },
  { month: "Dec", revenue: 11500 },
];

const TOP_PRODUCTS = [
  { name: "Bananas", sku: "001", units: 312, revenue: 936 },
  { name: "Tomatoes",    sku: "004", units: 278, revenue: 834 },
  { name: "Lettuce",         sku: "007", units: 241, revenue: 482 },
  { name: "Apples",          sku: "002", units: 215, revenue: 430 },
  { name: "Greek Yogurt",         sku: "015", units: 198, revenue: 594 },
];

const CATEGORY_BREAKDOWN = [
  { category: "Fruits",     pct: 38, color: "bg-emerald-500" },
  { category: "Vegetables", pct: 29, color: "bg-sky-500" },
  { category: "Dairy",      pct: 18, color: "bg-amber-400" },
  { category: "Bakery",     pct: 15, color: "bg-violet-500" },
];

const STAT_CARDS = [
  { label: "Total Revenue (YTD)", value: "$2", icon: DollarSign},
  { label: "Total Orders",        value: "2,341",   icon: ShoppingBag},
  { label: "Unique Customers",    value: "847",     icon: Users},
  { label: "Items Sold",          value: "8,912",   icon: Package},
];

const MAX_REVENUE = Math.max(...MONTHLY_REVENUE.map((m) => m.revenue));


export default function ManagerSalesPage() {


  return (
    <>
      <ManagerNavbar />
      <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-zinc-100 to-zinc-100 dark:from-zinc-950 dark:via-emerald-950/20 dark:to-zinc-950 p-6">
        <div className="mx-auto w-full max-w-6xl space-y-6">

          {/* Header card */}
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-7 shadow-xl shadow-black/10 dark:shadow-black/30">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Sales &amp; Reports - Not Connected to backend yet
                </h1>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                  Revenue analytics and product performance - Mock data for now
                </p>
              </div>
            </div>

            {/* Stat cards */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {STAT_CARDS.map(({ label, value, icon: Icon }) => (
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

          {/* Chart + category breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Bar chart */}
            <section className="lg:col-span-2 bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 dark:shadow-black/30">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Monthly Revenue</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Full year overview</p>

              <div className="mt-6 flex items-end gap-2 h-48">
                {MONTHLY_REVENUE.map(({ month, revenue }) => {
                  const heightPct = Math.round((revenue / MAX_REVENUE) * 100);
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="relative w-full flex justify-center">
                        {/* Tooltip */}
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

            {/* Category breakdown */}
            <section className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl shadow-black/10 dark:shadow-black/30">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">By Category</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Revenue share breakdown</p>

              <div className="mt-6 space-y-4">
                {CATEGORY_BREAKDOWN.map(({ category, pct, color }) => (
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

              {/* Legend */}
              <div className="mt-6 grid grid-cols-2 gap-2">
                {CATEGORY_BREAKDOWN.map(({ category, color }) => (
                  <div key={category} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
                    {category}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Top products table */}
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
                  {TOP_PRODUCTS.map((p, i) => (
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
          </section>

        </div>
      </main>
    </>
  );
}