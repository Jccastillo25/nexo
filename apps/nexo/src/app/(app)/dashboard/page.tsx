import type { Metadata } from "next";
import { PageHeader, MetricCard, EmptyState } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { hasPermission } from "@nexo/permissions";
import { DEMO_DATASET } from "@/lib/agency/fixtures";
import { DEMO_DATA_NOTICE } from "@/lib/agency/types";
import {
  resolveAgent,
  sortStages,
  summarizeAgents,
  summarizeTickets,
} from "@/lib/agency/selectors";
import {
  agentStatusLabel,
  agentStatusTone,
  stageStatusLabel,
  stageStatusTone,
  ticketStatusLabel,
  ticketStatusTone,
} from "./labels";
import { ProgressBar } from "./progress-bar";
import { AgentCard } from "./agent-card";
import { TicketCard } from "./ticket-card";

export const metadata: Metadata = {
  title: "Dashboard de agencia · Nexo",
};

/**
 * Dashboard de agencia digital — SOLO LECTURA, datos de ejemplo (ticket #13,
 * etapa 3). No persiste, no consulta datos operativos y no expone ninguna
 * acción de crear/asignar/editar/ejecutar/cambiar estado.
 *
 * PROTECCIÓN (ver apps/nexo/docs/DASHBOARD_AGENCIA_IMPLEMENTACION.md): el
 * middleware solo AUTENTICA. Esta ruta exige además autorización de servidor
 * con hasPermission (fail-closed). El código de permiso usado es
 * `nexo.ver_modulo`, ya existente por el trigger trg_seed_module_permission;
 * su adecuación semántica para el Dashboard sigue PENDIENTE de decisión
 * humana, y el significado de una concesión/denegación real no está
 * aprobado en esta etapa.
 */
export default async function DashboardAgenciaPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const canView = await hasPermission({ supabase, companyId }, "nexo.ver_modulo");

  if (!canView) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader
          title="Dashboard de agencia"
          description="Resumen de actividad, agentes de IA, tickets asignados y progreso por etapa."
        />
        <EmptyState
          title="Sin acceso a este Dashboard"
          description="Tu cuenta no tiene habilitado el acceso a este Dashboard para esta empresa. Pedile a un owner/admin que revise tus permisos."
        />
      </div>
    );
  }

  const agents = summarizeAgents(DEMO_DATASET);
  const tickets = summarizeTickets(DEMO_DATASET);
  const hasAgents = DEMO_DATASET.agents.length > 0;
  const hasTickets = DEMO_DATASET.tickets.length > 0;

  return (
    <div className="flex w-full min-w-0 max-w-7xl flex-col gap-6">
      <PageHeader
        title="Dashboard de agencia"
        description="Resumen de actividad, agentes de IA, tickets asignados y progreso por etapa. Vista de solo lectura."
      />

      {/* Aviso persistente: los datos mostrados son de ejemplo. */}
      <p
        role="note"
        className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
      >
        {DEMO_DATA_NOTICE}. Esta vista es de solo lectura y no ejecuta acciones.
      </p>

      {/* Resumen de actividad (métricas derivadas de los fixtures). */}
      <section aria-labelledby="resumen-titulo" className="flex flex-col gap-3">
        <h2
          id="resumen-titulo"
          className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500"
        >
          Resumen de actividad
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Agentes" value={String(agents.total)} />
          <MetricCard label="Agentes disponibles" value={String(agents.disponible)} />
          <MetricCard label="Tickets totales" value={String(tickets.total)} />
          <MetricCard label="Progreso global" value={`${tickets.globalProgress}%`} />
        </div>
        <p className="text-sm text-neutral-600">
          {`Disponibles: ${agents.disponible} · Ocupados: ${agents.ocupado} · Bloqueados: ${agents.bloqueado}. `}
          {`Pendientes: ${tickets.pendiente} · En curso: ${tickets.enCurso} · Completados: ${tickets.completado} · Sin asignar: ${tickets.sinAsignar}.`}
        </p>
      </section>

      {/* Agentes de IA: estado actual y tickets asignados. */}
      <section aria-labelledby="agentes-titulo" className="flex flex-col gap-3">
        <h2 id="agentes-titulo" className="text-lg font-semibold text-neutral-900">
          Agentes de IA
        </h2>
        {hasAgents ? (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {DEMO_DATASET.agents.map((agent) => {
              const assigned = DEMO_DATASET.tickets.filter(
                (t) => t.assignedAgentId === agent.id,
              );
              return (
                <li key={agent.id} className="min-w-0">
                  <AgentCard
                    name={agent.name}
                    role={agent.role}
                    statusLabel={agentStatusLabel[agent.status]}
                    statusTone={agentStatusTone[agent.status]}
                    assignedTitles={assigned.map((t) => t.title)}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="Sin agentes registrados"
            description="Todavía no hay agentes de IA para mostrar en este Dashboard."
          />
        )}
      </section>

      {/* Tickets: responsable, estado y avance por etapa. */}
      <section aria-labelledby="tickets-titulo" className="flex flex-col gap-3">
        <h2 id="tickets-titulo" className="text-lg font-semibold text-neutral-900">
          Tickets asignados
        </h2>
        {hasTickets ? (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {DEMO_DATASET.tickets.map((ticket) => {
              const agent = resolveAgent(DEMO_DATASET, ticket);
              return (
                <li key={ticket.id} className="min-w-0">
                  <TicketCard
                    title={ticket.title}
                    assigneeName={agent ? agent.name : "Sin asignar"}
                    statusLabel={ticketStatusLabel[ticket.status]}
                    statusTone={ticketStatusTone[ticket.status]}
                    stages={sortStages(ticket).map((stage) => ({
                      id: stage.id,
                      name: stage.name,
                      statusLabel: stageStatusLabel[stage.status],
                      statusTone: stageStatusTone[stage.status],
                      progress: stage.progress,
                    }))}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="Sin tickets"
            description="Todavía no hay tickets asignados para mostrar en este Dashboard."
          />
        )}
      </section>

      {/* Progreso por etapa (lista textual, sin depender solo del color). */}
      <section aria-labelledby="progreso-titulo" className="flex flex-col gap-3">
        <h2 id="progreso-titulo" className="text-lg font-semibold text-neutral-900">
          Progreso por etapa
        </h2>
        {hasTickets ? (
          <div className="flex flex-col gap-4">
            {DEMO_DATASET.tickets.map((ticket) => (
              <div key={ticket.id} className="min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900">{ticket.title}</h3>
                <ul className="mt-2 flex flex-col gap-3">
                  {sortStages(ticket).map((stage) => (
                    <li key={stage.id} className="min-w-0">
                      <ProgressBar
                        name={stage.name}
                        statusLabel={stageStatusLabel[stage.status]}
                        statusTone={stageStatusTone[stage.status]}
                        progress={stage.progress}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sin etapas"
            description="No hay etapas para mostrar mientras no existan tickets."
          />
        )}
      </section>
    </div>
  );
}
