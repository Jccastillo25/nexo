"use client";

// Ficha de UN contrato (Contratación → Contratos → 👁/✎) — dueña única del
// ciclo de vida completo del contrato (P2/P3, reconciliación de
// navegación 2026-09-14): editar datos base, asignar jornada, activar
// (genera PIN), regenerar PIN, finalizar. Antes ese ciclo estaba repartido
// entre /expedientes/[id]/contratos-panel.tsx (activar/finalizar/PIN) y
// esta página (solo editar/jornada) — se unificó acá, reutilizando
// exactamente las mismas Server Actions/RPC (contratacion/contratos/
// actions.ts, movidas desde expedientes/[id]/actions.ts, no duplicadas).
import { useState, useTransition } from "react";
import { StatusBadge, useToast, type StatusTone } from "@nexo/ui";
import {
  editarContrato,
  activarContrato,
  finalizarContrato,
  regenerarPin,
  asignarJornada,
  type ContratoInput,
} from "../actions";

export interface ContratoFichaData {
  id: string;
  numeroContrato: number;
  estado: "borrador" | "activo" | "finalizado";
  puesto: string | null;
  departamento: string | null;
  modalidadContrato: "nomina_estandar" | "comisionista_destajo" | null;
  fechaInicio: string | null;
  fechaFinPrevista: string | null;
  fechaFinReal: string | null;
  salarioBase: number | null;
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
  jornadaNombre: string;
  vigenteDesde: string;
}

const ESTADO_TONE: Record<ContratoFichaData["estado"], StatusTone> = {
  borrador: "warning",
  activo: "positive",
  finalizado: "neutral",
};

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

export default function ContratoFicha({
  contrato,
  canEditar,
  canActivar,
  canFinalizar,
  canVerSalario,
  canEditarSalario,
  canVerCredenciales,
  canRegenerarPin,
  canVerTurnos,
  credencial,
  jornadasDisponibles,
  jornadaVigente,
}: {
  contrato: ContratoFichaData;
  canEditar: boolean;
  canActivar: boolean;
  canFinalizar: boolean;
  canVerSalario: boolean;
  canEditarSalario: boolean;
  canVerCredenciales: boolean;
  canRegenerarPin: boolean;
  canVerTurnos: boolean;
  credencial: CredencialEstado | null;
  jornadasDisponibles: JornadaOption[];
  jornadaVigente: JornadaVigente | null;
}) {
  const { show } = useToast();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<ContratoInput>({
    puesto: contrato.puesto ?? "",
    departamento: contrato.departamento ?? "",
    modalidadContrato: contrato.modalidadContrato ?? "nomina_estandar",
    fechaInicio: contrato.fechaInicio ?? "",
    fechaFinPrevista: contrato.fechaFinPrevista ?? "",
    salarioBase: contrato.salarioBase ?? undefined,
  });
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pinRevelado, setPinRevelado] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const puedeEditar = canEditar && contrato.estado === "borrador";
  const puedeAsignarJornada = canEditar && canVerTurnos && contrato.estado !== "finalizado";

  function update<K extends keyof ContratoInput>(key: K, value: ContratoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await editarContrato(contrato.id, form);
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar el contrato.");
        show(res.message ?? "No se pudo guardar el contrato.", "error");
        return;
      }
      show("Contrato actualizado.", "success");
      setEditando(false);
    });
  }

  function asignar() {
    if (!jornadaSeleccionada) return;
    setError(null);
    startTransition(async () => {
      const res = await asignarJornada(contrato.id, jornadaSeleccionada);
      if (!res.ok) {
        setError(res.message ?? "No se pudo asignar la jornada.");
        show(res.message ?? "No se pudo asignar la jornada.", "error");
        return;
      }
      show("Jornada asignada.", "success");
      setJornadaSeleccionada("");
    });
  }

  function activar() {
    setError(null);
    startTransition(async () => {
      const res = await activarContrato(contrato.id);
      if (!res.ok) {
        setError(res.message ?? "No se pudo activar el contrato.");
        show(res.message ?? "No se pudo activar el contrato.", "error");
        return;
      }
      show("Contrato activado.", "success");
      if (res.pin) setPinRevelado(res.pin);
    });
  }

  function regenerar() {
    setError(null);
    startTransition(async () => {
      const res = await regenerarPin(contrato.id);
      if (!res.ok) {
        setError(res.message ?? "No se pudo regenerar el PIN.");
        show(res.message ?? "No se pudo regenerar el PIN.", "error");
        return;
      }
      show("PIN regenerado.", "success");
      if (res.pin) setPinRevelado(res.pin);
    });
  }

  function finalizar() {
    setError(null);
    startTransition(async () => {
      const res = await finalizarContrato(contrato.id);
      if (!res.ok) {
        setError(res.message ?? "No se pudo finalizar el contrato.");
        show(res.message ?? "No se pudo finalizar el contrato.", "error");
        return;
      }
      show("Contrato finalizado — credencial revocada.", "success");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm text-neutral-500">Contrato #{contrato.numeroContrato}</span>
          <StatusBadge label={contrato.estado} tone={ESTADO_TONE[contrato.estado]} />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {pinRevelado && (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-6 py-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              PIN de kiosko — se muestra una sola vez
            </p>
            <p className="text-4xl font-bold tabular-nums tracking-[0.3em] text-neutral-900">{pinRevelado}</p>
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

        {editando ? (
          <form onSubmit={guardar} className="flex flex-col gap-4">
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
                {isPending ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="text-sm text-neutral-500 hover:text-neutral-900"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm text-neutral-700 sm:grid-cols-4">
              <Field label="Puesto" value={contrato.puesto ?? "—"} />
              <Field label="Departamento" value={contrato.departamento ?? "—"} />
              <Field label="Inicio" value={contrato.fechaInicio ?? "—"} />
              {canVerSalario && (
                <Field
                  label="Salario base"
                  value={contrato.salarioBase != null ? `C$ ${contrato.salarioBase}` : "—"}
                />
              )}
            </div>

            {contrato.estado === "activo" && canVerCredenciales && credencial && (
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

            <div className="flex flex-wrap items-center gap-3">
              {puedeEditar && (
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200"
                >
                  Editar contrato
                </button>
              )}
              {contrato.estado === "borrador" && canActivar && (
                <button
                  type="button"
                  disabled={isPending || !jornadaVigente}
                  title={!jornadaVigente ? "Asigná una jornada antes de activar" : undefined}
                  onClick={activar}
                  className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                >
                  Activar
                </button>
              )}
              {contrato.estado === "activo" && canRegenerarPin && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={regenerar}
                  className="text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
                >
                  Regenerar PIN
                </button>
              )}
              {contrato.estado === "activo" && canFinalizar && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={finalizar}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                >
                  Finalizar
                </button>
              )}
            </div>

            {!puedeEditar && contrato.estado === "borrador" && (
              <p className="text-xs text-neutral-400">No tenés permiso para editar este contrato.</p>
            )}
            {contrato.estado !== "borrador" && (
              <p className="text-xs text-neutral-400">
                Solo se puede editar un contrato en borrador — la información base queda congelada al
                activarlo.
              </p>
            )}
          </>
        )}
      </div>

      {puedeAsignarJornada && (
        <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Jornada</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            {jornadaVigente ? (
              <span>
                {jornadaVigente.jornadaNombre}
                <span className="ml-1 text-neutral-400">
                  (vigente desde {jornadaVigente.vigenteDesde})
                </span>
              </span>
            ) : (
              <span className="text-amber-600">Sin asignar — no se puede activar el contrato.</span>
            )}
          </div>
          {jornadasDisponibles.length > 0 ? (
            <div className="flex items-center gap-2">
              <select
                value={jornadaSeleccionada}
                onChange={(e) => setJornadaSeleccionada(e.target.value)}
                className={`${inputClass} text-sm`}
              >
                <option value="">{jornadaVigente ? "Reasignar…" : "Asignar…"}</option>
                {jornadasDisponibles.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isPending || !jornadaSeleccionada}
                onClick={asignar}
                className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 disabled:opacity-40"
              >
                {isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-neutral-400">
              Sin jornadas creadas todavía — ver Contratación → Jornadas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      {children ?? <span className="text-neutral-900">{value}</span>}
    </label>
  );
}
