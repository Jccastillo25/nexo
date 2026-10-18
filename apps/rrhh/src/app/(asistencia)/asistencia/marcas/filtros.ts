/** Estados que devuelve y acepta `consultar_marcas` (P4c, 2026-10-17). */
export const ESTADOS_MARCA = [
  "registrada", "entrada_abierta_hoy", "en_descanso_hoy", "falta_salida", "descanso_sin_cerrar", "sin_descanso_marcado",
] as const;
export type EstadoMarca = (typeof ESTADOS_MARCA)[number];

export type FiltrosMarcas = {
  desde: string; hasta: string; empleadoId?: string; contratoId?: string;
  estado?: string; offset?: number;
};
function dateValue(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : null;
}
export function filtrosValidos(input: FiltrosMarcas): boolean {
  if (!input || typeof input !== "object") return false;
  const desde = dateValue(input.desde), hasta = dateValue(input.hasta);
  if (desde === null || hasta === null || hasta < desde || hasta - desde > 61 * 86400000) return false;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if ([input.empleadoId, input.contratoId].some(value => value !== undefined && (typeof value !== "string" || (value !== "" && !uuid.test(value))))) return false;
  if (input.estado !== undefined && !(["", ...ESTADOS_MARCA] as readonly string[]).includes(input.estado)) return false;
  return input.offset === undefined || (Number.isSafeInteger(input.offset) && input.offset >= 0 && input.offset <= 2147483647);
}
