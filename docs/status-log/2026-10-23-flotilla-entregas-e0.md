# 2026-10-23 — Flotilla: Entregas, E0, Paso Cero aplicado y E1 en local

- **Pedido del usuario:** implementar la especificación "Nexo Entregas" (MVP) y dejar Flotilla lista, sin subagentes ("Lanza sin agentes para que podamos tener flotilla listo e implementar esto que te envié"). La especificación queda en [plan 22](../plan/22-flotilla-entregas.md).
- **Estado anterior → nuevo:** Transporte/Flotilla "código aprovechable, sin adaptar" → Paso Cero aplicado en `nexo-core` y zona `/flotilla` adaptada a Nexo en local (E1), sin esquema.
- **Commit:** ninguno.
- **Migración:** `20261024034727_flotilla_entregas_paso_cero.sql`, **aplicada** (aprobación del usuario: "Si").

## E0 — verificación (solo lectura)

Detalle en la sección 18 del plan 22. Lo principal:

- `nexo-core`: `core.apps.flotilla` existe y está activa en el catálogo, pero **no está habilitada para la empresa** (sin fila en `core.company_apps`). Antes del Paso Cero solo existía `flotilla.ver_modulo`; 0 plantillas; no hay schema `flotilla` ni tablas heredadas de Ruta360.
- Vercel: 8 proyectos, ninguno de Flotilla.
- `apps/flotilla`: sin `basePath`, con login propio, `/supadmin`, tablas `admins`/`drivers` y PIN; la cola sin señal (`lib/offline/sync.ts`) no enviaba `localId` y duplicaba al reintentar. Estaba en `lint-deuda`.
- La especificación usa códigos de 3 segmentos; la norma exige 4. La matriz aplicada los corrige.

## Paso Cero (aplicado)

35 códigos nuevos de 4 segmentos (36 con `flotilla.ver_modulo`) y 6 plantillas: Vendedor 8, Coordinador 24, Bodega 12, Administración 10, Conductor 4, Gerencia 36. Tabla completa en la sección 19 del plan 22.

- Ensayo previo de la inserción en una transacción revertida; el remoto quedó igual después del rollback.
- Aplicada con `apply_migration` (versión remota `20261024034727`; el archivo local se renombró desde `20261024050000` sin tocar su SQL).
- Poscheque remoto: 36 permisos, plantillas con los conteos esperados y 0 filas en `core.company_apps`. Los controles de separación de funciones de la migración pasaron.
- Advisors no consultados: la migración solo inserta filas de catálogo.

## E1 — adaptación de `apps/flotilla` (local)

- Retirado el código heredado de Ruta360: `app/`, `components/`, `lib/`, `supabase/` (migraciones de otro proyecto), `wiki/`, `docs/`, `public/`, `proxy.ts` con login propio, `package-lock.json` de npm y el PDF de especificación. Sigue en el historial de Git.
- App nueva `nexo-flotilla` con la estructura de Productos: `basePath: "/flotilla"`, proxy de SSO (`updateSession` de `@nexo/supabase`), `NexoShell`, `sin-acceso`, `error`/`loading`/`global-error`, Speed Insights y Analytics, cabeceras compartidas, puerto 3006.
- `src/lib/permisos.ts` con los 36 códigos y `src/lib/nav.ts` con el menú desplegable: Entregas, Rutas, Bodega, Conductor, Análisis y Configuración, cada hijo con su permiso y como "Pronto" hasta su etapa.
- `/dashboard`: estado "Pendiente de integración" (sin cifras) hasta que exista el esquema.
- Panel: rewrite `/flotilla` por `FLOTILLA_APP_URL` en `apps/nexo/next.config.ts`, variable en `turbo.json` y `.env.local.example`.
- Gate de lint: `transporte-app` (deuda) sale del registro y `nexo-flotilla` entra al gate; la autocomprobación ya no depende de ese nombre. `.claude/launch.json` con `flotilla`.

## Pruebas

- `pnpm install` actualizó `pnpm-lock.yaml`.
- `nexo-flotilla`: `typecheck`, `lint` y `build` con código 0 (rutas `/`, `/dashboard`, `/sin-acceso`).
- `nexo-panel`: `typecheck` con código 0.
- `node scripts/lint-apps.mjs plan` (gate 8, deuda 0) y `self-test` en verde.
- Navegador (preview local, sin sesión): `localhost:3000/flotilla` → `/login?next=/flotilla` y `localhost:3006/flotilla/dashboard` → `localhost:3000/login?next=/flotilla/dashboard`. Sin errores en el servidor.
- **No probado con sesión:** `core.has_permission` exige que la app esté habilitada en `core.company_apps`, así que hoy nadie entra (ni el owner) hasta habilitarla. `pnpm verify` completo no se corrió.

## Habilitación y prueba con sesión (mismo día)

- Con aprobación del usuario ("Si"), `20261024035935_flotilla_habilitar` **aplicada**: fila en `core.company_apps` para `materiales-jcastillo` (`enabled = true`). El mosaico aparece en el Launcher de producción y no abre hasta el deploy.
- En el Chrome del usuario, con su sesión de owner, `localhost:3000/flotilla` abrió el Dashboard con `NexoShell`, el breadcrumb "Flotilla / Dashboard", los 6 grupos del menú y el estado "Pendiente de integración".
- **Bug encontrado y corregido:** el `matcher` del proxy del panel (`apps/nexo/src/proxy.ts`) no excluía `/flotilla`. Cada `/flotilla/_next/static/*` pasaba por el proxy del panel y por el de la zona, y los dos refrescaban la sesión a la vez. Con el token vencido, los logs de Auth muestran unos 10 `token_refreshed` en el mismo segundo (04:00:22 UTC) y luego `429 over_request_rate_limit`. La sesión local se perdió y los grupos del menú no se desplegaban, porque los scripts de la zona no cargaban. Se agregó `flotilla(?:/|$)` a la exclusión, igual que Productos y Presupuesto, y la regla quedó en `CLAUDE.md` (punto 4 de la regla de monorepo).
- Después de la corrección falta que el usuario vuelva a iniciar sesión para comprobar el menú desplegable.

## Pendiente

- E2: schema `flotilla` en `nexo-core` (órdenes, líneas, referencias de origen, recorridos, paradas, intentos, evidencias, incidencias, auditoría y registro de operaciones idempotente), con RLS, `GRANT` y RPC.
- Proyecto de Vercel `nexo-flotilla` y `FLOTILLA_APP_URL` en `nexocore` cuando el usuario decida desplegar.
- Decisiones de la sección 16 del plan 22 antes del piloto.
