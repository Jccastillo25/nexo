# Diseño UX/UI de Nexo — estudio de SAP Fiori y Odoo

Investigación encargada por el usuario (2026-08-30) para definir el
lenguaje visual del panel y la navegación dentro de cada módulo. No es
teoría suelta: termina en tokens concretos aplicados a `packages/ui` y al
panel real (`apps/nexo`).

## 1. Qué toma Nexo de cada uno

### SAP Fiori (el más relevante para el *panel*, no para los módulos)

Fiori es literalmente el mismo problema que Nexo: un launcher único
("Fiori Launchpad") que da acceso a decenas de apps de negocio separadas,
basado en rol. Su anatomía ([SAP Design System — Fiori Launchpad](https://www.sap.com/design-system/fiori-design-web/v1-84/foundations/integration-and-services/sap-fiori-launchpad/launchpad)):

- **Shell bar** (barra superior, siempre visible): de izquierda a derecha —
  botón "Atrás" (solo dentro de una app), marca/logo, título de la
  página/app actual, y a la derecha: búsqueda, notificaciones, menú de
  usuario.
- **Home page**: tiles (mosaicos) agrupados en **Spaces** — colecciones de
  apps relevantes para un rol de negocio. Un tile puede mostrar un
  indicador en vivo (ej. "8 viajes activos").
- Principios declarados: **role-based, adaptive, simple, coherent,
  delightful** ([SAP Fiori Design Principles](https://leverx.com/newsroom/sap-fiori-design-principles)).

Lo que Nexo adopta de esto:
- El **shell bar persistente** con el nombre del módulo activo y el menú de
  usuario a la derecha — Nexo no lo tenía (el panel actual es solo la
  grilla, sin barra superior).
- **Agrupar tiles por categoría** (Fiori "Spaces") — esto ya existe en
  nuestro schema (`core.apps.category`: "RRHH", "Ventas", "Cadena de
  suministro"...) pero el panel actual (`apps/nexo/src/app/page.tsx`) no lo
  usa, muestra todo en una grilla plana. Se corrige en la sección 3.
- La idea de **tile con indicador en vivo** (ej. "3 clientes nuevos hoy") —
  no se implementa todavía, queda anotada como mejora futura en
  `core.apps` (columna a agregar más adelante).

### Odoo (el más relevante para la navegación *dentro* de cada módulo)

Odoo resuelve el mismo problema con una estética mucho más plana y menos
corporativa que Fiori: grilla de apps por categoría con texto de categoría
en un color de acento distinto por sección (ver la captura que compartió
el usuario: Finanzas en verde azulado, Ventas en rosa, Cadena de suministro
en morado, RRHH en naranja, Marketing en naranja, Servicios en violeta,
Productividad en azul violeta). Dentro de cada app, el patrón es siempre el
mismo: navegación horizontal superior (secciones del módulo) +
breadcrumb + selector de vista (lista/kanban/calendario) + buscador con
filtros.

Lo que Nexo adopta de esto:
- **Colores por categoría, no por módulo individual** — ya estaba en
  [PROPUESTA_MARCA_MODULOS.md](PROPUESTA_MARCA_MODULOS.md) sección 2, se
  formaliza acá como tokens reales.
- **El patrón de navegación interna** (nav horizontal + breadcrumb + view
  switcher) como convención recomendada para todo módulo nuevo — no se
  fuerza retroactivamente sobre RRHH/Flotilla/CRM (cada uno ya tiene su
  propia UI hecha), pero sí es la referencia para Inventario/Compras/
  Ventas/Contabilidad (Fase 2 del roadmap).
- **Estética plana, sin sombras duras, tipografía sans-serif limpia** — más
  cercano a lo que ya tiene el CRM (Tailwind, bordes finos) que a la
  densidad de Fiori.

## 2. Tokens de diseño (packages/ui)

| Token | Valor | Uso |
|---|---|---|
| `--nexo-shell-bg` | `#18181B` (neutral-900) | Fondo del shell bar |
| `--nexo-shell-fg` | `#FAFAFA` (neutral-50) | Texto/iconos del shell bar |
| `--nexo-bg` | `#F5F5F5` (neutral-100) | Fondo del contenido |
| Categoría Finanzas | `verde` — `#DCFCE7` / texto `#166534` | Tiles de Contabilidad, Facturación |
| Categoría Ventas | `rosa` — `#FCE7F3` / texto `#9D174D` | Tiles de CRM, Ventas/PdV |
| Categoría Cadena de suministro | `morado` — `#F3E8FF` / texto `#6B21A8` | Tiles de Flotilla, Inventario, Compras |
| Categoría RRHH | `ámbar` — `#FEF3C7` / texto `#92400E` | Tiles de RRHH |
| Categoría Servicios | `índigo` — `#E0E7FF` / texto `#3730A3` | Tiles de Proyectos, Soporte |
| Tipografía shell/panel | [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts) | Todo el chrome de Nexo — neutral, no compite con la identidad propia de cada módulo (el CRM ya usa Archivo Black/Work Sans/IBM Plex Mono como marca propia, y eso se mantiene tal cual dentro de `/crm`) |

Regla de identidad: **el shell de Nexo es neutral (Inter, escala de grises
+ acentos de categoría); cada módulo puede tener su propia tipografía y
color de marca puertas adentro** (así como el CRM ya tiene la suya) — el
usuario nota "estoy en Nexo" por el shell bar, y "estoy en el CRM" por el
contenido. Es exactamente cómo funciona Fiori: shell bar consistente,
apps individuales con su propia UI.

## 3. Aplicado al panel (`apps/nexo`)

Cambios reales sobre el código existente (Fase 4):
1. **Shell bar nuevo** en `layout.tsx`/`page.tsx`: barra oscura persistente
   con "Nexo" a la izquierda y el usuario + salir a la derecha (antes era
   parte del contenido de la página, sin persistir entre navegaciones).
2. **Grilla agrupada por categoría** en vez de plana: `get_visible_apps` ya
   devuelve `category`; el home la usa para agrupar con un título de
   sección (estilo Odoo), en vez de una sola grilla sin agrupar.
3. Colores de categoría de la tabla de arriba, reemplazando los colores
   por-módulo sueltos que había antes (`COLOR_CLASSES` keyeaba por
   `app.color`, ahora es por `app.category`).

Ver el resultado en `apps/nexo/src/app/page.tsx` y verificado en vivo con
el Browser pane (mismo método que la Fase 4).

## 4. Pendiente / fuera de alcance de esta pasada

- Tiles con indicador en vivo (requiere agregar una función/columna que
  cada módulo alimente, ej. `core.apps` + una vista materializada de
  "conteo relevante" por módulo) — anotado para cuando haya más de 2
  módulos con datos reales.
- Selector de densidad (compacta/cómoda) al estilo Fiori — no aplica
  todavía, ningún módulo tiene tablas de datos densas construidas sobre
  `packages/ui`.
- Búsqueda empresarial en el shell bar (Fiori) — no hay nada que buscar
  todavía entre módulos (CRM es el único con datos reales, y son de
  prueba).

Fuentes: [SAP Design System — Fiori Launchpad](https://www.sap.com/design-system/fiori-design-web/v1-84/foundations/integration-and-services/sap-fiori-launchpad/launchpad), [SAP Fiori Design Principles — LeverX](https://leverx.com/newsroom/sap-fiori-design-principles), [Best Practices for Designing SAP Fiori Apps](https://www.sap.com/design-system/fiori-design-web/v1-96/discover/sap-products/sap-s4hana-only/best-practices-for-designing-sap-fiori-apps), captura de `odoo.com/apps` compartida por el usuario (2026-08-29).
