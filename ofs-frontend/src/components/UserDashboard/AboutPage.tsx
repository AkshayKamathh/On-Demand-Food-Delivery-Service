export default function AboutPage() {
  return (
     <main className="min-h-screen animate-fade-slide-up delay-100 pt-10 bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 text-zinc-900 dark:text-violet-50">
      <div className="mx-auto w-full max-w-4xl bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl shadow-black/10 dark:shadow-black/30">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          About OFS
        </h1>

        <p className="animate-fade-slide-up delay-200 mt-3 text-zinc-600 dark:text-zinc-300">
          OFS is a local organic food retailer in Downtown San Jose. Our mission is to allow customers to order fresh, organic produce 
          online and have it delivered right to their door by our fleet of delivery robots. We offer a wide selection of fruits, vegetables, and other organic products sourced from local farms. 
          Our delivery robots optimize routes to ensure fast and efficient delivery while minimizing environmental impact.
        </p>

        <div className="animate-fade-slide-up delay-300 mt-8 grid gap-4">
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">What We Offer</h2>
            <ul className="mt-3 list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-200">
              <li>Wide catalog of organic products</li>
              <li>Online order checkout and payment</li>
              <li>Local delivery with free delivery on qualifying orders</li>
              <li>Live customer support</li>
            </ul>
          </section>

          <section className="animate-fade-slide-up delay-400 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Delivery Rules</h2>
            <ul className="mt-3 list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-200">
              <li>Orders under 20 lbs: free delivery</li>
              <li>Orders of 20 lbs or more: $10 delivery fee</li>
              <li>Maximum order weight: 200 lbs</li>
            </ul>
          </section>
        </div>

        <div className="animate-fade-slide-up delay-500 mt-10 flex flex-wrap gap-3">
          <a
            href="/dashboard/contact"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            Contact Us
          </a>
          <a
            href="/userDashboard"
            className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-white/60 dark:hover:bg-zinc-900/30"
          >
            Back to Home
          </a>
        </div>
      </div>
    </main>
  );
}