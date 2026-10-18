# 2026-10-17 — Corrección de los 6 hallazgos de la prueba de subagentes

- **Origen:** hallazgos de producto de la prueba de delegación real
  ([2026-10-17-subagentes.md](2026-10-17-subagentes.md)).
- **Estado anterior → nuevo:** 6 hallazgos abiertos → corregidos en local,
  **implementado, no validado visualmente**. Sin commit ni push (el usuario
  quiere un solo despliegue). Sin migraciones ni cambios en remoto.
- **Flujo:** coordinador → `ui-frontend` (8 archivos autorizados) →
  `reviewer` → ajustes menores del coordinador.

## Cambios

| # | Hallazgo | Corrección | Archivo |
|---|---|---|---|
| 1 | Configuración antes que Precios | Orden Catálogo → Precios → Configuración | `apps/productos/src/lib/nav.ts` |
| 2 | Grupos vacíos pintados como "Pronto"; sin `aria-expanded` ni foco | `children: []` no se renderiza, en cascada (`isEmptyGroup`); sin `children` sigue siendo "Pronto". `aria-expanded` en el botón de grupo; `focus-visible:ring-white/70` en grupo, links, logo y botón de colapsar | `packages/ui/NexoSidebar.tsx`, `packages/ui/nexo-nav.ts` (comentarios) |
| 3 | `error.message` crudo en carga | Texto fijo con `role="alert"`; error real a `console.error` en el servidor | `configuracion/[catalogo]/page.tsx`, `clasificacion/page.tsx` |
| 4 | Errores técnicos al guardar | P0001 → mensaje de la RPC; 42501 → "Tu rol no permite gestionar este catálogo."; otros → "No se pudo guardar. Intenta de nuevo."; todo lo que no es P0001 se registra con `console.error`. `role="alert"` en el error del panel | `configuracion/actions.ts`, `configuracion/paneles.tsx` |
| 5 | Toast sin `aria-live` | **Falso positivo parcial:** sonner 2.0.8 ya monta siempre su `<section aria-live="polite">`. No se duplica la región viva; se agrega `containerAriaLabel="Notificaciones"` y un comentario | `packages/ui/Toast.tsx` |
| 6 | Sin `focus-visible` en botones del panel | Anillo `focus-visible:ring-blue-500` + offset en Editar, Cancelar, Guardar y Agregar | `configuracion/paneles.tsx` |

`docs/DESIGN_SYSTEM.md` ("Menú lateral desplegable"): semántica de
`children: []` frente a `children` omitido, accesibilidad del sidebar y el
orden nuevo de Productos en la tabla.

## Revisión independiente (`reviewer`)

Sin hallazgos críticos ni altos. Atendidos por el coordinador:
- **Baja:** un grupo con solo subgrupos vacíos seguía pintándose → oculto en
  cascada con `isEmptyGroup`.
- **Baja:** el 42501 no se registraba (también puede ser un `GRANT`
  faltante) → ahora se registra antes de traducirlo.
- **Nota:** documentar la semántica en `DESIGN_SYSTEM.md` → hecho.

Señalado para el commit: `apps/productos/src/lib/catalogos-ruta.ts` está sin
seguimiento y lo importan `[catalogo]/page.tsx` y `paneles.tsx`; tiene que ir
en el mismo commit o el build se rompe.

## Pruebas

- `npx.cmd --yes pnpm@9.15.9 typecheck` → exit 0 (8/8), después de los
  ajustes del coordinador.
- `npx.cmd --yes pnpm@9.15.9 lint:gate` → exit 0 (6/6).

## Pendiente

- Recorrido visual: contraste del anillo `white/70` sobre el azul marino,
  sidebar colapsado y drawer móvil, grupo Precios con su hijo "Pronto".
- Usuario sin permisos de configuración: confirmar que el grupo se oculta.
- Códigos reales de PostgREST (P0001/42501) con un rol sin permiso en remoto.
- `build` de las apps (no ejecutado) y prueba con lector de pantalla.
- Opcional: quitar el `%` de `'Catálogo desconocido: %'` en una migración
  futura (inalcanzable hoy desde la acción).
