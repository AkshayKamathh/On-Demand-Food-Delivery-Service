// app/(dashboard)/layout.tsx
import { CartProvider } from "@/context/CartContext";
import DashboardNavbar from "@/components/ui/UserDashNavbar";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider> 
      <DashboardNavbar />
      <main>{children}</main>
    </CartProvider>
  );
}
