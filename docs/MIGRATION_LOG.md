# Bitácora de migración

Orden de bitácora: más reciente arriba.

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
