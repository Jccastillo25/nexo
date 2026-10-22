---
name: nexo-ui-review
description: Lista de verificación de accesibilidad, UX e interfaz para pantallas de Nexo, con formato de hallazgos archivo:línea. Usar al especificar estados y criterios (ux-planner), al autoverificar una pantalla (ui-frontend) o al revisar cambios de UI (reviewer).
---

# Nexo UI review — accesibilidad y UX

Adaptación estable al proyecto. Fuente y licencia: [SOURCE.md](SOURCE.md). Lista
fija dentro del repo. **No descarga reglas de internet en cada uso.**

## Cuándo se utiliza

- ux-planner: para no olvidar estados, validaciones y accesibilidad en la especificación.
- ui-frontend: autoverificación antes de entregar.
- reviewer: revisión de cualquier cambio en `apps/*/src/app` o `packages/ui`.

## Contexto que debe consultar

1. Los archivos que indique el coordinador, más el diff real (`git diff`).
2. La especificación o los criterios de aceptación de la tarea.
3. `docs/DESIGN_SYSTEM.md` y la skill [nexo-ui](../nexo-ui/SKILL.md) para distinguir lo que es regla de la suite de lo que es preferencia.

## Procedimiento — lista de verificación

**Accesibilidad (crítico)**
- Botones de solo icono con `aria-label`. Los iconos decorativos llevan `aria-hidden` (los SVG del kit ya lo traen).
- Cada control de formulario tiene `<label>` asociado o nombre accesible.
- Las acciones usan `<button>` y la navegación `<a>`/`Link`. Nada de `div` clicables.
- Encabezados en orden (un `h1` por página, que da `PageHeader`).
- Los mensajes asíncronos (toasts, errores de validación) se anuncian (`role="alert"`/`status`).
- Contraste WCAG AA: texto normal 4.5:1, texto grande (18px o 14px en negrita) 3:1; bordes de input, iconos con significado, indicador de foco y segmentos de gráfico 3:1 contra lo que tienen al lado. Un texto sobre fondo de color se mide en su peor punto. Combinaciones dudosas fuera de la escala habitual (p. ej. `text-neutral-400` sobre blanco para texto que hay que leer) se reportan con la pareja exacta.
- El estado nunca se comunica solo con color: va con texto o icono (como `StatusBadge`, que lleva etiqueta).

**Foco y teclado (crítico)**
- Foco visible en todo elemento interactivo (`focus-visible:ring-*` o `focus-visible:outline-*`, como `Button`). No quitar `outline` sin reemplazo. El foco no aparece solo con hover.
- Todo se puede operar con teclado (Tab, Shift+Tab, Enter, Espacio). Los diálogos (`ConfirmDialog`) atrapan y devuelven el foco y se cierran con Escape.
- El orden de tabulación sigue el orden visual; `tabIndex` positivo no se usa. Nada que funcione solo con hover o arrastrando sin alternativa de teclado.

**Formularios (alto)**
- Tipos e `inputMode` correctos (correo, número, fecha), `autoComplete` en datos personales y nunca bloquear el pegado.
- El botón de enviar se deshabilita solo mientras la acción está en curso (`isPending`).
- Errores en línea junto al campo y con la solución.
- Las acciones destructivas piden confirmación (`ConfirmDialog`).

**Estados (alto)**
- Carga, vacío (`EmptyState` con siguiente paso), error comprensible sin datos técnicos ni ajenos, éxito (`useToast`).
- Los vacíos distintos usan su variante de `EmptyState`: sin registros todavía (`empty`), filtro sin resultados (`no-results`), sin permiso (`no-access`, nunca muestra el código del permiso), falla (`error`), fuente pendiente (`pending`). Cada uno nombra la causa y el paso siguiente.
- La carga tiene texto o esqueleto con nombre accesible, no solo un giro.
- Acceso denegado: control oculto o deshabilitado y el servidor también deniega.

**Contenido y diseño (medio)**
- Textos largos: truncar o partir; en hijos de flex con truncado, `min-w-0`.
- Números en tablas con `tabular-nums`. Fechas y montos con `Intl`/`toLocaleString("es-NI")`, nunca con formato armado a mano.
- Sin desplazamiento horizontal en móvil. Tablas anchas dentro de `overflow-x-auto`. No se usa `overflow-hidden` para esconder contenido que no cabe.
- La franja intermedia (tablet, aprox. 640 a 1024 px) tiene su propia disposición, no un escritorio apretado; las rejillas bajan a una columna en móvil.
- Objetivos táctiles en móvil de al menos 44 × 44 px para las acciones principales (`Button` `md`/`lg` ya suben a `min-h-11` bajo 640 px). El tamaño `sm` (32 px) y los iconos de fila (`RowActionIcons`, 32 px) son una decisión del kit para tablas densas: no se reportan como falla, pero sí si quedan pegados sin separación.
- Con zoom de texto al 200 % no se corta ni se superpone nada; en móvil, el campo enfocado no queda tapado por el teclado.
- Filtros y paginación reflejados en la URL.

**Anti-relleno (medio)** (criterios de la sección "Anti-relleno" de [nexo-ui](../nexo-ui/SKILL.md))
- Botones o enlaces genéricos ("Enviar", "Continuar", "Más información") donde existe un verbo del negocio.
- Adjetivos de folleto, muletillas, emojis, raya (—) uniendo frases en textos de la interfaz (no aplica a "—" como valor vacío de celda).
- Cifras, nombres, testimonios o afirmaciones de seguridad o rendimiento sin fuente real.
- Insignias, puntos de estado, pulsos, brillos, sombras o flechas que no marcan un estado ni una dirección.
- Controles sin comportamiento real o enlaces de menú que llevan a una ruta inexistente.
- Se reporta el patrón repetido con sus líneas; un caso aislado y defendible no es hallazgo.

**Movimiento (medio)**
- Respetar `prefers-reduced-motion`.
- Animar solo `transform`/`opacity`; nunca `transition: all` (en Tailwind, preferir `transition-colors` o `transition-transform` a `transition` genérico cuando importe).

**Reglas de la suite (bloqueantes)**
- `NexoShell`, menú desplegable con un icono en cada ítem, `next/link` dentro del módulo, una sola paleta/Inter, sin datos de ejemplo, permisos en servidor y en UI.

## Restricciones

- El revisor no corrige: reporta. El planner no implementa.
- Hallazgo sin evidencia (línea o salida de comando) = no es hallazgo.
- No certificar "accesible" ni "seguro": la inspección de código no sustituye una prueba con lector de pantalla, teclado real o RLS en remoto.

## Entregables

Hallazgos agrupados por archivo, del más grave al menos grave:

```
## apps/<app>/src/app/(app)/ruta/page.tsx
- page.tsx:42 — [Alta] Botón de solo icono sin aria-label → agregar aria-label="Eliminar marca".
✓ archivo-sin-hallazgos.tsx
```

Al final, dos listas: **Comprobado** (con el comando o la evidencia) y **Pendiente / no comprobado**.
Cada punto de "Comprobado" lleva su evidencia concreta (comando y resultado, o
`archivo:línea`). Nombrar una prueba no es ejecutarla: lo que no se corrió va en
"Pendiente".

## Comprobaciones

- Se recorrieron todas las secciones de la lista para cada archivo de UI del diff.
- typecheck y lint de las apps tocadas, ejecutados con su resultado real.

## Si falta información o una herramienta

- Sin criterios de aceptación: revisa contra esta lista y `CLAUDE.md`, y reporta "criterios no recibidos".
- Sin navegador ni lector de pantalla: marca contraste real, foco visible en pantalla y responsivo como **pendientes de prueba visual**.
- El diff incluye archivos fuera del alcance: repórtalo como hallazgo; no los revises a fondo sin pedirlo.
