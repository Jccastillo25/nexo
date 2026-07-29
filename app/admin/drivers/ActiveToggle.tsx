"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ActiveToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("users").update({ is_active: !isActive }).eq("id", userId);
    setSaving(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
        isActive ? "bg-slate-800 text-slate-300" : "bg-red-900 text-red-200"
      }`}
    >
      {isActive ? "Activo" : "Inactivo"}
    </button>
  );
}
