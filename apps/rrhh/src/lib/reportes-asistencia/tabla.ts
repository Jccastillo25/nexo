/**
 * Definición de columnas y totales de cada reporte, en texto ya formateado.
 * Una sola definición para la pantalla, el PDF y la vista de impresión, para
 * que los tres muestren exactamente lo mismo.
 */
import {
  entero,
  estadoDia,
  fechaCorta,
  horaManagua,
  horaProgramada,
  minutosHM,
  minutosPromedio,
  persona,
  porcentaje,
  propia,
  textoObservaciones,
  TIPOS_INCIDENCIA,
} from "./formato";
import type { DatosReporte, FilaDiaria, FilaResumen, Reporte, Totales } from "./tipos";

export type ColumnaTabla = {
  key: string;
  header: string;
  /** Números y horas a la derecha. */
  derecha?: boolean;
};

export type FilaTabla = {
  id: string;
  celdas: string[];
  /** Estado crudo del día (para el StatusBadge en pantalla). */
  estado?: string;
};

export type Tabla = { columnas: ColumnaTabla[]; filas: FilaTabla[] };

export type Total = { label: string; valor: string; hint?: string };

type Def<F> = ColumnaTabla & { valor: (f: F) => string };

const fecha: Def<FilaDiaria> = { key: "fecha", header: "Fecha", valor: (f) => fechaCorta(f.fecha) };
const personaCol: Def<FilaDiaria> = {
  key: "persona",
  header: "Persona (código)",
  valor: (f) => persona(f.empleado_nombre, f.empleado_codigo),
};
const departamento: Def<FilaDiaria> = { key: "departamento", header: "Departamento", valor: (f) => f.departamento ?? "—" };
const entrada: Def<FilaDiaria> = { key: "entrada", header: "Entrada", derecha: true, valor: (f) => horaManagua(f.entrada) };
const inicioDesc: Def<FilaDiaria> = {
  key: "inicio_descanso",
  header: "Inicio desc.",
  derecha: true,
  valor: (f) => horaManagua(f.inicio_descanso),
};
const finDesc: Def<FilaDiaria> = {
  key: "fin_descanso",
  header: "Fin desc.",
  derecha: true,
  valor: (f) => horaManagua(f.fin_descanso),
};
const salida: Def<FilaDiaria> = { key: "salida", header: "Salida", derecha: true, valor: (f) => horaManagua(f.salida) };
const netas: Def<FilaDiaria> = {
  key: "netas",
  header: "Netas",
  derecha: true,
  // En feriado/día no laborable las horas trabajadas van en minutos_no_laborable.
  valor: (f) => minutosHM(f.minutos_netos ?? f.minutos_no_laborable),
};
const tardanza: Def<FilaDiaria> = {
  key: "tardanza",
  header: "Tardanza",
  derecha: true,
  valor: (f) => minutosHM(f.minutos_tardanza),
};
const salTemprana: Def<FilaDiaria> = {
  key: "salida_temprana",
  header: "Sal. temprana",
  derecha: true,
  valor: (f) => minutosHM(f.minutos_salida_temprana),
};
const estado: Def<FilaDiaria> = { key: "estado", header: "Estado", valor: (f) => estadoDia(f.estado).label };
const observaciones: Def<FilaDiaria> = {
  key: "observaciones",
  header: "Observaciones",
  valor: (f) => textoObservaciones(f.observaciones),
};

const COLUMNAS_DIARIA: Def<FilaDiaria>[] = [
  fecha, personaCol, departamento, entrada, inicioDesc, finDesc, salida, netas, tardanza, salTemprana, estado, observaciones,
];

const COLUMNAS_TARDANZAS: Def<FilaDiaria>[] = [
  fecha,
  personaCol,
  departamento,
  { key: "entrada_prog", header: "Entrada prog.", derecha: true, valor: (f) => horaProgramada(f.hora_entrada_prog) },
  entrada,
  tardanza,
  { key: "salida_prog", header: "Salida prog.", derecha: true, valor: (f) => horaProgramada(f.hora_salida_prog) },
  salida,
  salTemprana,
  estado,
];

const COLUMNAS_INCIDENCIAS: Def<FilaDiaria>[] = [
  fecha,
  personaCol,
  departamento,
  { key: "tipo", header: "Tipo", valor: (f) => (f.tipo ? propia(TIPOS_INCIDENCIA, f.tipo) ?? f.tipo : "—") },
  entrada,
  inicioDesc,
  finDesc,
  salida,
  { key: "marcas", header: "Marcas", derecha: true, valor: (f) => entero(f.marcas_count) },
  estado,
  observaciones,
];

function programado(f: FilaDiaria): string {
  if (f.es_feriado) return f.feriado_nombre ? `Feriado: ${f.feriado_nombre}` : "Feriado";
  if (!f.jornada_id) return "Sin jornada";
  if (!f.laborable) return "No laborable";
  return `${horaProgramada(f.hora_entrada_prog)}–${horaProgramada(f.hora_salida_prog)}`;
}

function descanso(f: FilaDiaria): string {
  if (f.descanso_aplicado_min === null || f.descanso_aplicado_min === undefined) return "—";
  const origen = f.descanso_origen === "programado" ? " (prog.)" : "";
  return `${minutosHM(f.descanso_aplicado_min)}${origen}`;
}

const COLUMNAS_TARJETA: Def<FilaDiaria>[] = [
  fecha,
  { key: "programado", header: "Programado", valor: programado },
  entrada,
  inicioDesc,
  finDesc,
  salida,
  { key: "descanso", header: "Descanso", derecha: true, valor: descanso },
  netas,
  tardanza,
  salTemprana,
  estado,
  observaciones,
];

const COLUMNAS_RESUMEN: Def<FilaResumen>[] = [
  { key: "persona", header: "Persona (código)", valor: (f) => persona(f.empleado_nombre, f.empleado_codigo) },
  { key: "contrato", header: "Contrato", derecha: true, valor: (f) => `N.º ${f.contrato_numero}` },
  { key: "departamento", header: "Departamento", valor: (f) => f.departamento ?? "—" },
  { key: "dias_laborables", header: "Días lab.", derecha: true, valor: (f) => entero(f.dias_laborables) },
  { key: "dias_asistidos", header: "Asistidos", derecha: true, valor: (f) => entero(f.dias_asistidos) },
  { key: "ausencias", header: "Sin marcas", derecha: true, valor: (f) => entero(f.ausencias) },
  { key: "incompletos", header: "Incompletos", derecha: true, valor: (f) => entero(f.incompletos) },
  { key: "programadas", header: "Programadas", derecha: true, valor: (f) => minutosHM(f.minutos_programados) },
  { key: "netas", header: "Netas", derecha: true, valor: (f) => minutosHM(f.minutos_netos) },
  { key: "sobre_jornada", header: "Sobre jornada", derecha: true, valor: (f) => minutosHM(f.minutos_sobre_jornada) },
  { key: "no_laborable", header: "No laborable", derecha: true, valor: (f) => minutosHM(f.minutos_no_laborable) },
  {
    key: "tardanzas",
    header: "Tardanzas",
    derecha: true,
    valor: (f) => `${entero(f.tardanzas)} · ${minutosHM(f.minutos_tardanza)}`,
  },
  {
    key: "salidas_tempranas",
    header: "Sal. tempranas",
    derecha: true,
    valor: (f) => `${entero(f.salidas_tempranas)} · ${minutosHM(f.minutos_salida_temprana)}`,
  },
  { key: "puntualidad", header: "Puntualidad", derecha: true, valor: (f) => porcentaje(f.puntualidad) },
  { key: "promedio", header: "Prom. tardanza", derecha: true, valor: (f) => minutosPromedio(f.promedio_tardanza) },
];

function armar<F>(defs: Def<F>[], filas: F[], id: (f: F) => string, estadoDe?: (f: F) => string): Tabla {
  return {
    columnas: defs.map(({ key, header, derecha }) => ({ key, header, derecha })),
    filas: filas.map((f) => ({ id: id(f), celdas: defs.map((d) => d.valor(f)), estado: estadoDe?.(f) })),
  };
}

const idDiaria = (f: FilaDiaria) => `${f.contrato_id}:${f.fecha}`;

export function tablaDe(datos: DatosReporte): Tabla {
  switch (datos.reporte) {
    case "resumen":
      return armar(COLUMNAS_RESUMEN, datos.filas, (f) => f.contrato_id);
    case "diaria":
      return armar(COLUMNAS_DIARIA, datos.filas, idDiaria, (f) => f.estado);
    case "tardanzas":
      return armar(COLUMNAS_TARDANZAS, datos.filas, idDiaria, (f) => f.estado);
    case "incidencias":
      return armar(COLUMNAS_INCIDENCIAS, datos.filas, idDiaria, (f) => f.estado);
    case "tarjeta":
      return armar(COLUMNAS_TARJETA, datos.filas, idDiaria, (f) => f.estado);
  }
}

const n = (t: Totales, k: string) => t[k] ?? 0;

/** Totales del período (MetricCard en pantalla; bloque final en PDF/impresión). */
export function totalesDe(reporte: Reporte, t: Totales, total: number): Total[] {
  switch (reporte) {
    case "diaria":
    case "tarjeta":
      return [
        { label: reporte === "tarjeta" ? "Días" : "Días-persona", valor: entero(total) },
        { label: "Completos", valor: entero(n(t, "completos")), hint: `${entero(n(t, "incompletos"))} incompletos` },
        { label: "Horas netas", valor: minutosHM(n(t, "minutos_netos")), hint: `${minutosHM(n(t, "minutos_no_laborable"))} en días no laborables` },
        { label: "Tardanzas", valor: entero(n(t, "tardanzas")), hint: `${minutosHM(n(t, "minutos_tardanza"))} en total` },
        { label: "Salidas tempranas", valor: entero(n(t, "salidas_tempranas")), hint: `${minutosHM(n(t, "minutos_salida_temprana"))} en total` },
      ];
    case "resumen":
      return [
        { label: "Personas", valor: entero(n(t, "personas")), hint: `${entero(total)} contratos` },
        { label: "Horas netas", valor: minutosHM(n(t, "minutos_netos")), hint: `de ${minutosHM(n(t, "minutos_programados"))} programadas` },
        { label: "Sobre jornada", valor: minutosHM(n(t, "minutos_sobre_jornada")), hint: "Informativo, no son horas extra" },
        { label: "Días sin marcas", valor: entero(n(t, "ausencias")) },
        { label: "Tardanzas", valor: entero(n(t, "tardanzas")), hint: `${minutosHM(n(t, "minutos_tardanza"))} en total` },
        { label: "Puntualidad", valor: porcentaje(t.puntualidad ?? null), hint: "Días puntuales / días evaluables" },
      ];
    case "tardanzas":
      return [
        { label: "Tardanzas", valor: entero(n(t, "tardanzas")), hint: `${minutosHM(n(t, "minutos_tardanza"))} en total` },
        {
          label: "Salidas tempranas",
          valor: entero(n(t, "salidas_tempranas")),
          hint: `${minutosHM(n(t, "minutos_salida_temprana"))} en total`,
        },
        { label: "Personas", valor: entero(n(t, "personas")) },
      ];
    case "incidencias":
      return Object.entries(TIPOS_INCIDENCIA).map(([clave, label]) => ({ label, valor: entero(n(t, clave)) }));
  }
}
