"use client";

import { useState, useTransition } from "react";
import { Alert, Button, EmptyState, Field, Input, Select, StatusBadge, useToast } from "@nexo/ui";
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
  /** rrhh.expedientes.plantillas.editar: lo exige asignarPlantillaPredeterminada en el servidor. */
  canAsignarPlantilla: boolean;
}

const EMPTY: PuestoInput = { nombre: "", descripcion: "", departamentoId: "" };

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): catalogo de puestos. La plantilla
 * predeterminada por puesto es una sugerencia (rrhh.puesto_plantillas) que
 * se ofrece al crear un contrato para ese puesto -- nunca obliga nada.
 * 2026-10-20: campos y botones del kit; el selector de plantilla se
 * habilita con el mismo permiso que valida la acción (plantillas.editar).
 */
export default function PuestosPanel({
  puestos,
  departamentos,
  plantillas,
  canCrear,
  canEditar,
  canVerPlantillas,
  canAsignarPlantilla,
}: PuestosPanelProps) {
  const { show } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [nuevo, setNuevo] = useState<PuestoInput>(EMPTY);
  const [errorNuevoDepto, setErrorNuevoDepto] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PuestoInput>(EMPTY);
  const [errorEditDepto, setErrorEditDepto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function nombreDepartamento(id: string | null) {
    return departamentos.find((d) => d.id === id)?.nombre ?? "Sin departamento";
  }

  function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.departamentoId) {
      setErrorNuevoDepto("Elige un departamento para este puesto.");
      return;
    }
    setErrorNuevoDepto(null);
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
    setErrorEditDepto(null);
    setEditForm({ nombre: p.nombre, descripcion: p.descripcion ?? "", departamentoId: p.departamentoId ?? "" });
  }

  function guardarEdicion(p: PuestoRow) {
    if (!editForm.departamentoId) {
      setErrorEditDepto("Elige un departamento para este puesto.");
      return;
    }
    setErrorEditDepto(null);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Puestos de trabajo</h2>
        {canCrear && !showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            Nuevo puesto
          </Button>
        ) : null}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {showForm ? (
        <form
          onSubmit={crear}
          noValidate
          className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre" required>
              <Input
                required
                value={nuevo.nombre}
                onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
                placeholder="Ej.: Vendedor de mostrador"
              />
            </Field>
            <Field label="Departamento" required error={errorNuevoDepto}>
              <Select
                value={nuevo.departamentoId}
                onChange={(e) => {
                  setNuevo((n) => ({ ...n, departamentoId: e.target.value }));
                  setErrorNuevoDepto(null);
                }}
              >
                <option value="">Elige un departamento</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Descripción" optional className="sm:col-span-2">
              <Input
                value={nuevo.descripcion}
                onChange={(e) => setNuevo((n) => ({ ...n, descripcion: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={isPending} disabled={!nuevo.nombre.trim()}>
              Crear puesto
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-3">
        {puestos.length === 0 ? (
          <EmptyState title="Todavía no hay puestos" description="Crea el primero para poder usarlo en un contrato." />
        ) : null}

        {puestos.map((p) => (
          <div key={p.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
            {editandoId === p.id ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Nombre" required>
                    <Input
                      value={editForm.nombre}
                      onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                    />
                  </Field>
                  <Field label="Departamento" required error={errorEditDepto}>
                    <Select
                      value={editForm.departamentoId}
                      onChange={(e) => {
                        setEditForm((f) => ({ ...f, departamentoId: e.target.value }));
                        setErrorEditDepto(null);
                      }}
                    >
                      <option value="">Elige un departamento</option>
                      {departamentos.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nombre}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Descripción" optional className="sm:col-span-2">
                    <Input
                      value={editForm.descripcion}
                      onChange={(e) => setEditForm((f) => ({ ...f, descripcion: e.target.value }))}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" onClick={() => setEditandoId(null)} disabled={isPending}>
                    Cancelar
                  </Button>
                  <Button
                    loading={isPending}
                    disabled={!editForm.nombre.trim()}
                    onClick={() => guardarEdicion(p)}
                  >
                    Guardar cambios
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">{p.nombre}</p>
                    <p className="text-sm text-neutral-500">
                      {nombreDepartamento(p.departamentoId)}
                      {p.descripcion ? ` · ${p.descripcion}` : ""}
                    </p>
                  </div>
                  <StatusBadge label={p.activo ? "Activo" : "Inactivo"} tone={p.activo ? "positive" : "neutral"} />
                </div>

                {canVerPlantillas ? (
                  <Field
                    label="Plantilla predeterminada"
                    className="sm:max-w-sm"
                    hint={!canAsignarPlantilla ? "Tu rol no permite cambiarla." : undefined}
                  >
                    <Select
                      value={p.plantillaPredeterminadaId ?? ""}
                      disabled={!canAsignarPlantilla || isPending}
                      onChange={(e) => cambiarPlantilla(p, e.target.value)}
                    >
                      <option value="">Ninguna</option>
                      {plantillas.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.nombre}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}

                {canEditar ? (
                  <div className="flex flex-wrap items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => empezarEdicion(p)} disabled={isPending}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActivo(p)} disabled={isPending}>
                      {p.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
