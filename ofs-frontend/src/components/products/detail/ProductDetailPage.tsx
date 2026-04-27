"use client";

/*
Call with:
<ProductDetailPage open={open} onClose={() => setOpen(false)} productId={id} />
*/

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/lib/theme-classes";
import { useCart } from "@/context/CartContext";

type Product = {
  item_id: number;
  description: string;
  price: number;
  weight: number;
  image_url: string | null;
};

type ProductDetailOverlayProps = {
  open: boolean;
  onClose: () => void;
  productId: number;
};

export default function ProductDetailOverlay({
  open,
  onClose,
  productId,
}: ProductDetailOverlayProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const { addToCart } = useCart();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setProduct(null);

    fetch(`http://localhost:8000/catalog/products/${productId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Product not found");
        return res.json();
      })
      .then(setProduct)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, productId]);

  // Close on ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Lock background scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!open) return null;

  const card = cn(
    "rounded-2xl",
    "bg-white dark:bg-zinc-800",
    "border border-zinc-200 dark:border-zinc-700",
    "shadow-sm",
  );

  const mainImage = cn(
    "w-full aspect-square",
    "rounded-2xl",
    "bg-zinc-100 dark:bg-zinc-700",
    "border border-zinc-200 dark:border-zinc-600",
    "flex items-center justify-center",
    "overflow-hidden",
  );

  const price = cn(
    "text-xl font-semibold",
    "text-emerald-700 dark:text-emerald-400",
  );

  const closeBtn = cn(
    "inline-flex items-center justify-center",
    "h-9 w-9 rounded-lg",
    "border border-zinc-200 dark:border-zinc-700",
    "bg-white/70 dark:bg-zinc-800/60",
    "hover:bg-white dark:hover:bg-zinc-700",
    "text-zinc-700 dark:text-zinc-200",
    "focus:outline-none focus:ring-2 focus:ring-emerald-500",
  );

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        "flex items-center justify-center",
        "p-4 sm:p-6",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Product details"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close overlay"
        onClick={onClose}
        className={cn(
          "absolute inset-0",
          "bg-black/40 dark:bg-black/60",
          "backdrop-blur-sm",
        )}
      />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full sm:w-[min(90vw,42rem)]",
          "max-h-[95dvh] sm:max-h-[80vh]",
          "overscroll-contain",
          "overflow-y-auto",
        )}
      >
        <div
          className={cn(
            "sticky top-0 z-10",
            "flex justify-end",
            "pt-2 pr-2 mb-1",
          )}
        >
          <button type="button" className={closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={cn(card, "p-4 sm:p-6")}>
          {loading && (
            <p className="text-center text-zinc-500 dark:text-zinc-400 py-16">
              Loading…
            </p>
          )}

          {error && (
            <p className="text-center text-red-500 py-16">{error}</p>
          )}

          {product && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Image */}
              <div className={mainImage}>
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.description}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-300 text-sm">
                    No image
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-3">
                  <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-white">
                    {product.description}
                  </h1>
                  <div className={price}>${product.price.toFixed(2)}</div>
                </div>

                <div className="mt-auto">
                  <button
                    type="button"
                    className={buttonClasses}
                    disabled={adding}
                    onClick={async () => {
                      if (adding) return;
                      setAdding(true);
                      try {
                        await addToCart({
                          id: product.item_id,
                          name: product.description,
                          price: product.price,
                          weight: String(product.weight),
                          image: product.image_url,
                        });
                      } catch {
                        // CartProvider surfaces handled cart errors in-app.
                      } finally {
                        setAdding(false);
                      }
                    }}
                  >
                    {adding ? "Adding…" : "Add to cart"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
