"use client";

import { useId, useState } from "react";
import type { Json } from "@/lib/supabase/database.types";

type Pair = { id: string; key: string; value: string };

function toPairs(datosExtra: Json | null | undefined): Pair[] {
  if (
    !datosExtra ||
    typeof datosExtra !== "object" ||
    Array.isArray(datosExtra)
  ) {
    return [];
  }
  return Object.entries(datosExtra).map(([key, value], i) => ({
    id: `${i}-${key}`,
    key,
    value: value === null || value === undefined ? "" : String(value),
  }));
}

/**
 * Editor de pares clave-valor libres para datos_extra (jsonb).
 * Mantiene un input oculto "datos_extra_json" sincronizado con el estado,
 * que es lo que efectivamente viaja en el FormData del formulario.
 */
export default function DatosExtraEditor({
  initial,
}: {
  initial: Json | null;
}) {
  const [pairs, setPairs] = useState<Pair[]>(() => toPairs(initial));
  const uid = useId();

  const json = JSON.stringify(
    Object.fromEntries(
      pairs
        .map((p) => [p.key.trim(), p.value] as const)
        .filter(([key]) => key.length > 0)
    )
  );

  function addPair() {
    setPairs((prev) => [
      ...prev,
      { id: `${uid}-${prev.length}-${Date.now()}`, key: "", value: "" },
    ]);
  }

  function removePair(id: string) {
    setPairs((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePair(id: string, field: "key" | "value", value: string) {
    setPairs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="datos_extra_json" value={json} />

      {pairs.length === 0 && (
        <p className="text-xs text-neutral-500">
          Sin datos adicionales todavía.
        </p>
      )}

      {pairs.map((pair) => (
        <div key={pair.id} className="flex items-center gap-2">
          <input
            type="text"
            value={pair.key}
            onChange={(e) => updatePair(pair.id, "key", e.target.value)}
            placeholder="clave"
            className="w-2/5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            value={pair.value}
            onChange={(e) => updatePair(pair.id, "value", e.target.value)}
            placeholder="valor"
            className="flex-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => removePair(pair.id)}
            aria-label="Eliminar par"
            className="shrink-0 rounded-md border border-neutral-200 px-2 py-1.5 text-xs text-neutral-500 transition-colors hover:border-red-300 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addPair}
        className="mt-1 self-start rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:border-blue-500 hover:text-blue-600"
      >
        + agregar par clave-valor
      </button>
    </div>
  );
}
