// Periodo (año/mes) de las pantallas: va en la URL (?anio=2026&mes=9) y por
// defecto es el mes actual en Nicaragua. Funciones puras: sirven en servidor
// y en cliente.

export const ANIO_MIN = 2023;
export const ZONA = "America/Managua";

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

export const nombreMes = (mes: number) => MESES[mes - 1] ?? "";
export const mesCorto = (mes: number) => MESES_CORTOS[mes - 1] ?? "";
export const capitalizar = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Hoy en Managua, YYYY-MM-DD. */
export function hoyManagua(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function periodoActual(): { anio: number; mes: number } {
  const [a, m] = hoyManagua().split("-");
  return { anio: Number(a), mes: Number(m) };
}

/** Años que se pueden elegir: 2023 → año actual + 1. */
export function aniosDisponibles(): number[] {
  const max = periodoActual().anio + 1;
  const r: number[] = [];
  for (let a = max; a >= ANIO_MIN; a--) r.push(a);
  return r;
}

type Params = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export function leerAnio(params: Params): number {
  const actual = periodoActual().anio;
  const a = Number(uno(params.anio));
  return Number.isInteger(a) && a >= ANIO_MIN && a <= actual + 1 ? a : actual;
}

export function leerPeriodo(params: Params): { anio: number; mes: number } {
  const actual = periodoActual();
  const anio = leerAnio(params);
  const m = Number(uno(params.mes));
  const mes = Number.isInteger(m) && m >= 1 && m <= 12 ? m : actual.mes;
  return { anio, mes };
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Primer y último día del mes, YYYY-MM-DD. */
export function rangoMes(anio: number, mes: number): { desde: string; hasta: string } {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return { desde: `${anio}-${dos(mes)}-01`, hasta: `${anio}-${dos(mes)}-${dos(ultimo)}` };
}

/** Días entre dos fechas YYYY-MM-DD (hasta − desde). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

export function esFechaIso(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** Mes desplazado n meses (n negativo hacia atrás). */
export function moverMes(anio: number, mes: number, n: number): { anio: number; mes: number } {
  const t = anio * 12 + (mes - 1) + n;
  return { anio: Math.floor(t / 12), mes: (t % 12) + 1 };
}

/** Ventana de la meta sugerida: los 3 meses anteriores, p. ej. "jun–ago 2026" o "nov 2025–ene 2026". */
export function ventanaBase(anio: number, mes: number): string {
  const ini = moverMes(anio, mes, -3);
  const fin = moverMes(anio, mes, -1);
  return ini.anio === fin.anio
    ? `${mesCorto(ini.mes)}–${mesCorto(fin.mes)} ${fin.anio}`
    : `${mesCorto(ini.mes)} ${ini.anio}–${mesCorto(fin.mes)} ${fin.anio}`;
}
