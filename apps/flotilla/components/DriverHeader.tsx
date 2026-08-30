"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOfflineSync } from "@/lib/offline/useOfflineSync";

export function DriverHeader({ fullName }: { fullName: string }) {
  const router = useRouter();
  const { pendingCount, isOnline } = useOfflineSync();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between gap-3 bg-slate-800 px-4 py-3 text-slate-100">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{fullName}</p>
        <p className="text-xs text-slate-400">
          {isOnline ? "En línea" : "Sin conexión"}
          {pendingCount > 0 && ` · ${pendingCount} evento(s) pendientes de enviar`}
        </p>
      </div>
      <button
        onClick={handleLogout}
        className="shrink-0 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold active:bg-slate-600"
      >
        Salir
      </button>
    </header>
  );
}
