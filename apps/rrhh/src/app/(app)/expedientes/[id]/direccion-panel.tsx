"use client";

import { useMemo, useState, useTransition } from "react";
import { useToast } from "@nexo/ui";
import { guardarDireccion, type DireccionInput } from "./direccion-actions";

export interface DepartamentoGeoOption {
  id: string;
  nombre: string;
}

export interface MunicipioGeoOption {
  id: string;
  nombre: string;
  departamentoId: string;
}

export interface DireccionData {
  departamentoGeoId: string | null;
  municipioGeoId: string | null;
  direccionDetalle: string | null;
}

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500";

/**
 * Fase 5 (2026-09-16, bloque pre-F1.5): pestaña "Dirección" del
 * expediente. municipios llega vacío hasta que se complete el catálogo
 * geográfico con una fuente oficial verificada (ver migración
 * 20260916170000_geografia_ni_y_expediente_ampliado.sql) -- el select de
 * municipio queda deshabilitado con esa aclaración mientras tanto, sin
 * bloquear guardar solo el departamento.
 */
export default function DireccionPanel({
  empleadoId,
  direccion,
  departamentos,
  municipios,
  canEditar,
}: {
  empleadoId: string;
  direccion: DireccionData | null;
  departamentos: DepartamentoGeoOption[];
  municipios: MunicipioGeoOption[];
  canEditar: boolean;
}) {
  const { show } = useToast();
  const [form, setForm] = useState<DireccionInput>({
    departamentoGeoId: direccion?.departamentoGeoId ?? "",
    municipioGeoId: direccion?.municipioGeoId ?? "",
    direccionDetalle: direccion?.direccionDetalle ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const municipiosDelDepartamento = useMemo(
    () => municipios.filter((m) => m.departamentoId === form.departamentoGeoId),
    [municipios, form.departamentoGeoId]
  );

  function update<K extends keyof DireccionInput>(key: K, value: DireccionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await guardarDireccion(empleadoId, form);
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar la dirección.");
        show(res.message ?? "No se pudo guardar la dirección.", "error");
        return;
      }
      show("Dirección guardada.", "success");
    });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-500">Departamento</span>
          <select
            disabled={!canEditar}
            value={form.departamentoGeoId}
            onChange={(e) => update("departamentoGeoId", e.target.value)}
            className={`${inputClass} disabled:opacity-60`}
          >
            <option value="">Sin asignar</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-500">Municipio</span>
          <select
            disabled={!canEditar || municipiosDelDepartamento.length === 0}
            value={form.municipioGeoId}
            onChange={(e) => update("municipioGeoId", e.target.value)}
            className={`${inputClass} disabled:opacity-60`}
          >
            <option value="">Sin asignar</option>
            {municipiosDelDepartamento.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
          {municipios.length === 0 && (
            <span className="text-xs text-neutral-400">
              Catálogo de municipios pendiente de cargar — podés guardar solo el departamento.
            </span>
          )}
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-neutral-500">Referencia de dirección</span>
        <textarea
          disabled={!canEditar}
          value={form.direccionDetalle}
          onChange={(e) => update("direccionDetalle", e.target.value)}
          placeholder="ej. De la rotonda Rubén Darío, 2c al lago, casa esquinera"
          rows={3}
          className={`${inputClass} disabled:opacity-60`}
        />
      </label>

      {canEditar && (
        <div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Guardando…" : "Guardar dirección"}
          </button>
        </div>
      )}
    </form>
  );
}
