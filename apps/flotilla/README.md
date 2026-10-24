# Flotilla (`/flotilla`)

Zona de Nexo para entregas, recorridos y conductores. Plan vigente:
[`docs/plan/22-flotilla-entregas.md`](../../docs/plan/22-flotilla-entregas.md)
(Entregas) dentro de la [Fase 4](../../docs/plan/07-fase4-transporte.md).

- Login único del panel (sin login propio), `NexoShell`, permisos
  `flotilla.*` del Paso Cero `20261024034727`.
- Datos en el schema `flotilla` de `nexo-core` (llega con la etapa E2).
- Desarrollo local: `pnpm --filter nexo-flotilla dev:zone` (puerto 3006) y
  `FLOTILLA_APP_URL=http://localhost:3006` en `apps/nexo/.env.local`.

El código heredado de Ruta360 (otro proyecto de Supabase, login con PIN,
`/supadmin`) se retiró el 2026-10-23 al empezar E1; sigue en el historial de
Git de esta carpeta.
