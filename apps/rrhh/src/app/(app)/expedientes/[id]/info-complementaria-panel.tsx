"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Field, Input, Select, useToast } from "@nexo/ui";
import {
  guardarInfoComplementaria,
  type InfoComplementariaInput,
  type EstadoCivil,
} from "./info-complementaria-actions";

export interface InfoComplementariaData {
  estadoCivil: EstadoCivil | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  contactoEmergenciaParentesco: string | null;
}

const ESTADO_CIVIL_LABEL: Record<EstadoCivil, string> = {
  soltero_a: "Soltero/a",
  casado_a: "Casado/a",
  union_de_hecho: "Unión de hecho",
  divorciado_a: "Divorciado/a",
  viudo_a: "Viudo/a",
};

/**
 * Fase 5 (2026-09-16, bloque pre-F1.5): pestaña "Información
 * complementaria". Set deliberadamente minimo (estado civil + contacto de
 * emergencia) -- ver comentario de rrhh.empleado_info_complementaria.
 */
export default function InfoComplementariaPanel({
  empleadoId,
  info,
  canEditar,
}: {
  empleadoId: string;
  info: InfoComplementariaData | null;
  canEditar: boolean;
}) {
  const { show } = useToast();
  const [form, setForm] = useState<InfoComplementariaInput>({
    estadoCivil: info?.estadoCivil ?? "",
    contactoEmergenciaNombre: info?.contactoEmergenciaNombre ?? "",
    contactoEmergenciaTelefono: info?.contactoEmergenciaTelefono ?? "",
    contactoEmergenciaParentesco: info?.contactoEmergenciaParentesco ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof InfoComplementariaInput>(key: K, value: InfoComplementariaInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await guardarInfoComplementaria(empleadoId, form);
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar.");
        show(res.message ?? "No se pudo guardar.", "error");
        return;
      }
      show("Información complementaria guardada.", "success");
    });
  }

  return (
    <form
      onSubmit={guardar}
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
    >
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Field label="Estado civil" className="sm:w-64">
        <Select
          disabled={!canEditar}
          value={form.estadoCivil}
          onChange={(e) => update("estadoCivil", e.target.value as EstadoCivil)}
        >
          <option value="">Sin especificar</option>
          {Object.entries(ESTADO_CIVIL_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="border-t border-neutral-100 pt-4">
        <legend className="mb-3 text-sm font-semibold text-neutral-900">Contacto de emergencia</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Nombre">
            <Input
              disabled={!canEditar}
              value={form.contactoEmergenciaNombre}
              onChange={(e) => update("contactoEmergenciaNombre", e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Teléfono">
            <Input
              type="tel"
              inputMode="tel"
              disabled={!canEditar}
              value={form.contactoEmergenciaTelefono}
              onChange={(e) => update("contactoEmergenciaTelefono", e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Parentesco">
            <Input
              disabled={!canEditar}
              value={form.contactoEmergenciaParentesco}
              onChange={(e) => update("contactoEmergenciaParentesco", e.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      {canEditar ? (
        <div>
          <Button type="submit" loading={isPending}>
            Guardar información
          </Button>
        </div>
      ) : null}
    </form>
  );
}
