#!/usr/bin/env node
/**
 * Gate de lint por app — issue #43 (observación de revisión del PR #44).
 *
 * Problema que resuelve: `lint:gate` tenía una lista de `--filter=` escrita a
 * mano. Una app nueva en `apps/*` podía declarar `lint`, pasar todos los checks
 * obligatorios y **nunca** ser linteada por el gate, porque nadie la agregaba a
 * esa lista. El guard de tareas (`check-app-tasks.mjs`) tampoco lo evitaba: está
 * conectado a `pnpm lint`, no a `lint:gate`, que es lo que corren `pnpm verify`
 * y el check `lint` del CI.
 *
 * Ahora todo se deriva del sistema de archivos:
 *   - se enumeran las apps reales de `apps/*`;
 *   - cada una debe estar CLASIFICADA en REGISTRO como `gate` o `deuda`;
 *   - si alguna app no está clasificada, ESTE script falla y no se lintea a medias;
 *   - si el registro menciona una app que ya no existe, también falla (registro podrido);
 *   - toda app en `gate` debe declarar la tarea `lint`.
 *
 * Subcomandos:
 *   plan       clasifica y valida. No ejecuta lint. (`pnpm lint:plan`)
 *   gate       valida y corre `turbo run lint` sobre las apps `gate`. (`pnpm lint:gate`)
 *   deuda      corre `turbo run lint` sobre las apps con deuda documentada. (`pnpm lint:deuda`)
 *   self-test  demuestra que una app nueva sin clasificar hace FALLAR `plan`, y
 *              que `plan` pasa cuando está clasificada. (`pnpm lint:self-test`)
 *
 * Flags: `--apps-dir <dir>` (lo usa self-test; también sirve para pruebas).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Clasificación de TODAS las apps de `apps/*`. Una app nueva sin entrada acá
 * rompe el gate a propósito: así no puede quedar fuera en silencio.
 *
 * `deuda` = app que hoy NO pasa `eslint` y por eso no puede bloquear el merge
 * (medido sobre `main` `fc2b309`). Se lintea igual en el check informativo
 * `lint-deuda`, así que sigue visible en cada PR. Al corregir el lint, mover la
 * entrada a `gate` y borrar el motivo.
 */
const REGISTRO = {
  "nexo-panel": { estado: "gate" },
  rrhh: { estado: "gate" },
  "nexo-agencia": { estado: "gate" },
  "nexo-atencion": { estado: "gate" },
  "nexo-productos": { estado: "gate" },
  "web-corporativo": { estado: "gate" },
  "materiales-jcastillo-crm": {
    estado: "deuda",
    motivo:
      "src/components/DeleteClienteButton.tsx: error react-hooks (setState sincrónico dentro de un efecto) + warning de variable sin usar en src/app/(app)/clientes/actions.ts. Pre-existente (archivos sin tocar desde a6abb2e), con eslint-config-next 16.3.0.",
  },
  "transporte-app": {
    estado: "deuda",
    motivo:
      "lib/offline/useOfflineSync.ts:22 error react-hooks (setState sincrónico dentro de un efecto). Pre-existente (archivo sin tocar desde a6abb2e).",
  },
};

const ERRORES = [];

function leerApps(appsDir) {
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => {
      const pkgPath = join(appsDir, entrada.name, "package.json");
      if (!existsSync(pkgPath)) return null;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      return {
        dir: entrada.name,
        nombre: pkg.name ?? entrada.name,
        tieneLint: Boolean(pkg.scripts?.lint),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function clasificar(appsDir) {
  ERRORES.length = 0;
  const apps = leerApps(appsDir);

  const sinClasificar = apps.filter((app) => !REGISTRO[app.nombre]);
  const registroPodrido = Object.keys(REGISTRO).filter(
    (nombre) => !apps.some((app) => app.nombre === nombre),
  );
  const gate = apps.filter((app) => REGISTRO[app.nombre]?.estado === "gate");
  const deuda = apps.filter((app) => REGISTRO[app.nombre]?.estado === "deuda");
  const gateSinTarea = gate.filter((app) => !app.tieneLint);

  if (apps.length === 0) {
    ERRORES.push(`no se encontró ninguna app en ${appsDir}`);
  }
  if (sinClasificar.length > 0) {
    ERRORES.push(
      `apps sin clasificar en REGISTRO: ${sinClasificar.map((app) => app.nombre).join(", ")} — agregalas como "gate" o como "deuda" con motivo (así ninguna app queda fuera del gate en silencio)`,
    );
  }
  if (registroPodrido.length > 0) {
    ERRORES.push(
      `REGISTRO menciona apps que ya no existen: ${registroPodrido.join(", ")} — borrá esas entradas (registro podrido)`,
    );
  }
  if (gate.length === 0) {
    ERRORES.push("no hay ninguna app en el gate: el check de lint no revisaría nada");
  }
  if (gateSinTarea.length > 0) {
    ERRORES.push(
      `apps en el gate que no declaran la tarea "lint": ${gateSinTarea.map((app) => app.nombre).join(", ")}`,
    );
  }

  return { apps, gate, deuda, sinClasificar, registroPodrido };
}

function imprimirPlan({ apps, gate, deuda }) {
  console.log(`apps encontradas en apps/*: ${apps.length}`);
  console.log(`  gate  (${gate.length}): ${gate.map((app) => app.nombre).join(", ") || "(ninguna)"}`);
  console.log(`  deuda (${deuda.length}): ${deuda.map((app) => app.nombre).join(", ") || "(ninguna)"}`);
  for (const app of deuda) {
    console.log(`    - ${app.nombre}: ${REGISTRO[app.nombre].motivo}`);
  }
}

function turboLint(apps, extraArgs = []) {
  const args = ["run", "lint", ...extraArgs, ...apps.map((app) => `--filter=${app.nombre}`)];
  const resultado = spawnSync("turbo", args, { stdio: "inherit", shell: true });
  return resultado.status ?? 1;
}

function crearAppDePrueba(dir, nombre) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify({ name: nombre, private: true, scripts: { lint: "eslint" } }, null, 2)}\n`,
  );
}

function selfTest() {
  const raiz = mkdtempSync(join(tmpdir(), "nexo-lint-apps-"));
  const appsDir = join(raiz, "apps");
  const script = fileURLToPath(import.meta.url);
  const fallos = [];

  const plan = () => {
    const r = spawnSync(process.execPath, [script, "plan", "--apps-dir", appsDir], {
      encoding: "utf8",
    });
    return { status: r.status, salida: `${r.stdout ?? ""}${r.stderr ?? ""}` };
  };

  try {
    // Fixture con TODAS las apps del registro ya clasificadas (si faltara
    // alguna, saltaría también la comprobación de "registro podrido").
    for (const nombre of Object.keys(REGISTRO)) {
      crearAppDePrueba(join(appsDir, `fixture-${nombre}`), nombre);
    }
    crearAppDePrueba(join(appsDir, "app-nueva"), "app-nueva-sin-clasificar");

    const conAppNueva = plan();
    if (conAppNueva.status === 0) {
      fallos.push("una app nueva sin clasificar NO hizo fallar el plan (quedaría fuera del gate en silencio)");
    } else if (!conAppNueva.salida.includes("app-nueva-sin-clasificar")) {
      fallos.push("el plan falló pero no nombró la app sin clasificar");
    } else {
      console.log("ok  app nueva sin clasificar -> el plan falla y la nombra");
      console.log(`    mensaje: ${conAppNueva.salida.trim().split("\n").filter((l) => l.includes("sin clasificar"))[0] ?? ""}`);
    }

    rmSync(join(appsDir, "app-nueva"), { recursive: true, force: true });
    const conTodoClasificado = plan();
    if (conTodoClasificado.status !== 0) {
      fallos.push(
        `el plan falló con todas las apps clasificadas (debería pasar): ${conTodoClasificado.salida.trim()}`,
      );
    } else {
      console.log("ok  todas las apps clasificadas -> el plan pasa");
    }

    // Registro podrido: una entrada que apunta a una app que ya no existe.
    rmSync(join(appsDir, "fixture-transporte-app"), { recursive: true, force: true });
    const conRegistroPodrido = plan();
    if (conRegistroPodrido.status === 0) {
      fallos.push("una entrada de REGISTRO sin app real no hizo fallar el plan (registro podrido)");
    } else if (!conRegistroPodrido.salida.includes("transporte-app")) {
      fallos.push("el plan falló por registro podrido pero no nombró la entrada obsoleta");
    } else {
      console.log("ok  entrada de REGISTRO sin app real -> el plan falla y la nombra");
    }
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }

  if (fallos.length > 0) {
    for (const fallo of fallos) console.error(`FALLO  ${fallo}`);
    return 1;
  }
  console.log("ok  autocomprobación del gate de lint completa");
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  const appsDirFlag = argv.indexOf("--apps-dir");
  const appsDir =
    appsDirFlag >= 0 ? resolve(argv[appsDirFlag + 1]) : join(process.cwd(), "apps");
  const comando =
    argv.filter(
      (_, indice) => appsDirFlag < 0 || (indice !== appsDirFlag && indice !== appsDirFlag + 1),
    )[0] ?? "plan";

  if (comando === "self-test") {
    process.exit(selfTest());
  }

  const clasificacion = clasificar(appsDir);
  if (comando !== "deuda") imprimirPlan(clasificacion);

  if (ERRORES.length > 0) {
    for (const error of ERRORES) console.error(`FALLO  ${error}`);
    process.exit(1);
  }

  if (comando === "plan") {
    console.log(`ok  clasificación válida (gate: ${clasificacion.gate.length}, deuda: ${clasificacion.deuda.length})`);
    return;
  }

  if (comando === "gate") {
    process.exit(turboLint(clasificacion.gate));
  }

  if (comando === "deuda") {
    if (clasificacion.deuda.length === 0) {
      console.log("ok  sin deuda de lint registrada");
      return;
    }
    console.log(`lint de la deuda documentada (${clasificacion.deuda.length} app(s), no bloquea):`);
    process.exit(turboLint(clasificacion.deuda, ["--continue"]));
  }

  console.error(`uso: node scripts/lint-apps.mjs [plan|gate|deuda|self-test] [--apps-dir <dir>]`);
  process.exit(2);
}

main();
