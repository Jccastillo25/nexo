// Métricas de Atención (RPC public.atencion_metricas, migración 20261015173729).
// Tiempos en segundos; "no se presentó" no entra en espera ni atención.

export interface ResumenMetricas {
  /** Solo en reportes globales (null en "Mis métricas"). */
  turnos: number | null;
  anulados: number | null;
  vencidos: number | null;
  en_curso: number | null;
  atendidos: number;
  no_se_presento: number;
  reactivados: number;
  fuera_de_orden: number;
  espera_prom: number | null;
  espera_mediana: number | null;
  espera_max: number | null;
  atencion_prom: number | null;
  atencion_mediana: number | null;
  atencion_max: number | null;
  sesion_segundos: number;
}

export interface MetricasAgente {
  user_id: string;
  nombre: string;
  atendidos: number;
  no_se_presento: number;
  espera_prom: number | null;
  atencion_prom: number | null;
  atencion_mediana: number | null;
  fuera_de_orden: number;
  sesion_segundos: number;
}

export interface Metricas {
  desde: string;
  hasta: string;
  solo_mias: boolean;
  resumen: ResumenMetricas;
  por_hora: { hora: number; turnos: number }[];
  por_dia: {
    fecha: string;
    atendidos: number;
    no_se_presento: number;
    espera_prom: number | null;
    atencion_prom: number | null;
  }[];
  por_agente: MetricasAgente[] | null;
  por_puesto: { puesto: string; atendidos: number; atencion_prom: number | null }[] | null;
}

export const PERIODOS = [
  { valor: "hoy", etiqueta: "Hoy", dias: 0 },
  { valor: "7d", etiqueta: "7 días", dias: 6 },
  { valor: "30d", etiqueta: "30 días", dias: 29 },
  { valor: "90d", etiqueta: "90 días", dias: 89 },
] as const;

export type Periodo = (typeof PERIODOS)[number]["valor"];

/** Zona de las sucursales (todas en Nicaragua hoy; ver core.sucursales.zona_horaria). */
const ZONA = "America/Managua";

function fechaLocal(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
}

/** Suma (o resta) días a una fecha "AAAA-MM-DD" sin pasar por la zona del servidor. */
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Rango [desde, hasta] en fecha local para el período; valor desconocido = hoy. */
export function rangoDe(periodo: string | undefined): { periodo: Periodo; desde: string; hasta: string } {
  const p = PERIODOS.find((x) => x.valor === periodo) ?? PERIODOS[0];
  const hoy = fechaLocal(new Date());
  return { periodo: p.valor, desde: sumarDias(hoy, -p.dias), hasta: hoy };
}

/**
 * Los `dias` días inmediatamente anteriores a un rango, para comparar.
 * Hoy (desde = hasta = 20/10) → 13/10 a 19/10.
 */
export function rangoAnterior(rango: { desde: string }, dias = 7): { desde: string; hasta: string } {
  return { desde: sumarDias(rango.desde, -dias), hasta: sumarDias(rango.desde, -1) };
}

/**
 * Segundos que lleva en la fila el turno en espera más antiguo (por
 * `en_fila_desde`, que se reinicia al reactivar), o null si nadie espera.
 */
export function esperaMasAntigua(
  turnos: readonly { estado: string; en_fila_desde: string }[],
  ahoraMs: number
): number | null {
  let masAntiguo: number | null = null;
  for (const t of turnos) {
    if (t.estado !== "esperando") continue;
    const desde = Date.parse(t.en_fila_desde);
    if (Number.isNaN(desde)) continue;
    if (masAntiguo === null || desde < masAntiguo) masAntiguo = desde;
  }
  return masAntiguo === null ? null : Math.max(0, Math.round((ahoraMs - masAntiguo) / 1000));
}

/** Comparación de un tiempo con su período anterior, con la forma de `delta` de MetricCard. */
export interface ComparacionDuracion {
  value: string;
  direction: "up" | "down" | "flat";
  tone: "positive" | "negative" | "neutral";
}

/**
 * Diferencia entre dos tiempos en segundos (actual − anterior). Que baje es
 * bueno (menos espera): bajar = positivo, subir = negativo. Sin alguno de los
 * dos valores no hay comparación (null).
 */
export function compararDuracion(
  actual: number | null | undefined,
  anterior: number | null | undefined
): ComparacionDuracion | null {
  if (actual === null || actual === undefined || anterior === null || anterior === undefined) return null;
  const diferencia = Math.round(actual - anterior);
  if (diferencia === 0) return { value: "0 s", direction: "flat", tone: "neutral" };
  return {
    value: formatoDuracion(Math.abs(diferencia)),
    direction: diferencia > 0 ? "up" : "down",
    tone: diferencia > 0 ? "negative" : "positive",
  };
}

/** 535 → "8 min 55 s"; 10579 → "2 h 56 min"; null → "—". */
export function formatoDuracion(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined) return "—";
  const s = Math.round(segundos);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  const resto = s % 60;
  return resto > 0 ? `${m} min ${resto} s` : `${m} min`;
}

/** "2026-10-15" → "15/10". */
export function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}
