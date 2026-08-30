# Bitácora de migración

Orden de bitácora: más reciente arriba.

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
