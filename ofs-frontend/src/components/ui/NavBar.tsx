// src/components/NavBar.tsx
"use client";

import { usePathname } from "next/navigation";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import Link from "next/link";

export default function Navbar() {
  const pathname = usePathname();

  // Show starting navbar on landing page AND auth routes
  const showNavbar = pathname === "/" 
  || pathname.startsWith("/login") 
  || pathname.startsWith("/forgot-password")
  || pathname.startsWith("/signup")

  if (!showNavbar) return null;

  return (
    <nav className="flex items-center justify-between p-4 border-b border-zinc-200 border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <Link href="/" className="text-xl font-bold text-zinc-50">
        OFS
      </Link>
      <div className="flex items-center gap-4">
        <ThemeToggleButton />
      </div>
    </nav>
  );
}
