"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getAuthHeaders } from "@/lib/authHeaders";
import { supabase } from "@/lib/supabaseClient";

type CartItem = {
  id: number;
  item_id: number;
  name: string;
  price: number;
  weight: string;
  quantity: number;
  image: string | null;
};

type CartContextType = {
  cartItems: CartItem[];
  cartCount: number;
  subtotal: number;
  totalWeight: number;
  deliveryFee: number;
  total: number;
  cartError: string;
  isCartReady: boolean;
  pendingItemIds: ReadonlySet<number>;
  clearCartError: () => void;
  addToCart: (item: {
    id: number;
    name: string;
    price: number;
    weight: string;
    image: string | null;
  }) => Promise<void>;
  updateQuantity: (id: number, quantity: number) => void;
  loadCart: () => Promise<void>;
};

type PendingUpdate = {
  target: number;
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const PATCH_DEBOUNCE_MS = 250;
const CART_API_URL = "http://localhost:8000/cart/items";

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const userSignal = options.signal ?? null;

  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort();
    } else {
      userSignal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function mapServerItem(item: any, fallback?: Partial<CartItem>): CartItem {
  return {
    id: item.id,
    item_id: item.item_id,
    name: item.description ?? fallback?.name ?? "",
    price: Number(item.price ?? fallback?.price ?? 0),
    weight: `${Number(item.weight ?? 0).toFixed(1)} lb`,
    quantity: item.quantity,
    image: item.image_url ?? fallback?.image ?? null,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartError, setCartError] = useState("");
  const [isCartReady, setIsCartReady] = useState(false);
  const [pendingItemIds, setPendingItemIds] = useState<ReadonlySet<number>>(
    () => new Set()
  );

  const pendingRef = useRef<Map<number, PendingUpdate>>(new Map());

  const clearCartError = useCallback(() => setCartError(""), []);

  useEffect(() => {
    if (!cartError) return;

    const timeoutId = window.setTimeout(() => {
      setCartError("");
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [cartError]);

  const markPending = useCallback((id: number, pending: boolean) => {
    setPendingItemIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const loadCart = useCallback(async () => {
    let headers: Record<string, string>;
    try {
      headers = await getAuthHeaders();
    } catch {
      setCartItems([]);
      setIsCartReady(true);
      return;
    }

    try {
      const res = await fetchWithTimeout(CART_API_URL, { headers }, 10000);

      if (!res.ok) {
        return;
      }

      const dataJson = await res.json();
      setCartError("");
      setCartItems(dataJson.map((item: any) => mapServerItem(item)));
    } catch {
      return;
    } finally {
      setIsCartReady(true);
    }
  }, []);

  const addToCart = useCallback(
    async (item: {
      id: number;
      name: string;
      price: number;
      weight: string;
      image: string | null;
    }) => {
      const headers = await getAuthHeaders();
      const res = await fetchWithTimeout(
        CART_API_URL,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            item_id: item.id,
            quantity: 1,
          }),
        },
        10000
      );

      if (!res.ok) {
        const text = await res.text();
        const message = text || "Failed to add item to cart";
        setCartError(message);
        throw new Error(message);
      }

      const saved = await res.json();
      setCartError("");

      setCartItems((prev) => {
        const existing = prev.find((x) => x.item_id === saved.item_id);
        if (existing) {
          return prev.map((x) =>
            x.item_id === saved.item_id ? { ...x, quantity: saved.quantity } : x
          );
        }

        return [
          ...prev,
          mapServerItem(saved, {
            name: item.name,
            price: item.price,
            image: item.image,
          }),
        ];
      });
    },
    []
  );

  const cancelPending = useCallback((id: number) => {
    const existing = pendingRef.current.get(id);
    if (!existing) return;
    clearTimeout(existing.timer);
    existing.controller.abort();
    pendingRef.current.delete(id);
  }, []);

  const flushUpdate = useCallback(
    async (id: number) => {
      const entry = pendingRef.current.get(id);
      if (!entry) return;

      const { target, controller } = entry;

      try {
        const headers = await getAuthHeaders();

        if (target <= 0) {
          const res = await fetchWithTimeout(
            `${CART_API_URL}/${id}`,
            { method: "DELETE", headers, signal: controller.signal },
            10000
          );
          if (!res.ok && res.status !== 404) {
            const text = await res.text();
            throw new Error(text || "Failed to remove cart item");
          }
          setCartError("");
          setCartItems((prev) => prev.filter((x) => x.id !== id));
        } else {
          const res = await fetchWithTimeout(
            `${CART_API_URL}/${id}`,
            {
              method: "PATCH",
              headers,
              body: JSON.stringify({ quantity: target }),
              signal: controller.signal,
            },
            10000
          );
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to update cart item");
          }
          const saved = await res.json();
          setCartError("");
          setCartItems((prev) =>
            prev.map((x) => (x.id === id ? { ...x, ...mapServerItem(saved, x) } : x))
          );
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          return;
        }
        setCartError(
          err instanceof Error ? err.message : "Failed to update cart item"
        );
        await loadCart();
      } finally {
        if (pendingRef.current.get(id) === entry) {
          pendingRef.current.delete(id);
          markPending(id, false);
        }
      }
    },
    [loadCart, markPending]
  );

  const updateQuantity = useCallback(
    (id: number, quantity: number) => {
      cancelPending(id);

      setCartItems((prev) => {
        if (quantity <= 0) {
          return prev.filter((x) => x.id !== id);
        }
        return prev.map((x) => (x.id === id ? { ...x, quantity } : x));
      });

      const controller = new AbortController();
      const timer = setTimeout(() => {
        flushUpdate(id).catch(() => {});
      }, PATCH_DEBOUNCE_MS);

      pendingRef.current.set(id, { target: quantity, controller, timer });
      markPending(id, true);
    },
    [cancelPending, flushUpdate, markPending]
  );

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      await loadCart();
    };

    init().catch(console.error);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      if (session) {
        await loadCart();
      } else {
        setCartItems([]);
        setIsCartReady(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      pendingRef.current.forEach((entry) => {
        clearTimeout(entry.timer);
        entry.controller.abort();
      });
      pendingRef.current.clear();
    };
  }, [loadCart]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const totalWeight = cartItems.reduce(
    (sum, item) =>
      sum + item.quantity * Number(item.weight.replace(" lb", "")),
    0
  );
  const deliveryFee = totalWeight <= 20 ? 0 : 10;
  const total = subtotal + deliveryFee;

  const value = useMemo(
    () => ({
      cartItems,
      cartCount,
      subtotal,
      totalWeight,
      deliveryFee,
      total,
      cartError,
      isCartReady,
      pendingItemIds,
      clearCartError,
      addToCart,
      updateQuantity,
      loadCart,
    }),
    [
      cartItems,
      cartCount,
      subtotal,
      totalWeight,
      deliveryFee,
      total,
      cartError,
      isCartReady,
      pendingItemIds,
      clearCartError,
      addToCart,
      updateQuantity,
      loadCart,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {cartError && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[70] max-w-sm">
          <div className="pointer-events-auto rounded-xl border border-red-300/80 bg-white px-4 py-3 shadow-xl shadow-red-500/10 dark:border-red-500/40 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  Cart update blocked
                </p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                  {cartError}
                </p>
              </div>
              <button
                type="button"
                onClick={clearCartError}
                className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Dismiss cart error"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
