"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NewCategoryForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("license_categories")
      .insert({ company_id: companyId, name: name.trim() });

    setSubmitting(false);

    if (insertError) {
      setError("No se pudo registrar la categoría.");
      return;
    }

    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 rounded-xl bg-slate-900 p-4">
      <input
        type="text"
        placeholder="Nombre de la categoría (ej. Liviana, Pesada, Motocicleta)"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-900 disabled:opacity-50"
      >
        {submitting ? "..." : "Agregar"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
