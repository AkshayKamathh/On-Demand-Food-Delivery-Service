// src/components/ui/DashboardNavbar.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingCart, Menu, User as UserIcon } from "lucide-react";
import { useCart } from "@/context/CartContext";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import Cart from "@/components/cart/cart";

export default function DashboardNavbar() {
  const { cartCount, isCartReady } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <nav className="flex items-center justify-between p-4 border-b border-zinc-200 border-zinc-800 bg-emerald-500/20 dark:bg-zinc-950/80 backdrop-blur">
        <Link href="/userDashboard" className="text-xl font-bold text-zinc-50">
          OFS
        </Link>

        <div className="flex items-center gap-4">
          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/userDashboard"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Products
            </Link>
            <Link
              href="/dashboard/about"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              About
            </Link>
            <Link
              href="/dashboard/contact"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Contact
            </Link>
            <Link
              href="/orders"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Orders
            </Link>
            {/* Account link */}
            <Link
              href="/dashboard/account"
              className="flex items-center gap-1 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <UserIcon className="h-4 w-4" />
              Account
            </Link>
          </div>

          {/* Cart Button */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <ShoppingCart className="h-5 w-5" />
            {isCartReady && cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                {cartCount}
              </span>
            )}
          </button>

          <ThemeToggleButton />

          <Link
            href="/checkout"
            className="hidden md:inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors"
          >
            Order Now
          </Link>
        </div>

        <button className="md:hidden p-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
          <Menu className="h-5 w-5" />
        </button>
      </nav>

      <Cart isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
