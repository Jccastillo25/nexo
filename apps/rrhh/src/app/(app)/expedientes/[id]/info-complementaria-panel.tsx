"use client";

import { useState, useTransition } from "react";
import { useToast } from "@nexo/ui";
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

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500";

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
    <form onSubmit={guardar} className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <label className="flex flex-col gap-1.5 text-sm sm:w-64">
        <span className="text-neutral-500">Estado civil</span>
        <select
          disabled={!canEditar}
          value={form.estadoCivil}
          onChange={(e) => update("estadoCivil", e.target.value as EstadoCivil)}
          className={`${inputClass} disabled:opacity-60`}
        >
          <option value="">Sin especificar</option>
          {Object.entries(ESTADO_CIVIL_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="border-t border-neutral-100 pt-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Contacto de emergencia</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">Nombre</span>
            <input
              disabled={!canEditar}
              value={form.contactoEmergenciaNombre}
              onChange={(e) => update("contactoEmergenciaNombre", e.target.value)}
              className={`${inputClass} disabled:opacity-60`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">Teléfono</span>
            <input
              disabled={!canEditar}
              value={form.contactoEmergenciaTelefono}
              onChange={(e) => update("contactoEmergenciaTelefono", e.target.value)}
              className={`${inputClass} disabled:opacity-60`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">Parentesco</span>
            <input
              disabled={!canEditar}
              value={form.contactoEmergenciaParentesco}
              onChange={(e) => update("contactoEmergenciaParentesco", e.target.value)}
              className={`${inputClass} disabled:opacity-60`}
            />
          </label>
        </div>
      </div>

      {canEditar && (
        <div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}
    </form>
  );
}
