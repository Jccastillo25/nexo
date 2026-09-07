"use client";

import { useState, useTransition } from "react";
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

const inputClass =
  "rounded-lg border border-[var(--nexo-border)] bg-black/20 px-2 py-1.5 text-sm text-white outline-none focus:border-[var(--nexo-accent)]";

export default function JornadasPanel({
  jornadas,
  diasPorJornada,
  canCrear,
  canEditar,
  canEliminar,
}: JornadasPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [nuevo, setNuevo] = useState<JornadaInput>({ nombre: "", descripcion: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dias, setDias] = useState<DiaInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrirDias(j: JornadaRow) {
    if (expandedId === j.id) {
      setExpandedId(null);
      return;
    }
    setDias(diasCompletos(diasPorJornada[j.id] ?? []));
    setExpandedId(j.id);
    setError(null);
  }

  function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearJornada(nuevo);
      if (!res.ok) {
        setError(res.message ?? "No se pudo crear la jornada.");
        return;
      }
      setNuevo({ nombre: "", descripcion: "" });
      setShowForm(false);
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
      if (!res.ok) setError(res.message ?? "No se pudo actualizar la jornada.");
    });
  }

  function eliminar(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await eliminarJornada(id);
      if (!res.ok) setError(res.message ?? "No se pudo eliminar la jornada.");
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
      if (!res.ok) setError(res.message ?? "No se pudieron guardar los días.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Jornadas</h2>
        {canCrear && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-[var(--nexo-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--nexo-accent-hover)]"
          >
            + Nueva jornada
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      {showForm && (
        <form onSubmit={crear} className="nexo-glass flex flex-col gap-3 rounded-2xl p-5">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-white/60">Nombre</span>
            <input
              required
              value={nuevo.nombre}
              onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
              placeholder="ej. Administrativo 8-17"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-white/60">Descripción (opcional)</span>
            <input
              value={nuevo.descripcion}
              onChange={(e) => setNuevo((n) => ({ ...n, descripcion: e.target.value }))}
              className={inputClass}
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-[var(--nexo-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Crear
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-white/50 hover:text-white">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {jornadas.length === 0 && (
          <p className="nexo-glass rounded-2xl px-4 py-6 text-center text-sm text-white/40">
            Todavía no hay jornadas creadas. Sin al menos una, no se puede activar ningún contrato nuevo.
          </p>
        )}

        {jornadas.map((j) => (
          <div key={j.id} className="nexo-glass flex flex-col gap-3 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-white">{j.nombre}</span>
                {j.descripcion && <span className="ml-2 text-sm text-white/40">{j.descripcion}</span>}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  j.activo ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-white/40"
                }`}
              >
                {j.activo ? "activa" : "inactiva"}
              </span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              {canEditar && (
                <button type="button" onClick={() => abrirDias(j)} className="text-white/60 hover:text-white">
                  {expandedId === j.id ? "Ocultar días" : "Días y horarios"}
                </button>
              )}
              {canEditar && (
                <button type="button" onClick={() => toggleActivo(j)} className="text-white/60 hover:text-white">
                  {j.activo ? "Desactivar" : "Activar"}
                </button>
              )}
              {canEliminar && (
                <button
                  type="button"
                  onClick={() => eliminar(j.id)}
                  className="text-red-400/70 hover:text-red-400"
                >
                  Eliminar
                </button>
              )}
            </div>

            {expandedId === j.id && (
              <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-white/40">
                        <th className="py-1 pr-2">Día</th>
                        <th className="px-2">Laborable</th>
                        <th className="px-2">Entrada</th>
                        <th className="px-2">Salida</th>
                        <th className="px-2">Descanso (min)</th>
                        <th className="px-2">Tol. entrada</th>
                        <th className="px-2">Tol. salida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dias.map((d) => {
                        const label = DIAS.find((x) => x.n === d.diaSemana)?.label;
                        return (
                          <tr key={d.diaSemana} className="text-white/80">
                            <td className="py-1 pr-2">{label}</td>
                            <td className="px-2">
                              <input
                                type="checkbox"
                                checked={d.laborable}
                                onChange={(e) => updateDia(d.diaSemana, { laborable: e.target.checked })}
                              />
                            </td>
                            <td className="px-2">
                              <input
                                type="time"
                                disabled={!d.laborable}
                                value={d.horaEntrada}
                                onChange={(e) => updateDia(d.diaSemana, { horaEntrada: e.target.value })}
                                className={`${inputClass} disabled:opacity-30`}
                              />
                            </td>
                            <td className="px-2">
                              <input
                                type="time"
                                disabled={!d.laborable}
                                value={d.horaSalida}
                                onChange={(e) => updateDia(d.diaSemana, { horaSalida: e.target.value })}
                                className={`${inputClass} disabled:opacity-30`}
                              />
                            </td>
                            <td className="px-2">
                              <input
                                type="number"
                                min={0}
                                disabled={!d.laborable}
                                value={d.minutosDescanso}
                                onChange={(e) => updateDia(d.diaSemana, { minutosDescanso: Number(e.target.value) })}
                                className={`${inputClass} w-20 disabled:opacity-30`}
                              />
                            </td>
                            <td className="px-2">
                              <input
                                type="number"
                                min={0}
                                disabled={!d.laborable}
                                value={d.toleranciaEntradaMin}
                                onChange={(e) =>
                                  updateDia(d.diaSemana, { toleranciaEntradaMin: Number(e.target.value) })
                                }
                                className={`${inputClass} w-20 disabled:opacity-30`}
                              />
                            </td>
                            <td className="px-2">
                              <input
                                type="number"
                                min={0}
                                disabled={!d.laborable}
                                value={d.toleranciaSalidaMin}
                                onChange={(e) =>
                                  updateDia(d.diaSemana, { toleranciaSalidaMin: Number(e.target.value) })
                                }
                                className={`${inputClass} w-20 disabled:opacity-30`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={guardarDias}
                    className="rounded-lg bg-[var(--nexo-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {isPending ? "Guardando…" : "Guardar días"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
