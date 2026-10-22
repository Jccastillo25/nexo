"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FilterBar, Input, Select } from "@nexo/ui";
import {
  ESTADOS_DIA,
  exigeNoLaborables,
  filtrosAplican,
  filtrosAQuery,
  filtrosDeRango,
  MAX_DIAS,
  rangoPorDefecto,
  tiposDe,
  validarRango,
} from "@/lib/reportes-asistencia/formato";
import { rutaReporte } from "@/lib/reportes-asistencia/rutas";
import type { FiltrosReporte, OpcionId, Reporte } from "@/lib/reportes-asistencia/tipos";

export type EmpleadoFiltro = { id: string; label: string; contratos?: { id: string; numero: number; estado: string }[] };

type Props = {
  reporte: Reporte;
  hoy: string;
  valores: FiltrosReporte;
  departamentos: OpcionId[];
  puestos: OpcionId[];
  empleados: EmpleadoFiltro[];
};

/** Controles que pueden fallar la validación del cliente. */
type Campo = "desde" | "hasta" | "empleadoId" | "contratoId";
type ErrorCampo = { campo: Campo; mensaje: string };

const ID_AYUDA_NO_LABORABLES = "reporte-filtros-no-laborables";

// Anchos en la barra de filtros: una columna en el celular, ancho fijo desde sm.
const ANCHO_FECHA = "w-full sm:w-40";
const ANCHO_LISTA = "w-full sm:w-48";
const ANCHO_PERSONA = "w-full sm:w-64";

const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** Qué fecha señalar cuando el rango no es válido. */
function campoDelRango(desde: string, hasta: string, hoy: string): Campo {
  if (!esFecha(desde)) return "desde";
  if (!esFecha(hasta) || hasta > hoy) return "hasta";
  return "desde";
}

/**
 * Filtros de un reporte. El estado aplicado vive en la URL (searchParams):
 * "Consultar" valida el rango aquí mismo (mismo límite que la RPC) y navega
 * con router.push; la página (Server Component) vuelve a consultar.
 *
 * Un error de validación se muestra junto al control que falló (Field lo
 * conecta con aria-invalid + aria-describedby) y el foco se mueve a ese control.
 */
export default function FiltrosReporteForm({ reporte, hoy, valores, departamentos, puestos, empleados }: Props) {
  const router = useRouter();
  const [borrador, setBorrador] = useState<FiltrosReporte>(valores);
  const [error, setError] = useState<ErrorCampo | null>(null);
  const [pendiente, startTransition] = useTransition();
  const refDesde = useRef<HTMLInputElement>(null);
  const refHasta = useRef<HTMLInputElement>(null);
  const refEmpleado = useRef<HTMLSelectElement>(null);
  const refContrato = useRef<HTMLSelectElement>(null);
  const aplica = filtrosAplican(reporte);
  const tipos = tiposDe(reporte);
  const contratos = empleados.find((e) => e.id === borrador.empleadoId)?.contratos ?? [];
  const noLaborablesForzado = aplica.noLaborables && exigeNoLaborables(borrador.estado);

  /** Mensaje de error solo para el control que falló (Field lo muestra junto al campo). */
  function errorDe(campo: Campo) {
    return error?.campo === campo ? error.mensaje : undefined;
  }

  function cambiar<K extends keyof FiltrosReporte>(clave: K, valor: FiltrosReporte[K]) {
    setError(null);
    setBorrador((previo) => ({
      ...previo,
      [clave]: valor,
      ...(clave === "empleadoId" ? { contratoId: "" } : {}),
      ...(clave === "estado" && exigeNoLaborables(String(valor)) ? { incluirNoLaborables: true } : {}),
    }));
  }

  function fallar(campo: Campo, mensaje: string) {
    setError({ campo, mensaje });
    const ref = { desde: refDesde, hasta: refHasta, empleadoId: refEmpleado, contratoId: refContrato }[campo];
    ref.current?.focus();
  }

  function consultar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problemaRango = validarRango(borrador.desde, borrador.hasta, hoy);
    if (problemaRango) return fallar(campoDelRango(borrador.desde, borrador.hasta, hoy), problemaRango);
    if (reporte === "tarjeta") {
      if (!borrador.empleadoId) return fallar("empleadoId", "Elige la persona de la tarjeta.");
      if (contratos.length > 1 && !borrador.contratoId) {
        return fallar("contratoId", "Esta persona tiene varios contratos: elige uno.");
      }
    }
    const filtros = noLaborablesForzado ? { ...borrador, incluirNoLaborables: true } : borrador;
    startTransition(() => router.push(rutaReporte(reporte, filtrosAQuery(reporte, filtros))));
  }

  function limpiar() {
    const rango = rangoPorDefecto(hoy);
    setBorrador(filtrosDeRango(rango.desde, rango.hasta));
    setError(null);
    startTransition(() => router.push(rutaReporte(reporte)));
  }

  return (
    <form onSubmit={consultar} noValidate aria-label="Filtros del reporte">
      <FilterBar onReset={limpiar}>
        <Field label="Desde" required error={errorDe("desde")} className={ANCHO_FECHA}>
          <Input
            ref={refDesde}
            required
            type="date"
            max={hoy}
            value={borrador.desde}
            onChange={(e) => cambiar("desde", e.target.value)}
          />
        </Field>
        <Field label="Hasta" required error={errorDe("hasta")} className={ANCHO_FECHA}>
          <Input
            ref={refHasta}
            required
            type="date"
            max={hoy}
            value={borrador.hasta}
            onChange={(e) => cambiar("hasta", e.target.value)}
          />
        </Field>
        <Field label="Departamento" className={ANCHO_LISTA}>
          <Select value={borrador.departamentoId} onChange={(e) => cambiar("departamentoId", e.target.value)}>
            <option value="">Todos</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Puesto" className={ANCHO_LISTA}>
          <Select value={borrador.puestoId} onChange={(e) => cambiar("puestoId", e.target.value)}>
            <option value="">Todos</option>
            {puestos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Persona"
          required={reporte === "tarjeta"}
          error={errorDe("empleadoId")}
          className={ANCHO_PERSONA}
        >
          <Select
            ref={refEmpleado}
            value={borrador.empleadoId}
            required={reporte === "tarjeta"}
            onChange={(e) => cambiar("empleadoId", e.target.value)}
          >
            <option value="">{reporte === "tarjeta" ? "Elige una persona" : "Todas"}</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </Select>
        </Field>
        {aplica.contrato ? (
          <Field label="Contrato" error={errorDe("contratoId")} className={ANCHO_LISTA}>
            <Select
              ref={refContrato}
              value={borrador.contratoId}
              disabled={contratos.length === 0}
              onChange={(e) => cambiar("contratoId", e.target.value)}
            >
              <option value="">{contratos.length > 1 ? "Elige un contrato" : contratos.length === 1 ? "Único contrato" : "—"}</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  N.º {c.numero} ({c.estado === "activo" ? "activo" : "finalizado"})
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {aplica.estado ? (
          <Field label="Estado" className={ANCHO_LISTA}>
            <Select value={borrador.estado} onChange={(e) => cambiar("estado", e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ESTADOS_DIA).map(([clave, { label }]) => (
                <option key={clave} value={clave}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {aplica.tipo ? (
          <Field label="Tipo" className={ANCHO_LISTA}>
            <Select value={borrador.tipo} onChange={(e) => cambiar("tipo", e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(tipos).map(([clave, label]) => (
                <option key={clave} value={clave}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {aplica.noLaborables ? (
          <div className="flex flex-col gap-1 self-center sm:pt-5">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
                checked={borrador.incluirNoLaborables || noLaborablesForzado}
                disabled={noLaborablesForzado}
                aria-describedby={noLaborablesForzado ? ID_AYUDA_NO_LABORABLES : undefined}
                onChange={(e) => cambiar("incluirNoLaborables", e.target.checked)}
              />
              Incluir feriados y días no laborables
            </label>
            {noLaborablesForzado ? (
              <p id={ID_AYUDA_NO_LABORABLES} className="text-xs text-neutral-500">
                Necesario para el estado elegido.
              </p>
            ) : null}
          </div>
        ) : null}
        <Button type="submit" loading={pendiente}>
          {pendiente ? "Consultando…" : "Consultar"}
        </Button>
      </FilterBar>
      <p className="mt-2 text-xs text-neutral-500">
        Rango máximo de {MAX_DIAS} días, hasta hoy. Fechas y horas de Nicaragua.
      </p>
    </form>
  );
}
