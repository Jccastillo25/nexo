import type { StatusTone } from "@nexo/ui";

// Etiquetas visibles de los estados de rrhh.contratos. Archivo sin "use
// client" a propósito: lo comparten el listado (Server Component) y la ficha
// del contrato (Client Component). Un valor exportado desde un archivo "use
// client" llega al servidor como referencia, no como dato.

export type EstadoContrato = "borrador" | "activo" | "finalizado";

export const ESTADO_CONTRATO: Record<EstadoContrato, { label: string; tone: StatusTone }> = {
  borrador: { label: "Borrador", tone: "warning" },
  activo: { label: "Activo", tone: "positive" },
  finalizado: { label: "Finalizado", tone: "neutral" },
};
