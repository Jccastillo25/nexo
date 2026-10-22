"use client";

import { useState, useTransition } from "react";
import { Alert, Button, DataTable, EmptyState, Field, Input, StatusBadge, useToast } from "@nexo/ui";
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

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): catalogo de plantillas de
 * contrato. Sin gestion de archivo todavia -- "tieneArchivo" queda listo
 * para cuando Fase 4 (Storage privado) permita subir el documento real.
 * 2026-10-20: campos, botones y tabla del kit.
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Plantillas</h2>
        {canCrear && !showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            Nueva plantilla
          </Button>
        ) : null}
      </div>

      <Alert tone="info">
        Todavía no se puede adjuntar el documento de la plantilla. Por ahora puedes crear su nombre y asignarla como
        predeterminada de un puesto en Contratación → Catálogos → Puestos.
      </Alert>

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
                placeholder="Ej.: Contrato vendedor de mostrador"
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
              Crear plantilla
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable
        rows={plantillas}
        rowKey={(p) => p.id}
        density="compact"
        caption="Plantillas de contrato"
        empty={<EmptyState bare title="Todavía no hay plantillas" />}
        columns={[
          {
            key: "nombre",
            header: "Plantilla",
            render: (p) => <span className="font-medium text-neutral-900">{p.nombre}</span>,
          },
          { key: "descripcion", header: "Descripción", render: (p) => p.descripcion ?? "—" },
          {
            key: "archivo",
            header: "Documento",
            render: (p) => (p.tieneArchivo ? "Adjunto" : "Sin documento"),
          },
          {
            key: "estado",
            header: "Estado",
            render: (p) => (
              <StatusBadge label={p.activo ? "Activa" : "Inactiva"} tone={p.activo ? "positive" : "neutral"} />
            ),
          },
          ...(canEditar
            ? [
                {
                  key: "acciones",
                  header: "Acciones",
                  align: "right" as const,
                  render: (p: PlantillaRow) => (
                    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => toggleActivo(p)}>
                      {p.activo ? "Desactivar" : "Activar"}
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
