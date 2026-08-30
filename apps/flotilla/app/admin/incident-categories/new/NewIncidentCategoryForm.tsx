"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BigButton } from "@/components/BigButton";

export function NewIncidentCategoryForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [blocksTrip, setBlocksTrip] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("anomaly_categories")
      .insert({ company_id: companyId, name: name.trim(), blocks_trip: blocksTrip });

    setSubmitting(false);

    if (insertError) {
      setError("No se pudo crear la categoría.");
      return;
    }

    router.push("/admin/incident-categories");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Nombre</label>
        <input
          type="text"
          placeholder="ej. Espejos retrovisores"
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

      <BigButton type="submit" loading={submitting} className="max-w-xs">
        Crear categoría
      </BigButton>
    </form>
  );
}
