/**
 * Fechas de negocio en Nicaragua (America/Managua, UTC−6 todo el año: no hay
 * horario de verano desde 2006).
 *
 * Módulo PURO a propósito, sin imports: lo usan páginas, el Route Handler del
 * PDF y la prueba `supabase/tests/rrhh_p6_filtros.test.mjs`, que lo carga con
 * `node --experimental-strip-types` (Node no resuelve el alias `@/`).
 */

const ZONA = "America/Managua";
const DIA_MS = 86_400_000;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy en Nicaragua, en formato YYYY-MM-DD. `ahora` solo sirve para fijar el instante. */
export function hoyManagua(ahora: Date = new Date()): string {
  const parts = formatoDia.formatToParts(ahora);
  return ["year", "month", "day"].map((key) => parts.find((p) => p.type === key)!.value).join("-");
}

/**
 * "YYYY-MM-DD" más (o menos) `dias` días de calendario. Pura: no depende de
 * la zona del servidor ni de la hora. sumarDias("2026-10-01", -1) → "2026-09-30".
 */
export function sumarDias(iso: string, dias: number): string {
  if (!FECHA_ISO.test(iso) || !Number.isInteger(dias)) throw new RangeError(`sumarDias: fecha o días inválidos (${iso}, ${dias})`);
  const fecha = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) throw new RangeError(`sumarDias: fecha inválida (${iso})`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** Instante (milisegundos) de las 00:00 de `iso` en Managua. Pura. */
export function inicioDiaManagua(iso: string): number {
  return Date.parse(`${iso}T00:00:00-06:00`);
}

export type Ventana = { desde: string; hasta: string };

/**
 * Ventanas [desde, hasta) en ISO para contar marcas: el día de hoy completo y
 * el mismo tramo de ayer, de las 00:00 hasta la hora actual menos 24 h
 * ("vs. ayer a esta hora"). Pura si se pasa `ahoraMs`.
 */
export function ventanasDeMarcas(ahoraMs: number = Date.now()): {
  hoy: string;
  hoyCompleto: Ventana;
  ayerHastaEstaHora: Ventana;
} {
  const hoy = hoyManagua(new Date(ahoraMs));
  const inicioHoy = inicioDiaManagua(hoy);
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    hoy,
    hoyCompleto: { desde: iso(inicioHoy), hasta: iso(inicioHoy + DIA_MS) },
    ayerHastaEstaHora: { desde: iso(inicioHoy - DIA_MS), hasta: iso(ahoraMs - DIA_MS) },
  };
}
