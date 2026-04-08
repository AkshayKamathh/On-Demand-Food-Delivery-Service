"use client";

import Link from "next/link"; //Use Link instead of href
import { useMemo, useState, useEffect} from "react"; //Calculate something and cache it, use values that can change while user interacts
import { useCart } from "@/context/CartContext"; //Pull cart data from the cart context
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

//Parse weight strings like "1lb" or "3 lb" using regex for weight computations (only for front-end mockup)
function parseWeightLb(weightString: string) {
  const match = String(weightString).match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

//Read cart items from the cart context, compute the subtotal/total weight/delivery fee/total, and display the delivery info form, order summary, and a placeholder for Stripe payment.
//Note: this is frontend-only mockup code/computations, checkout doesn't work
export default function CheckoutPage() {
  //Get cart items from context (should be an array of items with price, weight, quantity)
  const { cartItems } = useCart() as any;

  //State variables to hold the delivery info form inputs (name, email, address)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const router = useRouter();
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }
    };

    checkAuth();
  }, [router]);

  //Temporary frontend "business-logic" computations for subtotal, weight, etc.
  //Uses memo to only recompute when cartItems changes
  const { subtotal, totalWeightLb, deliveryFee, total } = useMemo(() => {
    const items = Array.isArray(cartItems) ? cartItems : [];

    //Calculate a running total for all items in the cart
    const subtotalCalc = items.reduce((sum: number, item: any) => {
      const qty = item.quantity ?? 1;
      return sum + item.price * qty;
    }, 0);

    //Calculate total weight for delivery fee rules
    const weightCalc = items.reduce((sum: number, item: any) => {
      const qty = item.quantity ?? 1;
      return sum + parseWeightLb(item.weight) * qty;
    }, 0);

    //Delivery fee rule (free vs $10 shipping)
    const fee = weightCalc < 20 ? 0 : 10;
    return {
      subtotal: subtotalCalc,
      totalWeightLb: weightCalc,
      deliveryFee: fee,
      total: subtotalCalc + fee,
    };
  }, [cartItems]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 text-zinc-900 dark:text-violet-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Checkout</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-200">
              Review your order, enter delivery info, and pay.
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

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Delivery + Payment */}
          <section className="lg:col-span-2 space-y-6">
            {/* Delivery info */}
            <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Delivery Information</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                (STATIC FOR FRONTEND MOCKUP: MISSING ADDRESS VALIDATION, DB CONNECTIVITY, ETC)
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
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            {/* Payment (Stripe placeholder) */}
            <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Payment</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                (STRIPE IMPLEMENTATION TO GO HERE)
              </p>

              <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-5">
                <div className="text-sm text-zinc-600 dark:text-zinc-300">
                  Placeholder: Stripe Card/Payment Element
                </div>
              </div>

              <button
                disabled
                className="mt-5 w-full px-4 py-3 rounded-xl bg-emerald-500/60 text-white font-semibold cursor-not-allowed"
                title="Enable once Stripe is wired up"
              >
                Place Order (disabled)
              </button>
            </div>
          </section>

          {/* Right: Order summary */}
          <aside className="space-y-6">
            <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Order Summary</h2>

              <div className="mt-4 space-y-3">
                {Array.isArray(cartItems) && cartItems.length > 0 ? (
                  cartItems.map((item: any) => {
                    const qty = item.quantity ?? 1;
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-300">
                            Qty: {qty} • Weight: {item.weight}
                          </div>
                        </div>
                        <div className="font-semibold">
                          ${(item.price * qty).toFixed(2)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">
                    Your cart is empty.
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