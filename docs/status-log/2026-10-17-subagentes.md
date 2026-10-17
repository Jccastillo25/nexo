# 2026-10-17 — Sistema de trabajo con subagentes

- **Pedido del usuario:** configurar un coordinador, un especialista en skills, ejecutores y un revisor independiente, implementarlo y comprobarlo. El texto llegó cortado al final ("SK…").
- **Estado anterior → nuevo:** sin `.claude/agents/` ni `.claude/skills/` → cuatro subagentes de proyecto, el registro de skills y la sección del coordinador en `CLAUDE.md`. Sin commit (el usuario quiere un solo despliegue).

## Inspección

- `CLAUDE.md` raíz se conserva íntegro: solo se le agregó contenido. Los `AGENTS.md`/`CLAUDE.md` de `apps/crm`, `flotilla` y `web-corporativo` son los avisos que genera `next dev` y no se tocaron. En `.claude/` solo había `launch.json`.
- Claude Code instalado: 2.1.299 (también 2.1.295) dentro de la app de escritorio. La CLI suelta no tiene sesión iniciada.
- Campos de frontmatter tomados de la documentación oficial (`code.claude.com/docs/en/sub-agents` y `/skills`).

## Archivos

- `.claude/agents/skills-specialist.md`: herramientas Read, Glob, Grep, WebFetch, WebSearch, Write y Edit; solo escribe en `.claude/skills/`.
- `.claude/agents/ux-planner.md`: solo lectura.
- `.claude/agents/ui-frontend.md`: herramientas de edición y terminal, más `Skill`.
- `.claude/agents/reviewer.md`: sin Write ni Edit; terminal solo para comprobaciones.
- Los cuatro tienen `Agent` deshabilitado y usan `model: inherit`.
- `.claude/skills/README.md`: inventario inicial (ninguna skill) y tabla de procedencia.
- `CLAUDE.md`: sección "Sistema de trabajo con subagentes" con el flujo del coordinador en seis pasos y las tareas que solo hace el coordinador.

## Comprobación

- Campos y valores: solo se usan `name`, `description`, `tools`, `disallowedTools`, `model` y `color`, todos documentados. No aparecen advertencias de "does not recognize" en el log de `claude --debug` (2.1.299), aunque la ejecución se detuvo al pedir login.
- `claude plugin validate` pasó, pero con un control negativo (un archivo roto) también pasó, así que **no sirve como prueba** de los agentes.
- **Carga en vivo:** la sesión en curso no ve los agentes nuevos (`Agent type 'reviewer' not found`), porque Claude Code los carga al iniciar la sesión. **Pendiente:** confirmarlo en una sesión nueva.
- Revisión independiente con un agente genérico que siguió `reviewer.md`. Encontró 2 hallazgos de gravedad media, los dos aplicados: (1) el revisor tiene terminal, así que el límite de escritura es por instrucción y los artefactos de build se aceptan; (2) la escritura del especialista no se puede restringir por ruta. Notas aplicadas: responsivo "no comprobado visualmente" en ui-frontend, y la verificación remota y visual a cargo del coordinador. La regla de proporcionalidad del coordinador queda señalada para que el usuario la confirme.

## Segunda parte: skills y validación (mismo día)

El usuario envió la sección que faltaba (SKILLS, ASIGNACIÓN, OPERACIÓN,
VALIDACIÓN, ENTREGA).

**Skills incorporadas** en `.claude/skills/`, cada una con `SKILL.md` (cuándo, contexto, procedimiento, restricciones, entregables, comprobaciones, qué hacer si falta información) y `SOURCE.md` (fuente, commit, licencia, qué se tomó y qué se descartó):

- `nexo-ui`: adaptación parcial de anthropics/skills `frontend-design` (`41bbe19`, Apache-2.0). Se descartó la búsqueda de identidad visual propia porque contradice la regla de paleta única.
- `nexo-react-next`: subconjunto de vercel-labs `react-best-practices` (`063bee9`, MIT) más reglas propias de Nexo.
- `nexo-ui-review`: lista fija de verificación, inspirada en vercel-labs `web-design-guidelines` y en web-interface-guidelines (`434b7f9`). No se instaló la original porque descarga reglas remotas en cada uso. Toma además las prioridades de ui-ux-pro-max (`56ea9cf`, MIT), que no se instaló porque requiere Python y su paleta y fuentes contradicen la suite.

**Asignación (`skills:` del frontmatter, soportado en 2.1.299):** ux-planner → nexo-ui y nexo-ui-review; ui-frontend → las tres; reviewer → nexo-ui-review y nexo-react-next. `CLAUDE.md` suma las reglas de operación, el formato del encargo y el comando para iniciar una sesión nueva.

**Validación con delegación real**, en la sesión nueva "Prueba de delegación: coordinador y 4 subagentes" (los agentes se cargan al iniciar la sesión):

- Paso 0: `Agent` ofrece los 4 tipos y `Skill` lista las 3 skills.
- skills-specialist: inventarió las 3 skills y recomendó nexo-ui-review como principal para diagnosticar el menú.
- ux-planner: analizó el flujo Productos → Configuración → Marcas, con permisos, estados y 3 criterios de aceptación.
- ui-frontend: confirmó que tenía las 3 skills precargadas. Hizo el diagnóstico sin editar; `typecheck` y `lint` de `nexo-productos` terminaron con exit 0.
- reviewer: confirmó las citas y corrigió 4 puntos (ver más abajo).
- Ningún subagente escribió: `git status` y los SHA256 de los 29 archivos sucios son idénticos antes y después. Las comprobaciones solo escribieron en `.next/`, que git ignora.

**Corrección de configuración aplicada:** `skills-specialist` recibe la herramienta `Skill`, para inventariar las skills de plugins y de la sesión, solo para consultar.

**Hallazgos de producto de la prueba** (no corregidos: la instalación no cambia funcionalidad):

1. Productos `nav.ts`: Configuración aparece antes que Precios, lo que incumple la regla del menú.
2. `NexoSidebar` no oculta los grupos sin hijos: los pinta como "Pronto".
3. `configuracion/[catalogo]/page.tsx:48` y `clasificacion/page.tsx:32` muestran `error.message` crudo.
4. `configuracion/actions.ts:37` deja pasar errores técnicos (permiso revocado con código interno, uuid inválido, fallos de red).
5. `Toast.tsx` no tiene `aria-live`.
6. Falta `focus-visible` en los botones de `paneles.tsx` y `aria-expanded` en los grupos del sidebar.

## Pendiente

- ~~Los 6 hallazgos de producto, como tarea aparte.~~ Corregidos en local el
  mismo día: [2026-10-17-hallazgos-ui-productos.md](2026-10-17-hallazgos-ui-productos.md).
- Que se cumplan por técnica los límites de escritura del reviewer y del especialista. Hoy son por instrucción, porque el reviewer tiene shell. Opciones: hooks `PreToolUse` en el frontmatter del agente, o reglas `deny` en `.claude/settings.json`, que también afectarían a la sesión principal.
- Medir las skills adaptadas frente a las originales en una tarea real; hoy no hay evaluación medida.
