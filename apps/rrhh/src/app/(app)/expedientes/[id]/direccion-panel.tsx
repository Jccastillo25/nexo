"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Button, Field, Select, Textarea, useToast } from "@nexo/ui";
import { guardarDireccion, type DireccionInput } from "./direccion-actions";

export interface DepartamentoGeoOption {
  id: string;
  nombre: string;
}

export interface MunicipioGeoOption {
  id: string;
  nombre: string;
  departamentoId: string;
}

export interface DireccionData {
  departamentoGeoId: string | null;
  municipioGeoId: string | null;
  direccionDetalle: string | null;
}

/**
 * Fase 5 (2026-09-16, bloque pre-F1.5): pestaña "Dirección" del
 * expediente. municipios llega vacío hasta que se complete el catálogo
 * geográfico con una fuente oficial verificada (ver migración
 * 20260916170000_geografia_ni_y_expediente_ampliado.sql) -- el select de
 * municipio queda deshabilitado con esa aclaración mientras tanto, sin
 * bloquear guardar solo el departamento.
 */
export default function DireccionPanel({
  empleadoId,
  direccion,
  departamentos,
  municipios,
  canEditar,
}: {
  empleadoId: string;
  direccion: DireccionData | null;
  departamentos: DepartamentoGeoOption[];
  municipios: MunicipioGeoOption[];
  canEditar: boolean;
}) {
  const { show } = useToast();
  const [form, setForm] = useState<DireccionInput>({
    departamentoGeoId: direccion?.departamentoGeoId ?? "",
    municipioGeoId: direccion?.municipioGeoId ?? "",
    direccionDetalle: direccion?.direccionDetalle ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const municipiosDelDepartamento = useMemo(
    () => municipios.filter((m) => m.departamentoId === form.departamentoGeoId),
    [municipios, form.departamentoGeoId]
  );

  function update<K extends keyof DireccionInput>(key: K, value: DireccionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await guardarDireccion(empleadoId, form);
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar la dirección.");
        show(res.message ?? "No se pudo guardar la dirección.", "error");
        return;
      }
      show("Dirección guardada.", "success");
    });
  }

  return (
    <form
      onSubmit={guardar}
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
    >
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Departamento">
          <Select
            disabled={!canEditar}
            value={form.departamentoGeoId}
            onChange={(e) => update("departamentoGeoId", e.target.value)}
          >
            <option value="">Sin asignar</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Municipio"
          hint={
            municipios.length === 0
              ? "El catálogo de municipios todavía no está cargado. Puedes guardar solo el departamento."
              : undefined
          }
        >
          <Select
            disabled={!canEditar || municipiosDelDepartamento.length === 0}
            value={form.municipioGeoId}
            onChange={(e) => update("municipioGeoId", e.target.value)}
          >
            <option value="">Sin asignar</option>
            {municipiosDelDepartamento.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Referencia de dirección">
        <Textarea
          disabled={!canEditar}
          value={form.direccionDetalle}
          onChange={(e) => update("direccionDetalle", e.target.value)}
          placeholder="Ej.: de la rotonda Rubén Darío, 2 c. al lago, casa esquinera"
          rows={3}
          autoComplete="street-address"
        />
      </Field>

      {canEditar ? (
        <div>
          <Button type="submit" loading={isPending}>
            Guardar dirección
          </Button>
        </div>
      ) : null}
    </form>
  );
}
