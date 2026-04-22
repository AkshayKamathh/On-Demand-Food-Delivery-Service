// src/components/manager/ManagerNavbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingBag, BarChart2, UserCircle } from "lucide-react";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";

const NAV_LINKS = [
  { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/orders",    label: "Orders",    icon: ShoppingBag },
  { href: "/manager/sales",     label: "Sales",     icon: BarChart2 },
  { href: "/manager/account",   label: "Account",   icon: UserCircle },
];

export default function ManagerNavbar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between p-4 border-b border-zinc-800 bg-emerald-500/20 dark:bg-zinc-950/80 backdrop-blur">
      {/* Brand */}
      <Link href="/manager/dashboard" className="text-xl font-bold text-zinc-50">
        OFS
      </Link>

      {/* Nav links + actions */}
      <div className="flex items-center gap-6">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                active
                  ? "text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}

        <ThemeToggleButton />
      </div>
    </nav>
  );
}