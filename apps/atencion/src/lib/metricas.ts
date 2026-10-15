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

/** Rango [desde, hasta] en fecha local para el período; valor desconocido = hoy. */
export function rangoDe(periodo: string | undefined): { periodo: Periodo; desde: string; hasta: string } {
  const p = PERIODOS.find((x) => x.valor === periodo) ?? PERIODOS[0];
  const hoy = fechaLocal(new Date());
  const desde = new Date(`${hoy}T12:00:00Z`);
  desde.setUTCDate(desde.getUTCDate() - p.dias);
  return { periodo: p.valor, desde: desde.toISOString().slice(0, 10), hasta: hoy };
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
