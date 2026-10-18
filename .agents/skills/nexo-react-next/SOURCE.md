# Procedencia de nexo-react-next

| Campo | Valor |
|---|---|
| Fuente | https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices (nombre original `vercel-react-best-practices`, versión `1.0.0` según su metadata) |
| Commit evaluado | `063bee94c3f4df8453406c830b0a7df0f2860278` (2026-08-28, último commit del repo) |
| Licencia | MIT (repositorio `vercel-labs/agent-skills`) |
| Fecha de evaluación | 2026-10-17 |
| Inspección | `SKILL.md` (índice de 70 reglas en 8 categorías). Sin scripts, `allowed-tools` ni red. No se leyeron los archivos `rules/*.md` ni `AGENTS.md` de la fuente. |

## Qué se tomó (redactado de nuevo para Nexo)

De las 70 reglas, las que aplican a la arquitectura real:

- Cascadas: `async-parallel`, `async-cheap-condition-before-await`.
- Servidor: `server-auth-actions`, `server-serialization`, `server-no-shared-module-state`.
- Paquete: `bundle-dynamic-imports`, `bundle-conditional`.
- Re-render y renderizado: `rerender-derived-state-no-effect`, `rerender-no-inline-components`, `rerender-lazy-state-init`, `rendering-conditional-render`, `rendering-usetransition-loading`.

Se agregaron reglas propias de Nexo que la fuente no tiene: RPC para Mobile,
`next/link` y `basePath`, y el error de exportar constantes desde `"use client"`.

## Qué se descartó y por qué

- `client-swr-dedup` y las reglas de caché LRU: Nexo no usa SWR y su patrón de datos es Server Component + RPC.
- `bundle-barrel-imports`: `@nexo/ui` es un barrel por diseño. No se cambia sin medir.
- Micro-optimizaciones de JavaScript (`js-*`) y `advanced-*`: bajo impacto para el volumen actual, y meterían ruido en las revisiones.
- Las otras skills del repo: `react-native-guidelines` (Nexo Mobile en pausa), `vercel-deploy-claimable` (despliega en servicios externos, prohibido sin aprobación), `vercel-optimize`, `react-view-transitions`, `composition-patterns` y `writing-guidelines` (no hay una necesidad actual que no cubran `nexo-ui` y `CLAUDE.md`).

## Evaluación

La selección se hizo comparando cada regla con el código real (layouts con
`Promise.all`, acciones con `requirePermission`, carga dinámica de Excel en
Productos). No se midió rendimiento.
