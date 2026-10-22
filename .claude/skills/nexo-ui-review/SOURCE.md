# Procedencia de nexo-ui-review

## Fuentes evaluadas

| Fuente | Commit evaluado | Licencia | Uso |
|---|---|---|---|
| https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines | `063bee9` (repo, 2026-08-28) | MIT (repo agent-skills) | Inspirado en ella; **no instalada** |
| https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md (las reglas que esa skill descarga) | `434b7f9` (2026-10-05) | No declarada en lo que se pudo consultar | Solo se tomaron ideas, redactadas de nuevo; sin texto literal |
| https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | `56ea9cf` (2026-10-15) | MIT | Solo el orden de prioridades (accesibilidad e interacción primero); **no instalada** |

Fecha de evaluación: 2026-10-17.

## Por qué no se instalaron las originales

- **web-design-guidelines** descarga sus reglas desde una URL de GitHub **en cada ejecución**. Las reglas cambian sin control de versión en el repo y llegan como contenido externo no confiable dentro del contexto del agente. Aquí la lista queda fija y versionada con el código.
- **ui-ux-pro-max** necesita Python (no instalado en esta máquina: comprobado el 2026-10-16) y ejecuta búsquedas sin pedir confirmación. Su valor principal (79 estilos, 192 paletas, 74 combinaciones de fuentes, generador de design system) contradice la paleta única y la tipografía Inter de Nexo. El instalador `uipro` y el marketplace agregarían una dependencia externa sin necesidad demostrada.

## Qué se adaptó

- Secciones de accesibilidad, foco, formularios, contenido, movimiento y antipatrones, reducidas a lo que aplica a las pantallas de Nexo y redactadas en español.
- Formato `archivo:línea` agrupado por archivo, combinado con la gravedad que exige el subagente `reviewer`.
- Reglas propias de la suite: `NexoShell`, menú desplegable, `next/link`, paleta única, permisos y datos reales.

## Qué se descartó

- Las reglas de "Title Case" en botones y títulos: la suite está en español, que usa mayúscula solo inicial.
- Las comillas tipográficas y la elipsis obligatoria en placeholders: no son convenciones del repo.
- La virtualización obligatoria de listas de más de 50 elementos: los listados de Nexo paginan en el servidor (50 por página).
- Modo oscuro: la suite es de tema claro (salvo el kiosco).

## Incorporación de antislop (2026-10-21)

| Campo | Valor |
|---|---|
| Fuente | https://github.com/miqdadbadjuber/anti-slop (`antislop.md`, `skills/antislop-human/SKILL.md`, `skills/antislop-layoutmobile/SKILL.md`, `skills/antislop-ui/SKILL.md`) |
| Commit | `439a2ef5b9dd0ebe74e8113ff43f5928d0fe2a6a` (2026-10-16), release declarada v3.2.21 |
| Licencia | MIT, © 2026 Miqdad Badjuber (`LICENSE` del repo) |
| Inspección | Lectura vía WebFetch; no se instaló ni ejecutó nada |

Se tomó, redactado de nuevo:
- Contraste con umbrales numéricos (4.5:1 y 3:1, incluido lo no textual y el foco), medido en el peor punto; estado no solo por color (R-25, antislop-human).
- Teclado: Escape en diálogos, orden de tabulación, nada solo con hover (R-32).
- Estados distinguidos por causa (primer uso, filtro vacío, sin permiso), mapeados a las variantes reales de `EmptyState` (`packages/ui/EmptyState.tsx`) (R-27).
- Responsivo: franja tablet propia, no ocultar desbordes con `overflow-hidden`, zoom 200 %, teclado móvil que no tapa el campo (antislop-layoutmobile, antislop-human).
- Objetivos táctiles de 44 px (R-03), adaptado a la decisión del kit en `packages/ui/Button.tsx` (`md`/`lg` suben a `min-h-11` en móvil; `sm` y `RowActionIcons` quedan en 32 px para tablas densas).
- Sección "Anti-relleno" que remite a `nexo-ui`.
- Del Delivery Gate: solo la exigencia de evidencia por punto y "nombrar una prueba no es ejecutarla" (R-35), sobre el formato Comprobado/Pendiente que ya existía.

Descartado: el Delivery Gate de cuatro bloques PASS/FAIL (duplicaría el formato
de hallazgos del reviewer), los scripts `contrast-check.py` y `contrast-mcp.py`
(requieren Python, que no estaba instalado según la comprobación del 2026-10-16; no se volvió a comprobar), y la skill original pide
`Bash(python *)` en `allowed-tools`), las auditorías escritas en `anti-slop/`, y
las reglas de tema oscuro y de identidad visual.

## Evaluación

La lista no se probó todavía contra un diff real. Se valida en la prueba de
delegación del 2026-10-17 (ver `docs/status-log/2026-10-17-subagentes.md`).
