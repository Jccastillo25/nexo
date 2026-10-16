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
- **Control negativo en el propio workflow** (criterio de aceptación del issue), en la rama del PR #44: commit `71416fa` con la migración P1 vuelta a resolver con la primera coincidencia → [run 38852180729](https://github.com/Jccastillo25/nexo/actions/runs/38852180729), `test-db-rrhh` **fail** en 17 s con `FALLO P1: C4: un PIN ambiguo devuelve cero filas (fallo cerrado)` y `exit code 1`; `git revert --no-edit` → commit `b3edfb9` (la migración queda **idéntica a `main`**, verificado con `git diff`) → [run 38852370017](https://github.com/Jccastillo25/nexo/actions/runs/38852370017), **success** con `test-db-rrhh` en verde.
- Runs completos: primero [38851449971](https://github.com/Jccastillo25/nexo/actions/runs/38851449971) (donde apareció el fallo de `typecheck` descrito abajo), después [38851916254](https://github.com/Jccastillo25/nexo/actions/runs/38851916254) ya con los 5 checks bloqueantes en verde.

## Hallazgo del primer run real del workflow

El primer run del workflow en el PR (run `38851449971`) dio: `lint` ✅, `build` ✅ (7 apps, 1m35s), `test-db-rrhh` ✅, `test-agencia-access` ✅, `lint-deuda` ❌ (deuda pre-existente, informativa) y **`typecheck` ❌**. Causa real, leída del log: `apps/web-corporativo` → `src/app/layout.tsx(33,50): error TS2304: Cannot find name 'LayoutProps'`.

`LayoutProps` es un tipo **generado por Next 16** que vive en `.next/types` + `next-env.d.ts`, y ese archivo está **gitignoreado** (no hay ningún `next-env.d.ts` versionado salvo `apps/flotilla`). En local `tsc --noEmit` pasaba porque los archivos generados ya existían de builds previos; en un clon limpio no. Se reprodujo localmente (borrar `.next` y `next-env.d.ts` → mismo TS2304, exit 2) y se corrigió cambiando la tarea a **`next typegen && tsc --noEmit`**: verificado después en clon limpio simulado, 7/7 tareas OK. No es una regresión de este PR: es una brecha que **solo se podía descubrir** ahora que la tarea `typecheck` existe y corre de verdad.

## Pendiente / acción manual

- Corregir el lint pre-existente de `crm` y `flotilla` y mover sus filtros a `lint:gate` (ticket aparte).
- Los **previews de Vercel** de la rama quedaron en `Deployment rate limited — retry in 24 hours`: cada push dispara 5 builds (una por app) y varios pushes seguidos agotan el límite de la cuenta. No es un fallo del código y por eso los checks de Vercel **no** se marcan como obligatorios (el `build` de este workflow sí cubre la compilación, sin depender de Vercel).
- La cobertura de RLS, particiones y concurrencia **no** existe en PGlite: si un caso las necesita, hace falta un Postgres desechable en el job o una base de staging descartable — nunca `nexo-core` de producción.
- `main` sigue sin la migración `20261015181000` aplicada: este issue no la aplica (fuera de alcance).

## Corrección tras la revisión del PR #44 (gate de lint)

La revisión señaló, con razón, que `lint:gate` era una lista de `--filter=`
escrita a mano: una app futura en `apps/*` podía declarar `lint`, pasar todos
los checks obligatorios y **nunca** ser linteada por el gate (el guard de tareas
está conectado a `pnpm lint`, no a `lint:gate`, que es lo que corren `pnpm
verify` y el CI). Se reemplazó por [`scripts/lint-apps.mjs`](../../scripts/lint-apps.mjs):

- El conjunto del gate se **deriva de `apps/*`**; cada app debe estar
  clasificada como `gate` o `deuda` en un registro explícito. La única exclusión
  es la deuda actual y documentada de `materiales-jcastillo-crm` y
  `transporte-app`, con el motivo y el archivo concreto al lado.
- Falla si hay una app **sin clasificar**, si el registro menciona una app
  inexistente, si el gate queda vacío o si una app del gate no declara `lint`.
- `pnpm lint:self-test` demuestra el mecanismo con un fixture temporal fuera del
  repo: app nueva sin clasificar → `plan` falla y la nombra; todo clasificado →
  pasa; entrada obsoleta → falla. Corre en `pnpm verify` y como paso del job
  `lint` del workflow.

Verificado en local: `lint:plan` OK (gate 5 / deuda 2), `lint:self-test` con sus
tres casos OK, `lint:gate` 5/5 tareas OK y `lint:deuda` fallando como se espera
(deuda pre-existente).

## Protección de `main` — activa y verificada (2026-10-16, posterior a este registro)

`main` quedó protegida exigiendo los cinco checks obligatorios del workflow `CI`
(`typecheck`, `lint`, `build`, `test-db-rrhh`, `test-agencia-access`; app GitHub
Actions `app_id 15368`) antes de fusionar, con `strict: false`,
`enforce_admins: true` y sin force push ni borrado de rama. **No** se exigen
`lint-deuda (no bloquea)` (es informativo a propósito: mide la deuda
pre-existente de `crm`/`flotilla`), `Vercel Preview Comments` ni
`Supabase Preview`.

Verificado por API: `GET /branches/main` → `"protected": true` (antes `false`,
404) y `GET /branches/main/protection` devuelve exactamente esos cinco
contextos, con `enforce_admins.enabled: true`, `allow_force_pushes.enabled:
false` y `allow_deletions.enabled: false`. No hay rulesets: es la protección
clásica de rama. El cuerpo exacto aplicado y los comandos reproducibles están en
[`docs/CI_CHECKS.md`](../CI_CHECKS.md).

Consecuencia operativa: con la regla activa, un push directo a `main` que no
traiga los checks aprobados en ese commit queda rechazado — el camino es
PR → checks en verde → merge.
