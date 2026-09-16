"use client";

import { useMemo, useState, useTransition } from "react";
import { StatusBadge, useToast } from "@nexo/ui";
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
const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500";

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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">
          Beneficiarios <span className="font-normal text-neutral-400">— {totalActivo}% asignado</span>
        </h3>
        {canCrear && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Nuevo beneficiario
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form onSubmit={crear} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-500">Nombre completo</span>
              <input
                required
                value={nuevo.nombreCompleto}
                onChange={(e) => setNuevo((n) => ({ ...n, nombreCompleto: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-500">Parentesco</span>
              <input
                required
                value={nuevo.parentesco}
                onChange={(e) => setNuevo((n) => ({ ...n, parentesco: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-500">Porcentaje</span>
              <input
                required
                type="number"
                min={1}
                max={100}
                step="0.01"
                value={nuevo.porcentaje || ""}
                onChange={(e) => setNuevo((n) => ({ ...n, porcentaje: Number(e.target.value) }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-500">Documento (opcional)</span>
              <input
                value={nuevo.documentoIdentidad}
                onChange={(e) => setNuevo((n) => ({ ...n, documentoIdentidad: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-500">Teléfono (opcional)</span>
              <input
                value={nuevo.telefono}
                onChange={(e) => setNuevo((n) => ({ ...n, telefono: e.target.value }))}
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Agregar
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {beneficiarios.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">Sin beneficiarios registrados.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {beneficiarios.map((b) => (
                <tr key={b.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-neutral-900">{b.nombreCompleto}</span>
                    <span className="ml-2 text-neutral-400">
                      {b.parentesco} · {b.porcentaje}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={b.activo ? "activo" : "inactivo"} tone={b.activo ? "positive" : "neutral"} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canEditar && (
                      <button
                        type="button"
                        onClick={() => toggleActivo(b)}
                        className="text-neutral-500 hover:text-neutral-900"
                      >
                        {b.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
