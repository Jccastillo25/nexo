import type { StatusTone } from "@nexo/ui";
import type { AgentStatus, StageStatus, TicketStatus } from "@/lib/agency/types";

/**
 * Etiquetas en español y tonos visuales para los estados del Dashboard
 * (ticket #13, etapa 3). Las etiquetas son texto legible: el color NUNCA es
 * el único portador de significado (criterio de aceptación). Los tonos se
 * limitan a los que `StatusBadge` de @nexo/ui define realmente en su tipo
 * `StatusTone` ("neutral" | "positive" | "warning" | "negative" | "info") —
 * no se inventan tonos ni tokens nuevos.
 */
export const agentStatusLabel: Record<AgentStatus, string> = {
  disponible: "Disponible",
  ocupado: "Ocupado",
  bloqueado: "Bloqueado",
};

export const agentStatusTone: Record<AgentStatus, StatusTone> = {
  disponible: "positive",
  ocupado: "warning",
  bloqueado: "negative",
};

export const ticketStatusLabel: Record<TicketStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completado: "Completado",
};

export const ticketStatusTone: Record<TicketStatus, StatusTone> = {
  pendiente: "neutral",
  en_curso: "info",
  completado: "positive",
};

export const stageStatusLabel: Record<StageStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
};

export const stageStatusTone: Record<StageStatus, StatusTone> = {
  pendiente: "neutral",
  en_curso: "info",
  completada: "positive",
};
