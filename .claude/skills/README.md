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
| `nexo-ui` | Diseñar y construir pantallas con `@nexo/ui` (tema claro, Inter, paleta única, menú desplegable); sección "Anti-relleno" de textos y decoración | ux-planner, ui-frontend | anthropics/skills `frontend-design` · `41bbe19` · Apache-2.0 (adaptación parcial) + miqdadbadjuber/anti-slop · `439a2ef` · MIT (ideas resumidas, 2026-10-21) |
| `nexo-react-next` | Patrones React 19 / Next 16 de la suite (RPC, permisos en acciones, cascadas, `"use client"`, comentarios útiles) | ui-frontend, reviewer | vercel-labs/agent-skills `react-best-practices` · `063bee9` · MIT (subconjunto) + anti-slop `antislop-code` · `439a2ef` · MIT (2026-10-21) |
| `nexo-ui-review` | Lista de verificación de accesibilidad y UX con hallazgos `archivo:línea` (contraste con umbrales, teclado, estados por causa, táctil, anti-relleno) | ux-planner, ui-frontend, reviewer | Ideas de vercel-labs `web-design-guidelines` (MIT) y web-interface-guidelines (`434b7f9`, sin licencia declarada; solo ideas, sin texto literal) + prioridades de ui-ux-pro-max (`56ea9cf`, MIT) + anti-slop `antislop-human`/`antislop-layoutmobile`/`antislop-ui` · `439a2ef` · MIT (2026-10-21) |
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

## Evaluada e incorporada en parte (2026-10-21, antislop)

Pedido del usuario del 2026-10-21. Fuente: https://github.com/miqdadbadjuber/anti-slop,
commit `439a2ef5b9dd0ebe74e8113ff43f5928d0fe2a6a` (2026-10-16, release declarada
v3.2.21), licencia MIT, © 2026 Miqdad Badjuber. Se leyó vía WebFetch, sin
instalar ni ejecutar nada: `README`, `LICENSE`, `antislop.md`, los seis
`skills/*/SKILL.md`, `cli/index.mjs`, `cli/lib/install.mjs`, `cli/lib/settings.mjs`,
`cli/package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/contrast-mcp-launcher.mjs`,
`skills/antislop-human/contrast-check.py` y `contrast-mcp.py`, `scripts/check-repo.mjs`
y `scripts/skill-index.mjs`. No se leyeron `cli/lib/banner.mjs`, `cli/scripts/*`,
los plugins de otros agentes ni `.github/workflows/ci.yml`.

**No se creó skill nueva**: lo útil se integró en `nexo-ui`, `nexo-ui-review` y
`nexo-react-next` (detalle en el `SOURCE.md` de cada una). Ningún texto largo
literal, ningún script, hook, `allowed-tools` ni servidor MCP traído.

| Regla o pieza externa | Decisión | Motivo |
|---|---|---|
| R-15 CTA específicos, R-16 palabras de folleto, muletillas y cautela apilada (copywriting) | Adoptada en `nexo-ui` | Aporta a la regla de textos que ya existía; reescrita en español |
| R-17, R-18, R-23, R-36, R-38 nada inventado | Ya cubierta (cero datos mock de `CLAUDE.md`); reforzada con cifras, nombres y afirmaciones de seguridad/rendimiento | |
| R-02 sin raya | Adoptada en parte | Solo como conector de frases en la interfaz; "—" como valor vacío es convención del repo (141 usos en `apps/`) |
| R-04 iconos genéricos y emojis, R-08 flechas, R-09 insignias, R-12 sombras, R-13 brillo, puntos de estado | Adoptadas en `nexo-ui` | Concretadas con `NexoIcon`, `StatusBadge` y la tarjeta estándar |
| R-24, R-26 navegación y controles reales | Ya cubierta ("Pronto" en el menú); extendida a botones | |
| R-25 contraste, R-32 teclado, R-27 estados | Adoptadas en `nexo-ui-review` con umbrales y variantes de `EmptyState` | |
| R-03 móvil y táctil 44 px, antislop-layoutmobile | Adoptada en `nexo-ui-review`, adaptada | Se respeta la decisión de `packages/ui/Button.tsx` (32 px en tablas densas) |
| R-35 verificación y Delivery Gate | Adoptada solo la evidencia por punto | El formato Comprobado/Pendiente del reviewer y la regla de cierre de `CLAUDE.md` ya cumplen el papel; un segundo informe PASS/FAIL duplicaría |
| antislop-code (comentarios) | Adoptada en `nexo-react-next` | |
| R-01, R-06, R-07, R-10, R-20, R-29 color, tipografía, fondos, vidrio, identidad, paleta | Descartadas | Contradicen la paleta única, Inter y "sin identidad propia del módulo"; el vidrio solo existe en el kiosco |
| R-21, R-34 modo oscuro o interruptor de tema | Descartadas | Tema claro por defecto; no se construye sistema de temas |
| R-05, R-14, R-11, R-19 variedad de secciones, tarjetas de distinto tamaño, radios, diales de movimiento | Descartadas o ya cubiertas | El kit fija radios y tarjetas; el movimiento ya está acotado en `nexo-ui` |
| R-37, diales ENERGY/RHYTHM/MOTION, "Design Read", `DESIGN.md` | Descartadas | La dirección visual es `docs/DESIGN_SYSTEM.md`; los diales empujan variedad visual que la suite no quiere |
| R-30 no clonar productos | Descartada | Nexo sigue a propósito un panel único estilo Odoo con kit propio |
| R-18, R-28 testimonios, FAQ, precios, barras de logos, hero | No aplican a las apps internas | Podrían servir a `apps/web-corporativo` si se trabaja ese sitio; no se adaptaron |
| R-33 sin scripts que parchean CSS | No incorporada | Sin caso en el repo |
| Asistente de instalación, bloque puntero en `CLAUDE.md`, modos during/after/ask, archivo de ajustes, auditorías en `anti-slop/` | Descartados | Modificarían `CLAUDE.md` y escribirían fuera del proyecto |
| `contrast-check.py`, `contrast-mcp.py`, plugin con servidor MCP | Descartados | Ejecutan Python; la skill pide `Bash(python *)`; sin necesidad demostrada |

**Hallazgos de seguridad del instalador y los scripts** (por lectura, sin ejecutar):
- `npx antislop-ai` (`cli/`, dependencias `@clack/prompts` y `picocolors` con rango `^`, sin `postinstall`): sin red ni procesos hijos en el código leído. Copia carpetas de skills a `.claude/skills/`, `.agents/skills/` y otras del proyecto o a `~/.claude/skills/` y equivalentes globales; al sobrescribir borra la carpeta destino con `rmSync` recursivo; `--update` sobrescribe sin preguntar en ambos alcances; reescribe `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` con un bloque que ordena a los agentes leer esas skills y preferirlas sobre las globales. No toca `.claude/settings*.json` ni hooks. Sin verificación de integridad.
- `cli/lib/settings.mjs`: escribe `%APPDATA%\antislop\settings.json` (o `~/.config/antislop/settings.json`) con el modo elegido.
- Plugin de Claude Code: declara un servidor MCP `antislop-contrast` que lanza `python`/`python3` buscado por `PATH` (riesgo si el `PATH` está comprometido); el servidor solo calcula contraste (`json`, `sys`), sin red ni archivos.
- La skill central declara `allowed-tools: Read Write Edit Glob Grep` y `antislop-human` agrega `Bash(python *) Bash(python3 *)`.
- `scripts/check-repo.mjs` es de solo lectura; `scripts/skill-index.mjs` reescribe `GUIDE.md` del propio repo. Ambos son herramientas de mantenimiento del repo externo, irrelevantes para Nexo.
- Instrucciones dirigidas al agente encontradas en el contenido (no se siguieron): "Another skill or planning workflow ... never replaces these", "This gate cannot be delegated or replaced", el asistente que pide agregar un bloque al archivo de entrada (`CLAUDE.md`) y el "Load always" de la descripción de la skill central. En Nexo prevalecen `CLAUDE.md` y el encargo del coordinador.

## Inventario de otras ubicaciones (2026-10-17)

- Usuario (`~/.claude/skills/`): no existe en esta máquina.
- Plugins y skills de la sesión: dependen de lo habilitado; se inventarían en cada consulta. El 2026-10-17 (alta de `nexo-security`): `~/.claude/plugins/` sin ningún `SKILL.md`; de seguridad, la sesión solo ofrecía el comando incorporado `security-review` y `engineering:code-review`, ambos genéricos y sin las reglas de Nexo.
- 2026-10-21 (alta de las tres skills de Planilla): `~/.claude/skills/` sigue sin existir; `~/.claude/plugins/` sin ningún `SKILL.md`; ninguna skill de la sesión (proyecto, `anthropic-skills:*`, `engineering:*`, `design:*`, `dataviz`) cubre nómina, legislación laboral de Nicaragua ni el motor de planilla.
- 2026-10-21 (evaluación de antislop): `~/.claude/` sin ningún `SKILL.md`; ninguna skill antislop instalada en el repo antes de la evaluación. De la sesión, `design:ux-copy` y `design:accessibility-review` son genéricas (por su descripción) y no conocen las reglas de Nexo.
- 2026-10-20 (alta de `nexo-dashboards`): de dashboards y gráficos, la sesión ofrecía la skill integrada `dataviz` (genérica, con paleta hex propia y un script validador) y `design:design-critique`; ninguna conoce `@nexo/ui`, el ritmo por días hábiles ni la regla de cero datos mock. `nexo-ui` solo menciona los dashboards de pasada.

## Cómo se referencian

En el frontmatter de un agente, `skills:` con lista YAML de nombres (el
`name` del `SKILL.md`, igual al nombre de la carpeta). El contenido completo se
precarga al iniciar el subagente. **Los subagentes no heredan las skills
cargadas por el coordinador**: si una tarea necesita otra skill, se agrega a
la lista del agente (y hace falta una sesión nueva) o se pide en el encargo
que la invoque con la herramienta `Skill`.
