import type {
  AgencyDataset,
  Agent,
  AgentSummary,
  Ticket,
  TicketSummary,
} from "./types";

/**
 * UTILIDADES DE DERIVACIÓN — puras, deterministas, sin persistencia,
 * consultas operativas ni llamadas externas (ticket #13, etapa 2).
 *
 * REGLA DE PROGRESO GLOBAL (documentada, ver docs/DASHBOARD_AGENCIA_DEMO.md):
 * El progreso global es el promedio aritmético de los porcentajes de ETAPA
 * de todas las etapas de todos los tickets, redondeado al entero más
 * cercano (Math.round) y acotado a [0, 100]. Se promedian etapas, no
 * tickets, para que cada etapa pese igual; un dataset sin etapas (o sin
 * tickets) devuelve 0 (denominador cero) — nunca NaN. Es determinista y no
 * depende del orden de los arrays.
 */

/** Acota un porcentaje a entero en [0, 100]; valores no finitos -> 0. */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Ordena etapas por `order` ascendente sin mutar la entrada. */
export function sortStages(ticket: Ticket) {
  return [...ticket.stages].sort((a, b) => a.order - b.order);
}

/** Todas las etapas del dataset, en orden estable. */
export function allStages(dataset: AgencyDataset) {
  return dataset.tickets.flatMap((ticket) => sortStages(ticket));
}

/**
 * Progreso global (0-100) del conjunto: promedio de los porcentajes de
 * etapa, redondeado. Sin etapas -> 0.
 */
export function globalProgress(dataset: AgencyDataset): number {
  const stages = allStages(dataset);
  if (stages.length === 0) return 0;
  const sum = stages.reduce((acc, stage) => acc + clampProgress(stage.progress), 0);
  return clampProgress(sum / stages.length);
}

/** Resumen de agentes derivado del mismo dataset. */
export function summarizeAgents(dataset: AgencyDataset): AgentSummary {
  return {
    total: dataset.agents.length,
    disponible: dataset.agents.filter((a) => a.status === "disponible").length,
    ocupado: dataset.agents.filter((a) => a.status === "ocupado").length,
    bloqueado: dataset.agents.filter((a) => a.status === "bloqueado").length,
  };
}

/** Resumen de tickets derivado del mismo dataset (incluye sin asignar). */
export function summarizeTickets(dataset: AgencyDataset): TicketSummary {
  const tickets = dataset.tickets;
  return {
    total: tickets.length,
    pendiente: tickets.filter((t) => t.status === "pendiente").length,
    enCurso: tickets.filter((t) => t.status === "en_curso").length,
    completado: tickets.filter((t) => t.status === "completado").length,
    sinAsignar: tickets.filter((t) => t.assignedAgentId === null).length,
    globalProgress: globalProgress(dataset),
  };
}

/** Agente asignado de un ticket, o null si está sin asignar / no existe. */
export function resolveAgent(dataset: AgencyDataset, ticket: Ticket): Agent | null {
  if (ticket.assignedAgentId === null) return null;
  return dataset.agents.find((a) => a.id === ticket.assignedAgentId) ?? null;
}
