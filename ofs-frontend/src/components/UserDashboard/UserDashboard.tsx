// app/(dashboard)/page.tsx
"use client";

import { useState, useMemo } from "react";
import { ShoppingCart, Eye } from "lucide-react";
import { cn } from "@/lib/cn";
import SearchBar from "@/components/ui/SearchBar";
import { useCart } from "@/context/CartContext";
import ProductDetailOverlay from "@/components/products/detail/ProductDetailPage";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  weight: string;
  inStock: number;
  emoji: string; 
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
    emoji: "🍎",  
  },
  {
    id: 2,
    name: "Fresh Tomatoes", 
    category: "Vegetables",
    price: 3.49,
    unit: "/lb",
    weight: "1 lb",
    inStock: 24,
    emoji: "🍅",  
  },
  {
    id: 3,
    name: "Whole Milk",
    category: "Dairy",
    price: 5.99,
    unit: "/gal",
    weight: "3 lb - 1 gal",
    inStock: 18,
    emoji: "🥛", 
  },
  {
    id: 4,
    name: "Sourdough Bread",
    category: "Bakery",
    price: 6.99,
    unit: "/loaf",
    weight: "2 lb - 1 loaf",
    inStock: 15,
    emoji: "🥖",  
  },
];

export default function DashboardPage() {
  const [products] = useState<Product[]>(initialProducts);
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { addToCart, cartCount } = useCart();

  const filteredProducts = useMemo(() => {
    const searchQuery = query.toLowerCase();
    return products.filter((product) => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchQuery) ||
        product.category.toLowerCase().includes(searchQuery);
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
      image: product.emoji,  // change later when we have imgs
    });
  };

  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
  };

  const closeProductDetail = () => {
    setSelectedProduct(null);
  };

  return (
    <>
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
          {/* SearchBar + Cart Count */}
          <div className="flex flex-col items-center gap-6">
            <SearchBar 
              onSearch={handleSearch}
              placeholder="Search products..."
            />
            
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

          {/* Product count */}
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
            Showing {filteredProducts.length} of {products.length} products
          </p>

          {/* Product grid */}
          <div className="animate-fade-slide-up delay-200 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="animate-fade-slide-up delay-300 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.02] flex flex-col group"
              >
                {/* Image with unique emoji */}
                <div className="relative h-32 rounded-t-2xl bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-zinc-900 dark:to-emerald-950 flex items-center justify-center text-4xl overflow-hidden group-hover:brightness-110">
                  <span className="drop-shadow-2xl z-10 animate-bounce-slow">{product.emoji}</span>
                  
                  {/* Detail button overlay */}
                  <button
                    onClick={() => openProductDetail(product)}
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
                          product.inStock > 10
                            ? "text-emerald-600"
                            : "text-amber-500"
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
                      {/* Quick View */}
                      <button
                        onClick={() => openProductDetail(product)}
                        className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-sm"
                        title="Quick view"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      
                      {/* Add to Cart */}
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md active:scale-[0.97] transition-all"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* No results */}
          {filteredProducts.length === 0 && (
            <div className="text-center py-16">
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
        </section>
      </main>

      {/* Product Detail Overlay */}
      {selectedProduct && (
        <ProductDetailOverlay
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
