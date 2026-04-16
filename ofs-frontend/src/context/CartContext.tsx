"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
  addToCart: (item: {
    id: number;
    name: string;
    price: number;
    weight: string;
    image: string | null;
  }) => Promise<void>;
  updateQuantity: (id: number, quantity: number) => Promise<void>;
  loadCart: () => Promise<void>;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const loadCart = async () => {
    let headers: Record<string, string>;
    try {
      headers = await getAuthHeaders();
    } catch {
      setCartItems([]);
      return;
    }

    try {
      const res = await fetchWithTimeout(
        "http://localhost:8000/cart/items",
        { headers },
        10000
      );

      if (!res.ok) {
        setCartItems([]);
        return;
      }

      const dataJson = await res.json();
      setCartItems(
        dataJson.map((item: any) => ({
          id: item.id,
          item_id: item.item_id,
          name: item.description,
          price: Number(item.price ?? 0),
          weight: `${Number(item.weight ?? 0).toFixed(1)} lb`,
          quantity: item.quantity,
          image: item.image_url ?? null,
        }))
      );
    } catch {
      setCartItems([]);
    }
  };

  const addToCart = async (item: {
    id: number;
    name: string;
    price: number;
    weight: string;
    image: string | null;
  }) => {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(
      "http://localhost:8000/cart/items",
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
      throw new Error(`Failed to add item to cart: ${text}`);
    }

    const saved = await res.json();

    setCartItems((prev) => {
      const existing = prev.find((x) => x.item_id === saved.item_id);
      if (existing) {
        return prev.map((x) =>
          x.item_id === saved.item_id ? { ...x, quantity: saved.quantity } : x
        );
      }

      return [
        ...prev,
        {
          id: saved.id,
          item_id: saved.item_id,
          name: saved.description ?? item.name,
          price: Number(saved.price ?? item.price),
          weight: `${Number(saved.weight ?? 0).toFixed(1)} lb`,
          quantity: saved.quantity,
          image: saved.image_url ?? item.image,
        },
      ];
    });
  };

  const updateQuantity = async (id: number, quantity: number) => {
    if (quantity <= 0) {
      const headers = await getAuthHeaders();
      await fetchWithTimeout(
        "http://localhost:8000/cart/items",
        { method: "DELETE", headers },
        10000
      );
      setCartItems([]);
      return;
    }

    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(
      `http://localhost:8000/cart/items/${id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ quantity }),
      },
      10000
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update cart item: ${text}`);
    }

    const saved = await res.json();
    setCartItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, quantity: saved.quantity } : x))
    );
  };

  useEffect(() => {
  const init = async () => {
    await loadCart();
  };

  init().catch(console.error);

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      if (session) {
        await loadCart();
      } else {
        setCartItems([]);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalWeight = cartItems.reduce(
    (sum, item) => sum + item.quantity * Number(item.weight.replace(" lb", "")),
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
      addToCart,
      updateQuantity,
      loadCart,
    }),
    [cartItems, cartCount, subtotal, totalWeight, deliveryFee, total]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
