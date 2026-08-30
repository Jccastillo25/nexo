# Bitácora de migración

Orden de bitácora: más reciente arriba.

## 2026-08-30 — Diseño UX/UI (investigación SAP Fiori + Odoo) aplicado al panel

- Investigación pedida por el usuario, documentada completa en
  [planning/DISENO_UX_UI.md](planning/DISENO_UX_UI.md): shell bar +
  agrupación por categoría (Fiori Launchpad/Spaces), estética plana y
  colores por categoría (Odoo).
- `packages/ui` dejó de estar vacío: `ShellBar` (barra superior persistente)
  y `category-colors.ts` (tokens de color por categoría, no por módulo).
- `apps/nexo`: shell bar agregado, grilla agrupada por categoría (antes era
  plana), tipografía Inter para el chrome del panel.
- Nueva función `public.get_visible_apps` corregida: excluía mal a `nexo`
  de su propia lista (se listaba a sí mismo, un tile circular apuntando a
  "/") — detectado al escribir el código del home, corregido con una
  migración nueva antes de verificarlo en vivo.
- **Verificación real, no solo "debería compilar"**:
  - `pnpm install` de nuevo (dependencia nueva `@nexo/ui` en `apps/nexo`).
  - `next build` de `apps/nexo` y de `apps/crm` — ambos compilan y tipan
    limpio.
  - En el camino, `next build` de `apps/crm` encontró un bug real de tipos
    en `packages/permissions` (heredado de la Fase 3, no detectado hasta
    ahora porque nunca se había corrido un build real de esa app): el tipo
    `RpcClient.rpc()` pedía un `Promise` estricto pero `supabase.rpc()`
    devuelve un `PostgrestFilterBuilder` (`PromiseLike`, no `Promise`
    completo) — corregido.
  - `turbo run build` de **todo el monorepo** detectó una colisión real:
    `apps/rrhh` y `apps/web-corporativo` tenían el mismo `name` de paquete
    (`"web"`, heredado sin tocar de sus `create-next-app` originales) —
    renombrados a `rrhh` y `web-corporativo`.
  - Resultado final de `turbo run build`: **4 de 5 apps compilan limpio**
    (`web-corporativo`, `crm`, `nexo`, `transporte-app`/flotilla). `rrhh`
    falla por falta de variables de entorno de su propio Supabase original
    (`ofeuzkwjhmfsazqfyutu`) — **esperado**, esa app no se ha tocado desde
    el import crudo, le toca configurarse en su propia fase (6), no antes.
- **No verificado visualmente todavía**: la grilla de módulos con datos
  reales (tiles agrupados por categoría) — requiere un usuario autenticado
  con membresía en `core.company_memberships`, que no existe todavía (ver
  nota de la Fase 4 más abajo). Sí se verificó que compila y tipa sin
  errores.

## 2026-08-30 — Fase 4: panel `apps/nexo`, verificado en vivo

- Se construyó `apps/nexo`: login (Supabase Auth), middleware de sesión,
  home (`/`) que llama a `public.get_visible_apps(companyId)` para armar la
  grilla de módulos — nunca hardcodea qué mostrar.
- Nueva función `public.get_visible_apps`: cruza `core.company_apps`
  (contratado) y `core.has_permission` (autorizado). Mismo patrón que
  `has_permission` — wrapper en `public` para no depender de exponer el
  schema `core`.
- `next.config.ts` de `apps/nexo` implementa el rewrite de Multi-Zones
  hacia `/crm` (el único módulo adaptado hasta ahora).
- **Se corrió de verdad, no solo se escribió**: `pnpm install` en todo el
  monorepo (vía `npx pnpm@9`, porque no había pnpm global instalable sin
  permisos de administrador), y ambas apps (`crm` en :3001, `nexo` en :3000)
  levantadas con el Browser pane. Verificado en vivo:
  - `http://localhost:3000/` → redirige a `/login` sin sesión (middleware
    funcionando).
  - Login de Nexo con credenciales falsas → `"Correo o contraseña
    incorrectos."`, confirmando conexión real end-to-end con Supabase Auth
    de `nexo-core` (no un error de red).
  - `http://localhost:3000/crm` → la URL se queda en el puerto 3000 (un
    solo dominio) pero el contenido servido es el login real de la app CRM
    (`/crm/login`, con su branding y su propio middleware de auth) — **el
    rewrite de Multi-Zones funciona de punta a punta**.
  - Consola del navegador sin errores en ninguna de las dos pantallas.
- Se creó/corrigió `.claude/launch.json` en el directorio de trabajo
  principal (`jcastillo`, no `Nexo` — el Browser pane lee el launch.json
  del working directory principal de la sesión) con configuraciones `crm` y
  `nexo` que corren `pnpm --filter <app> dev` con `pnpm -C` apuntando al
  monorepo real.
- **No verificado todavía**: la grilla de módulos con un usuario real
  autenticado (`core.company_memberships` está vacío — hace falta crear un
  usuario y una membresía manualmente, ver `apps/nexo/README.md`).

## 2026-08-30 — Fase 3: adaptar `web-corporativo` + `crm`

- **`web-corporativo`**: no requirió ningún cambio. Es contenido estático,
  vive en el dominio raíz `materialesjcastillo.com` (no en Multi-Zones), no
  usa Supabase. Se documentó ese hecho en su README para que quede
  explícito que "no adaptado" no es lo mismo que "pendiente".
- **`crm`**: adaptado de punta a punta.
  - `next.config.ts`: `basePath: "/crm"` + `transpilePackages: ["@nexo/permissions"]`.
  - Cliente/servidor de Supabase re-apuntados a `nexo-core`
    (`yrbjlmiqhkyxtlcerowh`), en vez del proyecto original
    `materiales-jcastillo-crm` (`arzadwxsifnaolvfcvqk`).
  - Las 3 acciones de escritura (`createCliente`, `updateCliente`,
    `deleteCliente`) llaman a `requirePermission()` de `@nexo/permissions`
    antes de tocar la base de datos.
  - Se agregó `core.company_memberships` + la función única
    `core.has_permission()` (gap detectado al implementar: el diseño
    original de la Fase 2 no tenía de dónde sacar el rol owner/admin).
    **El usuario pidió resetear el schema `core` recién creado (sin datos
    reales) para incorporar esto desde cero en vez de parchearlo** — se hizo
    con `drop schema core cascade` + recrear, confirmado de bajo riesgo
    porque `core` no tenía ningún dato real todavía.
  - `crm.clientes` quedó con RLS real: las 4 policies (ver/crear/editar/eliminar)
    llaman a `core.has_permission()` directo — la protección de datos no
    depende solo de que el código de la app se acuerde de chequear.
  - `get_advisors` detectó y se corrigieron 2 warnings: `search_path`
    mutable en una función nueva, y el RPC `public.has_permission`
    ejecutable por el rol `anon` sin sesión (se revocó de `PUBLIC`, se dejó
    solo para `authenticated`).
- **Resuelto**: el clasificador de permisos de Claude Code denegó
  `restore_project` sobre el proyecto pausado `arzadwxsifnaolvfcvqk`
  (materiales-jcastillo-crm), así que no se pudo inspeccionar en vivo. El
  usuario confirmó que todo lo que había ahí era de prueba — **no hace
  falta copiar ningún dato**. La estructura de `crm.clientes` recreada a
  partir de `database.types.ts` (2026-08-29) es la definitiva, no un
  placeholder a completar después.
- **Pendiente manual, fuera del alcance de las herramientas MCP**: exponer
  el schema `crm` en Settings → API → Data API → Exposed schemas del
  proyecto `nexo-core`. Sin esto, `apps/crm` no puede conectarse de verdad
  todavía.
- **Sin verificar**: no se corrió un dev server real (no existe `apps/nexo`
  todavía para probar Multi-Zones de punta a punta) — el comportamiento de
  `proxy.ts`/`middleware.ts` con `basePath` activo queda pendiente de
  confirmar en la Fase 4.

## 2026-08-30 — Fase 2: proyecto `nexo-core` + schema `core` + norma v3.0

- Proyecto Supabase `nexo-core` creado (ref `yrbjlmiqhkyxtlcerowh`,
  org `Grupo CT`, `us-east-1`, plan gratuito).
- Aplicadas las migraciones `core_schema` y `core_seed_apps`: 7 tablas del
  schema `core`, trigger `trg_seed_module_permission`, RLS habilitado en
  las 7 tablas, `core.apps` sembrada con los 4 módulos actuales.
- Verificado en vivo: el trigger creó solo los 4 permisos de visibilidad
  (`nexo.ver_modulo`, `rrhh.ver_modulo`, `flotilla.ver_modulo`,
  `crm.ver_modulo`) sin ningún INSERT manual.
- `get_advisors` (security): sin alertas más allá de "RLS sin policy" en
  las 5 tablas que se dejaron así a propósito (provisional hasta Fase 3+).
- Se construyó el motor de permisos fail-closed en
  `packages/permissions/index.ts` (`hasPermission`/`requirePermission`):
  un `permission_code` no registrado en `core.permissions_catalog` deniega
  siempre, incluso para owners/admins.
- Se agregó `CLAUDE.md` en la raíz del repo con la regla obligatoria de
  permisos, para que se aplique automáticamente en cualquier sesión de
  Claude Code que trabaje en este monorepo (pedido explícito del usuario:
  "esto tiene que ser algo que se dispare siempre").
- Pendiente: nada de esto está conectado todavía a ningún `apps/<módulo>`
  real — es la base, la integración es la Fase 3+.

## 2026-08-29 — Import de código real (git subtree, historial preservado)

Se trajo el código de los 4 productos existentes a sus carpetas en `apps/`,
usando `git subtree` para conservar el historial de commits de cada uno
(decisión tomada con el usuario ese mismo día). **Solo se importó el
código** — nada de Multi-Zones (`basePath`/`rewrites`), nada de Supabase
(`nexo-core` no existe todavía), nada de adaptación de permisos. Eso es la
siguiente fase.

| Módulo | Origen | Método | Commits traídos |
|---|---|---|---|
| `apps/web-corporativo` | `WEB Corporativo jcastillo/apps/web` | `git subtree split --prefix=apps/web` + `subtree add` | 3 |
| `apps/crm` | `WEB Corporativo jcastillo/apps/crm` | `git subtree split --prefix=apps/crm` + `subtree add` | 1 |
| `apps/flotilla` | `Desktop/Transporte` (repo completo, rama `master`) | `git subtree add` directo | historial completo de Ruta360 |
| `apps/rrhh` | `jcaatillo/marcacion-grupo-ct`, solo la carpeta `web/` (clonado a una carpeta temporal, ya eliminada) | `git subtree split --prefix=web` + `subtree add` | historial completo de `web/` |

Notas:

- El `docs/` en la **raíz** de `marcacion-grupo-ct` (`business_rules.md`,
  `database.md`, `repository_map.md`, minúsculas) **no se trajo** — parecía
  superado por el `docs/` propio de `web/` (`BUSINESS_RULES.md`,
  `DATABASE.md`, etc., mayúsculas), que sí viajó dentro de `apps/rrhh/docs/`.
  Si algo de esos 3 archivos viejos tenía información que no esté en la
  versión nueva, falta rescatarlo a mano.
- Quedan dos remotes en este repo apuntando a las carpetas locales de los
  proyectos originales, para poder traer fixes futuros mientras dure la
  transición (`git subtree pull --prefix=apps/<modulo> <remote> <rama>`):
  - `ruta360` → `Desktop/Transporte` (rama `master`, sin split, se puede
    hacer `pull` directo)
  - `materiales-jcastillo` → `WEB Corporativo jcastillo` (para `crm`/`web-corporativo`
    hay que **regenerar el split** — `git subtree split --prefix=apps/crm -b split-crm`
    de nuevo en ese repo — antes de poder hacer `pull`, porque un subfolder-split
    no seatualiza solo)
  - No quedó remote para `rrhh` (se clonó a una carpeta temporal ya borrada);
    para traer fixes futuros de Gestor360 hay que re-clonar
    `jcaatillo/marcacion-grupo-ct` y repetir el split de `web/`.
- Verificado: ningún `node_modules/` ni `.next/` quedó commiteado en ninguno
  de los 4 imports (los `.gitignore` de origen ya los excluían). Tamaño
  final de `.git`: ~2.4 MB.

## 2026-08-29 — Repo creado

- Se crea el repositorio local `Nexo` (`C:\Users\Gerencia\Desktop\Nexo`),
  esqueleto de monorepo Turborepo + pnpm workspaces.
- Se copian los documentos de planeación
  (`PLAN_UNIFICACION_NEXO.md`, `PROPUESTA_MARCA_MODULOS.md`) a
  `docs/planning/`.
- Ningún módulo migrado todavía. Ningún proyecto Supabase (`nexo-core`)
  provisionado todavía.
- Pendiente: crear el repositorio remoto en GitHub cuando el usuario lo
  indique (aún no solicitado).

## Próximos pasos pendientes de ejecutar

1. Provisionar el proyecto Supabase `nexo-core` y las tablas de `core.*`.
2. Elegir el módulo piloto (`web-corporativo` recomendado, menor riesgo) y
   migrarlo completo (app + datos) para validar el patrón Multi-Zones de
   punta a punta.
3. Construir la app `nexo` (panel) real sobre ese primer módulo migrado.
