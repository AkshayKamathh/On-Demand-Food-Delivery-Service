"use client";

/*
Call with:
<ProductDetailPage open={open} onClose={() => setOpen(false)} />
*/

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { buttonClasses, dividerClasses } from "@/lib/theme-classes";

type Nutrient = { label: string; value: string };

type ProductDetailOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export default function ProductDetailOverlay({
  open,
  onClose,
}: ProductDetailOverlayProps) {
  const images = useMemo(() => [0, 1, 2, 3, 4, 5], []);
  const [activeIndex, setActiveIndex] = useState(0);

  const nutrients: Nutrient[] = [
    { label: "Calories", value: "—" },
    { label: "Protein", value: "— g" },
    { label: "Carbs", value: "— g" },
    { label: "Fat", value: "— g" },
    { label: "Sodium", value: "— mg" },
  ];

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
    "text-zinc-400 dark:text-zinc-300",
  );

  const thumbBase = cn(
    "shrink-0 w-20 h-20 rounded-xl",
    "bg-zinc-100 dark:bg-zinc-700",
    "border border-zinc-200 dark:border-zinc-600",
    "flex items-center justify-center",
    "text-zinc-400 dark:text-zinc-300",
    "cursor-pointer hover:opacity-90",
    "focus:outline-none focus:ring-2 focus:ring-emerald-500",
  );

  const bodyText = cn(
    "text-sm sm:text-base leading-relaxed",
    "text-zinc-600 dark:text-zinc-300",
  );

  const price = cn(
    "text-xl font-semibold",
    "text-emerald-700 dark:text-emerald-400",
  );

  const subtleText = cn("text-xs", "text-zinc-500 dark:text-zinc-400");
  const surface = cn(
    "rounded-xl",
    "border border-zinc-200 dark:border-zinc-700",
  );
  const nutrientRow = cn("flex items-center justify-between py-2");
  const nutrientKey = cn("text-zinc-600 dark:text-zinc-300");
  const nutrientVal = cn("text-zinc-900 dark:text-white font-medium");

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
          "relative w-full",
          "max-w-5xl",
          "max-h-[90dvh] sm:max-h-[90vh]",
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Media */}
            <div>
              <div className={mainImage}>
                <div className="text-center">
                  <div className="text-sm font-medium">Product Image</div>
                  <div className="text-xs opacity-80">
                    Placeholder #{activeIndex + 1}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex gap-3 overflow-x-auto pb-1 px-1 py-1">
                {images.map((imgIdx) => {
                  const isActive = imgIdx === activeIndex;
                  return (
                    <button
                      key={imgIdx}
                      type="button"
                      onClick={() => setActiveIndex(imgIdx)}
                      className={cn(
                        thumbBase,
                        isActive &&
                          "ring-2 ring-emerald-500 border-transparent",
                      )}
                      aria-pressed={isActive}
                    >
                      <span className="text-xs">#{imgIdx + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Details */}
            <div className="flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-white">
                    Product Name
                  </h1>
                  <div className={price}>$9.99</div>
                </div>

                <p className={cn(bodyText, "mt-3")}>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                  do eiusmod tempor.
                </p>
              </div>

              <div className={dividerClasses} />

              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  Nutrition
                </h2>
                <p className={cn(bodyText, "mt-1")}>
                  Per serving (placeholder values).
                </p>

                <div className={cn(surface, "mt-3")}>
                  <div className="p-4">
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                      {nutrients.map((n) => (
                        <div key={n.label} className={nutrientRow}>
                          <span className={nutrientKey}>{n.label}</span>
                          <span className={nutrientVal}>{n.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className={dividerClasses} />

              <div className="mt-auto">
                <button
                  type="button"
                  className={buttonClasses}
                  onClick={() => alert("Added to cart (placeholder)")}
                >
                  Add to cart
                </button>

                <p className={cn(subtleText, "mt-3")}>
                  Shipping and taxes calculated at checkout. (Placeholder)
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={cn(card, "p-4 sm:p-6 mt-6")}>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Details
          </h2>
          <p className={cn(bodyText, "mt-2")}>
            More product details can go here.
          </p>
        </div>
      </div>
    </div>
  );
}
