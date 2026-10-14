"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormSection, StatusBadge, useToast } from "@nexo/ui";
import type { Sucursal } from "@/lib/supabase/database.types";
import { guardarSucursal } from "./actions";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "text-xs font-medium uppercase tracking-wide text-neutral-500";

interface Borrador {
  sucursalId: string | null;
  nombre: string;
  direccion: string;
  activa: boolean;
}

const NUEVA: Borrador = { sucursalId: null, nombre: "", direccion: "", activa: true };

/** Lista de sucursales con alta y edición en la misma pantalla. */
export default function SucursalesPanel({ sucursales, puedeGestionar }: { sucursales: Sucursal[]; puedeGestionar: boolean }) {
  const router = useRouter();
  const { show } = useToast();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function guardar() {
    if (!borrador) return;
    if (borrador.nombre.trim().length < 2) {
      setError("Escribí el nombre de la sucursal.");
      return;
    }
    startTransition(async () => {
      const res = await guardarSucursal(borrador);
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar la sucursal.");
        return;
      }
      show(borrador.sucursalId ? "Sucursal actualizada." : "Sucursal creada.", "success");
      setBorrador(null);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {puedeGestionar && !borrador && (
        <div>
          <button
            type="button"
            onClick={() => {
              setBorrador(NUEVA);
              setError(null);
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Nueva sucursal
          </button>
        </div>
      )}

      {borrador && (
        <FormSection title={borrador.sucursalId ? "Editar sucursal" : "Nueva sucursal"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="s_nombre" className={labelClass}>
                Nombre
              </label>
              <input
                id="s_nombre"
                value={borrador.nombre}
                maxLength={80}
                onChange={(e) => {
                  setBorrador({ ...borrador, nombre: e.target.value });
                  setError(null);
                }}
                placeholder="Sucursal Central"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="s_direccion" className={labelClass}>
                Dirección
              </label>
              <input
                id="s_direccion"
                value={borrador.direccion}
                maxLength={200}
                onChange={(e) => setBorrador({ ...borrador, direccion: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={borrador.activa}
              onChange={(e) => setBorrador({ ...borrador, activa: e.target.checked })}
            />
            Activa
          </label>
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setBorrador(null)}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </FormSection>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-2.5 font-medium">Sucursal</th>
              <th className="px-4 py-2.5 font-medium">Dirección</th>
              <th className="px-4 py-2.5 font-medium">Usuarios</th>
              <th className="px-4 py-2.5 font-medium">Puestos</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sucursales.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-neutral-900">{s.nombre}</td>
                <td className="px-4 py-2.5 text-neutral-600">{s.direccion ?? "—"}</td>
                <td className="px-4 py-2.5 text-neutral-600">{s.usuarios}</td>
                <td className="px-4 py-2.5 text-neutral-600">{s.puestos}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge label={s.activa ? "Activa" : "Inactiva"} tone={s.activa ? "positive" : "neutral"} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  {puedeGestionar && (
                    <button
                      type="button"
                      onClick={() => {
                        setBorrador({ sucursalId: s.id, nombre: s.nombre, direccion: s.direccion ?? "", activa: s.activa });
                        setError(null);
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sucursales.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-neutral-400">Todavía no hay sucursales.</p>
        )}
      </div>
    </div>
  );
}
