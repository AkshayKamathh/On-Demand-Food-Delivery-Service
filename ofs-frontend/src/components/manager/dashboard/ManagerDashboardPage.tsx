"use client";

import { useEffect, useState } from "react";

type InventoryItem = {
  sku: string;
  name: string;
  category: string;
  price: number;
  weight_lb: number; // from backend schema
  stock: number;
  status: string;
};

export default function ManagerDashboardPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  //(Optional) keep your existing KPI + orders mock data for now
  const kpis = [
    { label: "Today’s Sales", value: "$1,284.50" },
    { label: "Orders In Progress", value: "6" },
    { label: "Low Stock Items", value: "4" },
    { label: "Robot Load", value: "3 / 10 orders" },
  ];

  const recentOrders = [
    { id: "ORD-1203", customer: "Maria G.", total: "$38.25", weight: "18.3 lb", status: "Preparing" },
    { id: "ORD-1204", customer: "James K.", total: "$64.10", weight: "25.9 lb", status: "Out for delivery" },
    { id: "ORD-1205", customer: "Aisha R.", total: "$22.80", weight: "9.4 lb", status: "Delivered" },
  ];

  const [showAdd, setShowAdd] = useState(false);

  const [newSku, setNewSku] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Fruits");
  const [newWeight, setNewWeight] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newStatus, setNewStatus] = useState("In Stock");

  const [adding, setAdding] = useState(false);

  async function addItem() {
    try {
      setAdding(true);
      setSaveMsg("");
      setError("");

      const sku = newSku.trim();
      const name = newName.trim();

      if (!sku || !name) {
        setSaveMsg("SKU and Name are required.");
        return;
      }

      const priceNum = Number(newPrice);
      const weightNum = Number(newWeight);
      const stockNum = Number(newStock);

      if (!Number.isFinite(priceNum) || priceNum < 0) {
        setSaveMsg("Price must be a valid number (0 or greater).");
        return;
      }
      if (!Number.isFinite(weightNum) || weightNum <= 0) {
        setSaveMsg("Weight must be a valid number (> 0).");
        return;
      }
      if (!Number.isFinite(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
        setSaveMsg("Stock must be a whole number (0 or greater).");
        return;
      }

      const payload = {
        sku,
        name,
        category: newCategory,
        price: priceNum,
        weight_lb: weightNum,
        stock: stockNum,
        status: newStatus,
      };

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const detail = errBody?.detail ? String(errBody.detail) : `HTTP ${res.status}`;
        throw new Error(detail);
      }

      const created = await res.json();

      //Add to table immediately
      setInventory((prev) => [created, ...prev]);

      setSaveMsg(`Added ${created.sku}.`);
      setShowAdd(false);

      //Clear fields
      setNewSku("");
      setNewName("");
      setNewCategory("Fruits");
      setNewWeight("");
      setNewPrice("");
      setNewStock("");
      setNewStatus("In Stock");
    } catch (e: any) {
      setSaveMsg(`Add failed: ${e?.message ?? "Unknown error"}`);
    } finally {
      setAdding(false);
    }
  }

  //Fetch inventory from backend API
  async function loadInventory() {
    try {
      setLoading(true);
      setError("");

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/inventory`);

      if (!res.ok) {
        throw new Error(`Backend error: ${res.status}`);
      }

      const data = (await res.json()) as InventoryItem[];
      setInventory(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  //Update form state
  const [skuInput, setSkuInput] = useState("");
  const [stockInput, setStockInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [statusInput, setStatusInput] = useState("In Stock");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  async function saveUpdate() {
    try {
      setSaving(true);
      setSaveMsg("");
      setError("");

      const sku = skuInput.trim();
      if (!sku) {
        setSaveMsg("Enter a SKU first.");
        return;
      }

      // Build PATCH payload only with fields the user provided
      const payload: any = {};

      if (stockInput.trim() !== "") {
        const stockNum = Number(stockInput);
        if (!Number.isFinite(stockNum) || !Number.isInteger(stockNum)) {
          setSaveMsg("Stock must be a whole number.");
          return;
        }
        payload.stock = stockNum;
      }

      if (priceInput.trim() !== "") {
        const priceNum = Number(priceInput);
        if (!Number.isFinite(priceNum) || priceNum < 0) {
          setSaveMsg("Price must be a valid number (0 or greater).");
          return;
        }
        payload.price = priceNum;
      }

      // Always send status if selected (optional—feel free to require it)
      if (statusInput) {
        payload.status = statusInput;
      }

      // If user didn’t fill anything besides SKU, do nothing
      if (Object.keys(payload).length === 0) {
        setSaveMsg("Enter stock/price/status to update.");
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/inventory/${encodeURIComponent(sku)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // backend sends { detail: "..." } for HTTPException
        const errBody = await res.json().catch(() => null);
        const detail = errBody?.detail ? String(errBody.detail) : `HTTP ${res.status}`;
        throw new Error(detail);
      }

      const updated = await res.json();

      // Update the table immediately: replace the matching item
      setInventory((prev) => prev.map((x: any) => (x.sku === updated.sku ? updated : x)));

      setSaveMsg(`Updated ${updated.sku} successfully.`);

      // Optional: clear inputs after success
      // setSkuInput("");
      // setStockInput("");
      // setPriceInput("");
    } catch (e: any) {
      setSaveMsg(`Update failed: ${e?.message ?? "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: any) {
    setSkuInput(item.sku);
    setStockInput(String(item.stock));
    setPriceInput(String(item.price));
    setStatusInput(item.status || "In Stock");
    setSaveMsg(`Editing ${item.sku} — change fields then click Save Update.`);
  }

  async function deleteItem(sku: string) {
    const ok = window.confirm(`Delete item ${sku}?`);
    if (!ok) return;

    try {
      setError("");
      setSaveMsg("");

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/inventory/${encodeURIComponent(sku)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const detail = errBody?.detail ? String(errBody.detail) : `HTTP ${res.status}`;
        throw new Error(detail);
      }

      // Update the UI immediately by removing the row
      setInventory((prev) => prev.filter((x: any) => x.sku !== sku));

      // If the quick update box was editing this SKU, clear it
      if (skuInput.trim() === sku) {
        setSkuInput("");
        setStockInput("");
        setPriceInput("");
        setStatusInput("In Stock");
      }

      setSaveMsg(`Deleted ${sku}.`);
    } catch (e: any) {
      setSaveMsg(`Delete failed: ${e?.message ?? "Unknown error"}`);
    }
  }

  //Run loadInventory() once when page first boots up
  useEffect(() => {
    loadInventory();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-100 dark:bg-zinc-900 p-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-7 shadow-xl shadow-black/10 dark:shadow-black/30">

          {/* Header */}
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
              <button
                onClick={() => setShowAdd((v) => !v)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
              >
                + Add Inventory Item
              </button>
              <button className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-white/60 dark:hover:bg-zinc-900/30">
                Export Report
              </button>
            </div>
          </div>

          {/* KPI cards */}
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

          {/* Main layout */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Inventory */}
            <section className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Inventory</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    Display and manage inventory items.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={loadInventory}
                    className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-white/60 dark:hover:bg-zinc-900/30"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              
              {showAdd && (
                <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Add Inventory Item</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">Creates a new item via POST /inventory.</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowAdd(false)}
                        className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 hover:bg-white/60 dark:hover:bg-zinc-900/30"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addItem}
                        disabled={adding}
                        className={`px-4 py-2 rounded-xl font-medium text-white ${
                          adding ? "bg-emerald-600/60 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500"
                        }`}
                      >
                        {adding ? "Adding..." : "Add Item"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input className={inputClass} placeholder="SKU (e.g. TOM-010)" value={newSku} onChange={(e) => setNewSku(e.target.value)} />
                    <input className={inputClass} placeholder="Name (e.g. Organic Tomatoes)" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    <select className={inputClass} value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                      <option className="bg-zinc-900">Fruits</option>
                      <option className="bg-zinc-900">Vegetables</option>
                      <option className="bg-zinc-900">Dairy</option>
                      <option className="bg-zinc-900">Pantry</option>
                    </select>

                    <input className={inputClass} placeholder="Weight lb (e.g. 1.2)" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
                    <input className={inputClass} placeholder="Price (e.g. 2.75)" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
                    <input className={inputClass} placeholder="Stock (e.g. 20)" value={newStock} onChange={(e) => setNewStock(e.target.value)} />

                    <select className={inputClass} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                      <option className="bg-zinc-900">In Stock</option>
                      <option className="bg-zinc-900">Low Stock</option>
                      <option className="bg-zinc-900">Out of Stock</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Loading/Error states */}
              {loading && (
                <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                  Loading inventory from backend…
                </div>
              )}
              {error && (
                <div className="mt-4 text-sm text-red-600">
                  Error loading inventory: {error}
                </div>
              )}

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
                        <td className="px-4 py-3 whitespace-nowrap">{Number(p.weight_lb).toFixed(1)} lb</td>
                        <td className="px-4 py-3 whitespace-nowrap">${Number(p.price).toFixed(2)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{p.stock}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={statusBadge(p.status)}>{p.status}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                          onClick={() => startEdit(p)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-white/60 dark:hover:bg-zinc-900/30"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteItem(p.sku)}
                            className="ml-2 px-3 py-1.5 rounded-lg border border-red-300/80 dark:border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-50/60 dark:hover:bg-red-900/20"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!loading && !error && inventory.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-zinc-600 dark:text-zinc-300" colSpan={8}>
                          No inventory returned from backend.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Quick Update */}
              <div className="mt-5 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Quick Update</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      Update stock/price/status for an item using the backend PATCH endpoint.
                    </p>
                  </div>

                  <button
                    onClick={saveUpdate}
                    disabled={saving}
                    className={`px-4 py-2 rounded-xl font-medium text-white ${
                      saving ? "bg-emerald-600/60 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500"
                    }`}
                  >
                    {saving ? "Saving..." : "Save Update"}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    className={inputClass}
                    placeholder="SKU (e.g. BAN-002)"
                    value={skuInput}
                    onChange={(e) => setSkuInput(e.target.value)}
                  />

                  <input
                    className={inputClass}
                    placeholder="New stock (e.g. 50)"
                    value={stockInput}
                    onChange={(e) => setStockInput(e.target.value)}
                  />

                  <input
                    className={inputClass}
                    placeholder="New price (e.g. 2.99)"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                  />

                  <select
                    className={inputClass}
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value)}
                  >
                    <option className="bg-zinc-900">In Stock</option>
                    <option className="bg-zinc-900">Low Stock</option>
                    <option className="bg-zinc-900">Out of Stock</option>
                  </select>
                </div>

                {saveMsg && (
                  <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
                    {saveMsg}
                  </p>
                )}
              </div>
            </section>

            {/* Right side panels (keep your existing ones for now) */}
            <aside className="grid gap-4">
              {/* Orders panel */}
              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Orders & History</h2>
                <div className="mt-4 grid gap-3">
                  {recentOrders.map((o) => (
                    <div key={o.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-zinc-800 dark:text-zinc-300 font-semibold">{o.id}</div>
                        <span className={statusBadge(o.status)}>{o.status}</span>
                      </div>
                      <div className="mt-1 text-sm text-zinc-800 dark:text-zinc-300">
                        {o.customer} • {o.total} • {o.weight}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Reports */}
              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Reports</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Sales and analytics</p>
                <div className="mt-4 grid gap-2">
                  <button className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                    View Sales Report
                  </button>
                </div>
              </section>

              {/* Customer lookup */}
              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-5">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Customer Lookup</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">View customer account info</p>
                <div className="mt-4 flex gap-2">
                  <input className={inputClass + " flex-1"} placeholder="Email or User ID..." />
                  <button className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                    Search
                  </button>
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

function statusBadge(status: string) {
  const base = "inline-flex items-center px-2.5 py-1 rounded-full text-xs border";
  const s = String(status).toLowerCase();

  if (s.includes("out")) return `${base} border-red-300/80 dark:border-red-500/40 text-red-600 dark:text-red-300 bg-red-50/60 dark:bg-red-900/20`;
  if (s.includes("low")) return `${base} border-amber-300/80 dark:border-amber-500/40 text-amber-700 dark:text-amber-200 bg-amber-50/60 dark:bg-amber-900/20`;
  if (s.includes("deliver")) return `${base} border-sky-300/80 dark:border-sky-500/40 text-sky-700 dark:text-sky-200 bg-sky-50/60 dark:bg-sky-900/20`;
  if (s.includes("prep")) return `${base} border-violet-300/80 dark:border-violet-500/40 text-violet-700 dark:text-violet-200 bg-violet-50/60 dark:bg-violet-900/20`;
  return `${base} border-emerald-300/80 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/20`;
}