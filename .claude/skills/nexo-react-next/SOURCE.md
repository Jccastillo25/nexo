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

## Incorporación de antislop-code (2026-10-21)

| Campo | Valor |
|---|---|
| Fuente | https://github.com/miqdadbadjuber/anti-slop/blob/439a2ef5b9dd0ebe74e8113ff43f5928d0fe2a6a/skills/antislop-code/SKILL.md |
| Commit | `439a2ef5b9dd0ebe74e8113ff43f5928d0fe2a6a` (2026-10-16), release declarada v3.2.21 |
| Licencia | MIT, © 2026 Miqdad Badjuber (`LICENSE` del repo) |
| Inspección | `SKILL.md` leído completo vía WebFetch. Su frontmatter declara `allowed-tools: Read Write Edit Glob Grep`, que no se trajo |

Se tomó, redactado de nuevo y en español, la sección 6 "Comentarios en el
código": qué comentarios aportan (porqué, regla de negocio, caso borde,
seguridad, contrato) y cuáles sobran (repetir la línea, narración por pasos,
etiquetas vacías, JSDoc eco, marcas de cierre, banners, emojis, TODO vago). Se
agregó la restricción de no reescribir comentarios fuera del diff. Se descartó
la dependencia del archivo central `antislop.md` y su referencia a la regla
R-31. No se evaluó contra una tarea real.

## Evaluación

La selección se hizo comparando cada regla con el código real (layouts con
`Promise.all`, acciones con `requirePermission`, carga dinámica de Excel en
Productos). No se midió rendimiento.
