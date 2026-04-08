"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useCart } from "@/context/CartContext";
import { getAuthHeaders } from "@/lib/authHeaders";
import { supabase } from "@/lib/supabaseClient";

const API_BASE_URL = "http://localhost:8000";

type CheckoutSummaryItem = {
  item_id: number;
  description: string;
  quantity: number;
  price: number;
  weight: number;
  line_total: number;
};

type CheckoutSummary = {
  items: CheckoutSummaryItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  total_weight: number;
};

type AddressSuggestion = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
};

type ValidatedAddress = {
  address: string;
  latitude: number;
  longitude: number;
};

export default function CheckoutPage() {
  const { cartItems, loadCart } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressValidationLoading, setAddressValidationLoading] = useState(false);
  const [validatedAddress, setValidatedAddress] = useState<ValidatedAddress | null>(null);
  const [addressError, setAddressError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmationStarted = useRef(false);

  const refreshSummary = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/checkout/summary`, {
        headers: await getAuthHeaders(),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 400 && text.includes("Cart is empty")) {
          setSummary(null);
          setSummaryError("");
          return;
        }
        throw new Error(text || "Unable to load checkout summary");
      }

      const payload = (await res.json()) as CheckoutSummary;
      setSummary(payload);
      setSummaryError("");
    } catch (error) {
      setSummary(null);
      setSummaryError(error instanceof Error ? error.message : "Unable to load checkout summary");
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      setEmail(user.email ?? "");
      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        [user.user_metadata?.first_name, user.user_metadata?.last_name]
          .filter(Boolean)
          .join(" ");
      setName(displayName || "");
      await refreshSummary();
    };

    checkAuth().catch(console.error);
  }, [router]);

  useEffect(() => {
    const status = searchParams.get("status");
    const orderId = searchParams.get("order_id");
    const sessionId = searchParams.get("session_id");

    if (status === "cancelled") {
      setCheckoutError("Stripe checkout was cancelled. Your cart has not been submitted.");
      return;
    }

    if (status !== "success" || !orderId || !sessionId || confirmationStarted.current) {
      return;
    }

    confirmationStarted.current = true;

    const confirmOrder = async () => {
      try {
        setConfirmationLoading(true);
        setCheckoutError("");
        const res = await fetch(`${API_BASE_URL}/checkout/confirm`, {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            order_id: Number(orderId),
            session_id: sessionId,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Unable to confirm order");
        }

        const payload = await res.json();
        setConfirmationMessage(
          `Order #${payload.order_id} is confirmed and payment was received successfully.`
        );
        await loadCart();
        await refreshSummary();
        router.replace("/checkout");
      } catch (error) {
        setCheckoutError(error instanceof Error ? error.message : "Unable to confirm order");
      } finally {
        setConfirmationLoading(false);
      }
    };

    confirmOrder().catch(console.error);
  }, [loadCart, router, searchParams]);

  useEffect(() => {
    const trimmedAddress = address.trim();

    if (trimmedAddress.length < 3 || validatedAddress?.address === trimmedAddress) {
      setSuggestions([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setAddressLookupLoading(true);
        const params = new URLSearchParams({ q: trimmedAddress });
        const res = await fetch(`${API_BASE_URL}/checkout/address/search?${params.toString()}`, {
          headers: await getAuthHeaders(),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Unable to search addresses");
        }

        const payload = await res.json();
        setSuggestions(payload.suggestions ?? []);
      } catch (error) {
        console.error(error);
        setSuggestions([]);
      } finally {
        setAddressLookupLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [address, validatedAddress]);

  const handleValidateAddress = async () => {
    try {
      setAddressValidationLoading(true);
      setAddressError("");
      setCheckoutError("");

      const res = await fetch(`${API_BASE_URL}/checkout/address/validate`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ address: address.trim() }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to validate address");
      }

      const payload = (await res.json()) as ValidatedAddress;
      setValidatedAddress(payload);
      setAddress(payload.address);
      setSuggestions([]);
    } catch (error) {
      setValidatedAddress(null);
      setAddressError(error instanceof Error ? error.message : "Unable to validate address");
    } finally {
      setAddressValidationLoading(false);
    }
  };

  const handleStartCheckout = async () => {
    if (!name.trim() || !email.trim()) {
      setCheckoutError("Please complete your name and email before continuing to payment.");
      return;
    }

    if (!validatedAddress) {
      setCheckoutError("Please validate your delivery address before continuing to payment.");
      return;
    }

    try {
      setCheckoutLoading(true);
      setCheckoutError("");

      const res = await fetch(`${API_BASE_URL}/checkout/session`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          full_name: name.trim(),
          email: email.trim(),
          address: validatedAddress.address,
          delivery_notes: deliveryNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to create Stripe checkout session");
      }

      const payload = await res.json();
      window.location.href = payload.checkout_url;
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Unable to create Stripe checkout session"
      );
      setCheckoutLoading(false);
    }
  };

  const lineItems = summary?.items ?? [];
  const subtotal = summary?.subtotal ?? 0;
  const totalWeightLb = summary?.total_weight ?? 0;
  const deliveryFee = summary?.delivery_fee ?? 0;
  const total = summary?.total ?? 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 text-zinc-900 dark:text-violet-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Checkout</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-200">
              Review your order, validate the delivery address, and pay with Stripe.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/userDashboard"
              className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/20 hover:bg-white/70 dark:hover:bg-zinc-900/30 transition"
            >
              Back to Products
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-6">
            <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Delivery Information</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Use Mapbox-backed address suggestions, then validate the address before payment.
              </p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent placeholder:text-zinc-500"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent placeholder:text-zinc-500"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className="md:col-span-2 w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent placeholder:text-zinc-500"
                  placeholder="Delivery address"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setValidatedAddress(null);
                    setAddressError("");
                  }}
                />
                <textarea
                  className="md:col-span-2 min-h-24 w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent placeholder:text-zinc-500"
                  placeholder="Delivery notes (optional)"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                />
              </div>

              {suggestions.length > 0 && (
                <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  {suggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.address}-${suggestion.longitude}`}
                      type="button"
                      className="w-full px-4 py-3 text-left bg-white/70 dark:bg-zinc-900/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-b last:border-b-0 border-zinc-200 dark:border-zinc-800"
                      onClick={() => {
                        setAddress(suggestion.address);
                        setValidatedAddress({
                          address: suggestion.address,
                          latitude: suggestion.latitude,
                          longitude: suggestion.longitude,
                        });
                        setSuggestions([]);
                        setAddressError("");
                      }}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {addressLookupLoading && (
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">
                    Searching Mapbox suggestions...
                  </span>
                )}
                {validatedAddress && !addressError && (
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">
                    Address validated for delivery.
                  </span>
                )}
              </div>

              {addressError && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-300">{addressError}</p>
              )}
              {summaryError && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-300">{summaryError}</p>
              )}
              {confirmationMessage && (
                <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                  {confirmationMessage}
                </p>
              )}
              {confirmationLoading && (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                  Confirming your paid order...
                </p>
              )}
              {checkoutError && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-300">{checkoutError}</p>
              )}
            </div>

            <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Payment</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Stripe Checkout handles card entry and payment confirmation after the backend
                validates your cart and current inventory.
              </p>

              <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-zinc-50/60 dark:bg-zinc-950/30 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <p>1. Validate your delivery address.</p>
                <p>2. We verify the cart and stock on the backend.</p>
                <p>3. Stripe collects payment on a hosted checkout page.</p>
                <p>4. After payment, the order is confirmed and inventory is updated.</p>
              </div>

              <button
                type="button"
                disabled={checkoutLoading || !validatedAddress || lineItems.length === 0}
                className="mt-5 w-full px-4 py-3 rounded-xl bg-emerald-500 text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                title="Validate the address first, then continue to Stripe"
                onClick={handleStartCheckout}
              >
                {checkoutLoading ? "Redirecting to Stripe..." : "Continue to Stripe"}
              </button>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Order Summary</h2>

              <div className="mt-4 space-y-3">
                {lineItems.length > 0 ? (
                  lineItems.map((item) => (
                    <div key={item.item_id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{item.description}</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-300">
                          Qty: {item.quantity} | Weight: {item.weight.toFixed(1)} lb
                        </div>
                      </div>
                      <div className="font-semibold">${item.line_total.toFixed(2)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">
                    {cartItems.length === 0 ? "Your cart is empty." : "Loading checkout summary..."}
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">Total weight</span>
                  <span className="font-medium">{totalWeightLb.toFixed(1)} lb</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">Delivery fee</span>
                  <span className="font-medium">
                    {deliveryFee === 0 ? "Free" : `$${deliveryFee.toFixed(2)}`}
                  </span>
                </div>

                <div className="flex justify-between text-base pt-2">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
