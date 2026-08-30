"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/supadmin", label: "Dashboard" },
  { href: "/supadmin/companies", label: "Empresas" },
  { href: "/supadmin/settings", label: "Configuración" },
];

export function SupadminSidebar({
  productName,
  logoUrl,
}: {
  productName: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/supadmin/login");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/supadmin" ? pathname === "/supadmin" : pathname.startsWith(href);
  }

  const brand = (
    <div className="mb-6 flex items-center gap-2">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo servido desde Supabase Storage
        <img src={logoUrl} alt={productName} className="h-8 w-8 rounded-lg object-contain bg-slate-900" />
      ) : null}
      <div>
        <p className="truncate text-sm font-bold text-slate-100">{productName}</p>
        <p className="text-xs text-slate-500">Super Admin</p>
      </div>
    </div>
  );

  const navLinks = (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            isActive(item.href) ? "bg-amber-400 text-slate-900" : "text-slate-300 hover:bg-slate-900"
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
      <div className="flex items-center justify-between border-b border-slate-800 bg-black px-4 py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100"
        >
          Menú
        </button>
        <p className="text-sm font-semibold text-slate-100">{productName}</p>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="w-64 shrink-0 bg-black p-4">
            {brand}
            {navLinks}
            <button
              onClick={handleLogout}
              className="mt-6 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100"
            >
              Salir
            </button>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Sidebar fijo en desktop */}
      <aside className="hidden w-56 shrink-0 flex-col justify-between border-r border-slate-800 bg-black p-4 md:flex">
        <div>
          {brand}
          {navLinks}
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          Salir
        </button>
      </aside>
    </>
  );
}
