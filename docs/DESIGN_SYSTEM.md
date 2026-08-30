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
pieza de esa norma se implementa.

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
puntuales (ej. el borde de un widget de la Torre de Control) — nunca en
tipografía, ni en la paleta general de botones/inputs/tarjetas.

## Regla obligatoria: `ShellBar` es LA barra superior, no una opción

**Ningún módulo construye su propio header para reemplazar la barra
superior persistente.** `ShellBar` de `@nexo/ui` **es** esa barra — se
usa tal cual (con las props que necesite: `title`, `titleHref`, `backHref`,
`userEmail`, `onSignOut`), nunca como inspiración para un componente propio.
Así se ve y se comporta exactamente igual en toda la suite, que es todo el
punto del principio de arriba.

Esta regla nació de un bug real: el CRM tenía su propio header (paleta
`concreto`/`acero`/`naranja`, `font-mono`) que solo importaba
`BackToPanelLink` — cumplía la letra de la regla vieja pero producía dos
diseños de navegación completamente independientes, justo lo que esta
guía existe para evitar. Corregido en
[`apps/crm/src/components/Header.tsx`](../apps/crm/src/components/Header.tsx):
hoy es un wrapper delgado de `ShellBar`. En una segunda pasada (mismo día)
se extendió la corrección al **contenido** también — el CRM ya no tiene
ninguna paleta ni tipografía propia (ver el principio revisado arriba):
`apps/crm/src/app/(app)/clientes/page.tsx` y el resto de sus páginas usan
los mismos tokens neutros/azul que el panel.

## Regla obligatoria: volver al panel, siempre visible

**Todo módulo autenticado tiene que ofrecer una forma persistente de
volver a la grilla de módulos de Nexo — visible en toda página, no solo
en la de inicio del módulo.** Antes de dar por terminado un módulo nuevo
(o una página nueva de un módulo existente), verificá:

1. El header/shell de la página autenticada es `ShellBar` con la prop
   `backHref` (regla de arriba) — o, en una pantalla fuera del layout
   autenticado normal (ej. `sin-acceso`, que no puede montar el layout sin
   caer en loop de redirect), al menos `BackToPanelLink` de `@nexo/ui`
   suelto.
2. La URL que le pasás sale de un helper `getPanelUrl()` propio de tu app
   (ver [`apps/crm/src/lib/panel.ts`](../apps/crm/src/lib/panel.ts)) — **no
   la hardcodees**. El patrón es siempre el mismo: `NEXO_PANEL_URL` como
   override opcional, si no está seteada cae al origin de la propia
   request (correcto en producción sin configurar nada extra, porque
   Multi-Zones sirve todo bajo el mismo dominio público). Se duplica a
   propósito en cada app — cada zona de Multi-Zones es un proceso
   independiente, no comparten runtime.
3. Páginas fuera del layout autenticado normal pero que igual son parte
   del módulo (ej. una pantalla de "sin acceso" como
   [`apps/crm/src/app/sin-acceso/page.tsx`](../apps/crm/src/app/sin-acceso/page.tsx))
   también lo incluyen — es ahí donde más falta hace, porque es a donde
   llega alguien que no puede usar el módulo.
4. La única pantalla que **no** lleva este link es el panel mismo
   (`apps/nexo`) — no hay a dónde volver desde home.

Si tu módulo todavía no tiene un header propio con identidad de marca (es
el caso de un módulo recién adaptado, ej. Flotilla/RRHH en las próximas
fases), no inventes uno — usá `ShellBar` de `@nexo/ui` directo, ya trae
esto resuelto.

## Tokens compartidos (`packages/ui`)

Fuente de verdad operativa (la tabla original con el razonamiento de
diseño está en
[planning/DISENO_UX_UI.md](planning/DISENO_UX_UI.md#2-tokens-de-diseño-packagesui)):

| Token | Valor | Uso |
|---|---|---|
| `--nexo-shell-bg` | `#18181B` (neutral-900) | Fondo de `ShellBar` |
| `--nexo-shell-fg` | `#FAFAFA` (neutral-50) | Texto/iconos de `ShellBar` |
| `--nexo-bg` | `#F5F5F5` (neutral-100) | Fondo del contenido del panel |
| Categoría Finanzas | verde `#DCFCE7` / texto `#166534` | `packages/ui/category-colors.ts` |
| Categoría Ventas | rosa `#FCE7F3` / texto `#9D174D` | ídem — CRM vive acá |
| Categoría Cadena de suministro | morado `#F3E8FF` / texto `#6B21A8` | ídem — Flotilla vive acá |
| Categoría RRHH | ámbar `#FEF3C7` / texto `#92400E` | ídem |
| Categoría Servicios | índigo `#E0E7FF` / texto `#3730A3` | ídem |
| Tipografía | [Inter](https://fonts.google.com/specimen/Inter) | **Toda** la suite — barra Y contenido. Ningún módulo carga otra tipografía (ver principio revisado arriba) |
| Acento | `#2563EB` (blue-600) / hover `#1D4ED8` (blue-700) | Botón primario, foco de inputs, links, ítem activo del `Sidebar` — en todos los módulos |

**Categoría nueva** (ej. al adaptar un módulo que no encaja en las 5 de
arriba): agregala a `CATEGORY_COLORS` en
[`packages/ui/category-colors.ts`](../packages/ui/category-colors.ts) y a
esta tabla en el mismo commit — que quede en un solo lugar, no un color
suelto en el componente del módulo.

## Checklist al crear o adaptar un módulo

1. `core.apps.category` usa una categoría de la tabla de arriba (o se
   agrega una nueva siguiendo el paso anterior).
2. El shell del módulo incluye `BackToPanelLink`/`ShellBar` con
   `backHref` — ver la regla obligatoria arriba.
3. **`globals.css` de la app agrega
   `@source "../../../../packages/ui/**/*.{ts,tsx}";`** justo después de
   `@import "tailwindcss";` (ajustar la profundidad de `../` según dónde
   viva el archivo). Tailwind v4 solo escanea el árbol de la propia app por
   default — sin este `@source`, cualquier clase usada *solo* dentro de
   `@nexo/ui` (ej. `rounded-full`, `hover:bg-neutral-800`, `md:flex`)
   nunca se genera: el componente compila sin error pero se renderiza roto
   en el navegador (fue un bug real, detectado recién al verificar
   `ShellBar` en vivo — no alcanza con que el build pase).
4. Si el módulo necesita un componente de datos genérico (tabla, tarjeta
   de estadística, selector de vista) que ya existe en otro módulo,
   muévelo a `packages/ui` en vez de duplicarlo — ejemplo pendiente real:
   `StatCard` existe hoy 3 veces distintas entre RRHH/Flotilla, hay que
   unificarlo cuando se adapten a Multi-Zones (Fases 5/6).
5. El contenido del módulo usa Inter y la paleta neutra+acento de la
   tabla de arriba — **no** una tipografía o paleta de marca propia (ver
   principio revisado arriba). Si el módulo importado tenía su propia
   identidad visual (fue el caso del CRM: `concreto`/`acero`/`naranja`,
   `Archivo Black`), se reemplaza al adaptarlo, no se preserva.
6. Si el módulo tiene más de una sección de navegación, monta `Sidebar`
   de `@nexo/ui` en su layout autenticado (ver
   [`apps/crm/src/app/(app)/layout.tsx`](../apps/crm/src/app/(app)/layout.tsx))
   — con una sola sección todavía no aporta, pero apenas se agregue una
   segunda, se monta.
