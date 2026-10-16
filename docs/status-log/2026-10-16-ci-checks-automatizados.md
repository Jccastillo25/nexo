# 2026-10-16 — CI: pruebas automatizadas y checks antes de fusionar (issue #43)

## Cambio de estado

- **Sin puerta de calidad** (0 workflows en `.github/workflows/`, `pnpm typecheck` ejecutaba **0 tareas con exit 0**, prueba P1 dependiente de una instalación manual de PGlite) → **workflow `CI` corriendo en cada PR y orden local única**, con la prueba SQL de P1 conectada y dependencia fijada.
- Estado del gate: **los checks se ejecutan y se ven en el PR, pero el merge todavía no está bloqueado** por GitHub. Eso requiere branch protection y es una acción manual del owner (pasos en [`CI_CHECKS.md`](../CI_CHECKS.md)).
- Rama `codex/ci-checks-issue-43` desde `main` `fc2b309`. **No se aplicó ninguna migración, no se desplegó nada y no se avanzó a P2.**

## Entregado

- **`.github/workflows/ci.yml`** (workflow `CI`): corre en `pull_request`, en push a `main` y a demanda. Node 24 + pnpm 9.15.9 (la versión de `packageManager`) + `pnpm install --frozen-lockfile`. Checks: `typecheck`, `lint`, `build`, `test-db-rrhh`, `test-agencia-access` (bloqueantes) y `lint-deuda (no bloquea)`.
- **Orden local única**: `pnpm install --frozen-lockfile && pnpm verify` — `verify` = `typecheck` → `lint:gate` → `test:db` → `test:agencia:access` → `build`.
- **`typecheck` real**: `"typecheck": "next typegen && tsc --noEmit"` en las 7 apps (`apps/*/package.json`) + guard [`scripts/check-app-tasks.mjs`](../../scripts/check-app-tasks.mjs) que **falla** si la tarea no existe en ninguna app o falta en alguna; evita el éxito silencioso de turbo con 0 tareas.
- **Prueba P1 conectada y fijada**: `"test:rrhh:p1": "node supabase/tests/run_rrhh_p1_pin_ambiguo.mjs"` y `"test:db"`; `@electric-sql/pglite` **`0.5.10` exacto** en `devDependencies` + `pnpm-lock.yaml`. Se eliminó el override `PGLITE_DIR` que permitía apuntar a copias ad hoc.
- **Entorno efímero garantizado**: la prueba corre en PGlite **en memoria** (WASM, dentro del proceso, sin sockets) y aplica **el archivo real** `supabase/migrations/20261015181000_p1_pin_ambiguo_fallo_cerrado.sql`. El job de pruebas tiene un guard que **falla** si el entorno trae `SUPABASE_*`, `DATABASE_URL` o `PG*`. El workflow no usa `secrets.` en ningún punto.
- **Lint con deuda separada**: `lint:gate` (5 apps limpias) bloquea; `lint:deuda` (`crm`, `flotilla`) publica la deuda en cada PR sin bloquear.
- **Documentación**: [`docs/CI_CHECKS.md`](../CI_CHECKS.md) (checks, qué cubre cada uno, límites, deuda pre-existente, pasos de branch protection), regla nueva en [`CLAUDE.md`](../../CLAUDE.md) y puntero en [`docs/README.md`](../README.md).

## Deuda pre-existente en `main` (medida antes de este cambio, no son regresiones)

- `pnpm typecheck`: **0 tareas, exit 0** — ninguna app declaraba `typecheck`. Síntoma real, referido en el issue.
- `lint` en `materiales-jcastillo-crm`: error `react-hooks` en `src/components/DeleteClienteButton.tsx` (+ warning de variable sin usar en `clientes/actions.ts`); en `transporte-app`: mismo error en `lib/offline/useOfflineSync.ts`. Archivos sin tocar desde `a6abb2e`; `eslint-config-next` 16.3.0. **No se corrigieron** (sería refactor funcional fuera de alcance): quedan visibles en `lint-deuda`.
- No existían workflows y el check de Supabase Preview puede quedar omitido (no valida migraciones).

## Verificación ejecutada

- Línea base sobre `main` `fc2b309`: `tsc --noEmit` en las 7 apps → **0 errores previos**; `eslint` por app → 5 limpias, `crm` y `flotilla` con los errores de arriba; `next build` de las 7 apps → **OK sin variables de entorno** (~50 s en total); `apps/agencia/scripts/check-access.cjs` → OK.
- Lockfile: `pnpm install --lockfile-only --frozen-lockfile` con pnpm 9.15.9 → **exitoso** (el lockfile coincide con los `package.json`), sin tocar `node_modules`.
- Prueba P1 con el runner ya conectado a la dependencia fijada: 28 aserciones en verde (detalle en el status-log de P1).
- **Control negativo en el propio workflow** (criterio de aceptación del issue): se empujó primero una migración P1 que vuelve a resolver con `limit 1` → el check `test-db-rrhh` **falló en C4**; al restaurar la migración correcta, el mismo check volvió a verde. Enlaces a los dos runs: ver el PR de esta rama.

## Hallazgo del primer run real del workflow

El primer run del workflow en el PR (run `38851449971`) dio: `lint` ✅, `build` ✅ (7 apps, 1m35s), `test-db-rrhh` ✅, `test-agencia-access` ✅, `lint-deuda` ❌ (deuda pre-existente, informativa) y **`typecheck` ❌**. Causa real, leída del log: `apps/web-corporativo` → `src/app/layout.tsx(33,50): error TS2304: Cannot find name 'LayoutProps'`.

`LayoutProps` es un tipo **generado por Next 16** que vive en `.next/types` + `next-env.d.ts`, y ese archivo está **gitignoreado** (no hay ningún `next-env.d.ts` versionado salvo `apps/flotilla`). En local `tsc --noEmit` pasaba porque los archivos generados ya existían de builds previos; en un clon limpio no. Se reprodujo localmente (borrar `.next` y `next-env.d.ts` → mismo TS2304, exit 2) y se corrigió cambiando la tarea a **`next typegen && tsc --noEmit`**: verificado después en clon limpio simulado, 7/7 tareas OK. No es una regresión de este PR: es una brecha que **solo se podía descubrir** ahora que la tarea `typecheck` existe y corre de verdad.

## Pendiente / acción manual

- **Owner**: activar en `main` *Require status checks to pass before merging* con `CI / typecheck`, `CI / lint`, `CI / build`, `CI / test-db-rrhh`, `CI / test-agencia-access` (y habilitar Actions si estuviera desactivado). Hasta entonces el gate **no** está activo.
- Corregir el lint pre-existente de `crm` y `flotilla` y mover sus filtros a `lint:gate` (ticket aparte).
- La cobertura de RLS, particiones y concurrencia **no** existe en PGlite: si un caso las necesita, hace falta un Postgres desechable en el job o una base de staging descartable — nunca `nexo-core` de producción.
- `main` sigue sin la migración `20261015181000` aplicada: este issue no la aplica (fuera de alcance).
