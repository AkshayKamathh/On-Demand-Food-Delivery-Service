"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { inputClasses, buttonClasses } from "@/lib/theme-classes";

type FilterOption = { label: string; value: string };

type SearchBarProps = {
  /** optional callback when user submits */
  onSearch?: (query: string, filter: string) => void;
  /** optional placeholder */
  placeholder?: string;
};

export default function SearchBar({
  onSearch,
  placeholder = "Search products...",
}: SearchBarProps) {
  const filters = useMemo<FilterOption[]>(
    () => [
      { label: "All", value: "all" },
      { label: "Snacks", value: "snacks" },
      { label: "Drinks", value: "drinks" },
      { label: "Meals", value: "meals" },
    ],
    [],
  );

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(filters[0]?.value ?? "all");

  // Inline styles (same “format” as your page)
  const wrapper = cn(
    // at most 20% of viewport width, but usable on small screens
    "w-full max-w-full",
    "sm:max-h-[20vh]",
    "width: 100%",
    "min-w-[220px] sm:min-w-0",
    "px-4 py-3",
    "flex justify-center items-center",
  );

  const form = cn("flex items-stretch gap-2 w-[80vw] max-w-[1000px]");

  const selectClasses = cn(
    // keep consistent with input look
    inputClasses,
    "py-2", // match input height
    "bg-white dark:bg-zinc-800",
  );

  const textInput = cn(inputClasses, "flex-1 py-2");

  const submitButton = cn(
    // reuse your theme button, but override width to fit inline
    buttonClasses,
    "w-auto",
    "px-4 py-2",
    "whitespace-nowrap",
  );

  return (
    <div className={wrapper}>
      <form
        className={form}
        onSubmit={(e) => {
          e.preventDefault();
          onSearch?.(query.trim(), filter);
        }}
      >
        {/* Dropdown filter (optional, but included) */}
        <select
          className={selectClasses}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter"
        >
          {filters.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Search input */}
        <input
          className={textInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
        />

        {/* Green button */}
        <button type="submit" className={submitButton} disabled={!query.trim()}>
          Search
        </button>
      </form>
    </div>
  );
}
