"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormSection, StatusBadge, useToast } from "@nexo/ui";
import type { PuestoEstado } from "@/lib/supabase/database.types";
import { guardarPuesto } from "./actions";

const inputClass =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

interface Borrador {
  puestoId: string | null;
  nombre: string;
  orden: number;
  activo: boolean;
}

/** Puestos de la sucursal. El orden define cuál se asigna primero al iniciar atención. */
export default function PuestosPanel({ sucursalId, puestos }: { sucursalId: string; puestos: PuestoEstado[] }) {
  const router = useRouter();
  const { show } = useToast();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function nuevo() {
    const siguiente = puestos.length + 1;
    setBorrador({ puestoId: null, nombre: `Puesto ${siguiente}`, orden: siguiente, activo: true });
    setError(null);
  }

  function guardar() {
    if (!borrador) return;
    startTransition(async () => {
      const res = await guardarPuesto({ ...borrador, sucursalId });
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar el puesto.");
        return;
      }
      show("Puesto guardado.", "success");
      setBorrador(null);
      router.refresh();
    });
  }

  return (
    <FormSection
      title="Puestos de atención"
      description="Al iniciar atención, el agente recibe el primer puesto libre según este orden."
    >
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {puestos.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="flex items-center gap-3">
              <span className="w-6 text-xs text-neutral-400">{p.orden}</span>
              <span className="font-medium text-neutral-900">{p.nombre}</span>
              {!p.activo && <StatusBadge label="Inactivo" tone="neutral" />}
              {p.ocupado_por && <StatusBadge label={`Ocupado: ${p.ocupado_por}`} tone="info" />}
            </div>
            <button
              type="button"
              onClick={() => {
                setBorrador({ puestoId: p.id, nombre: p.nombre, orden: p.orden, activo: p.activo });
                setError(null);
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Editar
            </button>
          </li>
        ))}
        {puestos.length === 0 && <li className="px-4 py-4 text-sm text-neutral-500">Todavía no hay puestos.</li>}
      </ul>

      {borrador ? (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Nombre
              <input
                value={borrador.nombre}
                maxLength={40}
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Orden
              <input
                type="number"
                min={1}
                value={borrador.orden}
                onChange={(e) => setBorrador({ ...borrador, orden: Number(e.target.value) })}
                className={`${inputClass} w-24`}
              />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700">
              <input type="checkbox" checked={borrador.activo} onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })} />
              Activo
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setBorrador(null)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isPending ? "Guardando…" : "Guardar puesto"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" onClick={nuevo} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            Agregar puesto
          </button>
        </div>
      )}
    </FormSection>
  );
}
