# Design system de la suite — guía obligatoria

Esta guía se repite, literal, en el `CLAUDE.md` raíz del repo — por eso se
dispara sola cada vez que se trabaja en este monorepo con Claude Code, sin
depender de que alguien se acuerde de leerla primero (mismo mecanismo que
[PERMISSIONS.md](PERMISSIONS.md)).

Nace de un problema real: cada módulo se construyó (o se importó de un
repo separado) con su propia idea de header, tipografía y navegación —
nada de eso era consistente entre `apps/nexo`, `apps/crm`,
`apps/web-corporativo`. Esta guía es la versión **operativa** de la
investigación de [planning/DISENO_UX_UI.md](planning/DISENO_UX_UI.md)
(estudio de SAP Fiori y Odoo): qué es obligatorio, qué es libre, y el
checklist para cuando se cree o adapte un módulo nuevo.

La norma completa (paleta agnóstica, App Shell con launcher/omnibar/
notificaciones, sidebar contextual, Torre de Control, vistas PWA/kiosko y
reglas anti-fragmentación) vive en
[planning/NORMA_DISENO_UNIVERSAL.md](planning/NORMA_DISENO_UNIVERSAL.md) —
este documento se actualiza con el ejemplo real de código a medida que cada
pieza de esa norma se implementa. **Aviso**: esa norma describe la versión
dark/glass de 2026-09-02, hoy reemplazada por "Nexo Enterprise UI" (ver
abajo) — tratarla como historia de diseño, no como estado vigente del
tema visual.

## Principio: un solo sistema de diseño, sin identidad propia por módulo

**Revisado (2026-08-30) — ya no hay "contenido con identidad propia".**
La versión anterior de este principio (inspirada en SAP Fiori/Odoo) dejaba
la tipografía y paleta del contenido libres por módulo; en la práctica eso
produjo el CRM con su propia marca industrial (`concreto`/`acero`/`naranja`,
`Archivo Black`/`Work Sans`/`IBM Plex Mono`) — que, aun con la barra
superior unificada, seguía sintiéndose como un software distinto por
dentro. Decisión explícita del usuario: **toda la suite, barra Y
contenido, usa el mismo sistema de diseño** — paleta neutra + acento azul,
tipografía Inter, mismos componentes de `@nexo/ui`. Ningún módulo nuevo
adopta tipografía ni paleta de marca propia, ni siquiera puertas adentro.

Lo único que distingue un módulo de otro es el **color de categoría**
(ver tabla de tokens abajo) en el ícono del App Launcher y en acentos
puntuales — nunca en tipografía, ni en la paleta general de
botones/inputs/tarjetas.

## Regla obligatoria: Nexo Enterprise UI — tema claro por defecto

**Revisado (2026-09-07) — reemplaza la regla anterior ("dark mode por
defecto + glassmorphism", 2026-09-02).** Decisión explícita del usuario:
"Nexo Enterprise UI" es la dirección visual aprobada de toda la suite —
tema **claro** por defecto (`ShellBar`/`Sidebar` de la norma anterior ya
eran claros por decisión de 2026-08-30 y nunca se migraron a dark/glass;
lo que cambia acá es el resto del contenido — RRHH, que sí había migrado a
dark/glass en su dashboard/`AppShell`, vuelve a claro también — y el
diseño del shell en sí: sidebar azul persistente, topbar con breadcrumb).

Componentes obligatorios del shell:

- **sidebar azul persistente**, colapsable en desktop (icon-only), off-canvas
  (`Drawer`) en mobile/tablet — nunca fijo en pantalla angosta;
- **topbar** con breadcrumb automático (calculado a partir del árbol de
  navegación + la ruta actual, no armado a mano por cada página),
  buscador, notificaciones y avatar de usuario;
- contenido claro, cards blancas, dashboards compactos de alta densidad
  con KPIs **reales** — regla de "cero datos mock": una métrica sin fuente
  real hoy se muestra como "Pendiente de integración"/"Pendiente de
  consolidación" o un `EmptyState`, nunca un número inventado.

**`AppShell`, `ShellBar`, `Sidebar` y `StatCard` quedaron retirados de
`packages/ui`** (verificado con un grep de `"@nexo/ui"` en todo el
monorepo, incluida `apps/flotilla`, antes de eliminarlos — nada fuera de
`apps/nexo`/`apps/rrhh`/`apps/crm` los consumía). Los reemplaza el kit
"Nexo Enterprise UI", todo en `packages/ui`, única fuente compartida
(ningún módulo duplica shell/topbar/sidebar/tablas/KPIs):

| Nuevo | Reemplaza a | Rol |
|---|---|---|
| `NexoShell` | `AppShell` + `ShellBar` + `Sidebar` + el `Header`/`AppSidebar` que cada módulo duplicaba | Orquestador: breadcrumb automático, collapse/Drawer compartido, monta `ToastProvider` una vez |
| `NexoSidebar` | `Sidebar` | Sidebar azul con grupos anidados de un nivel, ítems sin `href` se ven deshabilitados ("Próximamente") |
| `NexoTopbar` | `ShellBar` | Breadcrumb + buscador + notificaciones + avatar |
| `MetricCard` | `StatCard` | Tile de KPI, tema claro |
| `Breadcrumb`, `PageHeader`, `DashboardHero`, `ActivityFeed`, `QuickActions`, `DataTable`, `FilterBar`, `StatusBadge`, `FormTabs`, `FormSection`, `EmptyState`, `ConfirmDialog`, `Toast`/`useToast` | — (100% nuevos) | Ver el componente para su rol puntual |

`Toast`/`useToast` **no** reimplementan un sistema de notificaciones desde
cero: envuelven `sonner` (ya era una dependencia real y en uso en
`apps/crm`/`apps/rrhh` — ver `apps/crm/src/components/ClienteForm.tsx`).
Es el único archivo de la suite que importa `"sonner"` directo
(`packages/ui/Toast.tsx`); los `<Toaster>` sueltos que vivían en los
layouts raíz de RRHH/CRM se retiraron a favor del que monta `NexoShell`.

**El tema oscuro + `.nexo-glass` sigue existiendo**, en `tokens.css`, pero
acotado exclusivamente a `apps/rrhh/src/app/kiosco` (pantalla inmersiva de
marcación — pinta su propio fondo a pantalla completa, independiente del
resto del layout). Ningún componente del kit Enterprise UI lo usa. Dark
como opción general de tema podrá volver más adelante — no se reconstruye
un sistema completo de temas si no existe.

**Árbol de navegación de referencia** (ítem sin `href` y sin `children` =
deshabilitado/"Próximamente" en `NexoSidebar` — no se crea una página
placeholder por cada funcionalidad futura; excepción: un placeholder
histórico ya existente, como `apps/rrhh/.../planillas/page.tsx`, se
conserva tal cual):

```text
Nexo
├── Dashboard
├── RRHH
├── CRM
├── Transporte        (sin href — Flotilla no está en Multi-Zones todavía)
├── Fabricación        (sin href — no existe todavía)
└── Configuración → Marca

RRHH
├── Dashboard
├── Expedientes
│   ├── Empleados
│   └── Documentos     (sin href — pendiente de modelo de datos)
├── Contratación
│   ├── Contratos      (listado global de solo lectura)
│   ├── Jornadas
│   └── Feriados
├── Asistencia
│   ├── Marcas          (sin href — F1.5)
│   ├── Incidencias     (sin href — F1.6)
│   ├── Justificaciones (sin href — F1.6)
│   └── Kioskos
├── Planillas          (placeholder histórico conservado)
└── Configuración
    ├── Puestos         (sin href)
    ├── Departamentos   (sin href)
    └── Catálogos       (sin href)

CRM
├── Dashboard
└── Clientes
```

## Regla obligatoria: todo módulo aterriza en su Dashboard de KPIs

**La ruta raíz de cada módulo (`/`, bajo su propio `basePath`) redirige
siempre a un `/dashboard` propio del módulo, con los KPIs principales de
esa área — nunca a una lista vacía ni a una página en blanco esperando que
el usuario haga clic en el sidebar.** No alcanza con redirigir a la
primera sección de contenido (ej. una tabla): tiene que ser una vista de
métricas, con al menos 2-3 tarjetas de KPI reales del módulo (`MetricCard`).

Referencia: [`apps/crm/src/app/(app)/dashboard/page.tsx`](../apps/crm/src/app/(app)/dashboard/page.tsx)
(total de clientes, nuevos este mes, distribución por tipo),
[`apps/rrhh/src/app/(app)/dashboard/page.tsx`](../apps/rrhh/src/app/(app)/dashboard/page.tsx)
(expedientes, contratos activos, marcas del día, planillas pendientes) y
[`apps/nexo/src/app/(app)/page.tsx`](../apps/nexo/src/app/(app)/page.tsx)
(Torre de Control: bienvenida + módulos habilitados + grid de módulos).

Al crear o adaptar un módulo nuevo:

1. `/dashboard` es la primera entrada del árbol de `NexoSidebar`, siempre.
2. Las tarjetas de KPI son datos reales del módulo (conteos, sumas,
   distribuciones) — no placeholders ni datos de ejemplo. Sin fuente real
   todavía, usar "Pendiente de integración"/"Pendiente de consolidación"
   con `tone="pending"` en `MetricCard`, nunca un número inventado.
3. Un gráfico simple (barras de distribución, como en el CRM) es
   suficiente para el MVP de cada módulo.

## Regla obligatoria: navegación dentro del módulo usa `next/link`, nunca `<a>` plano

**Todo link que navega dentro del mismo módulo (sidebar, tabs, breadcrumbs,
cualquier `<Link>`/botón que cambia de página sin cruzar de módulo) usa
`next/link`, nunca un `<a href>` nativo.** El `basePath` de Next.js
(`/crm`, `/rrhh`, `/flotilla`...) se aplica automáticamente a `next/link` y
`router.push`, pero **no** a un `<a>` nativo — un `<a href="/clientes">`
navega el navegador literalmente a `nexo.materialesjcastillo.com/clientes`
(la zona del panel, que no tiene esa ruta) en vez de `.../crm/clientes`, y
produce un 404 real en producción, no solo un error de desarrollo.

Bug real que esto corrigió (histórico): el `Sidebar.tsx` original
renderizaba sus ítems con `<a href={item.href}>` — compilaba sin error,
funcionaba en local por coincidencia y rompía en producción real.
`NexoSidebar` usa `next/link` en cada ítem.

**La única excepción, a propósito, es `BackToPanelLink`** (ver
[`packages/ui/BackToPanelLink.tsx`](../packages/ui/BackToPanelLink.tsx),
usado dentro de `NexoSidebar` cuando se le pasa `backHref`): ese sí es un
`<a>` plano, porque cruza de módulo — cruza de *zona* en Multi-Zones, así
que necesita una navegación real del navegador, nunca client-side routing.

## Regla obligatoria: `NexoShell`/`NexoTopbar` son LA barra superior, no una opción

**Ningún módulo construye su propio header/sidebar para reemplazar el
shell persistente.** `NexoShell` de `@nexo/ui` (que arma `NexoSidebar` +
`NexoTopbar` por dentro) **es** ese shell — se usa tal cual desde el
layout autenticado del módulo (`items`, `moduleLabel`, `backHref`,
`userEmail`, `onSignOut`), nunca como inspiración para un componente
propio. Ver
[`apps/rrhh/src/app/(app)/layout.tsx`](../apps/rrhh/src/app/(app)/layout.tsx),
[`apps/crm/src/app/(app)/layout.tsx`](../apps/crm/src/app/(app)/layout.tsx) y
[`apps/nexo/src/app/(app)/layout.tsx`](../apps/nexo/src/app/(app)/layout.tsx) —
los tres son wrappers delgados de `NexoShell`, cero lógica de shell propia.

## Regla obligatoria: volver al panel, siempre visible

**Todo módulo autenticado tiene que ofrecer una forma persistente de
volver a la grilla de módulos de Nexo.** Antes de dar por terminado un
módulo nuevo (o una página nueva de un módulo existente), verificá:

1. El layout autenticado pasa `backHref` a `NexoShell` (regla de arriba)
   — o, en una pantalla fuera del layout autenticado normal (ej.
   `sin-acceso`, que no puede montar el layout sin caer en loop de
   redirect), al menos `BackToPanelLink` de `@nexo/ui` suelto.
2. La URL que le pasás sale de un helper `getPanelUrl()` propio de tu app
   (ver [`apps/crm/src/lib/panel.ts`](../apps/crm/src/lib/panel.ts)) — **no
   la hardcodees**. Se duplica a propósito en cada app — cada zona de
   Multi-Zones es un proceso independiente, no comparten runtime.
3. Páginas fuera del layout autenticado normal pero que igual son parte
   del módulo (ej. `sin-acceso`) también lo incluyen.
4. La única pantalla que **no** lleva este link es el panel mismo
   (`apps/nexo`) — no hay a dónde volver desde home (`NexoShell` ahí se
   monta sin `backHref`).

## Tokens compartidos (`packages/ui/tokens.css`)

| Token | Valor | Uso |
|---|---|---|
| `--nexo-enterprise-bg` | `#F3F4F6` (neutral-100) | Fondo base de la app — **por defecto desde 2026-09-07** |
| `--nexo-enterprise-surface` | `#FFFFFF` | Cards, topbar |
| `--nexo-enterprise-border` | `#E5E7EB` (neutral-200) | Bordes |
| `--nexo-enterprise-sidebar-bg` | `#0F2A5C` | Fondo del sidebar azul persistente |
| `--nexo-enterprise-sidebar-active` | `#1D4ED8` (blue-700) | Ítem activo del sidebar |
| `--nexo-enterprise-accent` / `-hover` | `#2563EB` / `#1D4ED8` (blue-600/700) | Botón primario, foco de inputs, links |
| `--nexo-bg` / `--nexo-shell-fg` / `.nexo-glass` | ver `tokens.css` | **Solo kiosko** (pantalla inmersiva) — ningún componente Enterprise UI los usa |
| Categoría Finanzas | verde `#DCFCE7` / texto `#166534` | `packages/ui/category-colors.ts` — solo iconos del launcher |
| Categoría Ventas | rosa `#FCE7F3` / texto `#9D174D` | ídem — CRM vive acá |
| Categoría Cadena de suministro | morado `#F3E8FF` / texto `#6B21A8` | ídem — Flotilla vive acá |
| Categoría RRHH | ámbar `#FEF3C7` / texto `#92400E` | ídem |
| Categoría Servicios | índigo `#E0E7FF` / texto `#3730A3` | ídem |
| Tipografía | [Inter](https://fonts.google.com/specimen/Inter) | Toda la suite — barra Y contenido |

**Categoría nueva** (ej. al adaptar un módulo que no encaja en las 5 de
arriba): agregala a `CATEGORY_COLORS` en
[`packages/ui/category-colors.ts`](../packages/ui/category-colors.ts) y a
esta tabla en el mismo commit.

## Checklist al crear o adaptar un módulo

1. `core.apps.category` usa una categoría de la tabla de arriba (o se
   agrega una nueva siguiendo el paso anterior).
2. El layout autenticado del módulo renderiza `NexoShell` con `items`
   (árbol `NexoNavItem[]`), `backHref` y `onSignOut` — ver la regla
   obligatoria arriba. Sin lógica de shell propia.
3. **`globals.css` de la app agrega, en este orden:**
   `@import "tailwindcss";`, luego
   `@import "../../../../packages/ui/tokens.css";` (variables
   `--nexo-enterprise-*` que usa `NexoShell`/`NexoSidebar`/`NexoTopbar` —
   sin esto, esas clases `bg-[var(--nexo-enterprise-*)]` resuelven a
   nada), y `@source "../../../../packages/ui/**/*.{ts,tsx}";` (Tailwind
   v4 solo escanea el árbol de la propia app por default — sin este
   `@source`, cualquier clase usada *solo* dentro de `@nexo/ui` nunca se
   genera: el componente compila sin error pero se renderiza roto).
4. Si el módulo necesita un componente de datos genérico (tabla, tarjeta
   de estadística, selector de vista) que ya existe en otro módulo,
   reusalo desde `packages/ui` en vez de duplicarlo. `apps/flotilla`
   (Sidebar/`StatCard` propios) sigue fuera de este kit — no está
   adaptado a Multi-Zones todavía, se migra en su fase correspondiente.
5. El contenido del módulo usa Inter y la paleta clara de la tabla de
   arriba — **no** una tipografía o paleta de marca propia.
6. La raíz del módulo (`page.tsx` en `/`) redirige a `/dashboard`, con
   KPIs reales — ver la regla obligatoria de arriba.
7. Ítems del árbol de navegación sin pantalla real todavía se agregan sin
   `href` (se ven deshabilitados/"Próximamente") — no se crea una página
   placeholder por cada uno.
