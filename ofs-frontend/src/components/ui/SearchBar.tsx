"use client";

// TODO Fix the filter, put it in its own separate container, 
// make search bar update as you type
import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import { inputClasses, buttonClasses } from "@/lib/theme-classes";
import { X, Filter } from "lucide-react";

type FilterOption = { label: string; value: string };

type SearchBarProps = {
  onSearch?: (query: string, filters: string[]) => void;
  placeholder?: string;
};

export default function SearchBar({
  onSearch,
  placeholder = "Search products...",
}: SearchBarProps) {
  const categories = useMemo<FilterOption[]>(
    () => [
      { label: "Fruits", value: "fruits" },
      { label: "Vegetables", value: "vegetables" },
      { label: "Dairy", value: "dairy" },
      { label: "Bakery", value: "bakery" },
      { label: "Snack", value: "snack" },
      { label: "Meal", value: "meal" },
      { label: "Drink", value: "drink" },
    ],
    []
  );

  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = () => {
    onSearch?.(query.trim(), selectedFilters);
  };

  const clearFilters = () => {
    setQuery("");
    setSelectedFilters([]);
    onSearch?.("", []);
  };

  const toggleFilter = (value: string) => {
    setSelectedFilters((prev) =>
      prev.includes(value)
        ? prev.filter((f) => f !== value)
        : [...prev, value]
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto mb-6">
      {/* Main search row */}
      <div className="flex items-stretch gap-3 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm rounded-xl p-2 border border-zinc-200 dark:border-zinc-700 shadow-xl">
        {/* search */}
        <input
          className="flex-1 min-w-[300px] bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-xl px-6 py-2 text-lg placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />

        {/* Filters Button */}
        <div className="flex-shrink-0">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              buttonClasses,
              "px-6 py-2 flex items-center gap-2 whitespace-nowrap shadow-sm",
              selectedFilters.length > 0 
                ? "bg-emerald-500 hover:bg-emerald-400 text-white" 
                : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
            )}
          >
            <Filter className="h-6 w-4" />
            {selectedFilters.length > 0 ? `Filters (${selectedFilters.length})` : "Filters"}
          </button>
        </div>

        {/* Clear Button*/}
        <div className="flex-shrink-0">
          <button
            onClick={clearFilters}
            className={cn(
              buttonClasses,
              "px-6 py-2 h-10 flex items-center gap-2 whitespace-nowrap shadow-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500",
              (!query && selectedFilters.length === 0) && "opacity-50 cursor-not-allowed"
            )}
            disabled={!query && selectedFilters.length === 0}
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Filters Dropdown with checkbox */}
    {showFilters && (
      <div className="fixed right-4 top-20 z-50 w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 shadow-2xl max-h-64 overflow-y-auto">
        <div className="space-y-2">
          {categories.map((category) => (
            <label key={category.value} className="flex items-center gap-3 p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-lg cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selectedFilters.includes(category.value)}
                onChange={() => toggleFilter(category.value)}
                className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500 dark:bg-zinc-700 dark:border-zinc-600"
              />
              <span className="text-zinc-700 dark:text-zinc-300 capitalize">{category.value}</span>
            </label>
          ))}
        </div>
      </div>
    )}
    </div>
  );
}
