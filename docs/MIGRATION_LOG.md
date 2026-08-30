# Bitácora de migración

Orden de bitácora: más reciente arriba.

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
- **Bloqueado, requiere decisión del usuario**: el clasificador de permisos
  de Claude Code denegó `restore_project` sobre el proyecto pausado
  `arzadwxsifnaolvfcvqk` (materiales-jcastillo-crm) — no se pudo confirmar
  si tiene datos reales de clientes ni copiarlos. La estructura de
  `crm.clientes` se recreó a partir del `database.types.ts` ya generado
  (2026-08-29), no de una inspección en vivo.
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
