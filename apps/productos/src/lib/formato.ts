// Montos y fechas visibles van con el formato del kit (moneda, fechaCorta...
// de @nexo/ui). Aquí solo queda lo que el kit no cubre: la fecha AAAA-MM-DD
// del día de Managua, para nombres de archivo y valores de <input type="date">.
// No se usa toISOString(): da la fecha UTC, que desde las 6 p. m. de Managua
// ya es el día siguiente.
import { ZONA_HORARIA } from "@nexo/ui";

const partesFecha = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-10-20": día de Managua de `fecha` (por defecto, ahora). */
export function fechaIsoManagua(fecha: Date = new Date()): string {
  const p = Object.fromEntries(partesFecha.formatToParts(fecha).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
}
