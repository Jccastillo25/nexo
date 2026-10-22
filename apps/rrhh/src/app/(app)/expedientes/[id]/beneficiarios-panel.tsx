"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Button, DataTable, EmptyState, Field, Input, StatusBadge, porcentaje, useToast } from "@nexo/ui";
import { crearBeneficiario, editarBeneficiario, type BeneficiarioInput } from "./beneficiarios-actions";

export interface BeneficiarioRow {
  id: string;
  nombreCompleto: string;
  parentesco: string;
  porcentaje: number;
  documentoIdentidad: string | null;
  telefono: string | null;
  activo: boolean;
}

const EMPTY: BeneficiarioInput = { nombreCompleto: "", parentesco: "", porcentaje: 0, documentoIdentidad: "", telefono: "" };

/** El porcentaje se guarda como 0–100; porcentaje() del kit recibe una fracción. */
function pct(valor: number): string {
  return porcentaje(valor / 100, { decimales: 2 });
}

/**
 * Fase 5 (2026-09-16, bloque pre-F1.5): pestaña "Beneficiario" -- dato
 * sensible, solo visible/editable con rrhh.expedientes.beneficiarios.*
 * (admin). El total mostrado es solo informativo del lado del cliente --
 * la regla real (suma <= 100) la exige el trigger de base de datos.
 */
export default function BeneficiariosPanel({
  empleadoId,
  beneficiarios,
  canCrear,
  canEditar,
}: {
  empleadoId: string;
  beneficiarios: BeneficiarioRow[];
  canCrear: boolean;
  canEditar: boolean;
}) {
  const { show } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [nuevo, setNuevo] = useState<BeneficiarioInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalActivo = useMemo(
    () => beneficiarios.filter((b) => b.activo).reduce((sum, b) => sum + b.porcentaje, 0),
    [beneficiarios]
  );

  function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearBeneficiario(empleadoId, nuevo);
      if (!res.ok) {
        setError(res.message ?? "No se pudo agregar el beneficiario.");
        show(res.message ?? "No se pudo agregar el beneficiario.", "error");
        return;
      }
      setNuevo(EMPTY);
      setShowForm(false);
      show("Beneficiario agregado.", "success");
    });
  }

  function toggleActivo(b: BeneficiarioRow) {
    setError(null);
    startTransition(async () => {
      const res = await editarBeneficiario(empleadoId, b.id, {
        nombreCompleto: b.nombreCompleto,
        parentesco: b.parentesco,
        porcentaje: b.porcentaje,
        documentoIdentidad: b.documentoIdentidad ?? "",
        telefono: b.telefono ?? "",
        activo: !b.activo,
      });
      if (!res.ok) {
        setError(res.message ?? "No se pudo actualizar el beneficiario.");
        show(res.message ?? "No se pudo actualizar el beneficiario.", "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">
          Beneficiarios{" "}
          <span className="font-normal text-neutral-500">
            · <span className="tabular-nums">{pct(totalActivo)}</span> asignado
          </span>
        </h3>
        {canCrear && !showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            Agregar beneficiario
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
            <Field label="Nombre completo" required>
              <Input
                required
                autoComplete="off"
                value={nuevo.nombreCompleto}
                onChange={(e) => setNuevo((n) => ({ ...n, nombreCompleto: e.target.value }))}
              />
            </Field>
            <Field label="Parentesco" required>
              <Input
                required
                value={nuevo.parentesco}
                onChange={(e) => setNuevo((n) => ({ ...n, parentesco: e.target.value }))}
              />
            </Field>
            <Field label="Porcentaje" required hint="Entre 1 y 100. La suma de los activos no puede pasar de 100.">
              <Input
                required
                type="number"
                inputMode="decimal"
                min={1}
                max={100}
                step="0.01"
                value={nuevo.porcentaje || ""}
                onChange={(e) => setNuevo((n) => ({ ...n, porcentaje: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Documento de identidad" optional>
              <Input
                autoComplete="off"
                value={nuevo.documentoIdentidad}
                onChange={(e) => setNuevo((n) => ({ ...n, documentoIdentidad: e.target.value }))}
              />
            </Field>
            <Field label="Teléfono" optional>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={nuevo.telefono}
                onChange={(e) => setNuevo((n) => ({ ...n, telefono: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={isPending}>
              Agregar beneficiario
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable
        rows={beneficiarios}
        rowKey={(b) => b.id}
        density="compact"
        caption="Beneficiarios del empleado"
        empty={<EmptyState bare title="Sin beneficiarios registrados" />}
        columns={[
          {
            key: "nombre",
            header: "Nombre",
            render: (b) => <span className="font-medium text-neutral-900">{b.nombreCompleto}</span>,
          },
          { key: "parentesco", header: "Parentesco", render: (b) => b.parentesco },
          { key: "porcentaje", header: "Porcentaje", numeric: true, render: (b) => pct(b.porcentaje) },
          {
            key: "estado",
            header: "Estado",
            render: (b) => (
              <StatusBadge label={b.activo ? "Activo" : "Inactivo"} tone={b.activo ? "positive" : "neutral"} />
            ),
          },
          ...(canEditar
            ? [
                {
                  key: "acciones",
                  header: "Acciones",
                  align: "right" as const,
                  render: (b: BeneficiarioRow) => (
                    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => toggleActivo(b)}>
                      {b.activo ? "Desactivar" : "Activar"}
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
