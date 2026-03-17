
"use client";

import { useTheme } from "@/context/ThemeContext";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

export default function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "p-2 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-800 transition-all",
        "focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:ring-offset-2",
        "w-10 h-10 flex items-center justify-center"
      )}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ?( 
        <Moon className="h-5 w-5 text-zinc-300" />
      ):(
        <Sun className="h-5 w-5 text-zinc-300 " />
      )}
    </button>
  );
}
