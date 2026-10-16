#!/usr/bin/env node
/**
 * Guard de cobertura de tareas del monorepo (issue #43).
 *
 * `turbo run <tarea>` termina en 0 con un WARNING cuando ninguna app declara esa
 * tarea. Ese era exactamente el caso de `pnpm typecheck`: 0 tareas, éxito
 * silencioso, ningún archivo revisado. Este guard corre ANTES de turbo y falla
 * si:
 *
 *   - ninguna app de `apps/*` declara la tarea (turbo no ejecutaría nada), o
 *   - alguna app de `apps/*` no la declara (una app nueva sin `typecheck`
 *     desaparecería del alcance sin dejar rastro).
 *
 * Uso: `node scripts/check-app-tasks.mjs typecheck`
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const tarea = process.argv[2];
if (!tarea) {
  console.error("uso: node scripts/check-app-tasks.mjs <tarea>");
  process.exit(2);
}

const appsDir = join(process.cwd(), "apps");
const apps = readdirSync(appsDir, { withFileTypes: true })
  .filter((entrada) => entrada.isDirectory())
  .map((entrada) => entrada.name)
  .sort();

const conTarea = [];
const sinTarea = [];

for (const app of apps) {
  const pkgPath = join(appsDir, app, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  (pkg.scripts?.[tarea] ? conTarea : sinTarea).push(pkg.name ?? app);
}

if (conTarea.length === 0) {
  console.error(
    `check-app-tasks: ninguna app declara la tarea "${tarea}" — turbo terminaría en 0 tareas con éxito.`,
  );
  process.exit(1);
}

if (sinTarea.length > 0) {
  console.error(
    `check-app-tasks: estas apps no declaran la tarea "${tarea}": ${sinTarea.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `check-app-tasks: "${tarea}" declarada por ${conTarea.length} app(s): ${conTarea.join(", ")}`,
);
