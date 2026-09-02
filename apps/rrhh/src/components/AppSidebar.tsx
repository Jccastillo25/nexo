"use client";

// Wrapper cliente del Sidebar compartido: el layout autenticado
// ((app)/layout.tsx) es un Server Component (ahi vive el chequeo de
// permisos), y no tiene forma directa de leer el pathname actual para
// marcar el item activo. usePathname() solo existe en Client Components —
// mismo patron que apps/crm/src/components/AppSidebar.tsx.
import { usePathname } from "next/navigation";
import { Sidebar, type SidebarItem } from "@nexo/ui";

const BASE_ITEMS: Omit<SidebarItem, "active">[] = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  { label: "Expedientes", href: "/expedientes", icon: "folder" },
  { label: "Kiosco", href: "/kiosco", icon: "clock" },
  { label: "Planillas", href: "/planillas", icon: "cash" },
];

export default function AppSidebar() {
  const pathname = usePathname();

  const items: SidebarItem[] = BASE_ITEMS.map((item) => ({
    ...item,
    active: pathname === item.href || pathname.startsWith(`${item.href}/`),
  }));

  return <Sidebar items={items} />;
}
