# Skills del proyecto Nexo — registro

Lo mantiene el subagente `skills-specialist` (ver
`.claude/agents/skills-specialist.md` y "Sistema de trabajo con subagentes" en
`CLAUDE.md`). Cada skill vive en `.claude/skills/<nombre>/SKILL.md`; este
README no es una skill.

## Tres capas, separadas a propósito

| Capa | Dónde vive | Quién la cambia |
|---|---|---|
| **Fuente y licencia** | `.claude/skills/<nombre>/SOURCE.md` y la tabla de abajo | skills-specialist |
| **Adaptación estable al proyecto** | `.claude/skills/<nombre>/SKILL.md` | skills-specialist, solo cuando cambia una regla del repo |
| **Instrucciones de cada tarea** | En el encargo del coordinador al ejecutor: objetivo, archivos autorizados, criterios, pruebas. Nunca dentro de la skill | Coordinador |

Las skills estables se **reutilizan** en cada tarea. No se buscan ni se
reescriben de nuevo salvo que falte una capacidad.

## Skills del proyecto

| Skill | Para qué | Asignada a | Fuente / commit / licencia |
|---|---|---|---|
| `nexo-ui` | Diseñar y construir pantallas con `@nexo/ui` (tema claro, Inter, paleta única, menú desplegable) | ux-planner, ui-frontend | anthropics/skills `frontend-design` · `41bbe19` · Apache-2.0 (adaptación parcial) |
| `nexo-react-next` | Patrones React 19 / Next 16 de la suite (RPC, permisos en acciones, cascadas, `"use client"`) | ui-frontend, reviewer | vercel-labs/agent-skills `react-best-practices` · `063bee9` · MIT (subconjunto) |
| `nexo-ui-review` | Lista de verificación de accesibilidad y UX con hallazgos `archivo:línea` | ux-planner, ui-frontend, reviewer | Ideas de vercel-labs `web-design-guidelines` (MIT) y web-interface-guidelines (`434b7f9`, sin licencia declarada; solo ideas, sin texto literal) + prioridades de ui-ux-pro-max (`56ea9cf`, MIT) |
| `nexo-security` | Lista de seguridad: permisos v3.0, RLS/GRANT (patrones A y B), `security definer` + `fn_exigir_permiso`, errores, SSO/open redirect, secretos, validación de entrada; consultas remotas de solo lectura en `consultas-remotas.md` | reviewer (pendiente de que el coordinador la agregue a `skills:`) | Creación propia (2026-10-17). Ideas, sin texto literal, de anthropics/claude-code-security-review (MIT, commit no visible), supabase/agent-skills `supabase-postgres-best-practices` v1.1.1 (MIT), docs de Supabase (functions, database advisors; sin licencia declarada, solo hechos técnicos) y guía Data Security de Next.js (repo vercel/next.js, MIT) |

Detalle de lo tomado, lo descartado y la evaluación: el `SOURCE.md` de cada skill.

## Evaluadas y no incorporadas (2026-10-17)

| Fuente | Motivo |
|---|---|
| nextlevelbuilder/ui-ux-pro-max-skill (instalación completa) | Necesita Python (no instalado), ejecuta búsquedas sin confirmar y su base de estilos, paletas y fuentes contradice la paleta única |
| vercel-labs `web-design-guidelines` (instalación) | Descarga sus reglas de internet en cada uso: contenido remoto cambiante y no confiable |
| vercel-labs `react-native-guidelines` | Nexo Mobile en pausa (plan 15) |
| vercel-labs `vercel-deploy-claimable` | Despliega en servicios externos: prohibido sin aprobación |
| vercel-labs `vercel-optimize`, `react-view-transitions`, `composition-patterns`, `writing-guidelines` | Sin necesidad actual que no cubran las tres skills y `CLAUDE.md`. Se reevalúan si aparece una tarea concreta |
| anthropics/claude-code-security-review `security-review.md` (copia al repo) | Declara `allowed-tools` con Bash y bloques `` !`git …` `` que se ejecutan al cargar; ordena lanzar subtareas (los subagentes de Nexo no pueden); excluye open redirect, que en Nexo sí importa. Sigue disponible como comando incorporado de Claude Code para quien lo invoque explícitamente |
| supabase/agent-skills (instalación vía `npx skills add` o plugin) | Instalación externa sin necesidad demostrada; su contenido es mayormente rendimiento de Postgres. Se tomaron solo ideas de seguridad para `nexo-security` |

## Inventario de otras ubicaciones (2026-10-17)

- Usuario (`~/.claude/skills/`): no existe en esta máquina.
- Plugins y skills de la sesión: dependen de lo habilitado; se inventarían en cada consulta. El 2026-10-17 (alta de `nexo-security`): `~/.claude/plugins/` sin ningún `SKILL.md`; de seguridad, la sesión solo ofrecía el comando incorporado `security-review` y `engineering:code-review`, ambos genéricos y sin las reglas de Nexo.

## Cómo se referencian

En el frontmatter de un agente, `skills:` con lista YAML de nombres (el
`name` del `SKILL.md`, igual al nombre de la carpeta). El contenido completo se
precarga al iniciar el subagente. **Los subagentes no heredan las skills
cargadas por el coordinador**: si una tarea necesita otra skill, se agrega a
la lista del agente (y hace falta una sesión nueva) o se pide en el encargo
que la invoque con la herramienta `Skill`.
