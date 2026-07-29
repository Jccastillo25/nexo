"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/fleet-trips", label: "Flota y Viajes" },
  { href: "/admin/vehicles", label: "Vehículos" },
  { href: "/admin/accessories", label: "Accesorios" },
  { href: "/admin/drivers", label: "Conductores" },
];

export function AdminSidebar({ fullName }: { fullName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  const navLinks = (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            isActive(item.href)
              ? "bg-amber-400 text-slate-900"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      {/* Barra superior en mobile */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100"
        >
          Menú
        </button>
        <p className="text-sm font-semibold text-slate-100">{fullName}</p>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="w-64 shrink-0 bg-slate-900 p-4">
            <p className="mb-4 text-sm font-semibold text-slate-100">{fullName}</p>
            {navLinks}
            <button
              onClick={handleLogout}
              className="mt-6 w-full rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100"
            >
              Salir
            </button>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Sidebar fijo en desktop */}
      <aside className="hidden w-56 shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-900 p-4 md:flex">
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-100">{fullName}</p>
          <p className="mb-6 text-xs text-slate-500">Panel de Administración</p>
          {navLinks}
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
        >
          Salir
        </button>
      </aside>
    </>
  );
}
