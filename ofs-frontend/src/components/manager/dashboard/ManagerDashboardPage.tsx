"use client";

import { ChangeEvent, useEffect, useState } from "react";
import ManagerNavbar from "@/components/manager/ManagerNavbar";
import { supabase } from "@/lib/supabaseClient";
import { getAuthHeaders } from "@/lib/authHeaders";

type InventoryItem = {
  sku: string;
  name: string;
  category: string;
  price: number;
  weight_lb: number;
  stock: number;
  status: string;
  image_url?: string | null;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const IMAGE_BUCKET = "product-images";

export default function ManagerDashboardPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const kpis = [
    { label: "Today's Sales", value: "$1,284.50" },
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
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImagePreview, setNewImagePreview] = useState("");
  const [adding, setAdding] = useState(false);

  const [skuInput, setSkuInput] = useState("");
  const [stockInput, setStockInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    return () => {
      if (newImagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(newImagePreview);
      }
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [newImagePreview, imagePreview]);

  function setPreviewWithCleanup(
    nextPreview: string,
    currentPreview: string,
    setter: (value: string) => void
  ) {
    if (currentPreview.startsWith("blob:")) {
      URL.revokeObjectURL(currentPreview);
    }
    setter(nextPreview);
  }

  function normalizeErrorMessage(message: string, fallback: string) {
    if (!message) return fallback;

    try {
      const parsed = JSON.parse(message);
      if (typeof parsed?.detail === "string" && parsed.detail.trim()) {
        return parsed.detail;
      }
    } catch {
      // Fall back to raw text when the backend did not return JSON.
    }

    return message;
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

  function resetEditImageInputs() {
    setImageFile(null);
    setImageUrlInput("");
    setPreviewWithCleanup("", imagePreview, setImagePreview);
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

    if (uploadError) {
      throw new Error(uploadError.message || "Unable to upload product image");
    }

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error("Unable to retrieve uploaded image URL");
    }

    return data.publicUrl;
  }

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

      let finalImageUrl: string | null = newImageUrl.trim() || null;
      if (newImageFile) {
        finalImageUrl = await uploadProductImage(newImageFile);
      }

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
      if (!sku) {
        setSaveMsg("Enter a SKU first.");
        return;
      }

      const payload: Record<string, any> = {};

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

      if (Object.keys(payload).length === 0) {
        setSaveMsg("Enter stock, price, or an updated image to save.");
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
      setSaveMsg(`Updated ${updated.sku} successfully.`);
      setImageFile(null);
      setImageUrlInput(updated.image_url ?? "");
      setPreviewWithCleanup(updated.image_url ?? "", imagePreview, setImagePreview);
    } catch (e: any) {
      setSaveMsg(`Update failed: ${e?.message ?? "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: InventoryItem) {
    setSkuInput(item.sku);
    setStockInput(String(item.stock));
    setPriceInput(String(item.price));
    setImageFile(null);
    setImageUrlInput(item.image_url ?? "");
    setPreviewWithCleanup(item.image_url ?? "", imagePreview, setImagePreview);
    setSaveMsg(`Editing ${item.sku} - change fields then click Save Update.`);
  }

  async function deleteItem(sku: string) {
    if (!window.confirm(`Delete item ${sku}?`)) return;
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
      setInventory((prev) => prev.filter((x) => x.sku !== sku));
      if (skuInput.trim() === sku) {
        setSkuInput("");
        setStockInput("");
        setPriceInput("");
        resetEditImageInputs();
      }
      setSaveMsg(`Deleted ${sku}.`);
    } catch (e: any) {
      setSaveMsg(`Delete failed: ${e?.message ?? "Unknown error"}`);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  return (
    <>
      <ManagerNavbar />
      <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 p-6">
        <div className="mx-auto w-full max-w-6xl">
          <div className="rounded-2xl border border-zinc-200 bg-white/80 p-7 shadow-xl shadow-black/10 backdrop-blur-sm dark:border-zinc-700/50 dark:bg-zinc-800/60 dark:shadow-black/30">
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
                <button className="rounded-xl border border-zinc-300 px-4 py-2 text-zinc-900 transition-colors hover:bg-white/60 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900/30">
                  Export Report
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className="rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-700/50 dark:bg-zinc-900/30"
                >
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">{k.label}</div>
                  <div className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {k.value}
                  </div>
                </div>
              ))}
            </div>

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

              {showAdd && (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-700/50 dark:bg-zinc-900/30">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Add Inventory Item</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">
                        Creates a new item via POST /inventory.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowAdd(false);
                          resetAddForm();
                        }}
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

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input
                      className={inputClass}
                      placeholder="Name (e.g. Organic Tomatoes)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <select className={inputClass} value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                      <option>Fruits</option>
                      <option>Vegetables</option>
                      <option>Dairy</option>
                      <option>Bakery</option>
                      <option>Meat & Seafood</option>
                    </select>
                    <input
                      className={inputClass}
                      placeholder="Weight lb (e.g. 1.2)"
                      value={newWeight}
                      onChange={(e) => setNewWeight(e.target.value)}
                    />
                    <input
                      className={inputClass}
                      placeholder="Price (e.g. 2.75)"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                    />
                    <input
                      className={inputClass}
                      placeholder="Stock (e.g. 20)"
                      value={newStock}
                      onChange={(e) => setNewStock(e.target.value)}
                    />
                    <input
                      className={inputClass}
                      placeholder="Image URL (optional)"
                      value={newImageUrl}
                      onChange={(e) => {
                        setNewImageUrl(e.target.value);
                        if (!newImageFile) {
                          setPreviewWithCleanup(e.target.value.trim(), newImagePreview, setNewImagePreview);
                        }
                      }}
                    />
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 transition-colors hover:bg-white/60 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900/30">
                      <input type="file" accept="image/*" className="hidden" onChange={handleAddFileChange} />
                      {newImageFile ? `Selected: ${newImageFile.name}` : "Choose product photo"}
                    </label>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Photo preview</p>
                    <ImagePreview imageUrl={newImagePreview} />
                  </div>
                </div>
              )}

              {loading && (
                <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">Loading inventory from backend...</div>
              )}
              {error && <div className="mt-4 text-sm text-red-600">Error loading inventory: {error}</div>}

              <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50/60 dark:bg-zinc-900/40">
                    <tr className="text-left text-zinc-600 dark:text-zinc-300">
                      {["SKU", "Photo", "Item", "Category", "Weight", "Price", "Stock", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700/50">
                    {inventory.map((p) => (
                      <tr key={p.sku} className="text-zinc-900 dark:text-zinc-100">
                        <td className="whitespace-nowrap px-4 py-3">{p.sku}</td>
                        <td className="px-4 py-3">
                          <ImageThumb imageUrl={p.image_url ?? null} alt={p.name} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{p.name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">{p.category}</td>
                        <td className="whitespace-nowrap px-4 py-3">{Number(p.weight_lb).toFixed(1)} lb</td>
                        <td className="whitespace-nowrap px-4 py-3">${Number(p.price).toFixed(2)}</td>
                        <td className="whitespace-nowrap px-4 py-3">{p.stock}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={statusBadge(p.status)}>{p.status}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <button
                            onClick={() => startEdit(p)}
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 transition-colors hover:bg-white/60 dark:border-zinc-600 dark:hover:bg-zinc-900/30"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteItem(p.sku)}
                            className="ml-2 rounded-lg border border-red-300/80 px-3 py-1.5 text-red-600 transition-colors hover:bg-red-50/60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-900/20"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loading && !error && inventory.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-zinc-600 dark:text-zinc-300" colSpan={9}>
                          No inventory returned from backend.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-700/50 dark:bg-zinc-900/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Quick Update</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      Update stock, price, or photo for an item via PATCH.
                    </p>
                  </div>
                  <button
                    onClick={saveUpdate}
                    disabled={saving}
                    className={`rounded-xl px-4 py-2 font-medium text-white transition-colors ${
                      saving ? "cursor-not-allowed bg-emerald-600/60" : "bg-emerald-600 hover:bg-emerald-500"
                    }`}
                  >
                    {saving ? "Saving..." : "Save Update"}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
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
                  <input
                    className={inputClass}
                    placeholder="New image URL (optional)"
                    value={imageUrlInput}
                    onChange={(e) => {
                      setImageUrlInput(e.target.value);
                      if (!imageFile) {
                        setPreviewWithCleanup(e.target.value.trim(), imagePreview, setImagePreview);
                      }
                    }}
                  />
                  <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 transition-colors hover:bg-white/60 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900/30">
                    <input type="file" accept="image/*" className="hidden" onChange={handleEditFileChange} />
                    {imageFile ? `Selected: ${imageFile.name}` : "Choose replacement photo"}
                  </label>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Current / new photo preview</p>
                  <ImagePreview imageUrl={imagePreview} />
                </div>

                {saveMsg && <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">{saveMsg}</p>}
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

function ImageThumb({ imageUrl, alt }: { imageUrl: string | null; alt: string }) {
  if (!imageUrl) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-500">
        No img
      </div>
    );
  }

  return <img src={imageUrl} alt={alt} className="h-12 w-12 rounded-lg object-cover" />;
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
  if (s.includes("out")) {
    return `${base} border-red-300/80 bg-red-50/60 text-red-600 dark:border-red-500/40 dark:bg-red-900/20 dark:text-red-300`;
  }
  if (s.includes("low")) {
    return `${base} border-amber-300/80 bg-amber-50/60 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-200`;
  }
  return `${base} border-emerald-300/80 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-200`;
}
