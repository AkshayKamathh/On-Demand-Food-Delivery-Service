export default function ContactPage() {
  return (
    <main className="min-h-screen pt-10 bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 text-zinc-900 dark:text-violet-50">
      <div className="mx-auto w-full max-w-4xl bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl shadow-black/10 dark:shadow-black/30">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Contact OFS
        </h1>

        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          For questions about your order, delivery, or your account, reach out here:
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Support Contact Details</h2>
            <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
              <div><span className="text-zinc-600 dark:text-zinc-300">Email:</span> support@ofs.example</div>
              <div><span className="text-zinc-600 dark:text-zinc-300">Phone:</span> (408) 555-0123</div>
              <div><span className="text-zinc-600 dark:text-zinc-300">Location:</span> Downtown San Jose</div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Message Us</h2>

            <div className="mt-3 space-y-3">
              <input
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
                placeholder="Your email"
              />
              <input
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
                placeholder="Subject"
              />
              <textarea
                className="w-full min-h-[120px] px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
                placeholder="How can we help?"
              />
              <button className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                Send
              </button>
            </div>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="/dashboard/about"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            About OFS
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