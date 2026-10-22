"use client";

import { useState, useTransition } from "react";
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  StatusBadge,
  useToast,
} from "@nexo/ui";
import {
  crearJornada,
  editarJornada,
  eliminarJornada,
  guardarDiasJornada,
  type DiaInput,
  type JornadaInput,
} from "./actions";

export interface JornadaRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface JornadaDiaRow {
  jornada_id: string;
  dia_semana: number;
  laborable: boolean;
  hora_entrada: string | null;
  hora_salida: string | null;
  minutos_descanso: number;
  tolerancia_entrada_min: number;
  tolerancia_salida_min: number;
}

export interface JornadasPanelProps {
  jornadas: JornadaRow[];
  diasPorJornada: Record<string, JornadaDiaRow[]>;
  canCrear: boolean;
  canEditar: boolean;
  canEliminar: boolean;
}

const DIAS = [
  { n: 1, label: "Lunes" },
  { n: 2, label: "Martes" },
  { n: 3, label: "Miércoles" },
  { n: 4, label: "Jueves" },
  { n: 5, label: "Viernes" },
  { n: 6, label: "Sábado" },
  { n: 7, label: "Domingo" },
] as const;

function nombreDia(n: number): string {
  return DIAS.find((x) => x.n === n)?.label ?? "";
}

function diasCompletos(existentes: JornadaDiaRow[]): DiaInput[] {
  return DIAS.map(({ n }) => {
    const fila = existentes.find((d) => d.dia_semana === n);
    return {
      diaSemana: n,
      laborable: fila?.laborable ?? (n <= 5),
      horaEntrada: fila?.hora_entrada?.slice(0, 5) ?? "08:00",
      horaSalida: fila?.hora_salida?.slice(0, 5) ?? "17:00",
      minutosDescanso: fila?.minutos_descanso ?? 60,
      toleranciaEntradaMin: fila?.tolerancia_entrada_min ?? 10,
      toleranciaSalidaMin: fila?.tolerancia_salida_min ?? 10,
    };
  });
}

const CHECKBOX =
  "size-4 rounded border-neutral-300 text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Nexo Enterprise UI (2026-09-07) §1.11: feedback idle→loading→success de
 * "Guardar días" via useToast, y confirmacion antes de descartar cambios
 * sin guardar en el editor de dias — sin tocar la logica/DB de F1.4.
 * 2026-10-20: campos, botones y tabla del kit; confirmación antes de
 * eliminar una jornada.
 */
export default function JornadasPanel({
  jornadas,
  diasPorJornada,
  canCrear,
  canEditar,
  canEliminar,
}: JornadasPanelProps) {
  const { show } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [nuevo, setNuevo] = useState<JornadaInput>({ nombre: "", descripcion: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dias, setDias] = useState<DiaInput[]>([]);
  const [diasIniciales, setDiasIniciales] = useState<DiaInput[]>([]);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [porEliminar, setPorEliminar] = useState<JornadaRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = JSON.stringify(dias) !== JSON.stringify(diasIniciales);

  function abrirDias(j: JornadaRow) {
    if (expandedId === j.id) {
      if (dirty) {
        setPendingCloseId(j.id);
        return;
      }
      setExpandedId(null);
      return;
    }
    const base = diasCompletos(diasPorJornada[j.id] ?? []);
    setDias(base);
    setDiasIniciales(base);
    setExpandedId(j.id);
    setError(null);
  }

  function descartarYCerrar() {
    setPendingCloseId(null);
    setExpandedId(null);
  }

  function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearJornada(nuevo);
      if (!res.ok) {
        setError(res.message ?? "No se pudo crear la jornada.");
        show(res.message ?? "No se pudo crear la jornada.", "error");
        return;
      }
      setNuevo({ nombre: "", descripcion: "" });
      setShowForm(false);
      show("Jornada creada.", "success");
    });
  }

  function toggleActivo(j: JornadaRow) {
    setError(null);
    startTransition(async () => {
      const res = await editarJornada(j.id, {
        nombre: j.nombre,
        descripcion: j.descripcion ?? "",
        activo: !j.activo,
      });
      if (!res.ok) {
        setError(res.message ?? "No se pudo actualizar la jornada.");
        show(res.message ?? "No se pudo actualizar la jornada.", "error");
      }
    });
  }

  function confirmarEliminar() {
    if (!porEliminar) return;
    const id = porEliminar.id;
    setError(null);
    startTransition(async () => {
      const res = await eliminarJornada(id);
      setPorEliminar(null);
      if (!res.ok) {
        setError(res.message ?? "No se pudo eliminar la jornada.");
        show(res.message ?? "No se pudo eliminar la jornada.", "error");
      } else {
        show("Jornada eliminada.", "success");
      }
    });
  }

  function updateDia(diaSemana: number, patch: Partial<DiaInput>) {
    setDias((prev) => prev.map((d) => (d.diaSemana === diaSemana ? { ...d, ...patch } : d)));
  }

  function guardarDias() {
    if (!expandedId) return;
    setError(null);
    startTransition(async () => {
      const res = await guardarDiasJornada(expandedId, dias);
      if (!res.ok) {
        // Regla obligatoria §1.11: si falla, el editor NO se cierra y los
        // datos ingresados se conservan tal cual (no se resetea `dias`).
        setError(res.message ?? "No se pudieron guardar los días.");
        show(res.message ?? "No se pudieron guardar los días.", "error");
        return;
      }
      setDiasIniciales(dias);
      show("Jornada guardada correctamente.", "success");
      setExpandedId(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Plantillas de jornada</h2>
        {canCrear && !showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            Nueva jornada
          </Button>
        ) : null}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {showForm ? (
        <form
          onSubmit={crear}
          className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre" required>
              <Input
                required
                value={nuevo.nombre}
                onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
                placeholder="Ej.: Administrativo 8-17"
              />
            </Field>
            <Field label="Descripción" optional>
              <Input
                value={nuevo.descripcion}
                onChange={(e) => setNuevo((n) => ({ ...n, descripcion: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={isPending}>
              Crear jornada
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-3">
        {jornadas.length === 0 ? (
          <EmptyState
            title="Todavía no hay jornadas"
            description="Sin al menos una jornada no se puede activar ningún contrato nuevo."
          />
        ) : null}

        {jornadas.map((j) => (
          <div key={j.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">{j.nombre}</p>
                {j.descripcion ? <p className="text-sm text-neutral-500">{j.descripcion}</p> : null}
              </div>
              <StatusBadge label={j.activo ? "Activa" : "Inactiva"} tone={j.activo ? "positive" : "neutral"} />
            </div>

            {canEditar || canEliminar ? (
              <div className="flex flex-wrap items-center gap-1">
                {canEditar ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => abrirDias(j)}
                    aria-expanded={expandedId === j.id}
                  >
                    {expandedId === j.id ? "Ocultar días" : "Días y horarios"}
                  </Button>
                ) : null}
                {canEditar ? (
                  <Button variant="ghost" size="sm" disabled={isPending} onClick={() => toggleActivo(j)}>
                    {j.activo ? "Desactivar" : "Activar"}
                  </Button>
                ) : null}
                {canEliminar ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setPorEliminar(j)}
                    aria-label={`Eliminar la jornada ${j.nombre}`}
                  >
                    Eliminar
                  </Button>
                ) : null}
              </div>
            ) : null}

            {expandedId === j.id ? (
              <div className="flex flex-col gap-3 border-t border-neutral-100 pt-3">
                <DataTable
                  rows={dias}
                  rowKey={(d) => String(d.diaSemana)}
                  density="compact"
                  caption={`Días y horarios de ${j.nombre}`}
                  columns={[
                    {
                      key: "dia",
                      header: "Día",
                      render: (d) => <span className="font-medium text-neutral-900">{nombreDia(d.diaSemana)}</span>,
                    },
                    {
                      key: "laborable",
                      header: "Laborable",
                      render: (d) => (
                        <input
                          type="checkbox"
                          checked={d.laborable}
                          onChange={(e) => updateDia(d.diaSemana, { laborable: e.target.checked })}
                          aria-label={`${nombreDia(d.diaSemana)} es laborable`}
                          className={CHECKBOX}
                        />
                      ),
                    },
                    {
                      key: "entrada",
                      header: "Entrada",
                      render: (d) => (
                        <div className="w-32">
                          <Input
                            type="time"
                            disabled={!d.laborable}
                            value={d.horaEntrada}
                            onChange={(e) => updateDia(d.diaSemana, { horaEntrada: e.target.value })}
                            aria-label={`Hora de entrada del ${nombreDia(d.diaSemana).toLowerCase()}`}
                          />
                        </div>
                      ),
                    },
                    {
                      key: "salida",
                      header: "Salida",
                      render: (d) => (
                        <div className="w-32">
                          <Input
                            type="time"
                            disabled={!d.laborable}
                            value={d.horaSalida}
                            onChange={(e) => updateDia(d.diaSemana, { horaSalida: e.target.value })}
                            aria-label={`Hora de salida del ${nombreDia(d.diaSemana).toLowerCase()}`}
                          />
                        </div>
                      ),
                    },
                    {
                      key: "descanso",
                      header: "Descanso (min)",
                      render: (d) => (
                        <div className="w-24">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            disabled={!d.laborable}
                            value={d.minutosDescanso}
                            onChange={(e) => updateDia(d.diaSemana, { minutosDescanso: Number(e.target.value) })}
                            aria-label={`Minutos de descanso del ${nombreDia(d.diaSemana).toLowerCase()}`}
                          />
                        </div>
                      ),
                    },
                    {
                      key: "tolEntrada",
                      header: "Tolerancia de entrada (min)",
                      render: (d) => (
                        <div className="w-24">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            disabled={!d.laborable}
                            value={d.toleranciaEntradaMin}
                            onChange={(e) =>
                              updateDia(d.diaSemana, { toleranciaEntradaMin: Number(e.target.value) })
                            }
                            aria-label={`Tolerancia de entrada del ${nombreDia(d.diaSemana).toLowerCase()}, en minutos`}
                          />
                        </div>
                      ),
                    },
                    {
                      key: "tolSalida",
                      header: "Tolerancia de salida (min)",
                      render: (d) => (
                        <div className="w-24">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            disabled={!d.laborable}
                            value={d.toleranciaSalidaMin}
                            onChange={(e) =>
                              updateDia(d.diaSemana, { toleranciaSalidaMin: Number(e.target.value) })
                            }
                            aria-label={`Tolerancia de salida del ${nombreDia(d.diaSemana).toLowerCase()}, en minutos`}
                          />
                        </div>
                      ),
                    },
                  ]}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" disabled={isPending} onClick={() => abrirDias(j)}>
                    Cancelar
                  </Button>
                  <Button loading={isPending} onClick={guardarDias}>
                    {isPending ? "Guardando…" : "Guardar días"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pendingCloseId !== null}
        title="Tienes cambios sin guardar"
        description="Si cierras el editor ahora, se pierden los cambios de días y horarios que no guardaste."
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={descartarYCerrar}
        onCancel={() => setPendingCloseId(null)}
      />
      <ConfirmDialog
        open={porEliminar !== null}
        title="Eliminar jornada"
        description={
          porEliminar
            ? `¿Eliminar la jornada «${porEliminar.nombre}»? Si ya se asignó a un contrato no se puede eliminar; en ese caso, desactívala.`
            : undefined
        }
        confirmLabel="Eliminar jornada"
        destructive
        pending={isPending}
        onConfirm={confirmarEliminar}
        onCancel={() => setPorEliminar(null)}
      />
    </div>
  );
}
