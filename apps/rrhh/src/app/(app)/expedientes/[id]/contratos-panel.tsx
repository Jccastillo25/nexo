"use client";

import { useState, useTransition } from "react";
import {
  crearContrato,
  editarContrato,
  activarContrato,
  finalizarContrato,
  type ContratoInput,
} from "./actions";

export interface ContratoRow {
  id: string;
  numero_contrato: number;
  estado: "borrador" | "activo" | "finalizado";
  puesto: string | null;
  departamento: string | null;
  modalidad_contrato: "nomina_estandar" | "comisionista_destajo" | null;
  fecha_inicio: string | null;
  fecha_fin_prevista: string | null;
  fecha_fin_real: string | null;
  salario_base: number | null;
}

export interface ContratosPanelProps {
  empleadoId: string;
  contratos: ContratoRow[];
  canCrear: boolean;
  canEditar: boolean;
  canActivar: boolean;
  canFinalizar: boolean;
  canVerSalario: boolean;
  canEditarSalario: boolean;
}

const EMPTY_FORM: ContratoInput = {
  puesto: "",
  departamento: "",
  modalidadContrato: "nomina_estandar",
  fechaInicio: "",
  fechaFinPrevista: "",
  salarioBase: undefined,
};

/**
 * F1.2 (2026-09-07): panel del Expediente Laboral de un empleado —
 * historial de contratos + el flujo borrador -> activo -> finalizado.
 * "Activar" todavía NO genera PIN (eso es F1.3, que reemplaza
 * rrhh.fn_activar_contrato sin tocar este componente).
 */
export default function ContratosPanel({
  empleadoId,
  contratos,
  canCrear,
  canEditar,
  canActivar,
  canFinalizar,
  canVerSalario,
  canEditarSalario,
}: ContratosPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ContratoInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tieneActivo = contratos.some((c) => c.estado === "activo");
  const borrador = contratos.find((c) => c.estado === "borrador");

  function update<K extends keyof ContratoInput>(key: K, value: ContratoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function abrirNuevo() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  }

  function abrirEditar(c: ContratoRow) {
    setForm({
      puesto: c.puesto ?? "",
      departamento: c.departamento ?? "",
      modalidadContrato: c.modalidad_contrato ?? "nomina_estandar",
      fechaInicio: c.fecha_inicio ?? "",
      fechaFinPrevista: c.fecha_fin_prevista ?? "",
      salarioBase: c.salario_base ?? undefined,
    });
    setEditingId(c.id);
    setShowForm(true);
    setError(null);
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = editingId
        ? await editarContrato(empleadoId, editingId, form)
        : await crearContrato(empleadoId, form);
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar el contrato.");
        return;
      }
      setShowForm(false);
    });
  }

  function activar(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await activarContrato(empleadoId, id);
      if (!res.ok) setError(res.message ?? "No se pudo activar el contrato.");
    });
  }

  function finalizar(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await finalizarContrato(empleadoId, id);
      if (!res.ok) setError(res.message ?? "No se pudo finalizar el contrato.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Expediente laboral</h2>
        {canCrear && !borrador && !showForm && (
          <button
            type="button"
            onClick={abrirNuevo}
            className="rounded-lg bg-[var(--nexo-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--nexo-accent-hover)]"
          >
            + Nuevo contrato
          </button>
        )}
      </div>

      {tieneActivo && (
        <p className="text-xs text-white/40">
          Ya existe un contrato activo — solo puede haber uno a la vez por empleado.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      {showForm && (
        <form onSubmit={guardar} className="nexo-glass flex flex-col gap-4 rounded-2xl p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Puesto">
              <input
                value={form.puesto}
                onChange={(e) => update("puesto", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Departamento">
              <input
                value={form.departamento}
                onChange={(e) => update("departamento", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Modalidad">
              <select
                value={form.modalidadContrato}
                onChange={(e) =>
                  update("modalidadContrato", e.target.value as ContratoInput["modalidadContrato"])
                }
                className={inputClass}
              >
                <option value="nomina_estandar">Nómina estándar</option>
                <option value="comisionista_destajo">Comisionista / destajo</option>
              </select>
            </Field>
            <Field label="Fecha de inicio">
              <input
                type="date"
                value={form.fechaInicio}
                onChange={(e) => update("fechaInicio", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Fecha fin prevista">
              <input
                type="date"
                value={form.fechaFinPrevista}
                onChange={(e) => update("fechaFinPrevista", e.target.value)}
                className={inputClass}
              />
            </Field>
            {canEditarSalario && (
              <Field label="Salario base">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.salarioBase ?? ""}
                  onChange={(e) =>
                    update("salarioBase", e.target.value ? Number(e.target.value) : undefined)
                  }
                  className={inputClass}
                />
              </Field>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-[var(--nexo-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--nexo-accent-hover)] disabled:opacity-50"
            >
              {isPending ? "Guardando…" : editingId ? "Guardar cambios" : "Crear borrador"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-white/50 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {contratos.length === 0 && !showForm && (
          <p className="nexo-glass rounded-2xl px-4 py-6 text-center text-sm text-white/40">
            Todavía no tiene contratos. Sin contrato activo, no puede marcar en el kiosko.
          </p>
        )}

        {contratos.map((c) => (
          <div key={c.id} className="nexo-glass flex flex-col gap-2 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-white/60">
                Contrato #{c.numero_contrato}
              </span>
              <EstadoBadge estado={c.estado} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-white/70 sm:grid-cols-4">
              <span>{c.puesto ?? "—"}</span>
              <span>{c.departamento ?? "—"}</span>
              <span>{c.fecha_inicio ?? "—"}</span>
              {canVerSalario && (
                <span>{c.salario_base != null ? `C$ ${c.salario_base}` : "—"}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {c.estado === "borrador" && canEditar && (
                <button
                  type="button"
                  onClick={() => abrirEditar(c)}
                  className="text-sm text-white/50 hover:text-white"
                >
                  Editar
                </button>
              )}
              {c.estado === "borrador" && canActivar && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => activar(c.id)}
                  className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  Activar
                </button>
              )}
              {c.estado === "activo" && canFinalizar && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => finalizar(c.id)}
                  className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                >
                  Finalizar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: ContratoRow["estado"] }) {
  const styles: Record<ContratoRow["estado"], string> = {
    borrador: "bg-white/10 text-white/60",
    activo: "bg-emerald-500/15 text-emerald-400",
    finalizado: "bg-white/5 text-white/40",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[estado]}`}>
      {estado}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-white/60">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-lg border border-[var(--nexo-border)] bg-black/20 px-3 py-2 text-white placeholder:text-white/30 outline-none focus:border-[var(--nexo-accent)]";
