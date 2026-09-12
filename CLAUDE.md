# Nexo — instrucciones para Claude Code

Monorepo de la suite Nexo (panel único estilo Odoo para Grupo CT /
Materiales J Castillo). Contexto completo en [`docs/`](docs/README.md),
plan original en [`docs/planning/`](docs/planning/).

## REGLA CRÍTICA: `CLAUDE.md` es la puerta de entrada, pero NO la única fuente de verdad

**Claude debe leer y mantener sincronizados los documentos vivos de Nexo.**
Que `CLAUDE.md` sea el archivo que Claude carga por defecto **no autoriza a
ignorar el resto de `docs/`**. Esta regla aplica en toda sesión que cambie
código, base de datos, permisos, despliegues, arquitectura, estado funcional
o alcance del producto.

### Lectura obligatoria ANTES de programar

**Desde 2026-09-11, `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md` e
`IMPLEMENTATION_STATUS.md` son índices/dashboards cortos, no monolitos.**
El contenido temático completo vive en [`docs/plan/`](docs/plan/) (por
fase/dominio) y [`docs/status-log/`](docs/status-log/) (una entrada por
subfase ya cerrada) — leer **solo el archivo de cada carpeta que aplica a
la tarea actual**, guiándose por la tabla de navegación de cada índice, en
vez de todo el árbol completo. Esto es lo que permite que la regla de
"lectura obligatoria" de abajo no cueste miles de líneas de contexto en
cada sesión.

Antes de empezar cualquier implementación, corrección estructural o migración,
Claude debe leer, en este orden:

1. `CLAUDE.md`.
2. [`docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`](docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md)
   (índice — objetivo, orden de fases, Definition of Done y protocolo)
   **+ el/los archivo(s) de `docs/plan/` correspondientes a la fase/módulo
   de la tarea** (su propia tabla dice cuál). Juntos son la
   **fuente de verdad del objetivo, reglas de dominio, fases y orden de
   implementación**.
3. [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md)
   (dashboard — estado general, divergencias, tablero de fase, próxima
   acción) — **tracker vivo de lo realmente verificado**. Abrir además la
   entrada de `docs/status-log/` correspondiente solo cuando la tarea
   necesite el detalle completo de verificación de una subfase ya cerrada
   (por ejemplo, para no repetir un bug ya encontrado y corregido).
4. [`docs/README.md`](docs/README.md)
   — índice para identificar qué documentos específicos aplican a la tarea.
5. La documentación específica del módulo o subsistema que se va a tocar
   (`RRHH_MVP.md`, `PERMISSIONS.md`, `DATABASE.md`, `ARCHITECTURE.md`,
   `DESIGN_SYSTEM.md`, etc.).
6. El estado remoto real de Supabase/Vercel/GitHub cuando la tarea dependa de
   esos sistemas.

Claude debe comparar explícitamente:

```text
PLAN MAESTRO
vs
IMPLEMENTATION_STATUS
vs
CÓDIGO REAL EN main
vs
MIGRACIONES VERSIONADAS
vs
BASE DE DATOS REMOTA
vs
DEPLOYMENT REAL
```

**Nunca asumir que un `.md` antiguo describe correctamente el remoto.** Si
existe divergencia, primero verificar la realidad y después corregir la
documentación que quedó desactualizada.

### Jerarquía de fuentes

Cuando dos fuentes se contradigan, usar esta jerarquía:

1. **Decisión explícita más reciente del usuario**.
2. `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md` para reglas de negocio,
   arquitectura objetivo, fases y Definition of Done.
3. Estado remoto verificado + código de `main` para saber qué existe realmente.
4. `docs/IMPLEMENTATION_STATUS.md` como representación documental de esa
   realidad.
5. Documentos vivos específicos (`DATABASE.md`, `MODULES.md`,
   `PERMISSIONS.md`, `RRHH_MVP.md`, etc.).
6. `docs/planning/*` como documentación histórica/propuesta original.

**No modificar el Plan Maestro para hacerlo coincidir con una implementación
incompleta o equivocada.** Si el código contradice una regla vigente del Plan
Maestro, se corrige el código. El Plan Maestro solo cambia cuando existe una
nueva decisión funcional/arquitectónica aprobada por el usuario.

### Actualización documental obligatoria DESPUÉS de implementar

Después de cualquier cambio material, Claude debe actualizar la documentación
en la **misma sesión y en el mismo commit o conjunto inseparable de commits**.
No dejar para una sesión futura la documentación del estado que acaba de
cambiar.

#### Siempre actualizar

- [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) cuando
  cambie el avance, validación, bloqueo, deuda técnica o estado real de una
  subfase/módulo. Desde 2026-09-11 esto son **dos pasos, no uno**: (1) crear
  una entrada nueva en `docs/status-log/YYYY-MM-DD-slug.md` con el detalle
  completo de esta subfase, y (2) agregar una fila enlazándola en la tabla
  de la sección 0 de `IMPLEMENTATION_STATUS.md` **y** actualizar sus
  secciones 1-7 (estado general, divergencias, tablero, próxima acción)
  para que el dashboard quede correcto sin depender de abrir el log. Nunca
  volver a pegar el detalle narrativo completo dentro de
  `IMPLEMENTATION_STATUS.md` — eso es exactamente el monolito que la
  reestructuración de 2026-09-11 eliminó para que la lectura obligatoria de
  cada sesión no cueste miles de líneas.

Registrar como mínimo cuando aplique:

```text
- fecha
- subfase / entregable
- estado anterior → estado nuevo
- commit
- migración(es)
- tablas/RPC/rutas afectadas
- pruebas ejecutadas
- resultado en remoto/deployment
- bloqueos o deuda restante
```

#### Actualizar según el tipo de cambio

- [`docs/RRHH_MVP.md`](docs/RRHH_MVP.md): todo cambio funcional, regla,
  flujo, aceptación o estado del MVP de RRHH.
- [`docs/MODULES.md`](docs/MODULES.md): cuando cambie el estado funcional o
  de integración de un módulo.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): cuando se complete/inicie una fase,
  cambie el orden de ejecución o cambie el estado global del roadmap.
- [`docs/DATABASE.md`](docs/DATABASE.md): tablas, columnas, índices,
  particiones, funciones/RPC, schemas, relaciones o decisiones persistentes.
- [`docs/MIGRATION_LOG.md`](docs/MIGRATION_LOG.md): toda migración aplicada,
  corrección remota relevante y notas de rollback/verificación.
- [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md): nueva convención de permisos,
  dominios, roles o cambio estructural del modelo RBAC.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): cambios de arquitectura,
  routing, SSO, Multi-Zones, integración entre módulos, backend compartido o
  estrategia móvil.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md): cambios en componentes,
  tokens o normas visuales universales.
- [`docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`](docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md)
  y el archivo específico de [`docs/plan/`](docs/plan/) que contiene la
  regla afectada: **solo** cuando una decisión aprobada por el usuario
  cambie el alcance, regla de dominio, orden de fases o arquitectura
  objetivo. El índice (`PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`) casi nunca
  cambia por sí solo — el contenido vive en `docs/plan/`.
- [`docs/README.md`](docs/README.md): cuando se agregue, renombre, reemplace o
  retire un documento que deba formar parte de la navegación documental.

### Regla especial para Nexo Mobile

Toda decisión actual de backend debe evaluarse también desde el objetivo de
`Nexo Mobile` Android/iOS definido en el Plan Maestro. Nueva lógica de negocio
que deba ser usada por Web y Mobile **no debe quedar encerrada únicamente en
una Server Action de Next.js**: debe existir una capa reutilizable/RPC/servicio
con autorización del backend.

Cuando cambie la preparación o avance móvil, actualizar como mínimo:

- `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md` si cambia la estrategia aprobada;
- `docs/IMPLEMENTATION_STATUS.md` para reflejar el avance real;
- `docs/ARCHITECTURE.md` cuando exista una decisión arquitectónica ya
  implementada o aprobada.

### Regla de cierre de tarea

**Una tarea no está terminada si el código quedó actualizado pero los
documentos vivos quedaron mintiendo sobre el estado.** Antes de cerrar una
tarea Claude debe comprobar:

```text
[ ] código/migraciones completados
[ ] build/tests aplicables ejecutados
[ ] remoto verificado cuando corresponde
[ ] IMPLEMENTATION_STATUS actualizado
[ ] documentos específicos afectados actualizados
[ ] MIGRATION_LOG/DATABASE actualizados si hubo DB
[ ] MODULES/ROADMAP actualizados si cambió estado global
[ ] docs/README actualizado si cambió el mapa documental
[ ] código + documentación incluidos en Git
[ ] commit/push realizado cuando la tarea incluye subir cambios
```

No usar frases como “terminado”, “validado” o “completo” en documentación si
solo compila o si falta E2E/remoto. Diferenciar siempre **implementado** de
**validado**.

## REGLA CRÍTICA: monorepo, pnpm y despliegues en Vercel

1. **Aislamiento de proyectos (1 app = 1 proyecto).** Este repositorio es
   un monorepo. Cada directorio dentro de `apps/` (ej. `apps/crm`,
   `apps/rrhh`) es una aplicación independiente. Al crear un módulo nuevo,
   **hace falta crear un proyecto nuevo y dedicado en Vercel**,
   estableciendo su *Root Directory* hacia esa subcarpeta específica.
   Nunca asumas que una app nueva se despliega bajo un proyecto unificado
   existente — verificá primero qué proyectos de Vercel existen
   realmente (vía el MCP de Vercel o pidiéndole al usuario que confirme)
   en vez de asumirlo a partir de la documentación local.
2. **Sincronización estricta del lockfile (evitar caídas de CI/CD).** Al
   crear una app nueva o modificar las dependencias del workspace (ej.
   integrar `@nexo/ui` o `@nexo/permissions`), el `package.json` cambia.
   Vercel usa instalación estricta (`frozen-lockfile`) y falla en
   segundos con `ERR_PNPM_OUTDATED_LOCKFILE` si `pnpm-lock.yaml` en la
   raíz no coincide.
3. **Paso obligatorio antes del push.** Antes de ejecutar o pedir un push
   a la rama principal que involucre dependencias nuevas o modificadas,
   hay que actualizar el lockfile localmente (`pnpm install`) e incluirlo
   en el mismo commit. Si no hay Node/pnpm disponible en el entorno para
   correrlo, decirlo explícitamente y ofrecer como contingencia configurar
   el *Install Command* del proyecto en Vercel como
   `npx pnpm install --no-frozen-lockfile`.
4. **Enrutamiento del Launcher — rewrite de Multi-Zones, nunca URL
   absoluta en `core.apps`.** `core.apps.route` (lo que arma la grilla del
   Launcher en `apps/nexo`) **siempre es una ruta relativa** (`/rrhh`,
   `/crm`, nunca `https://<proyecto>.vercel.app/...`) — así lo consume
   `next/link` en [`apps/nexo/src/app/page.tsx`](apps/nexo/src/app/page.tsx),
   y así se sostiene la regla de login único: las cookies de sesión de
   Supabase son del dominio público compartido, y un link a un dominio
   `*.vercel.app` distinto las pierde y expone el login propio de ese
   proyecto — exactamente lo que la regla de SSO prohíbe. La URL absoluta
   real del deploy de cada módulo **sí existe**, pero como *destino de un
   rewrite* en `apps/nexo/next.config.ts` (vía una env var tipo
   `CRM_APP_URL`), no en la base de datos — ver el rewrite de `/crm` ahí
   como referencia. Al activar un módulo nuevo en `core.apps`
   (`core.company_apps.enabled = true`) verificá también que
   `apps/nexo/next.config.ts` tenga su rewrite `source`/`destination`
   agregado y que el módulo tenga su propio `basePath` configurado — si
   falta cualquiera de los dos, el link no da 404 por la ruta en sí sino
   porque nadie la reescribe hacia el deploy real; agregar el rewrite es
   la corrección, no cambiar `route` a una URL absoluta.
5. **Checklist de "módulo nuevo desplegado pero no carga"** — tres causas
   reales y distintas, ya vistas todas al conectar RRHH (2026-09-04), cada
   una con un síntoma que parece el mismo 500/404 genérico. Verificalas en
   este orden antes de asumir que el código está mal:
   1. **Las env vars NO se comparten entre proyectos de Vercel.** Aunque
      `nexocore` y `nexo-rrhh` sean parte del mismo monorepo y del mismo
      dominio, son proyectos de Vercel independientes con sus propias
      Environment Variables. Una variable que un módulo lee en runtime
      (ej. `NEXO_COMPANY_ID` en `src/lib/company.ts`) hay que configurarla
      **en el proyecto de Vercel de ESE módulo**, aunque ya exista con el
      mismo nombre y valor en `nexocore` — verificalo con
      `get_project`/mirando el dashboard del proyecto correcto, no
      asumas que "ya está puesta" porque la viste en otro proyecto.
   2. **`turbo.json` tiene un allowlist de `env` para la tarea `build`** —
      cualquier variable no listada ahí se descarta silenciosamente antes
      de correr el build (afecta a `next.config.ts`, no al runtime de
      Server Components). Si un módulo nuevo introduce una env var propia
      (ej. `RRHH_APP_URL`), agregala a `tasks.build.env` en `turbo.json` o
      el build va a usar el valor por defecto/`undefined` sin avisar más
      que un warning en el log de build ("missing from turbo.json").
   3. **Un schema Postgres nuevo necesita `GRANT USAGE`/`SELECT` explícito
      para `authenticated`, además de RLS.** Habilitar RLS en las tablas
      no alcanza — RLS filtra *filas*, no reemplaza el permiso base de
      *tabla/schema* de Postgres. Sin el `GRANT`, cualquier query falla
      con "permission denied for schema/table" antes de evaluar ninguna
      policy. Ya pasó dos veces (`crm` en
      [`20260830000010_fix_crm_schema_grants.sql`](supabase/migrations/20260830000010_fix_crm_schema_grants.sql),
      `rrhh` en
      [`20260904000001_fix_rrhh_schema_grants.sql`](supabase/migrations/20260904000001_fix_rrhh_schema_grants.sql)) —
      al crear el schema de un módulo nuevo, el `GRANT USAGE ON SCHEMA
      ... TO authenticated` + `GRANT SELECT, INSERT, UPDATE, DELETE ON
      ALL TABLES IN SCHEMA ... TO authenticated` va en la misma migración
      que crea las tablas, no como fix posterior.

   Para diagnosticar cuál de las tres es, `get_runtime_errors`/
   `get_runtime_logs` del MCP de Vercel (scopeados al proyecto y
   deployment exactos) dan el mensaje real del servidor — no asumas la
   causa por el síntoma en el navegador (404 vs 500 vs pantalla en blanco
   no distinguen entre estas tres por sí solos).

## Regla obligatoria: permisos (norma v3.0)

**Esta regla aplica siempre que se crea o modifica una server action, route
handler, botón, checkbox, toggle, o cualquier acción del usuario en
cualquier `apps/<módulo>`. No es opcional y no depende de que el usuario lo
pida explícitamente en el prompt — se cumple siempre.**

Antes de dar por terminada una función nueva que hace algo (no solo lee),
verificá:

1. ¿Tiene un código de permiso `<modulo>.<dominio>.<recurso>.<verbo>`
   definido?
2. ¿Ese código está insertado en `core.permissions_catalog` vía una
   migración en `supabase/migrations/`?
3. ¿La función llama a `requirePermission(ctx, codigo)` de
   `@nexo/permissions` **antes** de ejecutar su lógica?
4. ¿La UI oculta/deshabilita el control correspondiente cuando
   `hasPermission(...)` es `false`?

Si falta el paso 2, la función queda denegada para todo el mundo por
diseño (fail-closed) — ver [`packages/permissions/index.ts`](packages/permissions/index.ts).
Guía completa, ejemplos y la tabla de dominios por módulo:
[`docs/PERMISSIONS.md`](docs/PERMISSIONS.md).

Al registrar un **módulo nuevo** en `core.apps` no hace falta hacer nada
extra para el permiso de visibilidad — un trigger de Postgres
(`trg_seed_module_permission`) lo crea solo. Eso es lo único automático a
nivel de base de datos; todo lo demás (permisos de funciones dentro del
módulo) sigue el checklist de arriba.

## Regla obligatoria: login único (SSO), ningún módulo tiene su propio

**Ningún `apps/<módulo>` implementa su propio formulario de login.** El
login vive solo en `apps/nexo` (el panel). Al crear o adaptar un módulo:

1. El middleware/proxy del módulo, sin sesión válida, redirige a
   `${NEXO_PANEL_URL:-origin}/login?next=<ruta-con-basePath>` — nunca a un
   `/login` propio del módulo. Ver
   [`apps/crm/src/lib/supabase/middleware.ts`](apps/crm/src/lib/supabase/middleware.ts)
   como referencia.
2. `NEXO_PANEL_URL` es un override opcional (dev local con puertos
   distintos, o acceso directo al deployment `*.vercel.app` del módulo sin
   pasar por el rewrite) — en producción no hace falta configurarlo porque
   Multi-Zones sirve todo bajo el mismo dominio público.
3. Esto funciona sin nada especial porque las cookies de sesión de
   Supabase son del dominio público compartido, no de cada deploy — un
   solo login vale para toda la suite.

## Regla obligatoria: `ShellBar` es la barra superior, ningún módulo la reemplaza

**Ningún `apps/<módulo>` construye su propio header de navegación.**
`ShellBar` de `@nexo/ui` es la barra superior persistente de toda la
suite — se usa tal cual, con `backHref` resuelto por un helper
`getPanelUrl()` propio del módulo (mismo patrón que la regla de SSO de
arriba). La identidad visual del módulo va en el contenido, debajo de la
barra, nunca reemplazándola. Guía completa, ejemplo del bug real que esto
corrigió, y checklist: [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## Regla obligatoria: navegación interna con `next/link`, nunca `<a>` plano

**Todo link que se queda dentro del mismo módulo usa `next/link`, nunca
un `<a href>` nativo** — el `basePath` (`/crm`, `/rrhh`, `/flotilla`) se
aplica solo a `next/link`/`router.push`, no a un `<a>` nativo. Un
`<a href="/clientes">` navega a `dominio.com/clientes` (404 real en
producción) en vez de `dominio.com/crm/clientes`. Bug real que esto
corrigió: [`packages/ui/Sidebar.tsx`](packages/ui/Sidebar.tsx) usaba `<a>`
en sus ítems. Única excepción a propósito:
[`BackToPanelLink`](packages/ui/BackToPanelLink.tsx), que cruza de zona en
Multi-Zones y por eso sí necesita un `<a>` plano. Detalle completo:
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## Regla obligatoria: todo módulo aterriza en su Dashboard de KPIs

**La raíz de cada módulo (`/`, bajo su propio `basePath`) redirige
siempre a un `/dashboard` propio, con las métricas principales de esa
área — nunca a una lista de contenido ni a una página en blanco.** No
alcanza con "no dejarlo en blanco": tiene que ser una vista de KPIs (2-3
tarjetas con datos reales del módulo como mínimo). Ver
[`apps/crm/src/app/(app)/dashboard/page.tsx`](apps/crm/src/app/(app)/dashboard/page.tsx)
como referencia y el checklist completo en
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## Regla obligatoria: Paso Cero — matriz de permisos antes que tablas o UI

**Prohibido generar código de frontend o crear tablas de datos para una
app/módulo nuevo (o una función nueva dentro de uno existente) sin antes
haber diseñado, presentado como Markdown + SQL, y hecho aprobar
explícitamente por el usuario su Matriz de Permisos y Roles** —
`[app].[modulo].[recurso].[accion]`, 4 segmentos estrictos, sin
excepción para código nuevo — **e insertado esa matriz en el catálogo**
(`core.permissions_catalog` + `core.app_roles` + `core.app_role_permissions`)
antes de que exista una tabla de datos del módulo. Precedente: la matriz
de RRHH (2026-09-02). Detalle:
[`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) y
[`docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §6`](docs/planning/ARQUITECTURA_MVP_ESCALABLE.md#6-playbook-para-agregar-una-nueva-app).

**Verificación Remota Obligatoria**: antes de escribir un `insert` hacia
`core.permissions_catalog`/`core.app_roles`, consultar el estado real del
proyecto remoto (`core.apps`, `core.permissions_catalog`, `core.app_roles`
filtrados por `module_slug`, vía el MCP de Supabase) — nunca asumir el
estado a partir de la documentación local, que puede estar desactualizada.

## Regla obligatoria: Nexo Enterprise UI — tema claro por defecto (reemplaza "dark mode por defecto")

**Desde 2026-09-07, "Nexo Enterprise UI" es la dirección visual aprobada
de toda la suite: tema CLARO por defecto** — reemplaza la regla anterior
de 2026-09-02 ("dark mode por defecto + glassmorphism"), que queda
revertida por decisión explícita del usuario. Componentes:

- sidebar azul persistente, colapsable en desktop, `Drawer` en
  mobile/tablet (nunca fijo en pantalla angosta);
- topbar con breadcrumb automático (a partir del árbol de navegación),
  buscador, notificaciones y avatar;
- contenido claro, cards blancas, dashboards de alta densidad con KPIs
  reales (nunca datos mock — usar "Pendiente de integración"/
  "Pendiente de consolidación"/`EmptyState` cuando no hay fuente real).

Kit compartido en `packages/ui` (única fuente — ningún módulo duplica
shell/topbar/sidebar/tablas/KPIs): `NexoShell`, `NexoSidebar`,
`NexoTopbar`, `Breadcrumb`, `PageHeader`, `DashboardHero`, `MetricCard`,
`ActivityFeed`, `QuickActions`, `DataTable`, `FilterBar`, `StatusBadge`,
`FormTabs`, `FormSection`, `Toast`/`useToast`, `ConfirmDialog`,
`EmptyState`. Reemplazan a `AppShell`/`ShellBar`/`Sidebar`/`StatCard`
(retirados de `packages/ui`, ver `docs/DESIGN_SYSTEM.md`).

El tema oscuro + `.nexo-glass` (tokens `--nexo-bg`/`--nexo-shell-fg`/etc.,
`tokens.css`) sigue existiendo mismo, acotado exclusivamente al kiosko de
RRHH (pantalla inmersiva de marcación) — ningún componente del kit
Enterprise UI lo usa. Dark como opción general de tema podrá volver más
adelante; no se reconstruye ahora un sistema completo de temas si no
existe. Detalle completo, qué reemplaza a qué, y el árbol de navegación
de referencia: [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## Regla obligatoria: una sola paleta y tipografía — ningún módulo tiene identidad visual propia

**Todo `apps/<módulo>` usa los mismos tokens de color y la misma
tipografía (Inter) que el resto de la suite, sin excepción — ni siquiera
en su propio contenido.** No es una preferencia de estilo: ya se intentó
lo contrario (el CRM tuvo su propia paleta "concreto/acero/naranja" y
tipografía "Archivo Black/Work Sans/IBM Plex Mono") y el resultado, aun
con la barra superior ya unificada, seguía sintiéndose como software
distinto por dentro — por eso el usuario la retiró explícitamente
(2026-08-30). Un módulo nuevo o adaptado **no reintroduce esta
fragmentación** aunque tenga su propia identidad de marca/categoría — esa
identidad va únicamente en el color de categoría del launcher
(`packages/ui/category-colors.ts`), nunca en botones, inputs, fondos ni
`font-family` propios.

Fuentes de verdad únicas, no se hardcodea un hex ni una fuente por fuera
de ellas:

- Color: tokens de [`packages/ui/tokens.css`](packages/ui/tokens.css)
  (dark/glass) + la escala `neutral-*`/`--nexo-accent` documentada en
  [`docs/planning/NORMA_DISENO_UNIVERSAL.md §1.2`](docs/planning/NORMA_DISENO_UNIVERSAL.md#12-paleta-de-colores-agnóstica).
- Tipografía: Inter en toda la suite, cargada vía
  [`packages/ui/shell-font.ts`](packages/ui/shell-font.ts) para el chrome
  compartido — un módulo no redefine `font-sans` a su propia fuente de
  marca (ver el comentario de ese archivo, que documenta exactamente este
  bug ya corregido una vez).
- Componentes genéricos (botón, input, modal, tabla, tarjeta de
  estadística): si ya existe una versión en otro módulo, se generaliza a
  `packages/ui`, no se duplica ni se reescribe a mano — checklist completo
  en [`docs/planning/NORMA_DISENO_UNIVERSAL.md §4`](docs/planning/NORMA_DISENO_UNIVERSAL.md#4-reglas-anti-fragmentación).

## Regla obligatoria: toda tabla de hechos nace particionada

**Al crear una tabla nueva que registra un evento de negocio que se sigue
insertando sin límite (transacciones, históricos, marcas, logs,
auditoría), la migración la crea particionada por `RANGE` mensual desde
el primer `create table`** — nunca se agrega el particionamiento después.
Catálogos/dimensiones (clientes, empleados, `permissions_catalog`) no se
particionan. Plantilla SQL, índices obligatorios (B-Tree en toda FK,
`(company_id, fecha)` compuesto, GIN en JSONB) y el mecanismo de
particiones futuras vía `pg_cron`:
[`docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §2`](docs/planning/ARQUITECTURA_MVP_ESCALABLE.md#2-estrategia-de-escalabilidad-extrema).

## Regla obligatoria: Vercel Speed Insights + Analytics

**Toda app en `apps/*` que se despliegue en Vercel debe incluir
`@vercel/speed-insights` y `@vercel/analytics`** (pedido explícito del
usuario — "recuerda siempre agregar esto"). Al crear o adaptar un módulo
nuevo:

```tsx
// layout.tsx
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
// ...
<body>
  {children}
  <SpeedInsights />
  <Analytics />
</body>
```

Ya está en `apps/nexo`, `apps/crm` y `apps/web-corporativo`. Falta agregarlo
a `apps/rrhh` y `apps/flotilla` cuando se adapten en sus fases.

## Arquitectura (resumen — detalle en `docs/ARCHITECTURE.md`)

- Monorepo Turborepo + pnpm. Un módulo = una app en `apps/*`, desplegable
  de forma independiente.
- Un solo dominio para toda la app (`nexo.materialesjcastillo.com`), los
  módulos son **rutas** (`/rrhh`, `/flotilla`, `/crm`), no subdominios —
  mecanismo: [Next.js Multi-Zones](https://nextjs.org/docs/pages/guides/multi-zones).
  El sitio público (`materialesjcastillo.com`) es un dominio aparte.
- Un solo proyecto Supabase, `nexo-core` (ref `yrbjlmiqhkyxtlcerowh`,
  `us-east-1`), con un schema Postgres por módulo (`rrhh`, `flotilla`,
  `crm`) más el schema `core` (compañías, catálogo de apps, permisos).
- Cada `apps/<módulo>` importado desde su repo original vía `git subtree`
  (historial preservado) — hoy sigue apuntando a su Supabase original hasta
  que se adapte en su fase correspondiente (ver `docs/ROADMAP.md`).

## Estado actual

Ver [`docs/MODULES.md`](docs/MODULES.md) y [`docs/ROADMAP.md`](docs/ROADMAP.md)
para qué fase está en curso. No asumas que un módulo ya está adaptado a
Multi-Zones o a `nexo-core` solo porque su código ya vive en `apps/`.
