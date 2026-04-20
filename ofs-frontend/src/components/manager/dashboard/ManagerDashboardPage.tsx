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

type ManagerOrder = {
  id: number;
  created_at: string;
  total: number;
  status: string;
  recipient_name: string;
  email: string;
  delivery_address: string;
};

const ORDER_STATUSES = [
  { value: "pending_payment", label: "Pending Payment" },
  { value: "submitted", label: "Order Received" },
  { value: "preparing", label: "Preparing" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ManagerDashboardPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [orders, setOrders] = useState<ManagerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const kpis = [
    { label: "Today’s Sales", value: "$1,284.50" },
    { label: "Orders In Progress", value: "6" },
    { label: "Low Stock Items", value: "4" },
    { label: "Robot Load", value: "3 / 10 orders" },
  ];

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Fruits");
  const [newWeight, setNewWeight] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");

  const [adding, setAdding] = useState(false);

  async function addItem() {
    try {
      setAdding(true);
      setSaveMsg("");
      setError("");

      const name = newName.trim();

      if (!name) {
        setSaveMsg("Name is required.");
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
        name,
        category: newCategory,
        price: priceNum,
        weight_lb: weightNum,
        stock: stockNum,
      };

      const baseUrl = BASE_URL;
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
      //setInventory((prev) => [created, ...prev]);
      setInventory((prev) =>
        [created, ...prev].sort((a, b) => Number(a.sku) - Number(b.sku))
      );

      setSaveMsg(`Added ${created.sku}.`);
      setShowAdd(false);

      //Clear fields
      setNewName("");
      setNewCategory("Fruits");
      setNewWeight("");
      setNewPrice("");
      setNewStock("");
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

      const baseUrl = BASE_URL;
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

      // If user didn’t fill anything besides SKU, do nothing
      if (Object.keys(payload).length === 0) {
        setSaveMsg("Enter stock/price to update.");
        return;
      }

      const baseUrl = BASE_URL;
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
    setSaveMsg(`Editing ${item.sku} — change fields then click Save Update.`);
  }

  async function deleteItem(sku: string) {
    const ok = window.confirm(`Delete item ${sku}?`);
    if (!ok) return;

    try {
      setError("");
      setSaveMsg("");

      const baseUrl = BASE_URL;
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
      }

      setSaveMsg(`Deleted ${sku}.`);
    } catch (e: any) {
      setSaveMsg(`Delete failed: ${e?.message ?? "Unknown error"}`);
    }
  }

  async function loadOrders() {
    try {
      setOrdersLoading(true);
      setOrdersError("");
      const res = await fetch(`${BASE_URL}/manager/orders`);
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = (await res.json()) as ManagerOrder[];
      setOrders(data);
    } catch (e: any) {
      setOrdersError(e?.message ?? "Failed to load orders");
    } finally {
      setOrdersLoading(false);
    }
  }

  async function updateOrderStatus(orderId: number, newStatus: string) {
    try {
      setUpdatingOrderId(orderId);
      const res = await fetch(`${BASE_URL}/manager/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail ?? `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o))
      );
    } catch (e: any) {
      setOrdersError(`Failed to update order ${orderId}: ${e?.message ?? "Unknown error"}`);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  //Run loadInventory() and loadOrders() once when page first boots up
  useEffect(() => {
    loadInventory();
    loadOrders();
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
                      Update stock/price for an item using the backend PATCH endpoint.
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
                    placeholder="Item ID (e.g. 12)"
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
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Orders & History</h2>
                  <button
                    onClick={loadOrders}
                    className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-sm text-zinc-900 dark:text-zinc-100 hover:bg-white/60 dark:hover:bg-zinc-900/30"
                  >
                    Refresh
                  </button>
                </div>

                {ordersError && (
                  <p className="mt-2 text-sm text-red-600">{ordersError}</p>
                )}

                <div className="mt-4 grid gap-3 max-h-[480px] overflow-y-auto pr-1">
                  {ordersLoading && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading orders…</p>
                  )}

                  {!ordersLoading && orders.length === 0 && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">No orders found.</p>
                  )}

                  {orders.map((o) => (
                    <div key={o.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-zinc-800 dark:text-zinc-300 font-semibold text-sm">
                          #{o.id}
                        </div>
                        <span className={statusBadge(o.status)}>{statusLabel(o.status)}</span>
                      </div>
                      <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                        {o.recipient_name} • ${o.total.toFixed(2)}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {new Date(o.created_at).toLocaleDateString()}
                      </div>
                      <div className="mt-2">
                        <select
                          disabled={updatingOrderId === o.id}
                          value={o.status}
                          onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm disabled:opacity-50"
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s.value} value={s.value} className="bg-white dark:bg-zinc-800">
                              {s.label}
                            </option>
                          ))}
                        </select>
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

function statusLabel(status: string): string {
  return ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function statusBadge(status: string) {
  const base = "inline-flex items-center px-2.5 py-1 rounded-full text-xs border";
  switch (status) {
    case "pending_payment":
      return `${base} border-amber-300/80 dark:border-amber-500/40 text-amber-700 dark:text-amber-200 bg-amber-50/60 dark:bg-amber-900/20`;
    case "submitted":
      return `${base} border-blue-300/80 dark:border-blue-500/40 text-blue-700 dark:text-blue-200 bg-blue-50/60 dark:bg-blue-900/20`;
    case "preparing":
      return `${base} border-violet-300/80 dark:border-violet-500/40 text-violet-700 dark:text-violet-200 bg-violet-50/60 dark:bg-violet-900/20`;
    case "out_for_delivery":
      return `${base} border-orange-300/80 dark:border-orange-500/40 text-orange-700 dark:text-orange-200 bg-orange-50/60 dark:bg-orange-900/20`;
    case "delivered":
      return `${base} border-sky-300/80 dark:border-sky-500/40 text-sky-700 dark:text-sky-200 bg-sky-50/60 dark:bg-sky-900/20`;
    case "cancelled":
      return `${base} border-red-300/80 dark:border-red-500/40 text-red-600 dark:text-red-300 bg-red-50/60 dark:bg-red-900/20`;
    // inventory statuses
    default: {
      const s = String(status).toLowerCase();
      if (s.includes("out")) return `${base} border-red-300/80 dark:border-red-500/40 text-red-600 dark:text-red-300 bg-red-50/60 dark:bg-red-900/20`;
      if (s.includes("low")) return `${base} border-amber-300/80 dark:border-amber-500/40 text-amber-700 dark:text-amber-200 bg-amber-50/60 dark:bg-amber-900/20`;
      return `${base} border-emerald-300/80 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/20`;
    }
  }
}