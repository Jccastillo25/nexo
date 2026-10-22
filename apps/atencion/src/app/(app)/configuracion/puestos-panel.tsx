"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, FormSection, Input, StatusBadge, useToast } from "@nexo/ui";
import type { PuestoEstado } from "@/lib/supabase/database.types";
import { guardarPuesto } from "./actions";

interface Borrador {
  puestoId: string | null;
  nombre: string;
  orden: number;
  activo: boolean;
}

/** Puestos de la sucursal. El orden define cuál se asigna primero al iniciar atención. */
export default function PuestosPanel({
  sucursalId,
  puestos,
  errorCarga = false,
}: {
  sucursalId: string;
  puestos: PuestoEstado[];
  errorCarga?: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function nuevo() {
    const siguiente = puestos.length + 1;
    setBorrador({ puestoId: null, nombre: `Puesto ${siguiente}`, orden: siguiente, activo: true });
    setError(null);
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!borrador) return;
    startTransition(async () => {
      const res = await guardarPuesto({ ...borrador, sucursalId });
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar el puesto.");
        return;
      }
      show("Puesto guardado.", "success");
      setBorrador(null);
      router.refresh();
    });
  }

  return (
    <FormSection
      title="Puestos de atención"
      description="Al iniciar atención, el agente recibe el primer puesto libre según este orden."
    >
      {errorCarga ? (
        <Alert tone="error">No se pudieron cargar los puestos. Recarga la página para intentarlo de nuevo.</Alert>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {puestos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <span className="w-6 text-xs text-neutral-500 tabular-nums">{p.orden}</span>
                <span className="font-medium text-neutral-900">{p.nombre}</span>
                {!p.activo && <StatusBadge label="Inactivo" tone="neutral" />}
                {p.ocupado_por && <StatusBadge label={`Ocupado: ${p.ocupado_por}`} tone="info" />}
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Editar ${p.nombre}`}
                onClick={() => {
                  setBorrador({ puestoId: p.id, nombre: p.nombre, orden: p.orden, activo: p.activo });
                  setError(null);
                }}
              >
                Editar
              </Button>
            </li>
          ))}
          {puestos.length === 0 && <li className="px-4 py-4 text-sm text-neutral-500">Todavía no hay puestos.</li>}
        </ul>
      )}

      {borrador ? (
        // noValidate: los errores los da el servidor, en el aviso de abajo, no la burbuja del navegador.
        <form onSubmit={guardar} noValidate className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Nombre" required className="w-full sm:w-64">
              <Input
                value={borrador.nombre}
                maxLength={40}
                required
                autoComplete="off"
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
              />
            </Field>
            <Field label="Orden" className="w-28">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={borrador.orden}
                onChange={(e) => setBorrador({ ...borrador, orden: Number(e.target.value) })}
              />
            </Field>
            <label className="flex h-9 items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                className="size-4 accent-blue-600"
                checked={borrador.activo}
                onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })}
              />
              Activo
            </label>
          </div>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setBorrador(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={isPending}>
              Guardar puesto
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button variant="secondary" onClick={nuevo}>
            Agregar puesto
          </Button>
        </div>
      )}
    </FormSection>
  );
}
