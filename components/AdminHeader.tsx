"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/admin", label: "Flota y Viajes" },
  { href: "/admin/vehicles", label: "Vehículos" },
  { href: "/admin/accessories", label: "Accesorios" },
  { href: "/admin/drivers", label: "Conductores" },
];

export function AdminHeader({ fullName }: { fullName: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-800 bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{fullName}</p>
          <p className="text-xs text-slate-400">Panel de Administración</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold active:bg-slate-700"
        >
          Salir
        </button>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
              pathname === item.href
                ? "bg-amber-400 text-slate-900"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
