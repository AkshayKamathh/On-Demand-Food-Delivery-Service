"use client";

import { useState, useMemo, useEffect } from "react";
import { ShoppingCart, Eye } from "lucide-react";
import { cn } from "@/lib/cn";
import SearchBar from "@/components/ui/SearchBar";
import { useCart } from "@/context/CartContext";
import ProductDetailOverlay from "@/components/products/detail/ProductDetailPage";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ApiProduct = {
  item_id: number;
  description: string;
  category_id: number | null;
  price: number;
  weight: number;
  stock: number;
  image_url: string | null;
};

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  weight: string;
  inStock: number;
  imageUrl: string | null;
};

const categoryNames: Record<number, string> = {
  1: "Fruits",
  2: "Vegetables",
  3: "Dairy",
  4: "Bakery",
  5: "Meat & Seafood",
};

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);

  const { addToCart, cartCount } = useCart();
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const router = useRouter();

  // client fallback for when a user isnt logged in, route to landing
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const timeout = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 5000)
        );

        const result = await Promise.race([supabase.auth.getUser(), timeout]);

        if (cancelled) return;

        if (!result || !("data" in result) || !result.data.user) {
          setAuthChecking(false);
          router.replace("/");
          return;
        }

        setAuthChecking(false);
      } catch {
        setAuthChecking(false);
        if (!cancelled) router.replace("/");
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (authChecking) return;

    async function loadProducts() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch("http://localhost:8000/catalog/products", {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch products");
        const data: ApiProduct[] = await res.json();

        const mapped: Product[] = data.map((p) => ({
          id: p.item_id,
          name: p.description ?? "Unnamed Product",
          category: categoryNames[p.category_id ?? 0] ?? "General",
          price: p.price ?? 0,
          unit: "/lb",
          weight: p.weight ? `${p.weight.toFixed(1)} lb` : "1 lb",
          inStock: p.stock ?? 0,
          imageUrl: p.image_url ?? null,
        }));

        setProducts(mapped);
      } catch (error) {
        console.error("Failed to load products:", error);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }

    loadProducts();
  }, [authChecking]);

  const filteredProducts = useMemo(() => {
    const searchQuery = query.toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery) ||
        product.category.toLowerCase().includes(searchQuery);
      const matchesFilters =
        selectedFilters.length === 0 ||
        selectedFilters.some(
          (filter) => product.category.toLowerCase() === filter.toLowerCase()
        );
      return matchesSearch && matchesFilters;
    });
  }, [query, selectedFilters, products]);

  const handleSearch = (searchQuery: string, filters: string[]) => {
    setQuery(searchQuery);
    setSelectedFilters(filters);
  };

  const handleAddToCart = async (product: Product) => {
    if (addingItemId !== null) return;

    try {
      setAddingItemId(product.id);

      await addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        weight: product.weight,
        image: product.imageUrl ?? null,
      });
    } catch {
      // CartProvider surfaces handled cart errors in-app.
    } finally {
      setAddingItemId(null);
    }
  };

  if (authChecking || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100">
        <div className="text-lg text-zinc-600 dark:text-zinc-400 animate-pulse">
          Loading products from store...
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 text-zinc-900 dark:text-violet-50">
        <section className="bg-emerald-500 text-white py-10 px-6">
          <div className="max-w-6xl mx-auto flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">Our Products</h1>
            <p className="text-sm opacity-90">
              Fresh, quality groceries delivered to your door.
            </p>
          </div>
        </section>

        <section className="animate-fade-slide-up delay-100 max-w-6xl mx-auto px-6 py-8 space-y-8">
          <div className="flex flex-col items-center gap-6">
            <SearchBar onSearch={handleSearch} placeholder="Search products..." />

            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
              <ShoppingCart className="h-4 w-4" />
              <span>
                Items in cart:{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {cartCount}
                </span>
              </span>
            </div>
          </div>

          <div className="animate-fade-slide-up delay-200 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="animate-fade-slide-up delay-300 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.02] flex flex-col group"
              >
                <div className="relative h-32 rounded-t-2xl bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-zinc-900 dark:to-emerald-950 overflow-hidden group-hover:brightness-110">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      <span className="text-zinc-400">🛒</span>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedProduct(product)}
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/20 backdrop-blur-sm flex items-center justify-center transition-all duration-300 hover:bg-black/30"
                  >
                    <Eye className="h-6 w-6 text-white drop-shadow-md" />
                  </button>
                </div>

                <div className="p-4 flex flex-col gap-2 flex-1">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {product.category}
                  </p>
                  <h2 className="text-sm font-semibold leading-tight line-clamp-2">
                    {product.name}
                  </h2>

                  <div className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-col gap-1 mt-auto">
                    <span>
                      Weight:{" "}
                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                        {product.weight}
                      </span>
                    </span>
                    <span>
                      In stock:{" "}
                      <span
                        className={cn(
                          "font-medium",
                          product.inStock > 10 ? "text-emerald-600" : "text-amber-500"
                        )}
                      >
                        {product.inStock}
                      </span>
                    </span>
                  </div>

                  <div className="mt-3 pt-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      ${product.price.toFixed(2)}
                      <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 block">
                        {product.unit}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-sm"
                        title="Quick view"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={addingItemId === product.id}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-xs font-semibold text-white shadow-md active:scale-[0.97] transition-all"
                      >
                        {addingItemId === product.id ? "Adding..." : "Add"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-4">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-zinc-400 dark:text-zinc-500 animate-pulse" />
              <h3 className="text-lg font-medium mb-2 text-zinc-900 dark:text-zinc-50">
                No products found
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                Try adjusting your search or filter
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setSelectedFilters([]);
                }}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium shadow-lg transition-all"
              >
                Clear filters
              </button>
            </div>
          )}

          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
            Showing {filteredProducts.length} of {products.length} products
          </p>
        </section>
      </main>

      {selectedProduct && (
        <ProductDetailOverlay
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          productId={selectedProduct.id}
        />
      )}
    </>
  );
}
