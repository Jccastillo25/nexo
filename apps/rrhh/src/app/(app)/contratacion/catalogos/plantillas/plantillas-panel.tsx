"use client";

import { useState, useTransition } from "react";
import { StatusBadge, useToast } from "@nexo/ui";
import { crearPlantilla, editarPlantilla, type PlantillaInput } from "./actions";

export interface PlantillaRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  tieneArchivo: boolean;
}

export interface PlantillasPanelProps {
  plantillas: PlantillaRow[];
  canCrear: boolean;
  canEditar: boolean;
}

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500";

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): catalogo de plantillas de
 * contrato. Sin gestion de archivo todavia -- "tieneArchivo" queda listo
 * para cuando Fase 4 (Storage privado) permita subir el documento real.
 */
export default function PlantillasPanel({ plantillas, canCrear, canEditar }: PlantillasPanelProps) {
  const { show } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [nuevo, setNuevo] = useState<PlantillaInput>({ nombre: "", descripcion: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearPlantilla(nuevo);
      if (!res.ok) {
        setError(res.message ?? "No se pudo crear la plantilla.");
        show(res.message ?? "No se pudo crear la plantilla.", "error");
        return;
      }
      setNuevo({ nombre: "", descripcion: "" });
      setShowForm(false);
      show("Plantilla creada.", "success");
    });
  }

  function toggleActivo(p: PlantillaRow) {
    setError(null);
    startTransition(async () => {
      const res = await editarPlantilla(p.id, {
        nombre: p.nombre,
        descripcion: p.descripcion ?? "",
        activo: !p.activo,
      });
      if (!res.ok) {
        setError(res.message ?? "No se pudo actualizar la plantilla.");
        show(res.message ?? "No se pudo actualizar la plantilla.", "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Plantillas de contrato</h2>
        {canCrear && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Nueva plantilla
          </button>
        )}
      </div>

      <p className="text-xs text-neutral-400">
        Este catálogo todavía no permite adjuntar el documento de la plantilla — esa parte llega en un
        bloque posterior (Storage privado). Por ahora podés crear el nombre y asignarlo como
        predeterminado de un puesto en Contratación → Catálogos → Puestos.
      </p>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form onSubmit={crear} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">Nombre</span>
            <input
              required
              value={nuevo.nombre}
              onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
              placeholder="ej. Contrato vendedor de mostrador"
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
        {plantillas.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">
            Todavía no hay plantillas creadas.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {plantillas.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-neutral-900">{p.nombre}</span>
                    {p.descripcion && <span className="ml-2 text-neutral-400">{p.descripcion}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400">
                    {p.tieneArchivo ? "con archivo" : "sin archivo todavía"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={p.activo ? "activo" : "inactivo"} tone={p.activo ? "positive" : "neutral"} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canEditar && (
                      <button
                        type="button"
                        onClick={() => toggleActivo(p)}
                        className="text-neutral-500 hover:text-neutral-900"
                      >
                        {p.activo ? "Desactivar" : "Activar"}
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
