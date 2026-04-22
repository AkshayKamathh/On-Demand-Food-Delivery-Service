// src/components/manager/ManagerNavbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  BarChart2,
  UserCircle,
  Menu,
  X,
  Leaf,
} from "lucide-react";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";

const NAV_LINKS = [
  { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/orders",    label: "Orders",    icon: ShoppingBag },
  { href: "/manager/sales",     label: "Sales",     icon: BarChart2 },
  { href: "/manager/account",   label: "Account",   icon: UserCircle },
];

export default function ManagerNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-700/50 bg-emerald-500/10 dark:bg-zinc-950/80 backdrop-blur-md">
        {/* Brand */}
        <Link
          href="/manager/dashboard"
          className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-lg tracking-tight"
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500 text-white">
            <Leaf className="h-4 w-4" />
          </span>
          OFS <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-1">Manager</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggleButton />

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 pt-[57px]">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700/50 px-4 py-4 flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}