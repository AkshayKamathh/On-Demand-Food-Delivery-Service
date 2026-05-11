"use client";

import { ChangeEvent, useEffect, useState } from "react";
import ManagerNavbar from "@/components/manager/ManagerNavbar";
import { supabase } from "@/lib/supabaseClient";
import { getAuthHeaders } from "@/lib/authHeaders";

type KpiStats = {
  todays_sales: number;
  orders_in_progress: number;
  low_stock_items: number;
  out_for_delivery: number;
};

type InventoryItem = {
  sku: string;
  name: string;
  category: string;
  price: number;
  weight_lb: number;
  stock: number;
  status: string;
  image_url?: string | null;
  is_active: boolean;
  long_description?: string | null;
  nutrition?: Record<string, unknown> | null;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const IMAGE_BUCKET = "product-images";

export default function ManagerDashboardPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kpiData, setKpiData] = useState<KpiStats | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Fruits");
  const [newWeight, setNewWeight] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImagePreview, setNewImagePreview] = useState("");
  const [adding, setAdding] = useState(false);

  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [skuInput, setSkuInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [stockInput, setStockInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [longDescInput, setLongDescInput] = useState("");
  const [nutritionRows, setNutritionRows] = useState<{ key: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    return () => {
      if (newImagePreview.startsWith("blob:")) URL.revokeObjectURL(newImagePreview);
      if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [newImagePreview, imagePreview]);

  function setPreviewWithCleanup(
    nextPreview: string,
    currentPreview: string,
    setter: (value: string) => void
  ) {
    if (currentPreview.startsWith("blob:")) URL.revokeObjectURL(currentPreview);
    setter(nextPreview);
  }

  function normalizeErrorMessage(message: string, fallback: string) {
    if (!message) return fallback;
    try {
      const parsed = JSON.parse(message);
      if (typeof parsed?.detail === "string" && parsed.detail.trim()) return parsed.detail;
    } catch {}
    return message;
  }

  function nutritionFromServer(n: Record<string, unknown> | null | undefined) {
    if (!n || Object.keys(n).length === 0) return [];
    return Object.entries(n).map(([key, value]) => ({ key, value: String(value) }));
  }

  function nutritionToPayload(rows: { key: string; value: string }[]): Record<string, number | string> | null {
    const result: Record<string, number | string> = {};
    for (const { key, value } of rows) {
      const k = key.trim();
      if (!k || value.trim() === "") continue;
      const num = Number(value);
      result[k] = Number.isFinite(num) ? num : value.trim();
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  function resetAddForm() {
    setNewName("");
    setNewCategory("Fruits");
    setNewWeight("");
    setNewPrice("");
    setNewStock("");
    setNewImageFile(null);
    setNewImageUrl("");
    setPreviewWithCleanup("", newImagePreview, setNewImagePreview);
  }

  function handleAddFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setNewImageFile(file);
    if (!file) {
      setPreviewWithCleanup(newImageUrl.trim(), newImagePreview, setNewImagePreview);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setSaveMsg("Please choose an image file.");
      e.target.value = "";
      setNewImageFile(null);
      return;
    }
    setSaveMsg("");
    setPreviewWithCleanup(URL.createObjectURL(file), newImagePreview, setNewImagePreview);
  }

  function handleEditFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (!file) {
      setPreviewWithCleanup(imageUrlInput.trim(), imagePreview, setImagePreview);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setSaveMsg("Please choose an image file.");
      e.target.value = "";
      setImageFile(null);
      return;
    }
    setSaveMsg("");
    setPreviewWithCleanup(URL.createObjectURL(file), imagePreview, setImagePreview);
  }

  async function uploadProductImage(file: File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `products/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) throw new Error(uploadError.message || "Unable to upload product image");
    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Unable to retrieve uploaded image URL");
    return data.publicUrl;
  }

  async function addItem() {
    try {
      setAdding(true);
      setSaveMsg("");
      setError("");

      const name = newName.trim();
      if (!name) { setSaveMsg("Name is required."); return; }

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

      let finalImageUrl: string | null = newImageUrl.trim() || null;
      if (newImageFile) finalImageUrl = await uploadProductImage(newImageFile);

      const payload = {
        name,
        category: newCategory,
        price: priceNum,
        weight_lb: weightNum,
        stock: stockNum,
        image_url: finalImageUrl,
      };

      const res = await fetch(`${BASE_URL}/inventory`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(normalizeErrorMessage(text, `HTTP ${res.status}`));
      }

      const created = (await res.json()) as InventoryItem;
      setInventory((prev) => [...prev, created].sort((a, b) => Number(a.sku) - Number(b.sku)));
      setSaveMsg(`Added ${created.sku}.`);
      setShowAdd(false);
      resetAddForm();
    } catch (e: any) {
      setSaveMsg(`Add failed: ${e?.message ?? "Unknown error"}`);
    } finally {
      setAdding(false);
    }
  }

  async function loadKpis() {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/manager/kpis`, { headers });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = (await res.json()) as KpiStats;
      setKpiData(data);
    } catch {}
  }

  async function loadInventory() {
    try {
      setLoading(true);
      setError("");
      const headers = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/inventory`, { headers });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = (await res.json()) as InventoryItem[];
      setInventory(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  async function saveUpdate() {
    try {
      setSaving(true);
      setSaveMsg("");
      setError("");

      const sku = skuInput.trim();
      if (!sku) { setSaveMsg("Enter a SKU first."); return; }

      const payload: Record<string, any> = {};

      if (nameInput.trim() !== "") {
        payload.name = nameInput.trim();
      }

      if (categoryInput.trim() !== "") {
        payload.category = categoryInput.trim();
      }

      if (weightInput.trim() !== "") {
        const weightNum = Number(weightInput);
        if (!Number.isFinite(weightNum) || weightNum <= 0) {
          setSaveMsg("Weight must be a valid number (> 0).");
          return;
        }
        payload.weight_lb = weightNum;
      }

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

      if (imageFile) {
        payload.image_url = await uploadProductImage(imageFile);
      } else if (imageUrlInput.trim() !== "") {
        payload.image_url = imageUrlInput.trim();
      }

      if (longDescInput.trim() !== "") {
        payload.long_description = longDescInput.trim();
      }

      const nutritionPayload = nutritionToPayload(nutritionRows);
      if (nutritionPayload) {
        payload.nutrition = nutritionPayload;
      }

      if (Object.keys(payload).length === 0) {
        setSaveMsg("Enter at least one field to update.");
        return;
      }

      const res = await fetch(`${BASE_URL}/inventory/${encodeURIComponent(sku)}`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(normalizeErrorMessage(text, `HTTP ${res.status}`));
      }

      const updated = (await res.json()) as InventoryItem;
      setInventory((prev) => prev.map((x) => (x.sku === updated.sku ? updated : x)));
      loadKpis();
      closeEditPanel();
    } catch (e: any) {
      setSaveMsg(`Update failed: ${e?.message ?? "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: InventoryItem) {
    setEditingItem(item);
    setSkuInput(item.sku);
    setNameInput(item.name);
    setCategoryInput(item.category);
    setWeightInput(String(item.weight_lb));
    setStockInput(String(item.stock));
    setPriceInput(String(item.price));
    setImageFile(null);
    setImageUrlInput(item.image_url ?? "");
    setPreviewWithCleanup(item.image_url ?? "", imagePreview, setImagePreview);
    setLongDescInput(item.long_description ?? "");
    setNutritionRows(nutritionFromServer(item.nutrition));
    setSaveMsg("");
    setShowEditPanel(true);
  }

  function closeEditPanel() {
    setShowEditPanel(false);
    setEditingItem(null);
    setSaveMsg("");
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    setImageFile(null);
  }

  async function deleteItem(sku: string) {
    if (!window.confirm(`Remove item ${sku} from the store?`)) return;
    try {
      setError("");
      setSaveMsg("");
      const res = await fetch(`${BASE_URL}/inventory/${encodeURIComponent(sku)}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(normalizeErrorMessage(text, `HTTP ${res.status}`));
      }
      const updated = await res.json();
      setInventory((prev) => prev.map((x) => (x.sku === updated.sku ? updated : x)));
      setSaveMsg(`Removed ${sku} from store. It can be restored.`);
    } catch (e: any) {
      setSaveMsg(`Remove failed: ${e?.message ?? "Unknown error"}`);
    }
  }

  async function restoreItem(sku: string) {
    try {
      setError("");
      setSaveMsg("");
      const res = await fetch(`${BASE_URL}/inventory/${encodeURIComponent(sku)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail ? String(errBody.detail) : `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setInventory((prev) => prev.map((x) => (x.sku === updated.sku ? updated : x)));
      setSaveMsg(`Restored ${sku}.`);
    } catch (e: any) {
      setSaveMsg(`Restore failed: ${e?.message ?? "Unknown error"}`);
    }
  }

  useEffect(() => {
    loadInventory();
    loadKpis();
  }, []);

  return (
    <>
      <ManagerNavbar />
      <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 p-6">
        <div className="mx-auto w-full max-w-6xl">
          <div className="rounded-2xl border border-zinc-200 bg-white/80 p-7 shadow-xl shadow-black/10 backdrop-blur-sm dark:border-zinc-700/50 dark:bg-zinc-800/60 dark:shadow-black/30">

            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 md:text-3xl">
                  Dashboard
                </h1>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                  Inventory overview and management
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowAdd((v) => !v)}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-emerald-500"
                >
                  + Add Inventory Item
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(kpiData
                ? [
                    { label: "Today's Sales",      value: `$${kpiData.todays_sales.toFixed(2)}` },
                    { label: "Orders In Progress", value: String(kpiData.orders_in_progress) },
                    { label: "Low Stock Items",    value: String(kpiData.low_stock_items) },
                    { label: "Out for Delivery",   value: String(kpiData.out_for_delivery) },
                  ]
                : [
                    { label: "Today's Sales",      value: "—" },
                    { label: "Orders In Progress", value: "—" },
                    { label: "Low Stock Items",    value: "—" },
                    { label: "Out for Delivery",   value: "—" },
                  ]
              ).map((k) => (
                <div
                  key={k.label}
                  className="rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-700/50 dark:bg-zinc-900/30"
                >
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">{k.label}</div>
                  <div className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{k.value}</div>
                </div>
              ))}
            </div>

            {/* Inventory Section */}
            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white/60 p-5 dark:border-zinc-700/50 dark:bg-zinc-900/30">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Inventory</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    Display and manage inventory items.
                  </p>
                </div>
                <button
                  onClick={loadInventory}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-zinc-900 transition-colors hover:bg-white/60 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900/30"
                >
                  Refresh
                </button>
              </div>

              {/* Add Item Form */}
              {showAdd && (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-700/50 dark:bg-zinc-900/30">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Add Inventory Item</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">
                        SKU is assigned automatically. All fields except Image are required.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowAdd(false); resetAddForm(); }}
                        className="rounded-xl border border-zinc-300 px-4 py-2 transition-colors hover:bg-white/60 dark:border-zinc-600 dark:hover:bg-zinc-900/30"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addItem}
                        disabled={adding}
                        className={`rounded-xl px-4 py-2 font-medium text-white transition-colors ${
                          adding ? "cursor-not-allowed bg-emerald-600/60" : "bg-emerald-600 hover:bg-emerald-500"
                        }`}
                      >
                        {adding ? "Adding..." : "Add Item"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
                        placeholder="e.g. Organic Tomatoes"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select className={inputClass} value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                        <option>Fruits</option>
                        <option>Vegetables</option>
                        <option>Dairy</option>
                        <option>Bakery</option>
                        <option>Meat & Seafood</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Weight (lb) <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
                        placeholder="e.g. 1.2"
                        value={newWeight}
                        onChange={(e) => setNewWeight(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Price <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
                        placeholder="e.g. 2.75"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Stock <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
                        placeholder="e.g. 20"
                        value={newStock}
                        onChange={(e) => setNewStock(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Image URL <span className="text-zinc-400">(optional)</span>
                      </label>
                      <input
                        className={inputClass}
                        placeholder="https://..."
                        value={newImageUrl}
                        onChange={(e) => {
                          setNewImageUrl(e.target.value);
                          if (!newImageFile) {
                            setPreviewWithCleanup(e.target.value.trim(), newImagePreview, setNewImagePreview);
                          }
                        }}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Photo upload <span className="text-zinc-400">(optional)</span>
                      </label>
                      <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 transition-colors hover:bg-white/60 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900/30">
                        <input type="file" accept="image/*" className="hidden" onChange={handleAddFileChange} />
                        {newImageFile ? `Selected: ${newImageFile.name}` : "Choose product photo"}
                      </label>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Photo preview</p>
                    {newImagePreview ? (
                      <img
                        src={newImagePreview}
                        alt="New product preview"
                        className="h-28 w-28 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
                      />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-500">
                        No preview
                      </div>
                    )}
                  </div>
                </div>
              )}

              {loading && (
                <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">Loading inventory from backend...</div>
              )}
              {error && (
                <div className="mt-4 text-sm text-red-600">Error loading inventory: {error}</div>
              )}

              {/* Inventory Table */}
              <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50/60 dark:bg-zinc-900/40">
                    <tr className="text-left text-zinc-600 dark:text-zinc-300">
                      {["SKU", "Item", "Category", "Weight", "Price", "Stock", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700/50">
                    {inventory.map((p) => (
                      <tr
                        key={p.sku}
                        className={`text-zinc-900 dark:text-zinc-100 ${!p.is_active ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">{p.sku}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{p.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">{p.category}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{Number(p.weight_lb).toFixed(1)} lb</td>
                        <td className="px-4 py-3 whitespace-nowrap">${Number(p.price).toFixed(2)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{p.stock}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={statusBadge(p.status)}>{p.status}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <button
                            onClick={() => startEdit(p)}
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 transition-colors hover:bg-white/60 dark:border-zinc-600 dark:hover:bg-zinc-900/30"
                          >
                            Edit
                          </button>
                          {p.is_active ? (
                            <button
                              onClick={() => deleteItem(p.sku)}
                              className="ml-2 px-3 py-1.5 rounded-lg border border-red-300/80 dark:border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-50/60 dark:hover:bg-red-900/20 transition-colors"
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              onClick={() => restoreItem(p.sku)}
                              className="ml-2 px-3 py-1.5 rounded-lg border border-emerald-300/80 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20 transition-colors"
                            >
                              Restore
                            </button>
                          )}
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

            </section>
          </div>
        </div>
      </main>

      {/* Edit Drawer */}
      {showEditPanel && editingItem && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={closeEditPanel}
          />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-zinc-900">

            {/* Header */}
            <div className="flex shrink-0 items-start justify-between border-b border-zinc-200 px-6 py-5 dark:border-zinc-700">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  SKU {editingItem.sku}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {editingItem.name}
                </h2>
              </div>
              <button
                onClick={closeEditPanel}
                className="ml-4 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

              {/* Basic Info */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Basic Info
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Name</label>
                    <input
                      className={inputClass}
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Category</label>
                    <select
                      className={inputClass}
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                    >
                      <option>Fruits</option>
                      <option>Vegetables</option>
                      <option>Dairy</option>
                      <option>Bakery</option>
                      <option>Meat & Seafood</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Weight (lb)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      className={inputClass}
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* Pricing & Stock */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Pricing & Stock
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Price ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputClass}
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Stock (units)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={inputClass}
                      value={stockInput}
                      onChange={(e) => setStockInput(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* Product Image */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Product Image
                </h3>
                <div className="flex gap-4">
                  <ImagePreview imageUrl={imagePreview} />
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Image URL</label>
                      <input
                        className={inputClass}
                        placeholder="https://..."
                        value={imageUrlInput}
                        onChange={(e) => {
                          setImageUrlInput(e.target.value);
                          if (!imageFile) {
                            setPreviewWithCleanup(e.target.value.trim(), imagePreview, setImagePreview);
                          }
                        }}
                      />
                    </div>
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      <input type="file" accept="image/*" className="hidden" onChange={handleEditFileChange} />
                      {imageFile ? `✓ ${imageFile.name}` : "Or upload a photo"}
                    </label>
                  </div>
                </div>
              </section>

              {/* Description */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Description
                </h3>
                <textarea
                  className={`${inputClass} min-h-[100px] w-full resize-y`}
                  placeholder="Describe this product for customers..."
                  value={longDescInput}
                  onChange={(e) => setLongDescInput(e.target.value)}
                />
              </section>

              {/* Nutrition */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Nutrition
                  </h3>
                  <button
                    type="button"
                    onClick={() => setNutritionRows((prev) => [...prev, { key: "", value: "" }])}
                    className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  >
                    + Add field
                  </button>
                </div>

                {nutritionRows.length === 0 ? (
                  <p className="text-sm text-zinc-400 dark:text-zinc-500">No nutrition data yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_7rem_1.5rem] gap-2 px-1">
                      <span className="text-xs text-zinc-400">Field</span>
                      <span className="text-xs text-zinc-400">Value</span>
                    </div>
                    {nutritionRows.map((row, i) => (
                      <div key={i} className="grid grid-cols-[1fr_7rem_1.5rem] items-center gap-2">
                        <input
                          className={`${inputClass} text-sm`}
                          placeholder="e.g. calories"
                          value={row.key}
                          onChange={(e) =>
                            setNutritionRows((prev) =>
                              prev.map((r, idx) => idx === i ? { ...r, key: e.target.value } : r)
                            )
                          }
                        />
                        <input
                          className={`${inputClass} text-sm`}
                          placeholder="e.g. 100"
                          value={row.value}
                          onChange={(e) =>
                            setNutritionRows((prev) =>
                              prev.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r)
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setNutritionRows((prev) => prev.filter((_, idx) => idx !== i))}
                          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900">
              {saveMsg && (
                <p className="mb-3 text-sm text-red-600 dark:text-red-400">{saveMsg}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={closeEditPanel}
                  className="flex-1 rounded-xl border border-zinc-300 py-2.5 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={saveUpdate}
                  disabled={saving}
                  className={`flex-1 rounded-xl py-2.5 font-medium text-white transition-colors ${
                    saving ? "cursor-not-allowed bg-emerald-600/60" : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ImagePreview({ imageUrl }: { imageUrl: string }) {
  if (!imageUrl) {
    return (
      <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-500">
        No preview
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt="Product preview"
      className="h-28 w-28 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
    />
  );
}

const inputClass =
  "rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:text-zinc-100";

function statusBadge(status: string) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs";
  const s = String(status).toLowerCase();
  if (s.includes("out"))
    return `${base} border-red-300/80 bg-red-50/60 text-red-600 dark:border-red-500/40 dark:bg-red-900/20 dark:text-red-300`;
  if (s.includes("low"))
    return `${base} border-amber-300/80 bg-amber-50/60 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-200`;
  return `${base} border-emerald-300/80 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-200`;
}