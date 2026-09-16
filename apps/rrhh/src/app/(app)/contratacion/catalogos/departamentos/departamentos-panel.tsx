"use client";

import { useState, useTransition } from "react";
import { StatusBadge, useToast } from "@nexo/ui";
import { crearDepartamento, editarDepartamento, type DepartamentoInput } from "./actions";

export interface DepartamentoRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface DepartamentosPanelProps {
  departamentos: DepartamentoRow[];
  canCrear: boolean;
  canEditar: boolean;
}

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500";

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): catalogo de departamentos
 * organizacionales. Mismo patron visual que apps/rrhh/.../jornadas/
 * jornadas-panel.tsx (lista + form inline + activar/desactivar).
 */
export default function DepartamentosPanel({ departamentos, canCrear, canEditar }: DepartamentosPanelProps) {
  const { show } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [nuevo, setNuevo] = useState<DepartamentoInput>({ nombre: "", descripcion: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearDepartamento(nuevo);
      if (!res.ok) {
        setError(res.message ?? "No se pudo crear el departamento.");
        show(res.message ?? "No se pudo crear el departamento.", "error");
        return;
      }
      setNuevo({ nombre: "", descripcion: "" });
      setShowForm(false);
      show("Departamento creado.", "success");
    });
  }

  function toggleActivo(d: DepartamentoRow) {
    setError(null);
    startTransition(async () => {
      const res = await editarDepartamento(d.id, {
        nombre: d.nombre,
        descripcion: d.descripcion ?? "",
        activo: !d.activo,
      });
      if (!res.ok) {
        setError(res.message ?? "No se pudo actualizar el departamento.");
        show(res.message ?? "No se pudo actualizar el departamento.", "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Departamentos</h2>
        {canCrear && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Nuevo departamento
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form onSubmit={crear} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">Nombre</span>
            <input
              required
              value={nuevo.nombre}
              onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
              placeholder="ej. Ventas"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">Descripción (opcional)</span>
            <input
              value={nuevo.descripcion}
              onChange={(e) => setNuevo((n) => ({ ...n, descripcion: e.target.value }))}
              className={inputClass}
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {departamentos.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">
            Todavía no hay departamentos creados.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {departamentos.map((d) => (
                <tr key={d.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-neutral-900">{d.nombre}</span>
                    {d.descripcion && <span className="ml-2 text-neutral-400">{d.descripcion}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={d.activo ? "activo" : "inactivo"} tone={d.activo ? "positive" : "neutral"} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canEditar && (
                      <button
                        type="button"
                        onClick={() => toggleActivo(d)}
                        className="text-neutral-500 hover:text-neutral-900"
                      >
                        {d.activo ? "Desactivar" : "Activar"}
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
