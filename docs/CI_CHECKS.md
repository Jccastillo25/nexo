# CI y validación local (issue #43)

Puerta de calidad del monorepo: **una sola orden local** reproduce lo mismo que
GitHub Actions exige en cada pull request. Objetivo del issue: dejar de repetir
ciclos de prueba manual y que ningún PR se fusione sin evidencia verificable.

## Una sola orden (local)

```bash
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` encadena, en este orden: `typecheck` → `lint:gate` → `test:db`
(prueba SQL de RRHH) → `test:agencia:access` → `build`. Cualquier control que
falla corta la cadena con salida distinta de cero. Los comandos sueltos, si
prefieres el detalle: `pnpm typecheck`, `pnpm lint`, `pnpm lint:gate`,
`pnpm lint:deuda`, `pnpm test:db`, `pnpm test:rrhh:p1`,
`pnpm test:agencia:access`, `pnpm build`.

Versiones fijadas para que local y CI coincidan: Node **24**, pnpm **9.15.9**
(`packageManager`) y `@electric-sql/pglite` **0.5.10** (versión exacta en
`devDependencies`; nada de instalaciones ad hoc ni versiones flotantes).

## Checks que corren en cada PR (`.github/workflows/ci.yml`)

Workflow `CI`. Los nombres exactos de los checks (los mismos que hay que marcar
como obligatorios) son los de la primera columna; en la web de GitHub aparecen
agrupados bajo el workflow `CI`. Verificado por API sobre el commit `b3edfb9`
(`gh api .../check-runs`): `typecheck`, `lint`, `build`, `test-db-rrhh`,
`test-agencia-access`, `lint-deuda (no bloquea)`, todos con `app=github-actions`.

| Check | Comando | Qué cubre | ¿Bloquea el merge? |
|---|---|---|---|
| `typecheck` | `pnpm typecheck` | Cobertura de la tarea + `next typegen && tsc --noEmit` en las **7 apps** (`apps/*/package.json` → `typecheck`). Cubre el código de las apps y, por imports, el de `packages/*`. El `next typegen` es obligatorio: sin él, los tipos generados por Next (`LayoutProps`, `PageProps`, `.next/types/*`) no existen en un clon limpio. | **Sí** |
| `lint` | `pnpm lint:gate` | ESLint en **todas las apps de `apps/*` excepto las de la lista de deuda documentada** (`materiales-jcastillo-crm`, `transporte-app`). El conjunto se **deriva del sistema de archivos**, no de una lista escrita a mano: si una app no está clasificada, el check **falla** (`lint:plan`) y además corre la autocomprobación `lint:self-test`. | **Sí** |
| `build` | `pnpm build` | `next build` real de las 7 apps, sin variables de entorno ni secretos. | **Sí** |
| `test-db-rrhh` | `pnpm test:db` | Prueba SQL de P1 (`supabase/tests/`) sobre la **migración real** del repo, en un PostgreSQL en memoria (PGlite) con `pgcrypto` real. Misma orden que `pnpm test:rrhh:p1`. | **Sí** |
| `test-agencia-access` | `pnpm test:agencia:access` | Arnés offline existente de acceso denegado/otorgado en `apps/agencia` (sin red, sin cuentas). | **Sí** |
| `lint-deuda (no bloquea)` | `pnpm lint:deuda` | ESLint de `materiales-jcastillo-crm` y `transporte-app`, donde `main` **ya falla** hoy. Se publica en cada PR para no ocultar la deuda, pero no bloquea. | No |

### Clasificación de apps para el gate de lint (observación de revisión del PR #44)

Antes, `lint:gate` era una lista de `--filter=` escrita a mano: una app nueva en
`apps/*` podía declarar `lint`, pasar **todos** los checks obligatorios y nunca
ser linteada por el gate. Ahora `scripts/lint-apps.mjs` enumera `apps/*` y exige
que **cada** app esté clasificada en su `REGISTRO`:

- `gate` → entra en `pnpm lint:gate` (check bloqueante).
- `deuda` → excluida del bloqueo **a propósito**, con el motivo escrito al lado
  (`materiales-jcastillo-crm` y `transporte-app`, ver la tabla de deuda de
  abajo). Sigue visible por `pnpm lint:deuda` en cada PR.

El script falla —y por lo tanto el check `lint` falla— si: hay una app **sin
clasificar**; el registro menciona una app que **ya no existe** (registro
podrido); el gate queda **vacío**; o una app del gate **no declara** la tarea
`lint`. Para corregir el lint de `crm`/`flotilla`, basta mover su entrada de
`deuda` a `gate` y borrar el motivo.

Comprobación de que esto no se rompe en silencio: `pnpm lint:self-test` crea un
`apps/*` temporal **fuera del repo** con todas las apps del registro ya
clasificadas más una app nueva sin clasificar, y verifica que `plan` (a) falla y
la nombra, (b) pasa cuando está clasificada y (c) falla si el registro apunta a
una app inexistente. Corre en `pnpm verify` y como paso propio del job `lint`.

El job de pruebas no recibe secretos y además tiene un guard explícito: si el
entorno trae `SUPABASE_*`, `DATABASE_URL` o `PG*`, el job **falla** en vez de
conectarse a algo. Ningún job aplica migraciones, publica deploys ni habla con
Supabase.

## Cómo se comprueba que el workflow falla cuando la prueba falla

Evidencia real, no supuesta (issue #43, criterio de aceptación). En la rama del
PR #44 se empujó **primero** una versión de la migración P1 que vuelve a
resolver la credencial con la primera coincidencia (el bug que P1 corrige,
`>= 1` en lugar de fallar cerrado) y **después** se revirtió con
`git revert --no-edit`, sin tocar nada más:

| Paso | Commit | Run | Resultado de `test-db-rrhh` |
|---|---|---|---|
| Migración con el bug reintroducido | `71416fa` | [run 38852180729](https://github.com/Jccastillo25/nexo/actions/runs/38852180729) | ❌ **fail** (17 s): `FALLO P1: C4: un PIN ambiguo devuelve cero filas (fallo cerrado)` → `Process completed with exit code 1` |
| Reversión (`git revert`, migración idéntica a `main`) | `b3edfb9` | [run 38852370017](https://github.com/Jccastillo25/nexo/actions/runs/38852370017) | ✅ pass (18 s) |

Eso prueba las dos mitades: que el CI ejecuta **el archivo de migración real**
del repo (cambiar ese archivo cambia el resultado del check, no una copia
guardada) y que una aserción rota no pasa desapercibida. El primer run de la
rama ([38851449971](https://github.com/Jccastillo25/nexo/actions/runs/38851449971))
sirvió además para descubrir el problema de `next typegen` descrito abajo.

## Límites de cobertura (lo que estos checks NO prueban)

| Área | Estado real |
|---|---|
| Motor de la prueba SQL | **PGlite = PostgreSQL empaquetado en WASM corriendo en el proceso.** No es el Postgres de Supabase: no hay pooler, ni PostgREST/Data API, ni `service_role`, ni extensiones que Supabase agrega aparte (`pg_cron`, `pg_net`, `vault`, `pg_graphql`…), ni el planificador/versión exacta del proyecto. Una prueba verde acá **no** es validación en `nexo-core`. |
| Esquema | La prueba usa un `rrhh` **mínimo replicado a mano** (`rrhh_p1_pin_ambiguo_entorno.sql`) con las reglas que importan (una credencial por contrato, un contrato activo por empleado, FK compuesta). No es el esquema real ni incluye el resto de columnas, triggers ni particiones. |
| RLS / policies | **No se prueba.** El entorno desechable no habilita RLS ni `GRANT`s por rol, así que las policies de `nexo-core` y los permisos de `authenticated`/`anon` no quedan cubiertos (solo se comprueba que `anon` no puede llamar la función interna y sí el wrapper público, que es un `GRANT`, no una policy). |
| Concurrencia | **No se prueba.** No hay carreras reales: la prueba es serial, un solo proceso, sin dos llamadas simultáneas ni bloqueos (`FOR UPDATE`) ejercitados en paralelo. Idempotencia/concurrencia son P4 y siguen pendientes. |
| bcrypt | Se usa `bcrypt` real (pgcrypto), pero la comparación corre en PGlite: sirve para la lógica de coincidencia, **no** mide el costo/tiempos del `crypt()` en el Postgres de Supabase. |
| App / navegador | Nada de esto recorre el kiosco en un navegador (Server Action → PostgREST → RPC), ni Rate Limit por IP, ni la UI. |
| Deploy | `build` compila, pero no valida Vercel, dominios, rewrites de Multi-Zones ni variables de entorno reales. |
| Lint | 2 de 7 apps no están cubiertas por el check bloqueante (ver deuda abajo). |

## Deuda pre-existente en `main` (NO son regresiones de este cambio)

Medido sobre `main` `fc2b309` antes de tocar nada:

| Hallazgo | Detalle | Qué se hizo |
|---|---|---|
| `typecheck` no revisaba nada | Ninguna app declaraba `typecheck`; `turbo run typecheck` terminaba en **0 tareas con exit 0** (éxito silencioso). | Se agregó `typecheck: tsc --noEmit` a las 7 apps y un guard (`scripts/check-app-tasks.mjs`) que falla si la tarea no existe en ninguna app o falta en alguna. Verificado: con las 7 apps, `tsc --noEmit` pasa **sin errores previos** (`main` estaba limpio de tipos). |
| `typecheck` no era reproducible en un clon limpio | Descubierto por el **primer run real del workflow**, no por inspección: en el clon de CI falló `web-corporativo` con `src/app/layout.tsx(33,50): error TS2304: Cannot find name 'LayoutProps'`, porque `next-env.d.ts` está **gitignoreado** (`next-env.d.ts` en el `.gitignore` raíz y en `apps/web-corporativo/.gitignore`) y los tipos generados por Next viven en `.next/`, que no existe en un checkout nuevo. En local pasaba porque los archivos generados ya estaban ahí. | Se cambió la tarea de cada app a **`next typegen && tsc --noEmit`** (el comando oficial de Next 16 para generar esos tipos sin build completo). Reproducido localmente borrando `.next` y `next-env.d.ts` (mismo TS2304, exit 2) y verificado después del cambio: **7/7 tareas OK en clon limpio simulado**. |
| `lint` fallaba en 2 apps | `materiales-jcastillo-crm`: `src/components/DeleteClienteButton.tsx` (error `react-hooks` *setState sincrónico dentro de un efecto*) + warning de variable sin usar en `clientes/actions.ts`. `transporte-app`: `lib/offline/useOfflineSync.ts` (mismo error `react-hooks`). Archivos sin tocar desde commits antiguos (`a6abb2e`), con `eslint-config-next` 16.3.0. | **No se tocaron** (sería un refactor funcional fuera de alcance). Se dejan visibles en el check informativo `lint-deuda` y se propone ticket aparte. |
| Sin workflows | No existía `.github/workflows/`. | Se agregó `ci.yml`. |
| Supabase Preview | El check de Supabase Preview puede quedar omitido y **no** valida migraciones. | Se documenta como no confiable; la validación de migraciones es `test-db-rrhh`. |

## Protección de `main`: estado verificado

**ACTIVA desde el 2026-10-16 y verificada por API.** `main` exige cinco
check-runs del workflow `CI` (app GitHub Actions, `app_id 15368`) antes de
fusionar:

| Check | ¿Obligatorio? |
|---|---|
| `typecheck` | **Sí** |
| `lint` | **Sí** |
| `build` | **Sí** |
| `test-db-rrhh` | **Sí** |
| `test-agencia-access` | **Sí** |
| `lint-deuda (no bloquea)` | **No** — es informativo a propósito: mide la deuda pre-existente de `crm`/`flotilla` y se deja visible en cada PR |
| `Vercel Preview Comments` y previews de Vercel | **No** — dependen del proyecto de Vercel y de su límite de builds |
| `Supabase Preview` | **No** — puede quedar en `skipping` y no valida migraciones |

Configuración exacta (classic branch protection; el repositorio no tiene
rulesets):

- `required_status_checks.strict` = **`false`** (no se exige que la rama esté al
  día antes de fusionar).
- `enforce_admins` = **`true`** (la regla aplica también al owner: no hay
  bypass).
- `allow_force_pushes` = **`false`** y `allow_deletions` = **`false`**.
- Sin `required_pull_request_reviews`, sin restricciones de push y sin
  `required_conversation_resolution`.

Comprobación reproducible:

```bash
gh api repos/Jccastillo25/nexo/branches/main --jq .protected   # true
gh api repos/Jccastillo25/nexo/branches/main/protection --jq \
  '{checks: [.required_status_checks.checks[] | .context],
    strict: .required_status_checks.strict,
    enforce_admins: .enforce_admins.enabled,
    force_pushes: .allow_force_pushes.enabled,
    deletions: .allow_deletions.enabled}'
# → checks: [typecheck, lint, build, test-db-rrhh, test-agencia-access],
#   strict: false, enforce_admins: true, force_pushes: false, deletions: false
```

Cómo se aplicó (idempotente):

```bash
# el cuerpo completo importa: el PUT reemplaza el objeto de protección
gh api --method PUT repos/Jccastillo25/nexo/branches/main/protection --input proteccion.json
```

```json
{
  "required_status_checks": {
    "strict": false,
    "checks": [
      { "context": "typecheck",           "app_id": 15368 },
      { "context": "lint",                "app_id": 15368 },
      { "context": "build",               "app_id": 15368 },
      { "context": "test-db-rrhh",        "app_id": 15368 },
      { "context": "test-agencia-access", "app_id": 15368 }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
```

> En la web: *Settings → Rules → Branches* → regla para `main` → **Require
> status checks to pass before merging** → marcar los cinco. Si se cambia por
> API, mandar el cuerpo completo de arriba: un `PUT` con un solo campo puede
> borrar el resto de la configuración.

Notas operativas:

- `Actions` está habilitado en el repositorio (`gh api
  repos/Jccastillo25/nexo/actions/permissions` → `enabled: true`); sin eso
  ningún workflow correría.
- Con la protección activa, un push directo a `main` que no traiga los checks
  aprobados en ese commit queda rechazado: el camino es PR → checks en verde →
  merge.
- Verificado sobre el PR #44 (head `3dbf147`): los cinco checks obligatorios en
  `success` y el PR seguía `MERGEABLE`, con `mergeStateStatus: UNSTABLE` — que
  solo refleja checks **no** obligatorios fallando (`lint-deuda` y los previews
  de Vercel limitados por rate limit), no un bloqueo del merge.
- Los checks de Vercel no se marcan como obligatorios por dos razones concretas
  observadas al preparar este PR: (a) cada push dispara **5 builds** (una por
  app), así que varios pushes seguidos agotan el límite de la cuenta — los
  previews de la rama terminaron en `Deployment rate limited — retry in 24
  hours`, que no es un fallo del código; y (b) el check de **Supabase Preview**
  puede quedar en `skipping` sin validar nada.

## Añadir pruebas más adelante

- Prueba SQL nueva: archivo en `supabase/tests/`, runner que aplique **la
  migración real** desde `supabase/migrations/`, y script raíz
  `test:<modulo>:<caso>`. Sumarla a `test:db` y a `pnpm verify`.
- Si el caso necesita el esquema real (RLS, particiones, concurrencia), PGlite
  ya no alcanza: hace falta un Postgres desechable dentro del job
  (contenedor) o una base de *staging* explícitamente descartable. Nunca
  `nexo-core` de producción.
