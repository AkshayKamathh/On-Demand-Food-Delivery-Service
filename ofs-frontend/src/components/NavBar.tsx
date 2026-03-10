// src/components/NavBar.tsx
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between p-4 border-b">
      <div>OFS</div>
      <div className="flex items-center gap-4">
        <ThemeToggleButton />
      </div>
    </nav>
  );
}
