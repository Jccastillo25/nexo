"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

const STANDALONE_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/authorizations", label: "Autorizaciones" },
];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Flota",
    items: [
      { href: "/admin/fleet-trips", label: "Flota y Viajes" },
      { href: "/admin/vehicles", label: "Vehículos" },
      { href: "/admin/accessories", label: "Accesorios" },
    ],
  },
  {
    label: "Conductores",
    items: [
      { href: "/admin/drivers", label: "Conductores" },
      { href: "/admin/license-categories", label: "Categorías de Licencia" },
    ],
  },
  {
    label: "Configuración",
    items: [
      { href: "/admin/incident-categories", label: "Categorías de Novedad" },
      { href: "/admin/admins", label: "Administradores" },
      { href: "/admin/company", label: "Empresa" },
    ],
  },
];

export function AdminSidebar({
  fullName,
  companyName,
  logoUrl,
}: {
  fullName: string;
  companyName: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const activeGroup = NAV_GROUPS.find((g) => g.items.some((i) => pathname.startsWith(i.href)));
    return new Set(activeGroup ? [activeGroup.label] : []);
  });

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const brand = (
    <div className="mb-4 flex items-center gap-2">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo servido desde Supabase Storage
        <img src={logoUrl} alt={companyName} className="h-8 w-8 rounded-lg object-contain bg-slate-800" />
      ) : null}
      <p className="truncate text-sm font-bold text-slate-100">{companyName}</p>
    </div>
  );

  const navLinks = (
    <nav className="flex flex-col gap-1">
      {STANDALONE_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            isActive(item.href) ? "bg-amber-400 text-slate-900" : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          {item.label}
        </Link>
      ))}

      {NAV_GROUPS.map((group) => {
        const isOpen = openGroups.has(group.label);
        const groupHasActive = group.items.some((i) => isActive(i.href));
        return (
          <div key={group.label} className="mt-1">
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${
                groupHasActive ? "text-amber-400" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {group.label}
              <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
            </button>
            {isOpen && (
              <div className="ml-2 flex flex-col gap-1 border-l border-slate-800 pl-2">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      isActive(item.href)
                        ? "bg-amber-400 text-slate-900"
                        : "text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
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
          <div className="w-64 shrink-0 overflow-y-auto bg-slate-900 p-4">
            {brand}
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
      <aside className="hidden w-56 shrink-0 flex-col justify-between overflow-y-auto border-r border-slate-800 bg-slate-900 p-4 md:flex">
        <div>
          {brand}
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
