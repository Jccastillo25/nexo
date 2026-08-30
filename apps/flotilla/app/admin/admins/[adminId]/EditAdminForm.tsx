"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BigButton } from "@/components/BigButton";

type Admin = { id: string; full_name: string; is_active: boolean };

export function EditAdminForm({ admin }: { admin: Admin }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(admin.full_name);
  const [isActive, setIsActive] = useState(admin.is_active);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("admins")
      .update({ full_name: fullName.trim(), is_active: isActive })
      .eq("id", admin.id);
    setSaving(false);

    if (updateError) {
      setError("No se pudo guardar los cambios.");
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Nombre completo</label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Estado</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsActive(true)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300"}`}
          >
            Activo
          </button>
          <button
            type="button"
            onClick={() => setIsActive(false)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${!isActive ? "bg-red-900 text-red-200" : "bg-slate-800 text-slate-300"}`}
          >
            Inactivo
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">Cambios guardados correctamente.</p>}

      <BigButton type="submit" loading={saving} className="max-w-xs">
        Guardar cambios
      </BigButton>
    </form>
  );
}
