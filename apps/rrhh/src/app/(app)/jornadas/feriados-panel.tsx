"use client";

import { useState, useTransition } from "react";
import { useToast } from "@nexo/ui";
import { crearFeriado, eliminarFeriado } from "./actions";

export interface FeriadoRow {
  id: string;
  fecha: string;
  nombre: string;
}

export interface FeriadosPanelProps {
  feriados: FeriadoRow[];
  canCrear: boolean;
  canEliminar: boolean;
}

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500";

/**
 * F1.4 (2026-09-07): calendario de feriados. Sin motor de pago/calculo
 * todavia (decision de negocio pendiente, ver docs/RRHH_MVP.md) -- este
 * panel solo mantiene el catalogo que F1.5 leera despues. Nexo Enterprise
 * UI (2026-09-07): restyle a tema claro + feedback via useToast.
 */
export default function FeriadosPanel({ feriados, canCrear, canEliminar }: FeriadosPanelProps) {
  const { show } = useToast();
  const [fecha, setFecha] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearFeriado({ fecha, nombre });
      if (!res.ok) {
        setError(res.message ?? "No se pudo crear el feriado.");
        show(res.message ?? "No se pudo crear el feriado.", "error");
        return;
      }
      setFecha("");
      setNombre("");
      show("Feriado agregado.", "success");
    });
  }

  function eliminar(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await eliminarFeriado(id);
      if (!res.ok) {
        setError(res.message ?? "No se pudo eliminar el feriado.");
        show(res.message ?? "No se pudo eliminar el feriado.", "error");
      } else {
        show("Feriado eliminado.", "success");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-neutral-900">Feriados</h2>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {canCrear && (
        <form onSubmit={agregar} className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">Fecha</span>
            <input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">Nombre</span>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. Navidad"
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Agregar
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {feriados.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">Sin feriados registrados.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {feriados.map((f) => (
                <tr key={f.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-500">{f.fecha}</td>
                  <td className="px-4 py-2.5 text-neutral-900">{f.nombre}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canEliminar && (
                      <button type="button" onClick={() => eliminar(f.id)} className="text-red-500 hover:text-red-700">
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
