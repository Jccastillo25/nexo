import type { AgencyDataset } from "./types";

/**
 * FIXTURES LOCALES DE DEMOSTRACIÓN (ticket #13, etapa 2). Marcados con el
 * sufijo "-demo-" para que ningún identificador pueda confundirse con un id
 * real de la suite. Casos cubiertos, exigidos por los criterios de
 * aceptación:
 *   - agentes en estado `disponible`, `ocupado` y `bloqueado`;
 *   - tickets `pendiente`, `en_curso` y `completado`;
 *   - tickets asignados y tickets SIN asignar (`assignedAgentId: null`);
 *   - un dataset secundario vacío (ausencia de tickets) -> `EMPTY_DATASET`.
 */

/** Dataset principal: opera la agencia ficticia completa. */
export const DEMO_DATASET: AgencyDataset = {
  agents: [
    { id: "agent-demo-001", name: "Ada Demo", role: "Dirección de cuenta", status: "disponible" },
    { id: "agent-demo-002", name: "Bruno Demo", role: "Diseño UX", status: "ocupado" },
    { id: "agent-demo-003", name: "Carla Demo", role: "Frontend", status: "disponible" },
    { id: "agent-demo-004", name: "Damián Demo", role: "QA", status: "bloqueado" },
  ],
  tickets: [
    {
      id: "ticket-demo-101",
      title: "Rediseño del sitio corporativo",
      assignedAgentId: "agent-demo-002",
      status: "completado",
      stages: [
        { id: "stage-demo-101-1", name: "Descubrimiento", status: "completada", progress: 100, order: 1 },
        { id: "stage-demo-101-2", name: "Wireframes", status: "completada", progress: 100, order: 2 },
        { id: "stage-demo-101-3", name: "UI final", status: "completada", progress: 100, order: 3 },
      ],
    },
    {
      id: "ticket-demo-102",
      title: "Campaña de lanzamiento",
      assignedAgentId: "agent-demo-003",
      status: "en_curso",
      stages: [
        { id: "stage-demo-102-1", name: "Brief", status: "completada", progress: 100, order: 1 },
        { id: "stage-demo-102-2", name: "Piezas gráficas", status: "en_curso", progress: 40, order: 2 },
        { id: "stage-demo-102-3", name: "Publicación", status: "pendiente", progress: 0, order: 3 },
      ],
    },
    {
      id: "ticket-demo-103",
      title: "Auditoría de accesibilidad",
      assignedAgentId: null,
      status: "pendiente",
      stages: [
        { id: "stage-demo-103-1", name: "Alcance", status: "pendiente", progress: 0, order: 1 },
        { id: "stage-demo-103-2", name: "Informe", status: "pendiente", progress: 0, order: 2 },
      ],
    },
    {
      id: "ticket-demo-104",
      title: "Migración de contenidos",
      assignedAgentId: "agent-demo-001",
      status: "en_curso",
      stages: [
        { id: "stage-demo-104-1", name: "Inventario", status: "completada", progress: 100, order: 1 },
        { id: "stage-demo-104-2", name: "Carga parcial", status: "en_curso", progress: 75, order: 2 },
        { id: "stage-demo-104-3", name: "Verificación", status: "pendiente", progress: 0, order: 3 },
      ],
    },
  ],
};

/** Dataset sin tickets: caso "ausencia de tickets" (denominador cero). */
export const EMPTY_DATASET: AgencyDataset = {
  agents: DEMO_DATASET.agents,
  tickets: [],
};
