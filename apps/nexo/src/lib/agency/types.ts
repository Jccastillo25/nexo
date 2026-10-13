/**
 * MODELO LOCAL TIPADO Y DETERMINISTA — operación ficticia de la agencia
 * digital (ticket #13, etapa 2). SOLO DEMOSTRACIÓN.
 *
 * Reglas invariantes de este módulo:
 * - Sin persistencia, sin consultas operativas (Supabase/RPC) y sin
 *   llamadas externas (fetch). Todo se deriva en memoria de los fixtures
 *   locales de `./fixtures`.
 * - Determinista: mismas entradas -> mismas salidas. Sin Date.now(), sin
 *   Math.random(), sin orden dependiente del reloj.
 * - Datos ficticios: ningún identificador corresponde a una persona, cliente
 *   o credencial real. La marca `DEMO_DATA_NOTICE` debe mostrarse visible en
 *   toda interfaz que consuma estos datos (ver `./checks` y docs adjunta).
 */

/** Marca visible obligatoria: la UI debe renderizar este texto junto a los datos. */
export const DEMO_DATA_NOTICE = "Datos de demostración — no representan información real";

/** Estado de disponibilidad de un agente de la agencia. */
export type AgentStatus = "disponible" | "ocupado" | "bloqueado";

export interface Agent {
  /** Identificador único e inmutable dentro de los fixtures. */
  readonly id: string;
  /** Nombre ficticio mostrado en la UI. */
  readonly name: string;
  /** Rol funcional dentro de la agencia (ej. "Diseño", "Frontend"). */
  readonly role: string;
  readonly status: AgentStatus;
}

/** Estado de una etapa individual dentro de un ticket. */
export type StageStatus = "pendiente" | "en_curso" | "completada";

export interface TicketStage {
  readonly id: string;
  readonly name: string;
  readonly status: StageStatus;
  /** Porcentaje de avance de la etapa; entero en [0, 100]. */
  readonly progress: number;
  /** Orden explícito (1-based) para no depender del orden del array. */
  readonly order: number;
}

/** Estado general derivado de las etapas del ticket. */
export type TicketStatus = "pendiente" | "en_curso" | "completado";

export interface Ticket {
  readonly id: string;
  readonly title: string;
  /** id de un Agent existente, o null si está explícitamente sin asignar. */
  readonly assignedAgentId: string | null;
  readonly status: TicketStatus;
  /** Etapas ordenadas por `order` ascendente. */
  readonly stages: readonly TicketStage[];
}

export interface AgencyDataset {
  readonly agents: readonly Agent[];
  readonly tickets: readonly Ticket[];
}

/** Resumen derivado de agentes: conteo por estado. Suma = total de agentes. */
export interface AgentSummary {
  readonly total: number;
  readonly disponible: number;
  readonly ocupado: number;
  readonly bloqueado: number;
}

/** Resumen derivado de tickets: conteo por estado y sin asignar. */
export interface TicketSummary {
  readonly total: number;
  readonly pendiente: number;
  readonly enCurso: number;
  readonly completado: number;
  readonly sinAsignar: number;
  /** Progreso global del conjunto, entero en [0, 100]. */
  readonly globalProgress: number;
}
