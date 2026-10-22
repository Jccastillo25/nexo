"use client";

import { useState, useTransition } from "react";
import { Alert, Button, DataTable, EmptyState, Field, Input, StatusBadge, useToast } from "@nexo/ui";
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

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): catalogo de departamentos
 * organizacionales (lista + form inline + activar/desactivar).
 * 2026-10-20: campos, botones y tabla del kit.
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Departamentos de la empresa</h2>
        {canCrear && !showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            Nuevo departamento
          </Button>
        ) : null}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {showForm ? (
        <form
          onSubmit={crear}
          className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre" required>
              <Input
                required
                value={nuevo.nombre}
                onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
                placeholder="Ej.: Ventas"
              />
            </Field>
            <Field label="Descripción" optional>
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
            <Button type="submit" loading={isPending}>
              Crear departamento
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable
        rows={departamentos}
        rowKey={(d) => d.id}
        density="compact"
        caption="Departamentos de la empresa"
        empty={
          <EmptyState
            bare
            title="Todavía no hay departamentos"
            description="Crea el primero para poder asignarle puestos."
          />
        }
        columns={[
          {
            key: "nombre",
            header: "Departamento",
            render: (d) => <span className="font-medium text-neutral-900">{d.nombre}</span>,
          },
          { key: "descripcion", header: "Descripción", render: (d) => d.descripcion ?? "—" },
          {
            key: "estado",
            header: "Estado",
            render: (d) => (
              <StatusBadge label={d.activo ? "Activo" : "Inactivo"} tone={d.activo ? "positive" : "neutral"} />
            ),
          },
          ...(canEditar
            ? [
                {
                  key: "acciones",
                  header: "Acciones",
                  align: "right" as const,
                  render: (d: DepartamentoRow) => (
                    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => toggleActivo(d)}>
                      {d.activo ? "Desactivar" : "Activar"}
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
