"use client";

import { useState, useTransition } from "react";
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  RowActionIcons,
  fechaCorta,
  useToast,
} from "@nexo/ui";
import { crearFeriado, eliminarFeriado } from "./actions";

export interface FeriadoRow {
  id: string;
  fecha: string;
  nombre: string;
}

export interface FeriadosPanelProps {
  feriados: FeriadoRow[];
  canCrear: boolean;
  canEliminar: boolean;
}

/**
 * F1.4 (2026-09-07): calendario de feriados. Sin motor de pago/calculo
 * todavia (decision de negocio pendiente, ver docs/RRHH_MVP.md) -- este
 * panel solo mantiene el catalogo que F1.5 leera despues.
 * 2026-10-20: campos, botones y tabla del kit; confirmación antes de
 * eliminar.
 */
export default function FeriadosPanel({ feriados, canCrear, canEliminar }: FeriadosPanelProps) {
  const { show } = useToast();
  const [fecha, setFecha] = useState("");
  const [nombre, setNombre] = useState("");
  const [porEliminar, setPorEliminar] = useState<FeriadoRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearFeriado({ fecha, nombre });
      if (!res.ok) {
        setError(res.message ?? "No se pudo crear el feriado.");
        show(res.message ?? "No se pudo crear el feriado.", "error");
        return;
      }
      setFecha("");
      setNombre("");
      show("Feriado agregado.", "success");
    });
  }

  function confirmarEliminar() {
    if (!porEliminar) return;
    const id = porEliminar.id;
    setError(null);
    startTransition(async () => {
      const res = await eliminarFeriado(id);
      setPorEliminar(null);
      if (!res.ok) {
        setError(res.message ?? "No se pudo eliminar el feriado.");
        show(res.message ?? "No se pudo eliminar el feriado.", "error");
      } else {
        show("Feriado eliminado.", "success");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {canCrear ? (
        <form
          onSubmit={agregar}
          className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs sm:flex-row sm:items-end"
        >
          <Field label="Fecha" required className="sm:w-48">
            <Input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Nombre" required className="sm:flex-1">
            <Input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej.: Navidad"
            />
          </Field>
          <div>
            <Button type="submit" loading={isPending}>
              Agregar feriado
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable
        rows={feriados}
        rowKey={(f) => f.id}
        density="compact"
        caption="Feriados de la empresa"
        empty={<EmptyState bare title="Sin feriados registrados" />}
        columns={[
          {
            key: "fecha",
            header: "Fecha",
            width: "9rem",
            render: (f) => <span className="tabular-nums">{fechaCorta(f.fecha)}</span>,
          },
          {
            key: "nombre",
            header: "Nombre",
            render: (f) => <span className="text-neutral-900">{f.nombre}</span>,
          },
          ...(canEliminar
            ? [
                {
                  key: "acciones",
                  header: "Acciones",
                  align: "right" as const,
                  render: (f: FeriadoRow) => (
                    <RowActionIcons
                      actions={[
                        {
                          key: "eliminar",
                          icon: "trash",
                          label: `Eliminar el feriado ${f.nombre}`,
                          destructive: true,
                          disabled: isPending,
                          onClick: () => setPorEliminar(f),
                        },
                      ]}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />

      <ConfirmDialog
        open={porEliminar !== null}
        title="Eliminar feriado"
        description={
          porEliminar ? `¿Eliminar «${porEliminar.nombre}» del ${fechaCorta(porEliminar.fecha)}?` : undefined
        }
        confirmLabel="Eliminar feriado"
        destructive
        pending={isPending}
        onConfirm={confirmarEliminar}
        onCancel={() => setPorEliminar(null)}
      />
    </div>
  );
}
