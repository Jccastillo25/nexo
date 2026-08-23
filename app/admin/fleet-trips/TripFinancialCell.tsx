"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Edición inline de invoice_number/trip_value directamente desde la tabla
// de viajes — resuelve la alerta en tiempo real sin depender de que el
// conductor vuelva a abrir la app. El trigger de la 0018 rechaza el
// UPDATE si el viaje ya pertenece a una liquidación sellada; ese error se
// muestra tal cual, no hace falta duplicar la validación acá.
export function TripFinancialCell({
  tripId,
  invoiceNumber,
  tripValue,
  locked,
}: {
  tripId: string;
  invoiceNumber: string | null;
  tripValue: number | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [invoice, setInvoice] = useState(invoiceNumber ?? "");
  const [value, setValue] = useState(tripValue?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("trips")
      .update({
        invoice_number: invoice.trim() || null,
        trip_value: value.trim() === "" ? null : Number(value),
      })
      .eq("id", tripId);
    setSaving(false);
    if (updateError) {
      setError("No se pudo guardar (¿la liquidación ya está sellada?).");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (locked) {
    return (
      <div className="text-xs text-slate-500">
        <p>{invoiceNumber ?? "—"}</p>
        <p>{tripValue !== null ? `$${tripValue.toLocaleString()}` : "—"}</p>
      </div>
    );
  }

  if (!editing) {
    const missing = invoiceNumber === null || tripValue === null;
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`text-left text-xs ${missing ? "text-amber-400" : "text-slate-300"}`}
      >
        <p>{invoiceNumber ?? "Sin factura"}</p>
        <p>{tripValue !== null ? `$${tripValue.toLocaleString()}` : "Sin valor"}</p>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        placeholder="N° factura"
        value={invoice}
        onChange={(e) => setInvoice(e.target.value)}
        className="w-28 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white"
      />
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        placeholder="Valor"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-28 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-1">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded bg-amber-400 px-2 py-1 text-xs font-semibold text-slate-900 disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setEditing(false)}
          className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
