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
  category_id: number | null;
  price: number;
  weight: number;
  stock: number;
  image_url: string | null;
  long_description: string | null;
  nutrition: Record<string, unknown> | null;
  extra: Record<string, unknown> | null;
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
  const [quantity, setQuantity] = useState(1);

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

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
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

  const detailsBlock = cn(
    "rounded-xl border border-zinc-200 dark:border-zinc-700",
    "bg-zinc-50 dark:bg-zinc-900/50 p-3",
  );

  const detailKey = "text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
  const detailValue = "mt-1 text-sm text-zinc-800 dark:text-zinc-100";

  const toTitleCase = (key: string) =>
    key
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\w/, (ch) => ch.toUpperCase());

  const formatScalar = (value: unknown) => {
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return Number.isInteger(value) ? `${value}` : value.toFixed(2);
    if (value === null || value === undefined || value === "") return "N/A";
    return String(value);
  };

  const renderStructuredDetails = (data: Record<string, unknown> | null) => {
    if (!data || Object.keys(data).length === 0) {
      return <span className="text-zinc-500 dark:text-zinc-400">N/A</span>;
    }

    return (
      <div className="space-y-2">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="text-sm text-zinc-800 dark:text-zinc-100">
            <p className="font-medium">{toTitleCase(key)}</p>
            {Array.isArray(value) ? (
              value.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {value.map((entry, index) => (
                    <span
                      key={`${key}-${index}`}
                      className="rounded-md bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
                    >
                      {formatScalar(entry)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 dark:text-zinc-400">N/A</p>
              )
            ) : typeof value === "object" && value !== null ? (
              <div className="mt-1 rounded-md bg-zinc-100 p-2 text-xs dark:bg-zinc-800/80">
                {Object.entries(value as Record<string, unknown>).map(([nestedKey, nestedVal]) => (
                  <p key={`${key}-${nestedKey}`}>
                    <span className="font-medium">{toTitleCase(nestedKey)}:</span>{" "}
                    {formatScalar(nestedVal)}
                  </p>
                ))}
              </div>
            ) : (
              <p>{formatScalar(value)}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

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
          "relative w-full sm:w-[min(94vw,68rem)]",
          "max-h-[96dvh] sm:max-h-[88vh]",
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

        <div className={cn(card, "p-4 sm:p-5 lg:p-6")}>
          {loading && (
            <p className="text-center text-zinc-500 dark:text-zinc-400 py-16">
              Loading…
            </p>
          )}

          {error && (
            <p className="text-center text-red-500 py-16">{error}</p>
          )}

          {product && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5 lg:gap-6">
              {/* Image */}
              <div className="flex flex-col gap-4">
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
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Quantity
                    </span>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                      <button
                        type="button"
                        className="h-7 w-7 rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                        disabled={adding || product.stock <= 0 || quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, product.stock)}
                        value={quantity}
                        onChange={(e) => {
                          const nextValue = Number(e.target.value);
                          if (Number.isNaN(nextValue)) return;
                          setQuantity(
                            Math.min(Math.max(1, nextValue), Math.max(1, product.stock)),
                          );
                        }}
                        className="w-14 rounded-md border border-zinc-200 bg-white px-2 py-1 text-center text-sm text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        disabled={adding || product.stock <= 0}
                        aria-label="Product quantity"
                      />
                      <button
                        type="button"
                        className="h-7 w-7 rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        onClick={() =>
                          setQuantity((prev) =>
                            Math.min(Math.max(1, product.stock), prev + 1),
                          )
                        }
                        disabled={
                          adding || product.stock <= 0 || quantity >= Math.max(1, product.stock)
                        }
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={cn(buttonClasses, "mt-3 w-full")}
                    disabled={adding || product.stock <= 0}
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
                          quantity,
                        });
                      } catch {
                        // CartProvider surfaces handled cart errors in-app.
                      } finally {
                        setAdding(false);
                      }
                    }}
                  >
                    {product.stock <= 0
                      ? "Sold out"
                      : adding
                        ? "Adding…"
                        : "Add to cart"}
                  </button>
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-white">
                    {product.description}
                  </h1>
                  <div className={price}>${product.price.toFixed(2)}</div>
                </div>

                {product.stock <= 0 && (
                  <p className="text-sm font-medium text-red-500">Out of stock</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className={detailsBlock}>
                    <p className={detailKey}>Weight</p>
                    <p className={detailValue}>{product.weight} lb</p>
                  </div>
                  <div className={detailsBlock}>
                    <p className={detailKey}>Stock</p>
                    <p className={detailValue}>{product.stock}</p>
                  </div>
                </div>

                <div className={detailsBlock}>
                  <p className={detailKey}>Long Description</p>
                  <p className={detailValue}>
                    {product.long_description ?? "N/A"}
                  </p>
                </div>

                <div className={detailsBlock}>
                  <p className={detailKey}>Nutrition</p>
                  <div className={detailValue}>{renderStructuredDetails(product.nutrition)}</div>
                </div>

                <div className={detailsBlock}>
                  <p className={detailKey}>Extra</p>
                  <div className={detailValue}>{renderStructuredDetails(product.extra)}</div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
