#!/usr/bin/env node
// =============================================================================
// Runner de la prueba P1 (issue #30) sobre un PostgreSQL embebido (PGlite).
//
//   pnpm test:rrhh:p1          # desde la raíz del repo
//
// La dependencia está fijada en package.json (@electric-sql/pglite 0.5.10,
// versión exacta) e instalada por `pnpm install --frozen-lockfile`: no hay
// instalaciones ad hoc ni versiones flotantes. El workflow de CI corre esta
// misma orden (ver docs/CI_CHECKS.md).
//
// Qué hace, en un motor en memoria que se descarta al terminar:
//   1. crea el entorno desechable (rrhh_p1_pin_ambiguo_entorno.sql);
//   2. aplica la migración real (supabase/migrations/20261017131004_p1_pin_ambiguo_fallo_cerrado.sql) —
//      nunca una copia, para que la prueba no pueda desincronizarse del
//      archivo que se va a aplicar en nexo-core;
//   3. ejecuta las comprobaciones (rrhh_p1_pin_ambiguo.prueba.sql);
//   4. revisa los avisos que emitió el motor: la señal técnica de PIN ambiguo
//      debe aparecer y NINGÚN aviso puede contener un PIN.
//
// Este runner NUNCA se conecta a una base remota: PGlite es un PostgreSQL
// compilado a WASM que corre dentro del proceso, sin sockets ni credenciales.
// El workflow de CI no recibe secretos de Supabase (ver el guard explícito en
// .github/workflows/ci.yml). La extensión pgcrypto se carga desde el propio
// paquete para que la comparación de PINes use bcrypt real.
// =============================================================================

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const testsDir = here;
const repoRoot = path.resolve(here, "..", "..");

const ENTORNO = path.join(testsDir, "rrhh_p1_pin_ambiguo_entorno.sql");
const PRUEBA = path.join(testsDir, "rrhh_p1_pin_ambiguo.prueba.sql");
const MIGRACION = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20261017131004_p1_pin_ambiguo_fallo_cerrado.sql",
);

// PINes de la prueba. Ninguno puede aparecer en un aviso del motor: los
// registros técnicos no llevan PIN (issue #30).
const PINES_DE_PRUEBA = ["1111", "2222", "4444", "5555", "6666", "9999"];
const VERIFICACIONES_ESPERADAS = 28;

const leer = (ruta) => readFile(ruta, "utf8");

const fallos = [];
const comprobar = (ok, descripcion) => {
  if (ok) {
    console.log(`ok  ${descripcion}`);
  } else {
    fallos.push(descripcion);
    console.log(`FALLO  ${descripcion}`);
  }
};

const avisos = [];
const anotarAviso = (notice) => avisos.push(`${notice.severity}: ${notice.message}`);

const [{ PGlite }, { pgcrypto }] = await Promise.all([
  import("@electric-sql/pglite"),
  import("@electric-sql/pglite/contrib/pgcrypto"),
]);
const db = await PGlite.create({ extensions: { pgcrypto } });
console.log("ok  PGlite en memoria (entorno efímero, sin conexión a ninguna base remota)");

try {
  const [entorno, migracion, prueba] = await Promise.all([
    leer(ENTORNO),
    leer(MIGRACION),
    leer(PRUEBA),
  ]);

  await db.exec(entorno, { onNotice: anotarAviso });
  console.log("ok  entorno desechable creado");

  await db.exec(migracion, { onNotice: anotarAviso });
  console.log("ok  migración 20261017131004_p1_pin_ambiguo_fallo_cerrado aplicada");

  // Reaplicarla no debe fallar ni cambiar el comportamiento (create or replace
  // + revoke idempotente): es el caso de un re-deploy de la migración.
  await db.exec(migracion, { onNotice: anotarAviso });
  console.log("ok  la migración se puede reaplicar sin error");

  await db.exec(prueba, { onNotice: anotarAviso });
  console.log("ok  rrhh_p1_pin_ambiguo.prueba.sql ejecutada (C1-C13)");
} catch (error) {
  fallos.push("la prueba abortó");
  console.log(`FALLO  la prueba abortó: ${error.message}`);
  try {
    await db.exec("rollback");
  } catch {
    // la transacción ya estaba cerrada; no hay nada que revertir
  }
} finally {
  await db.close();
}

const verificaciones = avisos.filter((a) => a.includes("ok: C")).length;
comprobar(
  verificaciones >= VERIFICACIONES_ESPERADAS,
  `se ejecutaron las ${VERIFICACIONES_ESPERADAS} comprobaciones de la prueba SQL (vistas: ${verificaciones})`,
);

const senales = avisos.filter((a) => a.startsWith("WARNING") && a.includes("PIN ambiguo"));
comprobar(
  senales.length >= 10,
  `la señal técnica de PIN ambiguo se emite sin bloquear la operación (vistas: ${senales.length})`,
);

const avisosConPin = avisos.filter((a) => PINES_DE_PRUEBA.some((pin) => a.includes(pin)));
comprobar(
  avisosConPin.length === 0,
  `ningún aviso del motor contiene un PIN (revisados: ${avisos.length})`,
);

if (avisosConPin.length > 0) {
  for (const aviso of avisosConPin) {
    console.log(`      aviso con PIN: ${aviso}`);
  }
}

const sampleSenal = senales[0] ?? "(sin señal)";
console.log(`\nseñal técnica de referencia:\n  ${sampleSenal.split("\n").join("\n  ")}`);

if (fallos.length > 0) {
  console.log(`\nRESULTADO: ${fallos.length} comprobación(es) fallida(s).`);
  process.exit(1);
}

console.log("\nRESULTADO: todas las comprobaciones de P1 pasaron.");
