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

## Pendiente

- Por decisión del usuario, nada se sube todavía: se pule todo en local para
  un solo despliegue.
- Commit, PR, CI y merge, cuando el usuario lo indique.
