"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BigButton } from "@/components/BigButton";

type Category = { id: string; name: string; blocks_trip: boolean };

export function EditIncidentCategoryForm({ category }: { category: Category }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [blocksTrip, setBlocksTrip] = useState(category.blocks_trip);
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
      .from("anomaly_categories")
      .update({ name: name.trim(), blocks_trip: blocksTrip })
      .eq("id", category.id);
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
        <label className="text-sm font-medium text-slate-300">Nombre</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">
          ¿Esta novedad bloquea el viaje hasta que un admin autorice?
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBlocksTrip(true)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${blocksTrip ? "bg-red-600 text-white" : "bg-slate-800 text-slate-300"}`}
          >
            Sí, bloquea el viaje
          </button>
          <button
            type="button"
            onClick={() => setBlocksTrip(false)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${!blocksTrip ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300"}`}
          >
            No, solo se reporta
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
