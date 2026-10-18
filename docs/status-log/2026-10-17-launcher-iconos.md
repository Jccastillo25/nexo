# 2026-10-17 — Launcher con grilla de iconos (estilo Odoo)

- **Pedido del usuario:** "quiero hacer un cambio en el panel para que las apps se vean así", con una captura de la pantalla de inicio de Odoo.
- **Estado anterior → nuevo:** grilla agrupada por categoría, con tarjetas con borde e icono de trazo de la categoría → grilla plana de mosaicos blancos con icono a color por app. Implementado y verificado en local; sin commit al momento de escribir esto.
- **Rama:** `feat/launcher-iconos` (desde `main` `6a7ddc3`).

## Cambios

- `packages/ui/app-icons.tsx` (nuevo): `AppTileIcon`, con iconos SVG planos en dos o tres tonos por `core.apps.icon`, respaldo por categoría y uno genérico. Se exporta desde `@nexo/ui`. El cambio es aditivo: `getCategoryIcon` y `CATEGORY_COLORS` siguen disponibles.
- `apps/nexo/src/app/page.tsx`: sin secciones; grilla `auto-fill` de 104 px, centrada; mosaico de 76 px con sombra y elevación al pasar el mouse; fondo degradado claro; header translúcido (el mismo contenido: "Nexo", correo, Cerrar sesión). Configuración pasa a ser un mosaico más.
- `docs/DESIGN_SYSTEM.md`: regla de la grilla del Launcher.

## Verificación

- `typecheck` y `lint` de `nexo-panel` sin errores.
- Recorrido visual en local (`localhost:3000`, sesión del usuario en su Chrome): Atención, CRM, Productos, RRHH y Configuración se ven con su icono a color. Flotilla no aparece para esta cuenta porque no tiene permiso; es lo esperado.
- No verificado: ancho de celular con una sesión real y producción.

## Menú lateral desplegable en todas las apps (mismo día)

Pedido: "El menú de RRHH es el único que tiene estos desplegables, me gustaría
agregarlo así a todo el menú en todas las apps. Sin que pierdan los iconos
[...] que esto fuera una regla al momento de crear una app". Regla nueva en
`CLAUDE.md` y `docs/DESIGN_SYSTEM.md` ("Menú lateral desplegable").

- Atención, CRM, Productos y RRHH reescriben su `lib/nav.ts`: Dashboard o
  Inicio suelto, todo lo demás en grupos y un icono en cada subítem. Árbol por
  app en `DESIGN_SYSTEM.md`. El panel Nexo ya cumplía. Agencia queda como
  excepción porque solo tiene su Dashboard.
- Kit: iconos `chart`, `target` y `monitor`. Se retira `NexoNavItem.section`
  (2026-10-16), para que quede un solo patrón.
- **Bug corregido (estaba en producción desde #45):**
  `/productos/configuracion/<catálogo>` fallaba con "CATALOGOS_RUTA.includes
  is not a function", porque la constante se exportaba desde un módulo
  `"use client"`. Ahora vive en `apps/productos/src/lib/catalogos-ruta.ts`.
- **Conflicto previsto con el PR #47:** el `nav.ts` de RRHH de esa rama le
  agrega `href: "/marcas"` a Marcas. Al integrarlos hay que conservar ese
  `href` y además el icono nuevo.
- Verificación: `typecheck` en las 8 apps y `lint:gate`. En local, con la
  sesión del usuario, `/productos/configuracion/marcas` muestra el menú
  desplegable con iconos y la página carga.

## Launcher por secciones (mismo día, segunda parte)

Pedido: "el app launcher debe de estar así como lo tenemos ahorita pero por
secciones. Ejemplo: Atención, todos sus apps por abajo y así sucesivamente".

- `apps/nexo/src/app/page.tsx`: se mantienen los mosaicos y el fondo, pero
  agrupados por `core.apps.category`, con un título (`h2`, `aria-labelledby`)
  y su grilla alineada a la izquierda. En el remoto hoy las secciones son
  Cadena de suministro (Productos, Flotilla), RRHH, Servicios (Atención,
  Agencia) y Ventas (CRM); cada usuario ve solo las de sus permisos. La
  tarjeta Configuración va en su propia sección, "Administración", al final.
- Verificación: typecheck y lint de `nexo-panel`. El sistema completo corre en
  local: panel en 3000 (ya estaba corriendo), CRM en 3001, RRHH en 3002,
  Atención en 3004 y Productos en 3005 (ya estaba corriendo). Cada zona
  responde por su puerto y a través del rewrite del panel (307 al login sin
  sesión). **Falta verificarlo visualmente con sesión:** el login es contra
  `nexo-core` con cuentas reales, así que lo hace el usuario.

**Ajuste visual (pedido: "necesito que lo adaptes visualmente en la pantalla o
no sé si podemos quitar el título"):** con una o dos apps por categoría, las
secciones apiladas y alineadas a la izquierda dejaban mucho vacío. Ahora
fluyen una al lado de la otra y centradas (`flex-wrap`, `max-w-5xl`), con el
título centrado y subrayado. Se le mostró al usuario una maqueta de
escritorio, celular y otra con más apps. Aprobó el diseño, con los títulos.

**Cuadrícula fija (pedido: "tener cuadrículas para que se vayan agregando
aplicaciones y se vea siempre con la misma similitud visual, con Ventas en el
top ocupando todo el espacio"):** grid de columnas de 104 px (3/5/8 según el
ancho), secciones con `grid-cols-subgrid` que ocupan tantas columnas como apps
(mínimo 2), orden fijo `ORDEN_CATEGORIAS` y Ventas siempre arriba a todo el
ancho (`SECCIONES_ANCHO_COMPLETO`); Administración al final. `main` pasa a
`max-w-6xl` para que entren las 8 columnas. Typecheck y lint de `nexo-panel`
en verde, y maqueta con las apps actuales y con más apps. Falta verlo con
sesión en `localhost:3000`.

**Apps "Próximamente" (pedido: "agregar todos los botones que pusiste en la
prueba, pero los que no tienen nada que digan próximamente, para tener una
mejor orientación visual"):**

- `APPS_PROXIMAMENTE` en `page.tsx` agrega 10 apps: Cotizaciones, Punto de
  venta, Facturación, Listas de precios, Inventario, Compras, Flotilla,
  Contabilidad, Bancos y Agencia digital. Se muestran como mosaicos sin
  enlace (borde punteado, icono gris, "Próximamente"). Si la app real llega
  por `get_visible_apps`, gana la real.
- Asistencia y Nómina, que estaban en la maqueta, no se agregaron: ya son
  menús dentro de RRHH.
- Flotilla y Agencia existen en `core.apps`, pero no están habilitadas para
  la empresa. Si se habilitan, un usuario sin permiso las verá como
  "Próximamente": es aceptable porque es solo orientación.
- `packages/ui/app-icons.tsx` suma 8 iconos y la categoría Finanzas.
- Verificado: typecheck y lint de `nexo-panel` y `lint:gate`, y maqueta
  mostrada al usuario. Falta verlo con sesión en `localhost:3000`.

**Revisión de duplicados e iconos borrosos (pedido del usuario):**

- Cotizaciones ya está en el menú del CRM y Listas de precios en el de
  Productos (las dos como "Pronto"). Se quitaron del Launcher, junto con sus
  iconos `quote` y `tag`. Quedan 8 apps "Próximamente".
- Agencia (dashboard de marketing): `apps/agencia` existe, pero en
  `core.apps` está `active = false`, y `core.has_permission` niega cualquier
  permiso de un módulo inactivo, incluso al owner. No se ve ni en local hasta
  activarla en `nexo-core`, y eso necesita la decisión del usuario.
- Flotilla: `apps/flotilla` existe, pero sigue en su propio proyecto Supabase
  con login propio y sin adaptar a Multi-Zones. No se puede abrir desde el
  panel hasta su fase.
- Iconos borrosos, causa probable: el `-translate-y` animado del mosaico (capa
  rasterizada con el escalado de Windows) y el `grayscale`/`opacity` de los
  "Próximamente". Ahora el hover solo cambia la sombra y el gris se hace con
  el color de relleno. Se comprobó en el CSS servido que la regla se genera.
  Typecheck, lint y lint:gate en verde. **No verificado en la pantalla del
  usuario.**

**Agencia activada y Listas de precios como app aparte (pedido: "activa
agencia digital; precios podemos hacerlo como una app aparte, sería sacarlo de
producto"):**

- Migración `20261017171359_agencia_activar`, aplicada en `nexo-core`
  (`active` y `enabled` en true). El Launcher ya trae Agencia por
  `get_visible_apps` y su "Próximamente" deja de mostrarse solo. Servidor
  local en 3003; `localhost:3000/agencia` responde con el rewrite (307 al
  login sin sesión). En producción la tarjeta ya aparece. Por pedido del
  usuario se creó en Vercel `AGENCIA_APP_URL` de Production en `nexocore`,
  apuntando a `https://nexo-agencia.vercel.app`. Se comprobó antes que ese
  dominio está activo (307 al login), que el último deploy de producción de
  `nexo-agencia` está READY (`main` `6619646`), que tiene sus variables
  (Supabase, `NEXO_COMPANY_ID`, `NEXO_PANEL_URL`) y que la variable figura
  en `turbo.json`. **Se hace efectiva con el próximo deploy de `nexocore`
  (el push único).**
- Listas de precios: se quitó el grupo "Precios" del menú de Productos
  (`apps/productos/src/lib/nav.ts`). En el Launcher vuelve como
  "Próximamente" (slug `precios`, Cadena de suministro, icono `tag`). La
  decisión quedó registrada en `plan/14-productos.md`. Falta su Paso Cero.
- Typecheck de `nexo-panel` y `nexo-productos` y `lint:gate` en verde.

## Pendiente

- Por decisión del usuario, nada se sube todavía: se pule todo en local para
  un solo despliegue.
- Commit, PR, CI y merge, cuando el usuario lo indique.
