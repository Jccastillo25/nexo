"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SupadminHeader() {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/supadmin/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-black px-4 py-3 text-slate-100">
      <div>
        <Link href="/supadmin" className="font-bold">
          Ruta360 · Super Admin
        </Link>
        {pathname !== "/supadmin" && (
          <Link href="/supadmin" className="ml-3 text-sm text-slate-400 hover:underline">
            ← Empresas
          </Link>
        )}
      </div>
      <button
        onClick={handleLogout}
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700"
      >
        Salir
      </button>
    </header>
  );
}
