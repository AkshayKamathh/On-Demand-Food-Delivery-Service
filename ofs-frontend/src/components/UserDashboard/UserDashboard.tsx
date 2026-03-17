// app/(dashboard)/page.tsx
"use client";

import { useState, useMemo } from "react";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/cn";
import SearchBar from "@/components/ui/SearchBar";
import { useCart } from "@/context/CartContext";

// Change most of this handling once we have DB tables
type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  weight: string;
  inStock: number;
};


const initialProducts: Product[] = [
  {
    id: 1,
    name: "Organic Apples",
    category: "Fruits",
    price: 4.99,
    unit: "/lb",
    weight: "1 lb",
    inStock: 32,
  },
  {
    id: 2,
    name: "Fresh Tomatoes",
    category: "Vegetables",
    price: 3.49,
    unit: "/lb",
    weight: "1 lb",
    inStock: 24,
  },
  {
    id: 3,
    name: "Whole Milk",
    category: "Dairy",
    price: 5.99,
    unit: "/lb",
    weight: "3 lb - 1 gal ",
    inStock: 18,
  },
  {
    id: 4,
    name: "Sourdough Bread",
    category: "Bakery",
    price: 6.99,
    unit: "/loaf",
    weight: "2 lb - 1 loaf",
    inStock: 15,
  },
];

export default function DashboardPage() {
  const [products] = useState<Product[]>(initialProducts);
  const [filter, setFilter] = useState("all");
	const [query, setQuery] = useState("");
const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const { addToCart, cartCount } = useCart();

  const filteredProducts = useMemo(() => {
  const searchQuery = query.toLowerCase();

  return products.filter((product) => {
    // Always match search
    const matchesSearch = 
      product.name.toLowerCase().includes(searchQuery) ||
      product.category.toLowerCase().includes(searchQuery);

    // Multi-select filter logic
    const matchesFilters = selectedFilters.length === 0 || 
        selectedFilters.some((filter) =>
          product.category.toLowerCase() === filter.toLowerCase()
      );

			return matchesSearch && matchesFilters;
		});
	}, [query, selectedFilters, products]);

	const handleSearch = (searchQuery: string, filters: string[]) => {
		setQuery(searchQuery);
		setSelectedFilters(filters);
	};

  const handleAddToCart = (product: Product) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      weight: product.weight,
      image: "🛒",
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 text-zinc-900 dark:text-violet-50">
      {/* Top banner */}
      <section className="bg-emerald-500 text-white py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Our Products</h1>
          <p className="text-sm opacity-90">
            Fresh, quality groceries delivered to your door.
          </p>
        </div>
      </section>

      <section className="animate-fade-slide-up delay-100 max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* SearchBar */}
        <div className="flex flex-col items-center gap-6">
          <SearchBar 
            onSearch={handleSearch}
            placeholder="Search products..."
          />
        </div>

        {/* Product grid */}
        <div className="animate-fade-slide-up delay-200 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <article
              key={product.id}
              className="animate-fade-slide-up delay-300 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="animate-fade-slide-up delay-300 h-28 rounded-t-2xl bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-zinc-900 dark:to-emerald-950 flex items-center justify-center text-3xl">
                🍎 {/* later add main image for each item,*/}
              </div>

              <div className="animate-fade-slide-up delay-300 p-4 flex flex-col gap-2 flex-1">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {product.category}
                </p>
                <h2 className="text-sm font-semibold">{product.name}</h2>

                <div className="animate-fade-slide-up delay-300 text-xs text-zinc-500 dark:text-zinc-400 flex flex-col gap-1">
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
                        "font-medium animate-fade-slide-up delay-300",
                        product.inStock > 10
                          ? "text-emerald-600"
                          : "text-amber-500"
                      )}
                    >
                      {product.inStock}
                    </span>
                  </span>
                </div>

                <div className="animate-fade-slide-up delay-300 mt-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    ${product.price.toFixed(2)}
                    <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      {product.unit}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-400 active:scale-[0.98] transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* No results */}
        {filteredProducts.length === 0 && (
          <div className="animate-fade-slide-up delay-200 text-center py-0">
            <ShoppingCart className="animate-fade-slide-up delay-300 h-12 w-12 mx-auto mb-4 text-zinc-400 dark:text-zinc-500" />
            <h3 className="animate-fade-slide-up delay-400 text-lg font-medium mb-2 text-zinc-900 dark:text-zinc-50">
              No products found
            </h3>
            <p className="animate-fade-slide-up delay-400 text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Try adjusting your search or filter
            </p>
            <button
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="animate-fade-slide-up delay-500 px-6 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Product count */}
        <p className="animate-fade-slide-up delay-200 text-sm text-zinc-500 dark:text-zinc-400 text-center">
          Showing {filteredProducts.length} of {products.length} products
        </p>

      </section>
    </main>
  );
}
