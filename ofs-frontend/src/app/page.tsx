import Link from "next/link";

const features = [
  {
    title: "On-demand delivery",
    description:
      "Order from nearby stores and get groceries delivered in under 30 minutes.",
  },
  {
    title: "Live order tracking",
    description:
      "Track your driving robot in real time, from OFS Grocery to your doorstep.",
  },
  {
    title: "No delivery fee on orders over 25lbs",
    description:
      "Great deal for families buying in bulk or weekly shopping.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 text-zinc-900 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 dark:text-violet-50">
      {/* SECTION */}
      <section className="px-6 py-16 md:py-24 lg:py-28 max-w-6xl mx-auto">
        <div className="grid gap-10 md:grid-cols-2 items-center">
          {/* Left area*/}
          <div className="space-y-6">

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Groceries, delivered
              <span className="text-emerald-600 dark:text-emerald-400"> exactly when you need them.</span>
            </h1>

            <p className="text-zinc-600 dark:text-white max-w-xl text-sm md:text-base">
              OFS connects you to our Grocery Store, optimizes your cart, and keeps
              you updated at every step—from order received to delivered.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-zinc-100 dark:text-zinc-900 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors"
              >
                Get started for free
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-emerald-500 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-100 dark:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 transition-colors"
              >
                Sign in
              </Link>
            </div>

            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-white">
              <span>• No delivery fees on orders over 25 lbs</span>
              <span>• Cancel anytime</span>
            </div>
          </div>

          {/* Right: map + order details */}
          <div className="relative">
            <div className="absolute -inset-4 bg-emerald-500/10 dark:bg-emerald-500/10 blur-3xl rounded-3xl" />

            <div className="relative rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 overflow-hidden shadow-xl">
              {/* Map image */}
              <div className="relative h-60 w-full">
                <img
                  src="/ofs-map.png"
                  alt="Map showing route from OFS Grocery to delivery location"
                  className="h-full w-full object-cover"
                />

                {/* OFS store marker */}
                <div className="absolute left-14 top-8 flex flex-col items-center gap-1">
                  <span className="rounded-full bg-white/90 dark:bg-zinc-950/80 px-2 py-0.5 text-[10px] font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
                    OFS Grocery
                  </span>
              
                </div>

                {/* Delivery location */}
                <div className="absolute right-16 bottom-16 flex flex-col items-center gap-1">
                  <span className="rounded-full bg-white/90 dark:bg-zinc-950/80 px-2 py-0.5 text-[10px] font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
                    Delivery location
                  </span>
                </div>
              </div>

              {/* Order detail */}
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">Order #</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      OFS-2026-1843
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-medium text-emerald-500 dark:text-emerald-400">
                    Preparing Order
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-zinc-100/80 dark:bg-zinc-900/70 px-3 py-2">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500">Weight</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">7.4 kg</p>
                  </div>
                  <div className="rounded-xl bg-zinc-100/80 dark:bg-zinc-900/70 px-3 py-2">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500">Total</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">$46.30</p>
                  </div>
                  <div className="rounded-xl bg-zinc-100/80 dark:bg-zinc-900/70 px-3 py-2">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500">ETA</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">18-22 min</p>
                  </div>
                </div>

                {/* Order prog */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                    Order progress
                  </p>

                  <ol className="flex flex-col gap-2 text-xs">
                    {[
                      { label: "Order received", state: "done" },
                      { label: "Preparing order", state: "active" },
                      { label: "Out for delivery", state: "pending" },
                      { label: "Delivered", state: "pending" },
                    ].map((step, idx) => (
                      <li key={step.label} className="flex items-center gap-2">
                        <span
                          className={[
                            "flex h-4 w-4 items-center justify-center rounded-full border text-[9px]",
                            step.state === "done" &&
                              "border-emerald-500 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400 dark:bg-emerald-400/10 dark:text-emerald-400",
                            step.state === "active" &&
                              "border-amber-500 bg-amber-500/10 text-amber-500 dark:border-amber-400 dark:bg-amber-400/10 dark:text-amber-400",
                            step.state === "pending" &&
                              "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-zinc-500",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {step.state === "done" ? "✓" : idx + 1}
                        </span>
                        <span
                          className={[
                            "text-zinc-600 dark:text-zinc-400",
                            step.state === "done" && "text-emerald-600 dark:text-emerald-400",
                            step.state === "active" && "text-amber-600 dark:text-amber-400",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {step.label}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-16 md:pb-24 max-w-5xl mx-auto">
        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Everything you need for fast grocery delivery
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Built for busy students, families, and elderly across San Jose.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/60 p-4 hover:border-emerald-500/60 transition-colors"
            >
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">
                {f.title}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section className="px-6 pb-12 max-w-4xl mx-auto">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-emerald-100/60 via-white to-zinc-50 dark:from-emerald-500/10 dark:via-zinc-950 dark:to-zinc-950 px-6 py-8 md:px-10 md:py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Ready to place your first OFS order?
            </h3>
            <p className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Create a free OFS account.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-zinc-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 transition-colors"
          >
            Get started
          </Link>
        </div>
      </section>
    </main>
  );
}
