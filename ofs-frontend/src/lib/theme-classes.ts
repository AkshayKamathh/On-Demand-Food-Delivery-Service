
import { cn } from "./cn";

export const inputClasses = cn(
  "bg-white dark:bg-zinc-800",
  "border border-zinc-300 dark:border-zinc-700",
  "text-zinc-900 dark:text-white",
  "placeholder-zinc-400 dark:placeholder-zinc-500",
  "rounded-lg px-3 py-2 text-sm",
  "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
);

export const labelClasses = cn(
  "text-sm font-medium",
  "text-zinc-700 dark:text-zinc-300"
);

export const buttonClasses = cn(
  "w-full font-medium py-2 px-4 rounded-lg text-sm transition-colors",
  "bg-emerald-600 hover:bg-emerald-700",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
);

export const dividerClasses = cn(
  "flex-1 h-px bg-zinc-300 dark:bg-zinc-700"
);

export const linkClasses = cn(
  "text-emerald-700 dark:text-emerald-700",
  "hover:text-indigo-500 dark:hover:text-indigo-300",
  "font-medium"
);

export const subtitleClasses = cn(
  "text-zinc-500 dark:text-zinc-400 text-sm"
);

export const errorClasses = cn(
  "bg-red-500/10 border border-red-500/30",
  "text-red-500 dark:text-red-400",
  "text-sm px-4 py-3 rounded-lg"
);

export const passwordToggleButtonClasses = cn(
  "absolute right-3 top-1/2 -translate-y-1/2",
  "text-zinc-400 hover:text-zinc-600",
  "dark:text-zinc-500 dark:hover:text-zinc-300",
  "focus:outline-none"
);
