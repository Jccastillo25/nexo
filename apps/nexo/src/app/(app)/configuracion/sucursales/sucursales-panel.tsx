"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, DataTable, Field, FormSection, Input, StatusBadge, useToast } from "@nexo/ui";
import type { Sucursal } from "@/lib/supabase/database.types";
import { guardarSucursal } from "./actions";

interface Borrador {
  sucursalId: string | null;
  nombre: string;
  direccion: string;
  activa: boolean;
}

const NUEVA: Borrador = { sucursalId: null, nombre: "", direccion: "", activa: true };

/** Lista de sucursales con alta y edición en la misma pantalla. */
export default function SucursalesPanel({ sucursales, puedeGestionar }: { sucursales: Sucursal[]; puedeGestionar: boolean }) {
  const router = useRouter();
  const { show } = useToast();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrir(b: Borrador) {
    setBorrador(b);
    setErrorNombre(null);
    setError(null);
  }

  function guardar() {
    if (!borrador) return;
    setError(null);
    if (borrador.nombre.trim().length < 2) {
      setErrorNombre("Escribe el nombre de la sucursal.");
      return;
    }
    startTransition(async () => {
      const res = await guardarSucursal(borrador);
      if (!res.ok) {
        const message = res.message ?? "No se pudo guardar la sucursal.";
        if (res.campo === "nombre") setErrorNombre(message);
        else setError(message);
        return;
      }
      show(borrador.sucursalId ? "Sucursal actualizada." : "Sucursal creada.", "success");
      setBorrador(null);
      setErrorNombre(null);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {puedeGestionar && !borrador && (
        <div>
          <Button onClick={() => abrir(NUEVA)}>Nueva sucursal</Button>
        </div>
      )}

      {borrador && (
        <FormSection title={borrador.sucursalId ? "Editar sucursal" : "Nueva sucursal"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" required error={errorNombre}>
              <Input
                value={borrador.nombre}
                maxLength={80}
                onChange={(e) => {
                  setBorrador({ ...borrador, nombre: e.target.value });
                  setErrorNombre(null);
                }}
                placeholder="Sucursal Central"
              />
            </Field>
            <Field label="Dirección" optional>
              <Input
                value={borrador.direccion}
                maxLength={200}
                autoComplete="street-address"
                onChange={(e) => setBorrador({ ...borrador, direccion: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              className="size-4 accent-blue-600"
              checked={borrador.activa}
              onChange={(e) => setBorrador({ ...borrador, activa: e.target.checked })}
            />
            Activa
          </label>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setBorrador(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={guardar} loading={isPending}>
              Guardar
            </Button>
          </div>
        </FormSection>
      )}

      <DataTable<Sucursal>
        rows={sucursales}
        rowKey={(s) => s.id}
        caption="Sucursales"
        emptyLabel="Todavía no hay sucursales."
        columns={[
          {
            key: "nombre",
            header: "Sucursal",
            render: (s) => <span className="font-medium text-neutral-900">{s.nombre}</span>,
          },
          { key: "direccion", header: "Dirección", render: (s) => s.direccion ?? "—" },
          { key: "usuarios", header: "Usuarios", numeric: true, render: (s) => s.usuarios },
          { key: "puestos", header: "Puestos", numeric: true, render: (s) => s.puestos },
          {
            key: "estado",
            header: "Estado",
            render: (s) => <StatusBadge label={s.activa ? "Activa" : "Inactiva"} tone={s.activa ? "positive" : "neutral"} />,
          },
          {
            key: "acciones",
            header: <span className="sr-only">Acciones</span>,
            align: "right",
            render: (s) =>
              puedeGestionar ? (
                <Button
                  variant="link"
                  size="sm"
                  aria-label={`Editar ${s.nombre}`}
                  onClick={() =>
                    abrir({ sucursalId: s.id, nombre: s.nombre, direccion: s.direccion ?? "", activa: s.activa })
                  }
                >
                  Editar
                </Button>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
