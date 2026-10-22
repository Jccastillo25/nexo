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
| `nexo-security` | Lista de seguridad: permisos v3.0, RLS/GRANT (patrones A y B), `security definer` + `fn_exigir_permiso`, errores, SSO/open redirect, secretos, validación de entrada; consultas remotas de solo lectura en `consultas-remotas.md` | reviewer | Creación propia (2026-10-17). Ideas, sin texto literal, de anthropics/claude-code-security-review (MIT, commit no visible), supabase/agent-skills `supabase-postgres-best-practices` v1.1.1 (MIT), docs de Supabase (functions, database advisors; sin licencia declarada, solo hechos técnicos) y guía Data Security de Next.js (repo vercel/next.js, MIT) |
| `nexo-dashboards` | Método para Dashboards de KPIs: preguntas por rol, ficha de KPI (fórmula, fuente, permiso, comparación, umbral), pirámide, formas de visual (hero, bullet, acumulado vs. ritmo, ranking), estados (sin datos ≠ error), ritmo por días hábiles con umbral único, checklist de revisión. Catálogo de KPIs por dominio en `references/` | ux-planner, ui-frontend, reviewer | Creación propia (2026-10-20) sobre el Dashboard de Presupuesto aprobado ese día. Ideas, sin texto literal, de la skill integrada `dataviz` de Claude Code (bundled-skills 2.1.304, sin licencia declarada; no se usan su paleta ni su script) y de la especificación de *bullet graph* de Stephen Few (vía fuentes secundarias) |
| `nexo-planilla-legal` | Marco legal de Nicaragua y fórmulas de planilla (INSS, INATEC, IR, salario diario, horas extra, feriados, vacaciones, aguinaldo, indemnización art. 45 por causa, liquidación, provisiones, préstamos y embargos), régimen laboral o de servicios profesionales por contrato, grado de certeza de cada dato y casos dorados (liquidación de C$45,021.66) | ux-planner, ui-frontend, reviewer (2026-10-21); el coordinador la invoca con `Skill` | Creación propia (2026-10-21) sobre `docs/plan/20-planilla.md`. Datos "verificar" contrastados el 2026-10-21 con el Código del Trabajo en Justia Nicaragua y la Ley 822 compilada en nicatributos (secundarias; resumen propio, sin texto literal). Sin código de AG Planilla |
| `nexo-planilla-motor` | Modelo de datos y motor en RPC: `contrato_regimen`, conceptos, tipos, `planilla_lineas` y `novedades` particionadas, préstamos, embargos, vacaciones, provisiones, liquidaciones, tramos de IR; orden de cálculo, redondeo, idempotencia, estados con separación de funciones, auditoría, pruebas doradas en PGlite, ensayo en transacción revertida; checklist del reviewer | reviewer (2026-10-21); el coordinador la invoca con `Skill` al escribir migraciones o RPC | Creación propia (2026-10-21) sobre el plan 20 §7–§8 y patrones verificados en `supabase/migrations/` y `supabase/tests/`. Sin fuentes externas |
| `nexo-planilla-flujos` | UX de Planilla: mapa de AG Planilla a un menú desplegable (dos opciones según la decisión 5), flujos (período, novedades, cálculo, comparativo, aprobación, pago, colillas, vacaciones, préstamos, liquidación, declaraciones, simulador de régimen), permiso por pantalla y acción, estados y KPIs | ux-planner, ui-frontend, reviewer (2026-10-21) | Creación propia (2026-10-21) sobre el plan 20 §1.2, §6, §8 y la navegación real de `apps/rrhh`. Sin fuentes externas |

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

## Evaluadas y no incorporadas (2026-10-21, Planilla)

| Fuente o propuesta | Motivo |
|---|---|
| Coati Payroll (BMO Soluciones), citado en el plan 20 §11 | Licencia no confirmada; no se consultó ni se tomó nada |
| Manuales o textos de AG Planilla | Software propietario y sin manuales públicos; solo se usa el funcionamiento ya descrito en el plan 20 |
| Skill aparte de migración de datos desde AG | Propuesta, no creada: depende de la decisión 7 del plan 20 (arranque en enero o a mitad de año) y de conocer qué exporta AG. El modelo de `nexo-planilla-motor` ya deja la tabla propuesta `saldos_iniciales` |

## Inventario de otras ubicaciones (2026-10-17)

- Usuario (`~/.claude/skills/`): no existe en esta máquina.
- Plugins y skills de la sesión: dependen de lo habilitado; se inventarían en cada consulta. El 2026-10-17 (alta de `nexo-security`): `~/.claude/plugins/` sin ningún `SKILL.md`; de seguridad, la sesión solo ofrecía el comando incorporado `security-review` y `engineering:code-review`, ambos genéricos y sin las reglas de Nexo.
- 2026-10-21 (alta de las tres skills de Planilla): `~/.claude/skills/` sigue sin existir; `~/.claude/plugins/` sin ningún `SKILL.md`; ninguna skill de la sesión (proyecto, `anthropic-skills:*`, `engineering:*`, `design:*`, `dataviz`) cubre nómina, legislación laboral de Nicaragua ni el motor de planilla.
- 2026-10-20 (alta de `nexo-dashboards`): de dashboards y gráficos, la sesión ofrecía la skill integrada `dataviz` (genérica, con paleta hex propia y un script validador) y `design:design-critique`; ninguna conoce `@nexo/ui`, el ritmo por días hábiles ni la regla de cero datos mock. `nexo-ui` solo menciona los dashboards de pasada.

## Cómo se referencian

En el frontmatter de un agente, `skills:` con lista YAML de nombres (el
`name` del `SKILL.md`, igual al nombre de la carpeta). El contenido completo se
precarga al iniciar el subagente. **Los subagentes no heredan las skills
cargadas por el coordinador**: si una tarea necesita otra skill, se agrega a
la lista del agente (y hace falta una sesión nueva) o se pide en el encargo
que la invoque con la herramienta `Skill`.
