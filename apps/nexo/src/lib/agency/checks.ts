/**
 * COMPROBACIONES FOCALIZADAS — ticket #13, etapa 2. Sin dependencias nuevas:
 * usa solo `node:assert` de la biblioteca estándar. Verifica de forma
 * determinista los criterios de aceptación de fixtures y selectores.
 * Importaciones relativas SIN sufijo `.ts` (requisito del tsconfig de la app).
 *
 * Ejecución (TypeScript ya disponible; ver docs adjunta para el detalle):
 *   pnpm --filter nexo-panel exec tsc src/lib/agency/checks.ts \
 *     --outDir /tmp/agency-checks --module commonjs --target es2019 \
 *     --moduleResolution node --skipLibCheck
 *   node /tmp/agency-checks/lib/agency/checks.js
 */
import assert from "node:assert/strict";
import { DEMO_DATASET, EMPTY_DATASET } from "./fixtures";
import {
  clampProgress,
  globalProgress,
  resolveAgent,
  summarizeAgents,
  summarizeTickets,
} from "./selectors";

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

export function runChecks(): string[] {
  const log: string[] = [];
  const ok = (name: string) => log.push(`ok - ${name}`);

  // 1. Unicidad de identificadores de agentes, tickets y etapas.
  assert.ok(unique(DEMO_DATASET.agents.map((a) => a.id)), "ids de agente únicos");
  assert.ok(unique(DEMO_DATASET.tickets.map((t) => t.id)), "ids de ticket únicos");
  const stageIds = DEMO_DATASET.tickets.flatMap((t) => t.stages.map((s) => s.id));
  assert.ok(unique(stageIds), "ids de etapa únicos");
  ok("identificadores únicos (agentes, tickets, etapas)");

  // 2. Referencias válidas: cada ticket referencia un agente existente o null.
  const agentIds = new Set(DEMO_DATASET.agents.map((a) => a.id));
  for (const ticket of DEMO_DATASET.tickets) {
    if (ticket.assignedAgentId !== null) {
      assert.ok(agentIds.has(ticket.assignedAgentId), `ticket ${ticket.id} -> agente existente`);
    }
  }
  ok("referencias agente/ticket válidas (o sin asignar)");

  // 3. Porcentajes de etapa y progreso global en [0, 100], coherentes.
  for (const ticket of DEMO_DATASET.tickets) {
    assert.ok(ticket.stages.length > 0, `ticket ${ticket.id} tiene etapas`);
    for (const stage of ticket.stages) {
      assert.equal(clampProgress(stage.progress), stage.progress, `etapa ${stage.id} en rango`);
    }
    const orders = ticket.stages.map((s) => s.order);
    assert.ok(unique(orders.map(String)), `orden de etapas único en ${ticket.id}`);
  }
  const gp = globalProgress(DEMO_DATASET);
  assert.ok(gp >= 0 && gp <= 100, "progreso global en rango");
  const expected = Math.round(
    DEMO_DATASET.tickets.flatMap((t) => t.stages).reduce((a, s) => a + s.progress, 0) / stageIds.length,
  );
  assert.equal(gp, expected, "progreso global = promedio de etapas");
  assert.equal(gp, 56, "progreso global esperado 56 (615/11 redondeado)");
  ok("porcentajes y progreso global coherentes con las etapas (56)");

  // 4. Resúmenes derivados de los mismos datos (sumas cerradas, sin duplicar).
  const agents = summarizeAgents(DEMO_DATASET);
  assert.equal(agents.total, DEMO_DATASET.agents.length);
  assert.equal(agents.disponible + agents.ocupado + agents.bloqueado, agents.total, "estados suman total");
  assert.ok(agents.disponible >= 1 && agents.ocupado >= 1 && agents.bloqueado >= 1, "3 estados presentes");

  const tickets = summarizeTickets(DEMO_DATASET);
  assert.equal(tickets.total, DEMO_DATASET.tickets.length);
  assert.equal(tickets.pendiente + tickets.enCurso + tickets.completado, tickets.total, "estados suman total");
  assert.ok(tickets.pendiente >= 1 && tickets.enCurso >= 1 && tickets.completado >= 1, "3 estados de ticket");
  assert.equal(tickets.globalProgress, gp, "resumen reutiliza el mismo progreso global");
  ok("resúmenes coherentes con los fixtures (sumas cerradas)");

  // 5. Casos: tickets sin asignar y ausencia de tickets.
  assert.equal(tickets.sinAsignar, 1, "existe 1 ticket sin asignar");
  const unassigned = DEMO_DATASET.tickets.find((t) => t.assignedAgentId === null);
  assert.ok(unassigned, "hay un ticket sin asignar");
  assert.equal(resolveAgent(DEMO_DATASET, unassigned!), null, "sin asignar -> null");
  const assigned = DEMO_DATASET.tickets.find((t) => t.assignedAgentId !== null)!;
  assert.ok(resolveAgent(DEMO_DATASET, assigned) !== null, "asignado -> agente");

  const empty = summarizeTickets(EMPTY_DATASET);
  assert.equal(empty.total, 0);
  assert.equal(empty.globalProgress, 0, "ausencia de tickets -> 0 (sin NaN)");
  assert.equal(globalProgress(EMPTY_DATASET), 0, "sin etapas -> 0");
  ok("sin asignar -> null; ausencia de tickets -> progreso 0");

  // 6. Determinismo y no-mutación de los fixtures.
  const snapshot = JSON.stringify(DEMO_DATASET);
  assert.equal(globalProgress(DEMO_DATASET), globalProgress(DEMO_DATASET), "determinista");
  assert.equal(JSON.stringify(DEMO_DATASET), snapshot, "los selectores no mutan los fixtures");
  ok("determinista y sin mutación de fixtures");

  return log;
}

export function main(): void {
  for (const line of runChecks()) console.log(line);
  console.log(`\n${runChecks().length} comprobaciones OK`);
}

// Ejecución directa (node <archivo>.js): imprime el log; importado, no ejecuta.
if (typeof require !== "undefined" && require.main === module) {
  main();
}
