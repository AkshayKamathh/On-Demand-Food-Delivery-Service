"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from "react";
import { cn } from "@/lib/cn";

import {
  inputClasses,
  labelClasses,
  buttonClasses,
  dividerClasses,
  linkClasses,
  subtitleClasses,
  errorClasses,
} from "@/lib/theme-classes";

import SearchBar from "../SearchBar";

type Theme = "light" | "dark";

type Nutrient = { label: string; value: string };

export default function ProductDetailPage() {
  // Placeholder "images" (later swap to real URLs and next/image)
  const images = useMemo(() => [0, 1, 2, 3, 4, 5], []);
  const [activeIndex, setActiveIndex] = useState(0);

  // Update to real product data structure as needed (name, price, description, nutrition, etc.)
  const nutrients: Nutrient[] = [
    { label: "Calories", value: "—" },
    { label: "Protein", value: "— g" },
    { label: "Carbs", value: "— g" },
    { label: "Fat", value: "— g" },
    { label: "Sodium", value: "— mg" },
  ];

  // Inline “theme-ish” classes (match your zinc + emerald palette)
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

  const secondaryButton = cn(
    "text-sm font-medium",
    "px-3 py-2 rounded-lg",
    "border border-zinc-200 dark:border-zinc-700",
    "bg-white dark:bg-zinc-800",
    "hover:bg-zinc-50 dark:hover:bg-zinc-700",
    "focus:outline-none focus:ring-2 focus:ring-emerald-500",
  );

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900">
      <SearchBar></SearchBar>
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className={cn(card, "p-4 sm:p-6")}>
          {/* Optional top bar 
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className={cn("text-sm", "text-zinc-500 dark:text-zinc-400")}>
              Theme: <span className="font-medium">{theme}</span>
            </div>

            <button
              type="button"
              className={secondaryButton}
              onClick={toggleTheme}
            >
              Toggle theme
            </button>
          </div>
          */}

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

              <div
                className="mt-3 flex gap-3 overflow-x-auto pb-1 px-1 py-1"
                aria-label="Product thumbnails"
              >
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
                      aria-label={`Select image ${imgIdx + 1}`}
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
                  do eiusmod tempor incididunt ut labore et dolore magna aliqua.
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
                {/* Reuse your existing theme button */}
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

        {/* Extra section */}
        <div className={cn(card, "p-4 sm:p-6 mt-6")}>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Details
          </h2>
          <p className={cn(bodyText, "mt-2")}>
            More product details can go here (ingredients, allergens, origin,
            etc.).
          </p>
        </div>
      </div>
    </div>
  );
}
