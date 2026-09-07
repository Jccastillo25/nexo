"use client";

import { useState, useTransition } from "react";
import { StatusBadge, type StatusTone } from "@nexo/ui";
import {
  crearContrato,
  editarContrato,
  activarContrato,
  finalizarContrato,
  regenerarPin,
  asignarJornada,
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

export interface CredencialEstado {
  tieneCredencial: boolean;
  activo: boolean;
  pinBloqueado: boolean;
  rotacionNumero: number;
}

export interface JornadaOption {
  id: string;
  nombre: string;
}

export interface JornadaVigente {
  jornadaId: string;
  jornadaNombre: string;
  vigenteDesde: string;
}

export interface ContratosPanelProps {
  empleadoId: string;
  contratos: ContratoRow[];
  /** Estado de credencial del contrato ACTIVO, si hay uno y si canVerCredenciales. */
  credencial: CredencialEstado | null;
  /** F1.4: jornadas activas disponibles para asignar (catálogo de /jornadas). */
  jornadasDisponibles: JornadaOption[];
  /** F1.4: jornada vigente (fila abierta) por contrato_id, si tiene una asignada. */
  jornadaVigentePorContrato: Record<string, JornadaVigente | undefined>;
  canCrear: boolean;
  canEditar: boolean;
  canActivar: boolean;
  canFinalizar: boolean;
  canVerSalario: boolean;
  canEditarSalario: boolean;
  canVerCredenciales: boolean;
  canRegenerarPin: boolean;
}

const EMPTY_FORM: ContratoInput = {
  puesto: "",
  departamento: "",
  modalidadContrato: "nomina_estandar",
  fechaInicio: "",
  fechaFinPrevista: "",
  salarioBase: undefined,
};

const ESTADO_TONE: Record<ContratoRow["estado"], StatusTone> = {
  borrador: "neutral",
  activo: "positive",
  finalizado: "neutral",
};

/**
 * F1.2/F1.3 (2026-09-07): panel del Expediente Laboral de un empleado —
 * historial de contratos, el flujo borrador -> activo -> finalizado, y
 * la credencial de asistencia (PIN) del contrato activo. "Activar"
 * genera el PIN automáticamente (F1.3) y lo muestra UNA sola vez, igual
 * que "Regenerar PIN". "Ver estado" nunca revela el PIN — solo si está
 * activo/bloqueado y cuántas veces se regeneró.
 *
 * Nexo Enterprise UI (2026-09-07): restyle a tema claro (StatusBadge
 * reemplaza el badge local) — misma logica/handlers, sin cambios de
 * comportamiento ni de RPC.
 */
export default function ContratosPanel({
  empleadoId,
  contratos,
  credencial,
  jornadasDisponibles,
  jornadaVigentePorContrato,
  canCrear,
  canEditar,
  canActivar,
  canFinalizar,
  canVerSalario,
  canEditarSalario,
  canVerCredenciales,
  canRegenerarPin,
}: ContratosPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ContratoInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinRevelado, setPinRevelado] = useState<{ contratoId: string; pin: string } | null>(null);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState<Record<string, string>>({});
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
      if (!res.ok) {
        setError(res.message ?? "No se pudo activar el contrato.");
        return;
      }
      if (res.pin) setPinRevelado({ contratoId: id, pin: res.pin });
    });
  }

  function finalizar(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await finalizarContrato(empleadoId, id);
      if (!res.ok) setError(res.message ?? "No se pudo finalizar el contrato.");
    });
  }

  /**
   * F1.4: asigna/reasigna jornada -- vigente_desde queda a cargo del RPC
   * (usa fecha_inicio del contrato o hoy si no hay ninguna asignación
   * previa; si ya hay una vigente, exige una fecha posterior a esa —
   * error entendible si el usuario intenta una fecha inválida).
   */
  function asignar(contratoId: string) {
    const jornadaId = jornadaSeleccionada[contratoId];
    if (!jornadaId) return;
    setError(null);
    startTransition(async () => {
      const res = await asignarJornada(empleadoId, contratoId, jornadaId);
      if (!res.ok) {
        setError(res.message ?? "No se pudo asignar la jornada.");
        return;
      }
      setJornadaSeleccionada((prev) => ({ ...prev, [contratoId]: "" }));
    });
  }

  function regenerar(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await regenerarPin(empleadoId, id);
      if (!res.ok) {
        setError(res.message ?? "No se pudo regenerar el PIN.");
        return;
      }
      if (res.pin) setPinRevelado({ contratoId: id, pin: res.pin });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Expediente laboral</h2>
        {canCrear && !borrador && !showForm && (
          <button
            type="button"
            onClick={abrirNuevo}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Nuevo contrato
          </button>
        )}
      </div>

      {tieneActivo && (
        <p className="text-xs text-neutral-400">
          Ya existe un contrato activo — solo puede haber uno a la vez por empleado.
        </p>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {pinRevelado && (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-6 py-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            PIN de kiosko — se muestra una sola vez
          </p>
          <p className="text-4xl font-bold tabular-nums tracking-[0.3em] text-neutral-900">
            {pinRevelado.pin}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Anotalo o entregáselo ahora al empleado — no se puede volver a ver, solo regenerar.
          </p>
          <button
            type="button"
            onClick={() => setPinRevelado(null)}
            className="mt-2 text-xs text-neutral-500 hover:text-neutral-900"
          >
            Ocultar
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={guardar} className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Guardando…" : editingId ? "Guardar cambios" : "Crear borrador"}
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

      <div className="flex flex-col gap-3">
        {contratos.length === 0 && !showForm && (
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-400">
            Todavía no tiene contratos. Sin contrato activo, no puede marcar en el kiosko.
          </p>
        )}

        {contratos.map((c) => (
          <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-neutral-500">Contrato #{c.numero_contrato}</span>
              <StatusBadge label={c.estado} tone={ESTADO_TONE[c.estado]} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-neutral-700 sm:grid-cols-4">
              <span>{c.puesto ?? "—"}</span>
              <span>{c.departamento ?? "—"}</span>
              <span>{c.fecha_inicio ?? "—"}</span>
              {canVerSalario && <span>{c.salario_base != null ? `C$ ${c.salario_base}` : "—"}</span>}
            </div>

            {c.estado !== "finalizado" && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span>Jornada:</span>
                {jornadaVigentePorContrato[c.id] ? (
                  <span className="text-neutral-700">
                    {jornadaVigentePorContrato[c.id]!.jornadaNombre}
                    <span className="ml-1 text-neutral-400">
                      (vigente desde {jornadaVigentePorContrato[c.id]!.vigenteDesde})
                    </span>
                  </span>
                ) : (
                  <span className="text-amber-600">sin asignar — no se puede activar</span>
                )}
                {canEditar && jornadasDisponibles.length > 0 && (
                  <>
                    <select
                      value={jornadaSeleccionada[c.id] ?? ""}
                      onChange={(e) =>
                        setJornadaSeleccionada((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 outline-none focus:border-blue-500"
                    >
                      <option value="">{jornadaVigentePorContrato[c.id] ? "Reasignar…" : "Asignar…"}</option>
                      {jornadasDisponibles.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isPending || !jornadaSeleccionada[c.id]}
                      onClick={() => asignar(c.id)}
                      className="rounded-lg bg-neutral-100 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-200 disabled:opacity-40"
                    >
                      Guardar
                    </button>
                  </>
                )}
                {canEditar && jornadasDisponibles.length === 0 && (
                  <span className="text-neutral-400">Sin jornadas creadas todavía — ver Jornadas.</span>
                )}
              </div>
            )}

            {c.estado === "activo" && canVerCredenciales && credencial && (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>Credencial de asistencia:</span>
                {!credencial.tieneCredencial ? (
                  <span className="text-amber-600">sin generar</span>
                ) : credencial.pinBloqueado ? (
                  <span className="text-red-600">bloqueada</span>
                ) : credencial.activo ? (
                  <span className="text-emerald-600">activa (rotación #{credencial.rotacionNumero})</span>
                ) : (
                  <span className="text-neutral-400">revocada</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              {c.estado === "borrador" && canEditar && (
                <button
                  type="button"
                  onClick={() => abrirEditar(c)}
                  className="text-sm text-neutral-500 hover:text-neutral-900"
                >
                  Editar
                </button>
              )}
              {c.estado === "borrador" && canActivar && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => activar(c.id)}
                  className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                >
                  Activar
                </button>
              )}
              {c.estado === "activo" && canRegenerarPin && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => regenerar(c.id)}
                  className="text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
                >
                  Regenerar PIN
                </button>
              )}
              {c.estado === "activo" && canFinalizar && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => finalizar(c.id)}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
