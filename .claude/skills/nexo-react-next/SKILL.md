---
name: nexo-react-next
description: Patrones de rendimiento y corrección para React 19 / Next.js 16 en las apps de Nexo (Server Components, Server Actions, RPC de Supabase, Multi-Zones). Usar al escribir, refactorizar o revisar código de páginas, layouts, acciones o componentes cliente en apps/*.
---

# Nexo React/Next — patrones verificados para la suite

Adaptación estable al proyecto. Fuente y licencia: [SOURCE.md](SOURCE.md). Solo
incluye reglas que aplican a cómo está hecho Nexo; no es la guía completa de
la fuente.

## Cuándo se utiliza

- Implementar o revisar `page.tsx`, `layout.tsx`, `actions.ts` o componentes `"use client"` en `apps/*`.
- No aplica a `apps/flotilla` (Next 16.2, sin adaptar a Nexo) salvo en su fase de adaptación.

## Contexto que debe consultar

1. `apps/<app>/AGENTS.md` cuando exista: Next.js 16 cambia APIs; la guía está en `node_modules/next/dist/docs/`.
2. `CLAUDE.md`: Multi-Zones con `basePath` por app, `proxy.ts` (no `middleware.ts`), login único, permisos.
3. Un módulo de referencia ya adaptado: `apps/productos` o `apps/atencion`, que tienen toda la lógica en RPC.

## Procedimiento — reglas por prioridad

**1. Sin cascadas (crítico)**
- Lanza juntas las lecturas independientes con `Promise.all` (permisos, RPC, `auth.getUser()`), como ya hacen los layouts.
- Haz primero la comprobación barata (formato del parámetro, `notFound()`) y solo después el `await` costoso.

**2. Servidor (alto)**
- Toda Server Action valida sesión y permiso: `requirePermission(ctx, código)` **antes** de cualquier efecto. Es igual de pública que un endpoint.
- La lógica que necesitará Mobile vive en una RPC de Postgres (`security definer`, `search_path` fijo). La Server Action solo adapta.
- Pasa a los componentes cliente solo los datos que necesitan, nunca filas completas ni campos sensibles: lo que se serializa llega al navegador.
- Nada de estado mutable por solicitud a nivel de módulo en código de servidor.
- **No exportes valores (constantes, objetos) desde un archivo `"use client"` para usarlos en el servidor**: llegan como referencia de cliente. Ponlos en `src/lib/`. Error real del 2026-10-17 en Productos.

**3. Paquete del navegador (alto)**
- Las librerías pesadas solo del cliente se cargan con `import()` dinámico al usarlas (p. ej. `read-excel-file`/`write-excel-file` en Productos).
- No importes módulos de servidor (`@/lib/supabase/server`) en archivos `"use client"`.

**4. Renderizado y estado del cliente (medio)**
- El estado derivado se calcula al renderizar, no con `useEffect` + `setState` (la regla `react-hooks` del lint lo marca).
- Usa `useTransition` para acciones pendientes (`isPending`) en lugar de banderas manuales.
- No definas componentes dentro de otros componentes.
- En renderizado condicional con números, ternario en vez de `&&` (evita pintar `0`).
- Inicialización costosa: `useState(() => valor)`.

**5. Navegación y zonas**
- Dentro del módulo, `next/link` y `router.push`; el `basePath` se aplica solo ahí. Usa `<a>` plano únicamente para cruzar de zona.
- Las rutas con estado (filtros, página) reflejan su estado en la URL (`searchParams`), como el listado de Productos.

**6. Comentarios en el código (bajo)**
Ideas de antislop-code (MIT, ver [SOURCE.md](SOURCE.md)). Aplica al código que
se escribe o toca en la tarea; no se reescriben comentarios ajenos al diff.
- Un comentario dice algo que el código no muestra: el porqué, una regla de negocio, una decisión del kit, un caso borde, un riesgo de seguridad o de rendimiento, un contrato con una RPC. Ejemplo del repo: el comentario de tamaños en `packages/ui/Button.tsx` explica por qué `sm` queda en 32 px.
- No se escriben: comentarios que repiten la línea siguiente ("// Inicializa el estado"), narración por pasos ("Paso 1", "Ahora…"), etiquetas vacías ("Función auxiliar", "Lógica principal"), JSDoc que solo repite la firma, marcas de cierre (`} // fin if`), banners de `====` o mayúsculas, emojis.
- Un `TODO` nombra la tarea concreta y su contexto, o no se escribe.
- Uno por bloque lógico, no uno por línea; una o dos líneas, en español y escritas como una frase normal (sin mayúsculas sostenidas).
- Cuando se limpian comentarios, no se cambia nada más: ni código, ni nombres, ni formato.

## Restricciones

- No cambiar `basePath`, rewrites de `apps/nexo/next.config.ts`, `proxy.ts` ni la autenticación sin aprobación del coordinador.
- No agregar SWR, React Query ni otra capa de datos: el patrón vigente es Server Component + RPC + `router.refresh()`.
- `@nexo/ui` se importa desde su índice (es un barrel). No se refactoriza por rendimiento sin una medición que lo justifique.

## Entregables

- Código conforme a estas reglas, más una nota de qué reglas aplicaron y cualquier excepción justificada.
- En revisión: hallazgos con el id de la regla (p. ej. "servidor: permiso antes del efecto").

## Comprobaciones

- `npx.cmd --yes pnpm@9.15.9 --filter <app> run typecheck` (incluye `next typegen`), `run lint` y, si cambian rutas o configuración, `run build`.
- Buscar en el diff `"use client"` junto a `export const` de datos usados por el servidor, y Server Actions sin `requirePermission`.

## Si falta información o una herramienta

- Duda sobre una API de Next 16: lee la documentación en `node_modules/next/dist/docs/`; no supongas el comportamiento de versiones anteriores.
- No hay RPC para lo que pide la tarea: no la inventes desde la UI. Repórtalo al coordinador, porque crear RPC implica migración y Paso Cero.
- No se puede ejecutar el build (falta de memoria o tiempo): dilo en la entrega; typecheck y lint siguen siendo obligatorios.
