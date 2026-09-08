"use client";

// Ficha de UN contrato (Contratación → Contratos → 👁/✎) — complementa,
// no reemplaza, al panel de ciclo de vida completo del Expediente Laboral
// (activar/finalizar/regenerar PIN siguen viviendo únicamente en
// /expedientes/[id]/contratos-panel.tsx, sin cambios). Acá solo viven las
// dos cosas que el rediseño de navegación pidió sacar de Expedientes:
// editar los datos base de un contrato en borrador, y asignar su jornada
// — mismas Server Actions (editarContrato/asignarJornada), mismos RPC,
// cero lógica de negocio nueva.
import { useState, useTransition } from "react";
import { StatusBadge, useToast, type StatusTone } from "@nexo/ui";
import { editarContrato, asignarJornada, type ContratoInput } from "../../../expedientes/[id]/actions";

export interface ContratoFichaData {
  id: string;
  empleadoId: string;
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
  canVerSalario,
  canEditarSalario,
  canVerTurnos,
  jornadasDisponibles,
  jornadaVigente,
}: {
  contrato: ContratoFichaData;
  canEditar: boolean;
  canVerSalario: boolean;
  canEditarSalario: boolean;
  canVerTurnos: boolean;
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
      const res = await editarContrato(contrato.empleadoId, contrato.id, form);
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
      const res = await asignarJornada(contrato.empleadoId, contrato.id, jornadaSeleccionada);
      if (!res.ok) {
        setError(res.message ?? "No se pudo asignar la jornada.");
        show(res.message ?? "No se pudo asignar la jornada.", "error");
        return;
      }
      show("Jornada asignada.", "success");
      setJornadaSeleccionada("");
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
            {puedeEditar && (
              <div>
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200"
                >
                  Editar contrato
                </button>
              </div>
            )}
            {!canEditar || contrato.estado !== "borrador" ? (
              <p className="text-xs text-neutral-400">
                {contrato.estado === "borrador"
                  ? "No tenés permiso para editar este contrato."
                  : "Solo se puede editar un contrato en borrador — el ciclo de vida (activar/finalizar/regenerar PIN) se administra desde el expediente del empleado."}
              </p>
            ) : null}
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
