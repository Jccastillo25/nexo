"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Advance = {
  id: string;
  amount: number;
  description: string | null;
  settlement_id: string | null;
  created_at: string | null;
};

// Anticipos/viáticos entregados en efectivo — los registra el admin, el
// conductor no los ve ni los gestiona desde la app (ver 0018_settlements.sql).
// Quedan "sueltos" (settlement_id NULL) hasta que se enganchan solos al
// próximo cierre de ciclo del conductor.
export function DriverAdvances({
  driverId,
  companyId,
  advances,
}: {
  driverId: string;
  companyId: string;
  advances: Advance[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Ingresa un monto válido.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("driver_advances").insert({
      company_id: companyId,
      driver_id: driverId,
      amount: value,
      description: description.trim() || null,
    });
    setSaving(false);
    if (insertError) {
      setError("No se pudo registrar el anticipo.");
      return;
    }
    setAmount("");
    setDescription("");
    router.refresh();
  }

  const loose = advances.filter((a) => !a.settlement_id);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Monto</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Descripción (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Registrar"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-col gap-2">
        {loose.length === 0 && (
          <p className="text-sm text-slate-500">Sin anticipos pendientes de liquidar.</p>
        )}
        {loose.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm"
          >
            <span className="text-slate-300">{a.description || "Anticipo"}</span>
            <span className="font-semibold text-white">${a.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
