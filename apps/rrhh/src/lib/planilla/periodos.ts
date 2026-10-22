/**
 * Períodos de planilla y meses de los filtros. Módulo PURO (sin acceso a
 * datos ni a Next): lo usan páginas, acciones y componentes cliente.
 *
 * Solo fechas de calendario "YYYY-MM-DD" (día de Managua, ver
 * lib/fecha-managua.ts). La regla 30/360 y cualquier conteo de días pagados
 * es de la RPC: aquí nunca se calcula planilla.
 */
import { fechaCorta } from "@nexo/ui/formato";
import { hoyManagua, sumarDias } from "@/lib/fecha-managua";
import type { ClasePlanilla, Frecuencia } from "./tipos";

export interface Periodo {
  inicio: string;
  fin: string;
}

export type Quincena = 1 | 2;

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MES_ISO = /^(\d{4})-(0[1-9]|1[0-2])$/;
/** Años que aceptan los filtros por URL (evita fechas absurdas en la RPC). */
const ANIO_MIN = 2000;
const ANIO_MAX = 2100;

function dos(n: number): string {
  return String(n).padStart(2, "0");
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "YYYY-MM-DD" que existe en el calendario (rechaza 2026-02-30). */
export function esFechaIso(valor: unknown): valor is string {
  if (typeof valor !== "string") return false;
  const m = FECHA_ISO.exec(valor);
  if (!m) return false;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  return anio >= ANIO_MIN && anio <= ANIO_MAX && mes >= 1 && mes <= 12 && dia >= 1 && dia <= ultimoDia(anio, mes);
}

/** "YYYY-MM" válido. */
export function esMes(valor: unknown): valor is string {
  if (typeof valor !== "string") return false;
  const m = MES_ISO.exec(valor);
  return m !== null && Number(m[1]) >= ANIO_MIN && Number(m[1]) <= ANIO_MAX;
}

/** Último día del mes (1–12): ultimoDia(2026, 2) → 28. */
export function ultimoDia(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Nombre del mes (1–12): nombreMes(10) → "octubre"; con `mayuscula`, "Octubre". */
export function nombreMes(mes: number, mayuscula = false): string {
  const nombre = MESES[mes - 1] ?? String(mes);
  return mayuscula ? capitalizar(nombre) : nombre;
}

/** Año y mes de "YYYY-MM" o "YYYY-MM-DD". */
export function partesMes(valor: string): { anio: number; mes: number } {
  return { anio: Number(valor.slice(0, 4)), mes: Number(valor.slice(5, 7)) };
}

// ---------------------------------------------------------------- períodos

/** 1.ª quincena: del 1 al 15; 2.ª: del 16 al último día. */
export function periodoQuincena(anio: number, mes: number, quincena: Quincena): Periodo {
  const base = `${anio}-${dos(mes)}`;
  return quincena === 1
    ? { inicio: `${base}-01`, fin: `${base}-15` }
    : { inicio: `${base}-16`, fin: `${base}-${dos(ultimoDia(anio, mes))}` };
}

export function periodoMes(anio: number, mes: number): Periodo {
  const base = `${anio}-${dos(mes)}`;
  return { inicio: `${base}-01`, fin: `${base}-${dos(ultimoDia(anio, mes))}` };
}

/** Siete días desde `inicio` (la fecha de fin se muestra en solo lectura). */
export function periodoSemana(inicio: string): Periodo {
  return { inicio, fin: sumarDias(inicio, 6) };
}

/** Aguinaldo: del 1 de enero al 31 de diciembre (decisión vigente, D11). */
export function periodoAnual(anio: number): Periodo {
  return { inicio: `${anio}-01-01`, fin: `${anio}-12-31` };
}

/**
 * Período de esa frecuencia que contiene `fecha`. La semana va de lunes a
 * domingo, igual que rrhh.fn_planilla_fin_periodo (date_trunc('week')).
 */
export function periodoQueContiene(fecha: string, frecuencia: Frecuencia): Periodo {
  const { anio, mes } = partesMes(fecha);
  const dia = Number(fecha.slice(8, 10));
  switch (frecuencia) {
    case "quincenal":
      return periodoQuincena(anio, mes, dia <= 15 ? 1 : 2);
    case "mensual":
      return periodoMes(anio, mes);
    case "anual":
      return periodoAnual(anio);
    case "semanal": {
      const diaSemana = new Date(`${fecha}T00:00:00Z`).getUTCDay(); // 0 = domingo
      return periodoSemana(sumarDias(fecha, -((diaSemana + 6) % 7)));
    }
  }
}

/**
 * Período que sigue a `ultimo` (la última planilla no anulada del tipo). Sin
 * planilla anterior, el que contiene `hoy`. La semanal conserva su cadencia
 * (los 7 días siguientes al fin), aunque no empiece en lunes.
 */
export function periodoSiguiente(ultimo: Periodo | null, frecuencia: Frecuencia, hoy: string = hoyManagua()): Periodo {
  if (!ultimo) return periodoQueContiene(hoy, frecuencia);
  const siguienteDia = sumarDias(ultimo.fin, 1);
  return frecuencia === "semanal" ? periodoSemana(siguienteDia) : periodoQueContiene(siguienteDia, frecuencia);
}

/**
 * Nombre del período para la pantalla:
 * "1.ª quincena de octubre de 2026", "Octubre de 2026",
 * "Semana del 05/10/2026 al 11/10/2026", "Aguinaldo 2026".
 * Un rango que no calza con su frecuencia se muestra como "Del … al …".
 */
export function etiquetaPeriodo(inicio: string, fin: string, frecuencia: Frecuencia | null, clase?: ClasePlanilla | null): string {
  if (!esFechaIso(inicio) || !esFechaIso(fin)) return delAl(inicio, fin);
  const a = partesMes(inicio);
  const b = partesMes(fin);
  if (clase === "aguinaldo" || frecuencia === "anual") {
    return a.anio === b.anio ? `Aguinaldo ${b.anio}` : `Aguinaldo ${a.anio}–${b.anio}`;
  }
  const diaInicio = Number(inicio.slice(8, 10));
  const diaFin = Number(fin.slice(8, 10));
  const mismoMes = a.anio === b.anio && a.mes === b.mes;
  const finDeMes = diaFin === ultimoDia(b.anio, b.mes);
  if (frecuencia === "quincenal" && mismoMes) {
    if (diaInicio === 1 && diaFin === 15) return `1.ª quincena de ${nombreMes(a.mes)} de ${a.anio}`;
    if (diaInicio === 16 && finDeMes) return `2.ª quincena de ${nombreMes(a.mes)} de ${a.anio}`;
  }
  if (frecuencia === "mensual" && mismoMes && diaInicio === 1 && finDeMes) {
    return `${nombreMes(a.mes, true)} de ${a.anio}`;
  }
  if (frecuencia === "semanal") return `Semana del ${fechaCorta(inicio)} al ${fechaCorta(fin)}`;
  return delAl(inicio, fin);
}

/** "Del 01/10/2026 al 15/10/2026" (un solo día: "01/10/2026"). */
export function delAl(inicio: string, fin: string): string {
  return inicio === fin ? fechaCorta(inicio) : `Del ${fechaCorta(inicio)} al ${fechaCorta(fin)}`;
}

/** "01/10/2026 – 15/10/2026" (línea secundaria de las tablas). */
export function rangoFechas(inicio: string, fin: string): string {
  return inicio === fin ? fechaCorta(inicio) : `${fechaCorta(inicio)} – ${fechaCorta(fin)}`;
}

// ---------------------------------------------------------------- meses ("YYYY-MM")

/** "YYYY-MM" de una fecha "YYYY-MM-DD". */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

/** Primer y último día de un mes "YYYY-MM". */
export function rangoMes(mes: string): Periodo {
  const { anio, mes: m } = partesMes(mes);
  return periodoMes(anio, m);
}

/** "YYYY-MM-01" (p. ej. `p_mes` de planilla_provisiones_generar y de las declaraciones). */
export function primerDiaMes(mes: string): string {
  return `${mes}-01`;
}

export function mesAnterior(mes: string): string {
  const { anio, mes: m } = partesMes(mes);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${dos(m - 1)}`;
}

export function mesSiguiente(mes: string): string {
  const { anio, mes: m } = partesMes(mes);
  return m === 12 ? `${anio + 1}-01` : `${anio}-${dos(m + 1)}`;
}

/**
 * Mes del parámetro `?mes=` si es válido; si no, el mes de `hoy`. Acepta el
 * valor tal como llega de `searchParams` (texto, arreglo o nada).
 */
export function leerMes(param: string | string[] | undefined | null, hoy: string = hoyManagua()): string {
  const valor = Array.isArray(param) ? param[0] : param;
  return esMes(valor) ? valor : mesDe(hoy);
}

/** Fecha del parámetro si es "YYYY-MM-DD" válida; si no, `defecto`. */
export function leerFecha(param: string | string[] | undefined | null, defecto: string): string {
  const valor = Array.isArray(param) ? param[0] : param;
  return esFechaIso(valor) ? valor : defecto;
}

/** "Octubre de 2026". */
export function etiquetaMes(mes: string): string {
  const { anio, mes: m } = partesMes(mes);
  return `${nombreMes(m, true)} de ${anio}`;
}
