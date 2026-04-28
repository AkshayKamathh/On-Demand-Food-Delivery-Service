"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X, Minus, Plus, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/cn";

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUANTITY_MAX = 999;

function CartLine({
  item,
}: {
  item: {
    id: number;
    name: string;
    price: number;
    quantity: number;
    image: string | null;
  };
}) {
  const { updateQuantity, pendingItemIds } = useCart();
  const isPending = pendingItemIds.has(item.id);
  const [draftQuantity, setDraftQuantity] = useState<string>(
    String(item.quantity)
  );

  useEffect(() => {
    setDraftQuantity(String(item.quantity));
  }, [item.quantity]);

  const commitDraft = () => {
    const parsed = Number.parseInt(draftQuantity, 10);
    if (!Number.isFinite(parsed)) {
      setDraftQuantity(String(item.quantity));
      return;
    }
    const clamped = Math.max(0, Math.min(parsed, QUANTITY_MAX));
    if (clamped !== item.quantity) {
      updateQuantity(item.id, clamped);
    } else {
      setDraftQuantity(String(item.quantity));
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors mb-3">
      <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden">
        {typeof item.image === "string" && item.image.startsWith("http") ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : null}
        <div
          className={cn(
            "w-full h-full flex items-center justify-center text-lg bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-zinc-800 dark:to-emerald-900",
            typeof item.image === "string" && item.image.startsWith("http")
              ? "hidden"
              : "flex"
          )}
        >
          🛒
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-50 truncate">
          {item.name}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          ${item.price.toFixed(2)} each
        </p>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Decrease quantity of ${item.name}`}
          onClick={() => updateQuantity(item.id, item.quantity - 1)}
          className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={item.quantity <= 0}
        >
          <Minus className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draftQuantity}
          onChange={(e) =>
            setDraftQuantity(e.target.value.replace(/[^0-9]/g, ""))
          }
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setDraftQuantity(String(item.quantity));
              e.currentTarget.blur();
            }
          }}
          aria-label={`Quantity of ${item.name}`}
          className={cn(
            "w-10 text-center font-medium text-sm rounded-md border bg-transparent",
            "border-zinc-300 dark:border-zinc-600",
            "text-zinc-900 dark:text-zinc-50",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/40",
            isPending && "opacity-70"
          )}
        />
        <button
          type="button"
          aria-label={`Increase quantity of ${item.name}`}
          onClick={() => updateQuantity(item.id, item.quantity + 1)}
          className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={item.quantity >= QUANTITY_MAX}
        >
          <Plus className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
        </button>
      </div>

      <div className="text-right ml-2">
        <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
          ${(item.price * item.quantity).toFixed(2)}
        </p>
      </div>
    </div>
  );
}

export default function Cart({ isOpen, onClose }: CartProps) {
  const {
    cartItems,
    cartCount,
    subtotal,
    totalWeight,
    deliveryFee,
    total,
    cartError,
    isCartReady,
  } = useCart();

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-all ${
        isOpen ? "flex" : "hidden"
      }`}
    >
      <div className="w-100 ml-auto bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-700 backdrop-blur-xl shadow-2xl flex flex-col h-full">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Your Cart ({isCartReady ? cartCount : "…"})
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!isCartReady ? (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
              <p className="text-sm animate-pulse">Loading your cart…</p>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-zinc-400" />
              <p className="text-lg mb-4">Your cart is empty</p>
              <Link
                href="/userDashboard"
                className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors"
                onClick={onClose}
              >
                Start Shopping
              </Link>
            </div>
          ) : (
            cartItems.map((item) => <CartLine key={item.id} item={item} />)
          )}
        </div>

        <div className="p-6 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 space-y-3">
          {cartError && (
            <div className="rounded-lg border border-red-300/80 dark:border-red-500/40 bg-red-50/60 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {cartError}
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">Subtotal:</span>
            <span className="text-zinc-600 dark:text-zinc-50">
              ${subtotal.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-300">
            <span>Total Weight:</span>
            <span className="text-zinc-600 dark:text-zinc-50">
              {totalWeight.toFixed(1)} lbs
            </span>
          </div>

          <div
            className={`flex justify-between text-sm ${
              totalWeight <= 20
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-600 dark:text-zinc-300"
            }`}
          >
            <span>Delivery Fee:</span>
            <span>
              {totalWeight <= 20 ? "FREE" : `$${deliveryFee.toFixed(2)}`}
            </span>
          </div>

          <div className="flex justify-between text-lg font-bold pt-2 border-t text-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>

          <Link
            href="/checkout"
            className={cn(
              "w-full block text-center py-3 bg-emerald-500 text-zinc-950 rounded-xl font-semibold shadow-lg hover:bg-emerald-400 transition-all text-sm",
              cartItems.length === 0 && "pointer-events-none opacity-50"
            )}
            onClick={onClose}
            aria-disabled={cartItems.length === 0}
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
