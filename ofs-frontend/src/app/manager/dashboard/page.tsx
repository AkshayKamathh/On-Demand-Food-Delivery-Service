/*export default function ManagerDashboardPage() 
{
    return (
        <main className="min-h-screen bg-zinc-100 dark:bg-zinc-900 p-6">
            <div className="mx-auto max-w-5xl bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl shadow-black/10 dark:shadow-black/30">
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                Manager Dashboard
                </h1>

                <p className="mt-2 text-zinc-600 dark:text-zinc-300">
                Inventory • Orders • Reports
                </p>
                <div className="mt-6 flex gap-3">
                    <button className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                        Add Item
                    </button>

                    <button className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100">
                        Export
                    </button>
                </div>
            </div>
        </main>
    );
}*/

export default function ManagerDashboardPage() {
  //Hard-coded mock inventory
  const inventory = [
    { sku: "001", name: "Organic Apples", category: "Fruits", weightLb: 1.0, price: 2.49, stock: 42, status: "In Stock" },
    { sku: "002", name: "Organic Bananas", category: "Fruits", weightLb: 2.0, price: 1.99, stock: 8, status: "Low Stock" },
    { sku: "003", name: "Organic Kale", category: "Vegetables", weightLb: 0.5, price: 3.49, stock: 0, status: "Out of Stock" },
    { sku: "004", name: "Brown Rice (2 lb)", category: "Pantry", weightLb: 2.0, price: 4.99, stock: 15, status: "In Stock" },
    { sku: "005", name: "Free-Range Eggs (12)", category: "Dairy", weightLb: 1.5, price: 6.25, stock: 5, status: "Low Stock" },
  ];

  //Hard-coded key performance indicators (KPIs) 
  const kpis = [
    { label: "Today’s Sales", value: "$1,284.50" },
    { label: "Orders In Progress", value: "6" },
    { label: "Low Stock Items", value: "4" },
    { label: "Robot Load", value: "3 / 10 orders" },
  ];

  //Hard-coded recent orders
  const recentOrders = [
    { id: "ORD-1203", customer: "Maria G.", total: "$38.25", weight: "18.3 lb", status: "Preparing" },
    { id: "ORD-1204", customer: "James K.", total: "$64.10", weight: "25.9 lb", status: "Out for delivery" },
    { id: "ORD-1205", customer: "Aisha R.", total: "$22.80", weight: "9.4 lb", status: "Delivered" },
  ];

  return (
    <main className="min-h-screen bg-zinc-100 dark:bg-zinc-900 p-6">
      <div className="mx-auto w-full max-w-6xl">

        {/*Top card wrapper*/}
        <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-7 shadow-xl shadow-black/10 dark:shadow-black/30">

          {/*Header*/}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
                Dashboard
              </h1>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                Inventory • Orders • Reports • Customer Support
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm">
                + Add Inventory Item
              </button>
              <button className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-white/60 dark:hover:bg-zinc-900/30">
                Export Report
              </button>
            </div>
          </div>

          {/*KPIs*/}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-4"
              >
                <div className="text-sm text-zinc-600 dark:text-zinc-300">{k.label}</div>
                <div className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {k.value}
                </div>
              </div>
            ))}
          </div>

          {/*Main layout, inventory on left and side panels on right*/}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/*Inventory*/}
            <section className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Inventory</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    Display and manage inventory items.
                  </p>
                </div>

                {/*Controls*/}
                <div className="flex flex-wrap gap-3">
                  <select className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-transparent text-zinc-900 dark:text-zinc-100">
                    <option className="bg-zinc-900">All Categories</option>
                    <option className="bg-zinc-900">Fruits</option>
                    <option className="bg-zinc-900">Vegetables</option>
                    <option className="bg-zinc-900">Dairy</option>
                    <option className="bg-zinc-900">Pantry</option>
                  </select>

                  <input
                    className="w-full md:w-64 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
                    placeholder="Search products..."
                  />

                  <button className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                    Search
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50/60 dark:bg-zinc-900/40">
                    <tr className="text-left text-zinc-600 dark:text-zinc-300">
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Weight</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Stock</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700/50">
                    {inventory.map((p) => (
                      <tr key={p.sku} className="text-zinc-900 dark:text-zinc-100">
                        <td className="px-4 py-3 whitespace-nowrap">{p.sku}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{p.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">{p.category}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{p.weightLb.toFixed(1)} lb</td>
                        <td className="px-4 py-3 whitespace-nowrap">${p.price.toFixed(2)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{p.stock}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={statusBadge(p.status)}>{p.status}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-white/60 dark:hover:bg-zinc-900/30">
                            Edit
                          </button>
                          <button className="ml-2 px-3 py-1.5 rounded-lg border border-red-300/80 dark:border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-50/60 dark:hover:bg-red-900/20">
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/*Quick update panel*/}
              <div className="mt-5 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Quick Update</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    </p>
                  </div>

                  <button className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                    Save
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input className={inputClass} placeholder="SKU (e.g. APL-001)" />
                  <input className={inputClass} placeholder="New stock (e.g. 50)" />
                  <input className={inputClass} placeholder="New price (e.g. 2.99)" />
                  <select className={inputClass}>
                    <option className="bg-zinc-900">Status: In Stock</option>
                    <option className="bg-zinc-900">Status: Low Stock</option>
                    <option className="bg-zinc-900">Status: Out of Stock</option>
                  </select>
                </div>
              </div>
            </section>

            {/*Right side panels*/}
            <aside className="grid gap-4">

              {/*Orders/Transactions*/}
              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Orders & History</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                </p>

                <div className="mt-4 grid gap-3">
                  {recentOrders.map((o) => (
                    <div key={o.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{o.id}</div>
                        <span className={statusBadge(o.status)}>{o.status}</span>
                      </div>
                      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                        {o.customer} • {o.total} • {o.weight}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-white/60 dark:hover:bg-zinc-900/30">
                          View
                        </button>
                        <button className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-white/60 dark:hover:bg-zinc-900/30">
                          Update Status
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  <button className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 hover:bg-white/60 dark:hover:bg-zinc-900/30">
                    View All Orders
                  </button>
                  <button className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 hover:bg-white/60 dark:hover:bg-zinc-900/30">
                    Transaction History
                  </button>
                </div>
              </section>

              {/*Reports*/}
              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Reports</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Sales and analytics
                </p>

                <div className="mt-4 grid gap-2">
                  <button className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                    View Sales Report
                  </button>
                  <button className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 hover:bg-white/60 dark:hover:bg-zinc-900/30">
                    Export Sales CSV
                  </button>
                </div>
              </section>

              {/*Customer lookup*/}
              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Customer Lookup</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  View customer account info
                </p>

                <div className="mt-4 flex gap-2">
                  <input className={inputClass + " flex-1"} placeholder="Email or User ID..." />
                  <button className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                    Search
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-3">
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">Preview </div>
                  <div className="mt-2 text-sm">
                    <div><span className="text-zinc-600 dark:text-zinc-300">Name:</span> Example Customer</div>
                    <div><span className="text-zinc-600 dark:text-zinc-300">Email:</span> customer@example.com</div>
                    <div><span className="text-zinc-600 dark:text-zinc-300">Role:</span> Customer</div>
                    <div><span className="text-zinc-600 dark:text-zinc-300">Orders:</span> 3 total</div>
                  </div>
                </div>
              </section>
            </aside>
          </div>

        </div>
      </div>
    </main>
  );
}

const inputClass =
  "px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500";

function statusBadge(status) {
  const base =
    "inline-flex items-center px-2.5 py-1 rounded-full text-xs border";

  const s = String(status).toLowerCase();
  if (s.includes("out")) return `${base} border-red-300/80 dark:border-red-500/40 text-red-600 dark:text-red-300 bg-red-50/60 dark:bg-red-900/20`;
  if (s.includes("low")) return `${base} border-amber-300/80 dark:border-amber-500/40 text-amber-700 dark:text-amber-200 bg-amber-50/60 dark:bg-amber-900/20`;
  if (s.includes("deliver")) return `${base} border-sky-300/80 dark:border-sky-500/40 text-sky-700 dark:text-sky-200 bg-sky-50/60 dark:bg-sky-900/20`;
  if (s.includes("prep")) return `${base} border-violet-300/80 dark:border-violet-500/40 text-violet-700 dark:text-violet-200 bg-violet-50/60 dark:bg-violet-900/20`;
  return `${base} border-emerald-300/80 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/20`;
}