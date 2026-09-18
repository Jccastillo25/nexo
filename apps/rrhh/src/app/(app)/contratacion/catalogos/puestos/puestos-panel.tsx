"use client";

import { useState, useTransition } from "react";
import { StatusBadge, useToast } from "@nexo/ui";
import { crearPuesto, editarPuesto, asignarPlantillaPredeterminada, type PuestoInput } from "./actions";

export interface PuestoRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  departamentoId: string | null;
  plantillaPredeterminadaId: string | null;
}

export interface DepartamentoOption {
  id: string;
  nombre: string;
}

export interface PlantillaOption {
  id: string;
  nombre: string;
}

export interface PuestosPanelProps {
  puestos: PuestoRow[];
  departamentos: DepartamentoOption[];
  plantillas: PlantillaOption[];
  canCrear: boolean;
  canEditar: boolean;
  canVerPlantillas: boolean;
}

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500";

const EMPTY: PuestoInput = { nombre: "", descripcion: "", departamentoId: "" };

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): catalogo de puestos. La plantilla
 * predeterminada por puesto es una sugerencia (rrhh.puesto_plantillas) que
 * se ofrece al crear un contrato para ese puesto -- nunca obliga nada.
 */
export default function PuestosPanel({
  puestos,
  departamentos,
  plantillas,
  canCrear,
  canEditar,
  canVerPlantillas,
}: PuestosPanelProps) {
  const { show } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [nuevo, setNuevo] = useState<PuestoInput>(EMPTY);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PuestoInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function nombreDepartamento(id: string | null) {
    return departamentos.find((d) => d.id === id)?.nombre ?? "—";
  }

  function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.departamentoId) {
      setError("Elegí un departamento para este puesto.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await crearPuesto(nuevo);
      if (!res.ok) {
        setError(res.message ?? "No se pudo crear el puesto.");
        show(res.message ?? "No se pudo crear el puesto.", "error");
        return;
      }
      setNuevo(EMPTY);
      setShowForm(false);
      show("Puesto creado.", "success");
    });
  }

  function empezarEdicion(p: PuestoRow) {
    setEditandoId(p.id);
    setEditForm({ nombre: p.nombre, descripcion: p.descripcion ?? "", departamentoId: p.departamentoId ?? "" });
  }

  function guardarEdicion(p: PuestoRow) {
    if (!editForm.departamentoId) {
      setError("Elegí un departamento para este puesto.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await editarPuesto(p.id, { ...editForm, activo: p.activo });
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar el puesto.");
        show(res.message ?? "No se pudo guardar el puesto.", "error");
        return;
      }
      setEditandoId(null);
      show("Puesto actualizado.", "success");
    });
  }

  function toggleActivo(p: PuestoRow) {
    setError(null);
    startTransition(async () => {
      const res = await editarPuesto(p.id, {
        nombre: p.nombre,
        descripcion: p.descripcion ?? "",
        departamentoId: p.departamentoId ?? "",
        activo: !p.activo,
      });
      if (!res.ok) {
        setError(res.message ?? "No se pudo actualizar el puesto.");
        show(res.message ?? "No se pudo actualizar el puesto.", "error");
      }
    });
  }

  function cambiarPlantilla(p: PuestoRow, plantillaId: string) {
    setError(null);
    startTransition(async () => {
      const res = await asignarPlantillaPredeterminada(p.id, plantillaId || null);
      if (!res.ok) {
        setError(res.message ?? "No se pudo asignar la plantilla.");
        show(res.message ?? "No se pudo asignar la plantilla.", "error");
        return;
      }
      show("Plantilla predeterminada actualizada.", "success");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Puestos</h2>
        {canCrear && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Nuevo puesto
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
              placeholder="ej. Vendedor de mostrador"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">Departamento</span>
            <select
              required
              value={nuevo.departamentoId}
              onChange={(e) => setNuevo((n) => ({ ...n, departamentoId: e.target.value }))}
              className={inputClass}
            >
              <option value="">— Elegí un departamento —</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
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

      <div className="flex flex-col gap-3">
        {puestos.length === 0 && (
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-400">
            Todavía no hay puestos creados.
          </p>
        )}

        {puestos.map((p) => (
          <div key={p.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
            {editandoId === p.id ? (
              <div className="flex flex-col gap-3">
                <input
                  value={editForm.nombre}
                  onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                  className={inputClass}
                />
                <select
                  required
                  value={editForm.departamentoId}
                  onChange={(e) => setEditForm((f) => ({ ...f, departamentoId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">— Elegí un departamento —</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
                <input
                  value={editForm.descripcion}
                  onChange={(e) => setEditForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción (opcional)"
                  className={inputClass}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => guardarEdicion(p)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoId(null)}
                    className="text-sm text-neutral-500 hover:text-neutral-900"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-neutral-900">{p.nombre}</span>
                    <span className="ml-2 text-sm text-neutral-400">{nombreDepartamento(p.departamentoId)}</span>
                    {p.descripcion && <span className="ml-2 text-sm text-neutral-400">{p.descripcion}</span>}
                  </div>
                  <StatusBadge label={p.activo ? "activo" : "inactivo"} tone={p.activo ? "positive" : "neutral"} />
                </div>

                {canVerPlantillas && (
                  <label className="flex items-center gap-2 text-sm text-neutral-600">
                    <span className="text-neutral-500">Plantilla predeterminada:</span>
                    <select
                      value={p.plantillaPredeterminadaId ?? ""}
                      disabled={!canEditar || isPending}
                      onChange={(e) => cambiarPlantilla(p, e.target.value)}
                      className={`${inputClass} disabled:opacity-50`}
                    >
                      <option value="">Ninguna</option>
                      {plantillas.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {canEditar && (
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => empezarEdicion(p)}
                      className="text-neutral-500 hover:text-neutral-900"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActivo(p)}
                      className="text-neutral-500 hover:text-neutral-900"
                    >
                      {p.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
