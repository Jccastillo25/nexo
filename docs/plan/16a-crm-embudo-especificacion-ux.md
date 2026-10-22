# Especificación UX: embudo comercial del CRM (Leads, Oportunidades, Actividades, Cotizaciones)

> **RETIRADO el 2026-10-20.** El usuario pidió borrar el CRM y replicar AG Negocio, su ERP actual ([plan 18](18-replica-ag-negocio.md)). Las pantallas, los esquemas `crm`/`metas` y sus permisos se borraron sin datos (`20261020143821`). El código está en la rama local `respaldo/crm-2026-10-20`. Este documento queda solo como historia.

> Especificación de `ux-planner` (2026-10-19) para [plan 16](16-crm-embudo-comercial.md). **Borrador:** está pendiente de que el usuario responda las preguntas de la §10 y confirme los datos iniciales (S6). Sin esquema ni UI todavía.

## 0. Lo que verifiqué antes de especificar

- **Plan 16.** La matriz de 21 permisos está aplicada (`20261019152215`). Las plantillas tienen 17, 27 y 34 permisos. Todavía no hay tablas ni RPC del embudo.
- **Plantilla Vendedor.** Ya tenía `crm.clientes.ver` (migración `20261018184849`, línea 64). No tiene ningún permiso `productos.*`.
- **Catálogo de productos.** `public.productos_listar` y `productos_obtener` exigen `productos.catalogo.producto.ver` (`20261016214634_productos_esquema.sql:554`, `:600`). **Un vendedor del CRM no puede buscar productos con esas RPC.** Hace falta una RPC propia del CRM (§7) o asignarle ese permiso. Ver P4.
- **Precios.** `productos` no tiene precio de venta, solo `costo_referencia`, y verlo exige otro permiso. Esto afecta el control del descuento (P1).
- **Tipo de actividad.** El plan 16 menciona `crm_Activities` (call, meeting…) de NextCRM, pero como modelo de referencia; no es una decisión nuestra.
- **Componentes del kit** (`packages/ui/index.ts`): `PageHeader`, `MetricCard`, `DataTable` (acepta `className` por columna, sirve para ocultar columnas según el ancho), `FilterBar`, `StatusBadge` (tonos neutral, positive, warning, negative, info), `FormTabs` (`content` como JSX), `FormSection`, `EmptyState`, `ConfirmDialog`, `RowActionsMenu`, `RowActionIcons`, `QuickActions`, `ActivityFeed`, `useToast`.
  - `ConfirmDialog` **no acepta contenido propio** (`children`), **no atrapa el foco y no cierra con Escape** (`packages/ui/ConfirmDialog.tsx`). Es deuda de accesibilidad que ya existe. La propuesta está en §2.
- **Iconos** (`nexo-icons.tsx`): grid, users, folder, settings, chat, clock, cash, calendar, file, briefcase, alert, shield, receipt, sliders, list, truck, factory, building, box, upload, tree, tag, ruler, book, price, chart, target, monitor. **Faltan `funnel`, `phone` y `mail`.**
- **Patrón de referencia del CRM:** las pantallas de Metas (no Clientes):
  - `sesionActual()` con `cache` y redirección si falta el permiso de la página (`metas/page.tsx:25`);
  - lectura por RPC y `mensajeUsuario(...)` + `ErrorCarga` para los errores;
  - estilos de `components/metas/estilos.ts` (`claseTarjeta`, `claseThead`, `claseBoton*`, `claseInput`);
  - montos y fechas con `lib/metas/formato.ts` (`usd`, `cs`, `csReferencia`, `fecha`, `fechaDeMarca` en hora de Managua, `leerNumero`);
  - filtros y página en la URL, y `Paginacion` (función local de `facturas/page.tsx`).
  - Clientes **no** sirve de referencia: lee la tabla directo, usa un `<h1>` suelto y no revisa permisos en la UI.
- **Hallazgo fuera de alcance:** en `nav.ts`, "Clientes" se muestra sin revisar `crm.clientes.ver`.
- **Rendimiento.** `permisosDe()` hace una llamada `hasPermission` por código: hoy son 9 y con el embudo serían 30 por solicitud. Recomiendo una RPC `crm_mis_permisos` que devuelva todos los códigos `crm.*` del usuario en una sola llamada (§7).

## 1. Menú final (`apps/crm/src/lib/nav.ts`)

Mantengo el embudo dentro de **Ventas**, porque es donde el usuario ya lo tiene, y lo ordeno según el flujo comercial. Los títulos del menú no cambian según el alcance; lo propio o lo del equipo lo indica la página (§2).

```text
Dashboard                         /dashboard                  grid      crm.ver_modulo (layout)
Ventas                                                        briefcase
  ├─ Leads                        /leads                      target    crm.ventas.lead.ver
  ├─ Oportunidades                /oportunidades              funnel*   crm.ventas.oportunidad.ver
  ├─ Agenda                       /actividades                calendar  crm.ventas.actividad.ver
  ├─ Cotizaciones                 /cotizaciones               receipt   crm.ventas.cotizacion.ver
  ├─ Clientes                     /clientes                   users     (hoy sin revisar permiso; debería ser crm.clientes.ver)
  ├─ Facturas | Mis facturas      /facturas                   file      (sin cambios)
  └─ Importar del ERP             /importar                   upload    (sin cambios)
Metas                                                         target    (sin cambios)
Análisis                                                      chart
  └─ Histórico                    (Pronto)                    clock     (sin cambios)
Configuración                                                 settings
  ├─ Embudo comercial             /configuracion/embudo       sliders   crm.configuracion.embudo.gestionar
  └─ Vendedores y usuarios        /configuracion/vendedores   users     (sin cambios)
```

- **\* Iconos nuevos en `packages/ui/nexo-icons.tsx`:**
  - `funnel`, para Oportunidades: `chart` ya lo usa Análisis y `target` ya lo usan Leads y Metas.
  - `phone` y `mail`, para los tipos de actividad dentro del contenido.
  - La visita usa `building`, la reunión `users` y la nota `file`.
- **El tablero y la lista son una sola entrada.** `/oportunidades` abre el tablero y `/oportunidades?vista=lista` la lista. Así se evitan dos ítems para el mismo recurso.
- **"Agenda" en vez de "Actividades".** Es la tarea principal del vendedor: qué hago hoy.
- **Al implementar** se extiende `Permisos` en `lib/metas/permisos.ts`, o mejor en un `lib/embudo/permisos.ts` que reutilice `sesionActual`, con claves `lead*`, `oportunidad*`, `actividad*`, `cotizacion*`, `equipoVentas`, `asignar` y `embudo`.

## 2. Patrones comunes a todas las pantallas

**Alcance propio o de equipo** (es el mismo patrón de Metas):
- **Sin `crm.ventas.equipo.ver`:**
  - la RPC solo devuelve los registros donde el usuario es el responsable;
  - el título es "Mis leads", "Mis oportunidades", "Mi agenda" o "Mis cotizaciones";
  - no hay filtro de responsable.
- **Con `equipo.ver`:**
  - el título es "Leads", "Oportunidades", etc.;
  - aparece el filtro "Responsable: Todos / Solo los míos / <usuario>", por defecto "Todos" y guardado en la URL (`?resp=`).
  - El gerente que también vende cambia a "Solo los míos" con un clic.

**Acceso a una página:**
- Sin el permiso `*.ver`, la página redirige con el patrón de Metas: al primer destino permitido, si no a `/dashboard`.
- Si alguien entra por enlace directo a un registro fuera de su alcance, borrado o inexistente, la RPC responde "no encontrado" y la página usa `notFound()` con el texto: "No encontramos este registro o no lo tienes asignado." No se revela si el registro existe.

**Controles sin permiso:** se **ocultan**. Se **deshabilitan, con el motivo visible**, solo cuando el permiso existe pero el estado lo impide; por ejemplo: "No se puede enviar: requiere aprobación". La RPC siempre vuelve a validar.

**Errores:**
- `mensajeUsuario(error, rpc, fallback)` + `ErrorCarga`, sin detalles técnicos.
- Sin permiso, el mensaje es `SIN_PERMISO`.
- Si el registro cambió entre la lectura y el guardado, la RPC lo rechaza y el mensaje es: "Este registro cambió mientras lo editabas. Recarga para ver la versión actual." Tus cambios se quedan en el formulario.

**Éxito:** `useToast().show("…", "success")` y luego `router.refresh()`. Si la acción creó algo, se navega a ese registro.

**Carga:** `loading.tsx` del grupo `(app)`, que ya existe. Mientras una acción está en curso, el botón se deshabilita (`isPending`) y muestra "Guardando…", "Moviendo…", etc.

**Confirmaciones:**
- `ConfirmDialog destructive` para eliminar, anular, perder y cancelar.
- **Propuesta para `packages/ui`, que necesitas aprobar:** agregar a `ConfirmDialog` un `children?: ReactNode` opcional para meter un campo dentro (motivo de pérdida, motivo de anulación, comentario de aprobación). Aprovechar el cambio para agregar Escape, foco inicial, foco atrapado y devolución del foco.
  - No existe un componente con formulario dentro de un diálogo. La alternativa es una página por cada acción, que en el teléfono es peor para acciones de un solo campo.

**Tablas:**
- `DataTable` del kit dentro de `claseTarjeta`, con columnas secundarias `hidden sm:table-cell` o `md:table-cell`. En el teléfono se ven 2 o 3 columnas y nunca hay desplazamiento horizontal.
- La columna principal es un `Link` a la ficha.
- Acciones visibles con `RowActionIcons`; las secundarias con `RowActionsMenu`.
- 50 filas por página con la `Paginacion` de facturas, extraída a un componente compartido del CRM.

**Filtros:** `FilterBar` con los controles; su estado vive en la URL (patrón de `facturas/filtros.tsx`) e incluye "Limpiar filtros".

**Teléfono:**
- `NexoShell` con el menú en cajón (drawer).
- Barra de acciones fija abajo en las fichas (`sticky bottom-0`) con: Llamar (`tel:`), WhatsApp (`https://wa.me/505…`, abre fuera de la app) y Registrar actividad.
- Áreas táctiles de al menos 44 px.
- Campos con el tipo de entrada correcto:
  - teléfono: `type="tel"` + `autoComplete="tel"`;
  - correo: `type="email"`;
  - montos: `inputMode="decimal"` + `leerNumero`;
  - fechas y horas: `type="date"` y `type="time"` nativos.
- Si guardar falla, no se borra lo escrito.

**Formato:** montos `US$` con `usd()` y C$ de referencia con `csReferencia()`; fechas con `Intl` es-NI en hora de Managua; columnas numéricas `tabular-nums`.

**Accesibilidad:**
- Un `h1` por página, el de `PageHeader`.
- Errores junto al campo con `role="alert"` y `aria-invalid`/`aria-describedby`.
- Foco visible con `focus-visible:ring-2 ring-blue-500`.
- El tablero se puede operar con teclado y lector de pantalla (§3.4).
- Los movimientos de tarjetas respetan `prefers-reduced-motion`.

## 3. Pantallas

### 3.1 Leads: lista (`/leads`)

**Usuarios y tareas:**
- El vendedor registra prospectos que llegan por la sala, una llamada, WhatsApp o una visita de campo, les da seguimiento y los convierte.
- El gerente ve todos los leads, reasigna y detecta los que nadie atiende.

**`PageHeader`:** "Mis leads" o "Leads". Botón "Nuevo lead" (`lead.crear`).

**Pestañas de estado** (enlaces con `aria-current`, como las de Metas), con su conteo: Activos (nuevo + contactado + calificado, por defecto) · Nuevos · Contactados · Calificados · Convertidos · Descartados.

**Filtros:** buscar (nombre, negocio, teléfono, correo, RUC), origen, responsable (`equipo.ver`) y "sin actividad hace más de 7 días".

**Columnas:**

| Columna | Teléfono | Tablet | Escritorio |
|---|---|---|---|
| Nombre + negocio (enlace a la ficha) | ✓ | ✓ | ✓ |
| Estado (`StatusBadge`) | ✓ | ✓ | ✓ |
| Teléfono (enlace `tel:`) | — | ✓ | ✓ |
| Origen | — | — | ✓ |
| Responsable (solo con `equipo.ver`) | — | — | ✓ |
| Próxima actividad o "Sin seguimiento" (tono warning) | — | ✓ | ✓ |
| Creado | — | — | ✓ |

Tonos de estado: nuevo = info, contactado = neutral, calificado = positive, descartado = negative, convertido = positive con el texto "Convertido".

**Acciones por fila:**
- `RowActionIcons`: Ver; Editar (`lead.editar`).
- `RowActionsMenu`: Registrar actividad (`actividad.crear`), Convertir (`lead.convertir`, solo si no está convertido ni descartado), Reasignar (`asignacion.gestionar`), Eliminar (`lead.eliminar`, nunca si está convertido).

**Acción masiva:** con `asignacion.gestionar` aparecen casillas de selección y la acción "Reasignar seleccionados" (§4.4).

**Vacío:**
- Sin leads: `EmptyState` "Todavía no tienes leads", "Registra el primer prospecto que te contacte." y el botón "Nuevo lead" (si tiene `crear`).
- Con filtros: "No hay leads con estos filtros" + "Quitar filtros".

### 3.2 Lead: ficha y formulario (`/leads/nuevo`, `/leads/[id]`)

**Campos** (`FormSection`):

| Sección | Campo | Regla |
|---|---|---|
| Contacto | Nombre del contacto | Obligatorio, de 2 a 120 caracteres |
| | Negocio o empresa | Opcional, hasta 120 |
| | Teléfono | Teléfono **o** correo obligatorio. Se normaliza a +505 cuando trae 8 dígitos |
| | Correo | Formato válido |
| | RUC o cédula | Opcional; se usa para detectar duplicados |
| | Dirección | Opcional, hasta 300 |
| Comercial | Origen | Obligatorio; catálogo de orígenes activos |
| | Tipo de cliente | Opcional: mayorista o detal (el mismo dominio que `crm.clientes.tipo_cliente`) |
| | Interés o necesidad | Opcional, hasta 2000 ("cemento y hierro para obra en Masaya") |
| | Responsable | Por defecto, quien lo crea. Solo se puede editar con `asignacion.gestionar`; si no, es de solo lectura |

**Duplicados:** al salir del campo de teléfono, correo o RUC, la RPC busca coincidencias en leads y en clientes. Si encuentra alguna, muestra un aviso que **no bloquea** el guardado: "Ya existe un cliente con este teléfono: Ferretería X (n.º 123)", con un enlace a ese registro si está dentro de su alcance.

**Ficha (`/leads/[id]`):**
- `PageHeader`: nombre y negocio, estado.
- Acciones: "Convertir" (primaria, `lead.convertir`), "Cambiar estado" (`lead.editar`, con las opciones válidas según la §5) y, en el menú, "Reasignar" y "Eliminar".
- Pestañas (`FormTabs`): **Datos** (formulario; editable con `lead.editar` mientras no esté convertido) · **Actividades** (línea de tiempo del lead, como en §3.5) · **Conversión** (solo si está convertido: enlaces al cliente y a la oportunidad creados).
- Lead convertido: los datos quedan en solo lectura, con el aviso "Este lead se convirtió el dd/mm/aaaa. Edita los datos en el cliente."
- Descartar pide un motivo de texto obligatorio, de 3 a 300 caracteres, dentro del diálogo.

**Éxito:** "Lead guardado." · "Lead descartado." · "Lead eliminado." (al eliminar se vuelve a la lista).

**Teléfono:** una columna, la barra fija de Llamar, WhatsApp y Registrar actividad, y las pestañas con desplazamiento horizontal propio.

### 3.3 Conversión de lead (`/leads/[id]/convertir`)

Es una página de dos pasos, no un diálogo, porque tiene varios campos. Exige `crm.ventas.lead.convertir`. No exige `clientes.crear` ni `oportunidad.crear`: convertir alcanza (plan 16 §3).

**Paso 1. Cliente:**
- La RPC propone clientes parecidos por RUC, teléfono y nombre.
- Opción A, "Vincular a un cliente existente": lista de candidatos con radio (nombre, n.º, RUC, teléfono) y un buscador para otro cliente.
- Opción B, "Crear cliente nuevo": nombre, teléfono, RUC, dirección y tipo, precargados del lead y editables.
- Si hay un RUC idéntico, la opción B se deshabilita con el texto "Ya existe un cliente con este RUC: vincúlalo." El servidor también la rechaza.

**Paso 2. Oportunidad:**
- Nombre (obligatorio; por defecto "<Negocio>: <interés>", recortado a 120).
- Etapa inicial (la primera etapa abierta por defecto; solo etapas abiertas).
- Monto estimado en US$ (obligatorio, ≥ 0).
- Fecha estimada de cierre (obligatoria, desde hoy).
- Responsable (el del lead; solo cambia con `asignacion.gestionar`).

**Confirmación:** "Convertir lead". La operación es atómica: si algo falla, no se crea nada.

**Éxito:** toast "Lead convertido. Se creó la oportunidad <nombre>." y navegación a `/oportunidades/[id]`. Las actividades agendadas del lead se pasan a la oportunidad (supuesto S3).

**Lead ya convertido o descartado:** la página muestra `EmptyState` "Este lead ya no se puede convertir" con un enlace a la ficha.

### 3.4 Embudo: tablero (`/oportunidades`)

**`PageHeader`:** "Mis oportunidades" u "Oportunidades". Descripción: "<n> abiertas · US$ X estimado · US$ Y ponderado". Selector Tablero / Lista y botón "Nueva oportunidad" (`oportunidad.crear`).

**Filtros:** buscar (nombre o cliente), responsable (`equipo.ver`), cierre (Todos · Este mes · Próximo mes · Vencidas).

**Columnas del tablero:**
- Solo las etapas **abiertas** activas, en su orden.
- Encabezado: nombre de la etapa · probabilidad % · número de oportunidades · US$ total · US$ ponderado.
- Tarjeta (`button`/`Link` que lleva a la ficha):
  - nombre (truncado, `min-w-0`) y cliente;
  - monto en US$;
  - fecha de cierre, con `StatusBadge` warning "Vencida" si ya pasó;
  - responsable (con `equipo.ver`);
  - menú "⋯" con "Mover a…" (lista de etapas abiertas), "Marcar ganada", "Marcar perdida" y "Registrar actividad".
- Cada columna muestra hasta 50 tarjetas. Si hay más: "Ver las <n> en la lista", que lleva a la lista filtrada por esa etapa. Los totales del encabezado cubren todas las oportunidades, no solo las mostradas.

**Mover entre etapas abiertas:**
- En escritorio, arrastrar y soltar es una **mejora opcional**. El mecanismo base, y el único accesible con teclado y táctil, es el menú "Mover a…".
- Al moverla, la probabilidad toma la de la nueva etapa.
- Toast: "Movida a <etapa>." La tarjeta se mueve de forma optimista; si la RPC falla, vuelve a su lugar con el error.
- El cambio de columna se anuncia con `aria-live="polite"`.
- Recomiendo **no agregar una librería de arrastre**: el arrastre nativo de HTML5 no funciona con el dedo.

**Ganada o perdida:**
- Solo con una acción explícita y su diálogo (§4.1, §4.3), nunca por arrastre.
- Debajo del tablero hay dos enlaces: "Ganadas este mes (n)" y "Perdidas este mes (n)", que llevan a la lista filtrada.

**Teléfono:**
- No se muestran columnas lado a lado.
- Arriba hay un `select` "Etapa: Calificado (12 · US$ 8,400)" y debajo las tarjetas de esa etapa en una columna. La etapa elegida se guarda en `?etapa=`.
- Mover solo con el menú.

**Tablet:** columnas con desplazamiento horizontal **dentro del tablero** (`overflow-x-auto`, columnas de ancho fijo `w-72`). El resto de la página no se desplaza a lo ancho.

**Vacío:**
- Sin oportunidades abiertas: "No hay oportunidades abiertas", "Convierte un lead o crea una oportunidad directamente.", con los botones "Ver leads" y "Nueva oportunidad".
- Sin etapas configuradas: `EmptyState` "El embudo no tiene etapas configuradas", con el enlace "Configurar embudo" si tiene `embudo.gestionar`; si no: "Pide al administrador que configure las etapas."

**Componente nuevo:** el tablero no existe en el kit. Propongo crearlo local en `apps/crm/src/components/embudo/tablero.tsx` y llevarlo a `packages/ui` solo cuando otro módulo lo necesite.

### 3.5 Oportunidad: lista y ficha (`/oportunidades?vista=lista`, `/oportunidades/nueva`, `/oportunidades/[id]`)

**Lista:**

| Columna | Teléfono | Tablet | Escritorio |
|---|---|---|---|
| Nombre + cliente (enlace) | ✓ | ✓ | ✓ |
| Monto US$ (`tabular-nums`, a la derecha) | ✓ | ✓ | ✓ |
| Etapa / estado (`StatusBadge`) | — | ✓ | ✓ |
| Probabilidad | — | — | ✓ |
| Ponderado | — | — | ✓ |
| Fecha de cierre | — | ✓ | ✓ |
| Responsable (con `equipo.ver`) | — | — | ✓ |

- Estado: abierta = info con el nombre de la etapa, ganada = positive, perdida = negative.
- Filtros: los del tablero más estado (Abiertas por defecto · Ganadas · Perdidas · Todas), etapa y rango de fecha de cierre.
- Acciones: Ver; Editar (`oportunidad.editar`); en el menú, Reasignar (`asignacion.gestionar`) y Eliminar (`oportunidad.eliminar`). Con `asignacion.gestionar`, acción masiva "Reasignar".

**Formulario (crear o editar):**
- Nombre: obligatorio, de 3 a 120.
- Cliente: obligatorio; selector con búsqueda (§7 `crm_clientes_buscar`).
- Etapa: solo abiertas.
- Monto estimado en US$: obligatorio, entre 0 y 99,999,999.99.
- Fecha estimada de cierre: obligatoria. Al crear, no puede ser anterior a hoy; al editar, una fecha pasada solo genera aviso.
- Probabilidad %: de 0 a 100. Toma la de la etapa y se puede ajustar; aparece la etiqueta "ajustada" cuando difiere de la etapa.
- Notas: hasta 2000.
- Responsable: con la regla del lead.
- Origen: si viene de un lead, se muestra "Viene del lead <nombre>" en solo lectura.

**Ficha:**
- `PageHeader`: nombre, `StatusBadge` de la etapa o del estado, cliente (enlace a `/clientes/[id]`).
- Acciones: "Mover a…" (`editar`), "Marcar ganada" (`editar`), "Marcar perdida" (`editar`), "Nueva cotización" (`cotizacion.crear`) y "Registrar actividad" (`actividad.crear`). En el menú: Editar, Reasignar, Reabrir (si está ganada o perdida, `editar`) y Eliminar.
- Resumen (`MetricCard` ×3): monto estimado · probabilidad · ponderado. Si está ganada: monto ganado y fecha. Si está perdida: el motivo.
- Pestañas:
  - **Línea de tiempo** (por defecto):
    - Las **actividades** de la oportunidad, ordenadas de la más reciente a la más antigua, con las agendadas arriba en un bloque "Próximas".
    - Los **hitos del sistema**: creada, cambio de etapa, cotización enviada, aprobada o aceptada, ganada, perdida, reabierta y reasignada.
    - Cada actividad muestra icono del tipo, asunto, fecha y hora, responsable, estado y notas (con "ver más").
    - Las agendadas tienen las acciones Completar, Reprogramar y Cancelar (`actividad.editar`).
    - Se usa una lista propia con el estilo de `ActivityFeed`; ese componente no admite iconos ni acciones. No se cambia el kit.
  - **Cotizaciones:** tabla de §3.8 filtrada por esta oportunidad.
  - **Datos:** el formulario.
- La línea de tiempo sigue al registro: el dueño de la oportunidad ve todas sus actividades, aunque las haya registrado otra persona. Sin `actividad.ver` la pestaña no aparece.

**Teléfono:** las acciones primarias van en la barra fija (Registrar actividad y Llamar al teléfono del cliente); las demás en "⋯".

### 3.6 Agenda de actividades (`/actividades`)

**Usuarios y tareas:** el vendedor en la calle ve qué tiene hoy, qué se le venció y lo cierra rápido. El gerente revisa el seguimiento del equipo.

**`PageHeader`:** "Mi agenda" o "Agenda". Botón "Registrar actividad" (`actividad.crear`).

**Pestañas** (en la URL, `?vista=`):
- **Hoy:** agendadas para hoy, en hora de Managua.
- **Vencidas (n):** agendadas cuya fecha y hora ya pasó; el número va en un `StatusBadge` warning.
- **Próximas:** de mañana a 14 días; se puede ampliar con desde y hasta.
- **Completadas:** últimos 30 días.
- **Por defecto:** Vencidas si hay alguna; si no, Hoy.

**Filtros:** tipo, responsable (`equipo.ver`) y "relacionado con" (buscar lead, oportunidad o cliente).

**Elemento** (lista de tarjetas en todos los tamaños, sin tabla, porque es una agenda):
- hora (o fecha + hora en Próximas y Vencidas) e icono del tipo con su texto (no solo el icono);
- asunto y enlace al registro relacionado: "Lead: …", "Oportunidad: …" o "Cliente: …";
- responsable (con `equipo.ver`);
- teléfono del contacto como `tel:` si existe;
- botones: **Completar** (primario), **Reprogramar** y "⋯" (Editar, Cancelar, Eliminar con `actividad.eliminar`).

**Completar:**
- Diálogo con "Resultado" (opcional, hasta 2000) y la casilla "Agendar seguimiento".
- Si la casilla está marcada, el diálogo se amplía con tipo, fecha y hora del seguimiento; ese seguimiento exige `actividad.crear`.
- Toast: "Actividad completada." o "Actividad completada y seguimiento agendado para el dd/mm."

**Reprogramar:** fecha y hora nuevas, que no pueden ser pasadas.

**Cancelar:** `ConfirmDialog destructive` con un motivo opcional.

**Vacío:**
- Hoy: "No tienes actividades para hoy" + "Registrar actividad".
- Vencidas: "Estás al día: no hay actividades vencidas" (tono positivo, sin botón).
- Próximas: "No hay actividades agendadas en los próximos 14 días".

### 3.7 Registrar actividad, formulario rápido (`/actividades/nueva`, `/actividades/[id]`)

Es una página propia, no un modal: en el teléfono se ve a pantalla completa y se llega desde cualquier lado con contexto.
- `?lead=`, `?oportunidad=` o `?cliente=` precargan el registro relacionado y lo dejan fijo.
- `?volver=` es la ruta interna a la que se regresa después de guardar. Se valida que sea relativa y del módulo.

**Campos, en orden:**
1. **Tipo:** botones segmentados con icono y texto: Llamada · Visita · Reunión · Nota · Correo. Es un `radiogroup` que se recorre con las flechas. No tiene valor por defecto.
2. **¿Cuándo?:** dos opciones, "Ya ocurrió" (queda completada) y "Agendar" (queda agendada). La **Nota** solo admite "Ya ocurrió".
3. **Fecha y hora:**
   - Con "Ya ocurrió": por defecto ahora; no puede ser futura.
   - Con "Agendar": obligatoria y debe ser futura.
4. **Asunto:** obligatorio, de 3 a 120 ("Llamar para confirmar entrega de bloques").
5. **Relacionado con:** obligatorio, **exactamente uno**: lead, oportunidad o cliente. Es un combobox con pestañas de tipo y búsqueda, y solo ofrece registros dentro del alcance del usuario (los clientes son de toda la empresa).
6. **Notas o resultado:** opcional, hasta 2000.
7. **Responsable:** por defecto, quien la registra. Agendarla para otra persona exige `asignacion.gestionar` (supuesto S4).

**Botones:** "Guardar" (primario) y "Guardar y registrar otra".
**Éxito:** "Actividad registrada." o "Actividad agendada para el dd/mm a las hh:mm." y vuelta a `?volver` o a la agenda.

**Editar (`/actividades/[id]`):** el mismo formulario.
- Una actividad completada o cancelada solo permite editar asunto y notas.
- El registro relacionado no cambia nunca.

**Validación en la RPC:** que el registro relacionado exista, no esté borrado y esté dentro del alcance; las reglas de fecha según el estado; y que el tipo sea uno de los cinco.

### 3.8 Cotizaciones (`/cotizaciones`, `/cotizaciones/nueva`, `/cotizaciones/[id]`, `/cotizaciones/[id]/imprimir`)

**Lista:**
- `PageHeader`: "Mis cotizaciones" o "Cotizaciones". Botón "Nueva cotización" (`cotizacion.crear`).
- Pestañas: Abiertas (borrador, pendiente, aprobada, enviada; por defecto) · **Por aprobar (n)** (solo con `cotizacion.aprobar`) · Aceptadas · Rechazadas, vencidas y anuladas · Todas.
- Filtros: buscar (número o cliente), responsable (`equipo.ver`) y rango de fechas.

| Columna | Teléfono | Tablet | Escritorio |
|---|---|---|---|
| N.º (mono) + cliente (enlace) | ✓ | ✓ | ✓ |
| Total US$ | ✓ | ✓ | ✓ |
| Estado | ✓ | ✓ | ✓ |
| Fecha | — | ✓ | ✓ |
| Válida hasta | — | — | ✓ |
| Oportunidad | — | — | ✓ |
| Responsable | — | — | ✓ |
| Descuento máx. % | — | — | ✓ (badge si supera el permitido) |

- Tonos de estado: borrador = neutral, pendiente de aprobación = warning, aprobada = info, enviada = info, aceptada = positive, rechazada = negative, vencida = neutral, anulada = negative.
- "Vencida" no se guarda: se calcula cuando está enviada y la fecha de validez ya pasó.

**Editor (`/cotizaciones/nueva?oportunidad=` o `?cliente=`; `/cotizaciones/[id]` en borrador):**

*Encabezado:*
- Cliente (obligatorio; si viene de una oportunidad, se fija al cliente de esa oportunidad).
- Oportunidad (opcional; solo oportunidades abiertas de ese cliente; supuesto S1).
- Atención a (texto, hasta 120).
- Fecha de emisión (hoy, en solo lectura).
- Válida hasta (obligatoria, igual o posterior a la emisión; la regla por defecto está en P6).
- Tipo de cambio de referencia (P5).
- Condiciones (forma de pago, entrega; hasta 2000).

*Líneas:*
- **Producto:** combobox con búsqueda por código o nombre; excluye los descontinuados para ventas.
- **Descripción:** el nombre del producto por defecto, editable, hasta 300.
- **Unidad:** viene del producto, en solo lectura.
- **Cantidad:** mayor que 0, hasta 3 decimales.
- **Precio unitario en US$:** mayor que 0, 2 decimales.
- **Descuento %:** de 0 a 100, 2 decimales.
- **Monto de descuento y total de la línea:** calculados por la aplicación, en solo lectura.
- Se puede agregar, quitar y reordenar líneas (botones ↑↓ con `aria-label`), con un máximo de 200. Hace falta al menos una para guardar.

*Totales* (los calcula el servidor y son los que valen; el cliente muestra una vista previa):
- subtotal bruto, descuento total, subtotal neto, IVA (P2), **total en US$** y total en C$ de referencia;
- "Descuento efectivo" = descuento total ÷ subtotal bruto.
- **Aviso en vivo:** si alguna línea o el descuento efectivo supera el máximo configurado: `Banner` warning "Esta cotización supera el descuento permitido (X %). Al enviarla quedará pendiente de aprobación." Las líneas afectadas se marcan con `aria-invalid` y un texto (nunca solo con color).

*Botones:*
- "Guardar borrador" (`crear` o `editar`).
- "Enviar al cliente" (`editar`):
  - dentro del límite: diálogo "¿Marcar como enviada?" → estado enviada;
  - fuera del límite: el botón dice "Solicitar aprobación" → estado pendiente.

*Teléfono:* cada línea es una tarjeta apilada con producto, cantidad × precio, descuento y total. Los totales y el botón principal van en una barra fija abajo. "Agregar producto" abre la búsqueda a pantalla completa.

**Vista de una cotización que no está en borrador (`/cotizaciones/[id]`):**
- Solo lectura con las mismas secciones e historial de estado (quién aprobó o rechazó, con su comentario).
- Acciones según estado y permiso (§5.3):
  - Aprobar / Rechazar aprobación (`aprobar`, solo si está pendiente);
  - Enviar (`editar`, si está aprobada);
  - Marcar aceptada / rechazada por el cliente (`editar`, si está enviada);
  - Anular (`anular`);
  - Duplicar como nueva (`crear`);
  - Descargar PDF (`ver`).

**Aprobación:**
- Pestaña "Por aprobar": el aprobador ve número, cliente, responsable, total y descuento efectivo frente al máximo.
- Botones Aprobar y Rechazar. Rechazar exige un comentario (de 3 a 500) y devuelve la cotización a borrador con ese comentario visible en el editor.
- Toast: "Cotización aprobada. <responsable> ya puede enviarla."

**Anulación:**
- `ConfirmDialog destructive` con un motivo obligatorio (de 3 a 300) dentro.
- Texto: "La cotización COT-… quedará anulada y no se podrá reactivar. Si necesitas cambiarla, duplícala."

**PDF (`/cotizaciones/[id]/imprimir`):**
- Página fuera del grupo `(app)`, sin `NexoShell`, con su propia revisión de sesión y de `cotizacion.ver`.
- Usa Inter y la paleta neutral.
- Contenido: encabezado de la empresa (P3), número, fechas, cliente y "atención a", líneas, totales, condiciones y vendedor.
- Botón "Descargar PDF", con la impresión del navegador (`window.print`) y CSS de impresión.
- Marca de agua por estado: borrador "BORRADOR · NO VÁLIDA"; pendiente "PENDIENTE DE APROBACIÓN"; anulada "ANULADA"; vencida "VENCIDA". Sin marca: aprobada, enviada y aceptada. Si se genera un archivo real o no se decide en P3.

**Vacío de la lista:** "Todavía no hay cotizaciones", "Crea una desde una oportunidad o directamente para un cliente." + "Nueva cotización".
**Catálogo sin productos activos:** el buscador muestra "No hay productos activos en el catálogo. Pide que los den de alta en Productos."

### 3.9 Configuración del embudo (`/configuracion/embudo`)

Exige `crm.configuracion.embudo.gestionar`; sin él, redirige. Tiene cuatro pestañas (`FormTabs`).

**Etapas:**
- Tabla con orden (botones ↑↓), nombre (obligatorio, de 2 a 60, único), probabilidad %, tipo (abierta, ganada, perdida), activa y número de oportunidades abiertas.
- Reglas, validadas en la RPC:
  - siempre **una** etapa ganada (100 %) y **una** perdida (0 %), creadas por el sistema: se pueden renombrar, pero no borrar ni desactivar, y su probabilidad no se edita;
  - al menos una etapa abierta activa;
  - probabilidad de las abiertas entre 0 y 100 (si no sube de una etapa a la siguiente, solo se avisa);
  - una etapa con oportunidades no se borra, solo se desactiva; y para desactivarla no puede tener oportunidades **abiertas**. El mensaje dice: "Mueve sus 4 oportunidades a otra etapa antes de desactivarla."
- Cambiar la probabilidad de una etapa **no** reescribe la de las oportunidades que tienen la probabilidad ajustada a mano. Sí actualiza las que siguen la de la etapa. El aviso: "Se actualizarán 12 oportunidades."

**Orígenes de lead:** nombre (único) y activo. No se borran los que tienen leads; se desactivan.

**Motivos de pérdida:** nombre, "pide detalle" (sí o no) y activo. La misma regla de borrado.

**Cotizaciones:** descuento máximo sin aprobación, de 0 a 100 %, 2 decimales. Más los campos que salgan de P2, P5 y P6 (IVA, tipo de cambio, validez por defecto).

**Guardar:** se hace por fila o por formulario. Toast: "Etapa guardada.", etc. Cada cambio deja registro en `core.audit_log`.

**Teléfono:** las tablas se vuelven tarjetas por fila.

## 4. Flujos de punta a punta

### 4.1 Lead → conversión → oportunidad → cotización → ganada

1. El vendedor entra por el menú **Ventas → Leads** o por el **Dashboard → "Nuevo lead"** (`QuickActions`). Abre "Nuevo lead", lo guarda y queda en estado nuevo.
2. Llama desde la ficha (`tel:`) y luego "Registrar actividad", que llega con el lead precargado: Llamada, "Ya ocurrió", con el resultado. El lead pasa solo de nuevo a contactado (supuesto S2).
3. "Cambiar estado → Calificado" (opcional) y luego "Convertir" (§3.3). Se vincula o crea el cliente y se crea la oportunidad en la primera etapa abierta.
4. En la ficha de la oportunidad usa "Nueva cotización", arma las líneas y la guarda. Dentro del límite, la envía (queda enviada) y descarga el PDF para compartirlo.
5. Mueve la oportunidad a "Cotización enviada" o "Negociación" con "Mover a…". Agenda el seguimiento.
6. El cliente acepta: "Marcar aceptada" en la cotización. El diálogo ofrece "Marcar también la oportunidad como ganada por US$ <total>" (casilla marcada por defecto si la oportunidad está abierta y el usuario tiene `oportunidad.editar`).
7. La oportunidad queda ganada con su monto y fecha de cierre (hoy, editable a una fecha pasada), probabilidad 100 % y un hito en la línea de tiempo. Las demás cotizaciones abiertas de esa oportunidad se ofrecen para anular en el mismo diálogo, solo si el usuario tiene `cotizacion.anular`.

### 4.2 Cotización con descuento alto → aprobación

1. El vendedor pone 18 % de descuento en una línea con un máximo configurado de 10 %. Ve el aviso en vivo y el botón dice "Solicitar aprobación".
2. Queda pendiente de aprobación: no se puede editar, el PDF sale con marca de agua y no se puede marcar como enviada (la RPC lo rechaza).
3. El gerente la ve en el Dashboard ("Cotizaciones por aprobar") o en **Cotizaciones → Por aprobar**, abre la vista y:
   - **la aprueba:** queda aprobada, el vendedor la envía y luego sigue el flujo 4.1 desde el paso 4;
   - **la rechaza con comentario:** vuelve a borrador con el comentario; el vendedor la ajusta y repite.
4. Si se edita una aprobada (vuelve a borrador; ver §5.3) y sigue fuera del límite, necesita una nueva aprobación.

### 4.3 Oportunidad perdida

1. "Marcar perdida" desde la ficha o la tarjeta del tablero.
2. Diálogo:
   - motivo (obligatorio; catálogo activo);
   - detalle (obligatorio si el motivo "pide detalle"; hasta 500);
   - si tiene cotizaciones enviadas o aprobadas: "Las cotizaciones abiertas (2) quedarán como rechazadas", en modo informativo;
   - si tiene actividades agendadas: casilla "Cancelar las 3 actividades agendadas", marcada por defecto.
3. Queda perdida, con probabilidad 0 y fecha de cierre hoy. Sale del tablero y aparece en "Perdidas este mes".
4. "Reabrir" (`oportunidad.editar`) la devuelve a una etapa abierta elegida en el diálogo y borra el motivo. Las cotizaciones no se reactivan.

### 4.4 Reasignación (`crm.ventas.asignacion.gestionar`)

1. **Una sola:** "Reasignar" en la ficha o fila de un lead, una oportunidad o una cotización.
   **Varias:** se seleccionan en la lista y se usa "Reasignar seleccionados". Pensado para la rotación de vendedores que ya documenta el plan 15.
2. Diálogo:
   - nuevo responsable: usuarios activos de la empresa que tienen el `*.ver` de ese recurso;
   - casilla "Mover también lo relacionado abierto", marcada por defecto:
     - en un lead, sus actividades agendadas;
     - en una oportunidad, sus actividades agendadas y sus cotizaciones en borrador, pendientes, aprobadas o enviadas.
3. La RPC valida que cada registro esté dentro del alcance del que reasigna y que el nuevo responsable tenga el permiso de ver. Toast: "<n> registros reasignados a <nombre>."
4. Queda un hito "Reasignada de A a B" en la línea de tiempo y un registro en `core.audit_log`. El vendedor anterior deja de verlos si no tiene `equipo.ver`.
5. Sin `asignacion.gestionar`, la acción y las casillas no aparecen. Si se envía un responsable distinto a una RPC de guardar, la RPC lo rechaza.

## 5. Máquinas de estado (la RPC es la autoridad; cualquier otra transición se rechaza)

### 5.1 Lead

```text
nuevo ──► contactado ──► calificado
  │  ╲         │              │
  │   ╲────────┼──────────────┼──► convertido (terminal; solo crm_lead_convertir)
  ▼            ▼              ▼
descartado ◄───┴──────────────┘     descartado ──reactivar──► contactado
```

- **nuevo → contactado:** automático al registrar la primera actividad completada (S2), o a mano.
- **Manual (`lead.editar`):** entre nuevo, contactado y calificado en cualquier dirección; descartar pide motivo; reactivar lleva un descartado a contactado.
- **convertir (`lead.convertir`):** desde nuevo, contactado o calificado. El lead convertido no se edita, no se descarta y no se elimina.
- **eliminar (`lead.eliminar`):** borrado lógico, en cualquier estado excepto convertido.

### 5.2 Oportunidad (estado derivado del tipo de la etapa)

```text
abierta(etapa i) ⇄ abierta(etapa j)          mover (editar)
abierta ──ganar──► ganada                    monto_ganado ≥ 0, fecha_cierre ≤ hoy
abierta ──perder─► perdida                   motivo obligatorio
ganada | perdida ──reabrir──► abierta(etapa elegida)
cualquiera ──eliminar──► (borrado lógico)    salvo con cotizaciones aceptadas
```

- La probabilidad es la de la etapa salvo que se ajuste a mano. Ganada es siempre 100 y perdida 0.
- Ponderado = monto estimado × probabilidad.
- Una oportunidad cerrada no se edita (solo se reabre); las notas sí se pueden editar.

### 5.3 Cotización

```text
borrador ──enviar (≤ máx)──► enviada
borrador ──enviar (> máx)──► pendiente_aprobacion ──aprobar──► aprobada ──enviar──► enviada
                                    └──rechazar aprobación (comentario)──► borrador
aprobada ──editar──► borrador (pierde la aprobación)
enviada ──► aceptada | rechazada (por el cliente)       [editar]
enviada + válida_hasta < hoy ⇒ se muestra "vencida"; puede marcarse aceptada (P6)
{borrador?, pendiente, aprobada, enviada} ──anular (motivo)──► anulada (terminal)   [anular]
oportunidad perdida ⇒ sus enviadas y aprobadas → rechazada
```

- Solo el borrador se edita. Para cambiar una enviada se duplica: la copia es un borrador nuevo con su propio número.
- La RPC vuelve a calcular los totales y la necesidad de aprobación cada vez que se guarda o se envía. El valor que manda el cliente no cuenta.
- El número se asigna al crearla, es correlativo por empresa (`COT-2026-00001`) y no se reutiliza.

### 5.4 Actividad

```text
agendada ──completar──► completada
agendada ──cancelar───► cancelada
agendada ──reprogramar─► agendada (nueva fecha y hora, futura)
(alta como "Ya ocurrió") ──► completada
cualquiera ──eliminar──► (borrado lógico)     [actividad.eliminar]
```

- "Vencida" se calcula (agendada con fecha y hora pasadas); no es un estado guardado.
- Completada y cancelada son terminales: solo se editan el asunto y las notas.

## 6. KPIs para el Dashboard del CRM (`/dashboard`)

Van en una sección "Embudo comercial" debajo de los KPIs actuales de clientes. Cada bloque aparece solo con su `*.ver`.

- **Alcance:** sin `equipo.ver`, "Mis números"; con él, el equipo, más un enlace "Solo los míos" (`?alcance=mio`).
- **Fuente:** `crm_embudo_resumen`.
- **Sin datos:** `EmptyState` con el siguiente paso; nunca ceros inventados.

| KPI | Cálculo | Permiso |
|---|---|---|
| Oportunidades abiertas | Número + US$ estimado total | `oportunidad.ver` |
| Monto ponderado | Σ monto × probabilidad de las abiertas | `oportunidad.ver` |
| Ganado este mes | Número + Σ monto ganado (fecha de cierre en el mes, hora de Managua) | `oportunidad.ver` |
| Tasa de cierre del mes | Ganadas ÷ (ganadas + perdidas) cerradas en el mes; "—" si no hubo cierres | `oportunidad.ver` |
| Embudo por etapa | Barras por etapa abierta (número y US$), con el patrón de "Distribución" del dashboard actual | `oportunidad.ver` |
| Cierre vencido | Abiertas con fecha estimada pasada (tono warning) | `oportunidad.ver` |
| Actividades de hoy / vencidas | Dos números, con enlace a la agenda | `actividad.ver` |
| Leads sin seguimiento | Nuevos o contactados sin actividad en 7 días | `lead.ver` |
| Leads nuevos este mes | Número | `lead.ver` |
| Cotizaciones por aprobar | Número con enlace a la pestaña; aparece solo si es mayor que 0 | `cotizacion.aprobar` |
| Cotizaciones enviadas abiertas | Número + US$ (enviadas sin vencer) | `cotizacion.ver` |

`QuickActions` del dashboard: "Nuevo lead" (`lead.crear`), "Registrar actividad" (`actividad.crear`), "Nueva cotización" (`cotizacion.crear`), "Ver mi agenda" (`actividad.ver`).

## 7. RPC necesarias (`public.crm_*`)

Todas siguen el patrón de las RPC de Metas:
- son `security definer` y reciben `p_company_id` primero;
- exigen el permiso con `core.fn_exigir_permiso`;
- aplican el **filtro de alcance**: sin `equipo.ver`, solo registros con `responsable_id = auth.uid()`;
- excluyen los borrados lógicos;
- las escrituras reciben `p_version` (control de cambios simultáneos) y escriben en `core.audit_log` con acciones `crm.*`;
- devuelven `jsonb`.

Lo que está fuera de alcance responde "no encontrado".

| RPC | Entrada (funcional) | Salida | Permiso |
|---|---|---|---|
| `crm_mis_permisos` | — | Códigos `crm.*` del usuario | sesión + `crm.ver_modulo` |
| `crm_embudo_config` | — | Etapas, orígenes y motivos activos, descuento máximo y parámetros | cualquier `crm.ventas.*.ver` |
| `crm_embudo_config_guardar_etapa` / `_origen` / `_motivo` / `_parametros` / `crm_embudo_reordenar_etapas` | Fila o lista de ids en orden | La fila guardada o un error de regla (§3.9) | `crm.configuracion.embudo.gestionar` |
| `crm_responsables` | Recurso (lead, oportunidad, actividad, cotización) | Usuarios activos que tienen el `*.ver` del recurso | `equipo.ver` o `asignacion.gestionar` |
| `crm_reasignar` | Recurso, ids[], nuevo responsable, incluir relacionados | Número de registros movidos | `asignacion.gestionar` (+ alcance) |
| `crm_clientes_buscar` | Texto, límite | id, n.º, nombre, RUC, teléfono | `crm.clientes.ver` o `lead.convertir` |
| `crm_productos_buscar` | Texto, límite | id, código, nombre, unidad, es servicio (**sin costo**; excluye los descontinuados para ventas) | `cotizacion.crear` o `cotizacion.editar` (P4) |
| `crm_leads_listar` | Estado(s), origen, responsable, buscar, sin seguimiento, límite, desplazamiento | `{total, conteos_por_estado, filas}` | `lead.ver` |
| `crm_lead_obtener` | id | Lead + próximas actividades + acciones permitidas | `lead.ver` |
| `crm_lead_guardar` | id o null, datos, versión | id, versión | `lead.crear` / `lead.editar` (cambiar el responsable: + `asignacion.gestionar`) |
| `crm_lead_duplicados` | Teléfono, correo, RUC, nombre | Coincidencias en leads (dentro del alcance) y en clientes | `lead.crear` o `lead.editar` |
| `crm_lead_cambiar_estado` | id, estado, motivo, versión | Estado nuevo | `lead.editar` |
| `crm_lead_candidatos_cliente` | id | Clientes parecidos | `lead.convertir` |
| `crm_lead_convertir` | id, cliente (existente o datos nuevos), datos de la oportunidad, versión | cliente_id, oportunidad_id (operación atómica) | `lead.convertir` |
| `crm_lead_eliminar` | id | ok | `lead.eliminar` |
| `crm_embudo_tablero` | Responsable, buscar, filtro de cierre, límite por etapa | Etapas[{totales, ponderado, filas}] + conteos de ganadas y perdidas del mes | `oportunidad.ver` |
| `crm_oportunidades_listar` | Estado, etapa, responsable, buscar, rango de cierre, página | `{total, filas}` | `oportunidad.ver` |
| `crm_oportunidad_obtener` | id | Oportunidad + resumen de cotizaciones + acciones permitidas | `oportunidad.ver` |
| `crm_oportunidad_linea_tiempo` | id, página | Actividades + hitos | `oportunidad.ver` (actividades solo con `actividad.ver`) |
| `crm_oportunidad_guardar` | id o null, datos, versión | id, versión | `oportunidad.crear` / `oportunidad.editar` |
| `crm_oportunidad_mover_etapa` | id, etapa (abierta), versión | Etapa, probabilidad | `oportunidad.editar` |
| `crm_oportunidad_ganar` | id, monto ganado, fecha, cotización opcional, versión | ok | `oportunidad.editar` |
| `crm_oportunidad_perder` | id, motivo, detalle, cancelar actividades, versión | ok + número de cotizaciones rechazadas | `oportunidad.editar` |
| `crm_oportunidad_reabrir` | id, etapa, versión | ok | `oportunidad.editar` |
| `crm_oportunidad_eliminar` | id | ok, o error si tiene cotizaciones aceptadas | `oportunidad.eliminar` |
| `crm_agenda` | Vista, desde y hasta, tipo, responsable, relacionado, página | Filas + conteos {hoy, vencidas, próximas} | `actividad.ver` |
| `crm_actividad_obtener` / `crm_actividad_guardar` | id o null, tipo, asunto, uno de {lead, oportunidad, cliente}, fecha y hora, estado inicial, notas, responsable, versión | id | `actividad.ver` / `actividad.crear` / `actividad.editar` (otro responsable: + `asignacion.gestionar`) |
| `crm_actividad_completar` | id, resultado, seguimiento opcional, versión | ok + id del seguimiento | `actividad.editar` (+ `actividad.crear` si hay seguimiento) |
| `crm_actividad_cancelar` | id, motivo, versión | ok | `actividad.editar` |
| `crm_actividad_eliminar` | id | ok | `actividad.eliminar` |
| `crm_cotizaciones_listar` | Estado(s), por aprobar, cliente, oportunidad, responsable, fechas, buscar, página | `{total, conteos, filas}` | `cotizacion.ver` (la pestaña por aprobar: `cotizacion.aprobar`) |
| `crm_cotizacion_obtener` | id | Encabezado, líneas, totales, historial, acciones permitidas | `cotizacion.ver` |
| `crm_cotizacion_guardar` | id o null, encabezado, líneas[], versión | id, número, totales, requiere aprobación | `cotizacion.crear` / `cotizacion.editar` (solo borrador) |
| `crm_cotizacion_enviar` | id, versión | Estado resultante (enviada o pendiente) | `cotizacion.editar` |
| `crm_cotizacion_aprobar` / `crm_cotizacion_rechazar_aprobacion` | id, comentario (obligatorio al rechazar) | ok | `cotizacion.aprobar` |
| `crm_cotizacion_resultado` | id, aceptada o rechazada, motivo, ganar oportunidad, anular hermanas | ok | `cotizacion.editar` (+ `oportunidad.editar` / `cotizacion.anular` según lo pedido) |
| `crm_cotizacion_anular` | id, motivo | ok | `cotizacion.anular` |
| `crm_cotizacion_duplicar` | id | id del nuevo borrador | `cotizacion.crear` |
| `crm_cotizacion_impresion` | id | Datos completos + empresa + marca de agua | `cotizacion.ver` |
| `crm_embudo_resumen` | Alcance (mío o equipo) | Bloques de §6 según los permisos | cada bloque, su `*.ver` |

Nota de esquema para el coordinador: `actividades` y `cotizaciones` van particionadas por mes. Las rutas usan solo `id` y la RPC lo localiza. Las líneas de la cotización no se exponen sueltas.

## 8. Criterios de aceptación (comprobables)

**Menú y permisos**
1. Un usuario con la plantilla Vendedor ve Leads, Oportunidades, Agenda y Cotizaciones con los iconos de §1. No ve "Embudo comercial" en Configuración. Ningún hijo dice "Pronto".
2. Un usuario sin `crm.ventas.lead.ver` no ve "Leads". Si entra a `/crm/leads` lo redirige y si llama a `crm_leads_listar` recibe "sin permiso".
3. Vendedor A no ve en ninguna lista, tablero ni agenda los registros de B. Si abre `/crm/oportunidades/<id de B>` recibe "No encontramos este registro…". Las RPC con ese id lo rechazan.
4. Un Gerente (`equipo.ver`) ve los de todos, con el filtro de responsable. "Solo los míos" filtra por `auth.uid()`.
5. Sin `asignacion.gestionar`, el responsable es de solo lectura, no hay casillas ni "Reasignar", y enviar otro responsable a `crm_lead_guardar` falla.
6. El Gerente no ve "Eliminar" en leads, oportunidades ni actividades; el Administrador sí. Después de eliminar con confirmación, el registro desaparece de las listas y en la base queda marcado como borrado.
7. Sin `cotizacion.aprobar` no aparecen la pestaña "Por aprobar" ni los botones, y llamar a `crm_cotizacion_aprobar` falla.
8. Un Vendedor sin ningún permiso `productos.*` puede buscar y agregar productos en una cotización. No ve costos.

**Leads y conversión**
9. Guardar un lead sin teléfono ni correo, o sin origen, muestra el error junto al campo y no llama a la RPC. La RPC rechaza lo mismo si se le llama directamente.
10. Un teléfono que coincide con un cliente existente muestra el aviso de duplicado y no impide guardar.
11. Convertir con "cliente nuevo" y un RUC que ya existe se rechaza. Vincular a uno existente crea solo la oportunidad. En ambos casos el lead queda convertido, de solo lectura, con enlaces al cliente y a la oportunidad. Si falla la creación de la oportunidad, no queda ningún cliente creado.
12. Un lead convertido o descartado no ofrece "Convertir" y `crm_lead_convertir` lo rechaza.

**Oportunidades**
13. "Mover a…" desde el menú de la tarjeta funciona con teclado y en un teléfono. Actualiza la columna, los totales y la probabilidad, que pasa a ser la de la etapa.
14. "Marcar perdida" sin motivo no se puede confirmar. Con el motivo, la oportunidad sale del tablero, sus cotizaciones enviadas pasan a rechazada y sus agendadas se cancelan si la casilla estaba marcada.
15. El ponderado del encabezado de una columna es igual a Σ monto × probabilidad de **todas** sus oportunidades, aunque se muestren solo 50.
16. En un teléfono (360 px) el tablero muestra una etapa a la vez con el selector, sin desplazamiento horizontal de la página.

**Actividades**
17. Una actividad "Ya ocurrió" con fecha futura, o "Agendar" con fecha pasada, se rechaza en el cliente y en la RPC. Una actividad sin registro relacionado, o con dos, también se rechaza.
18. Una agendada para ayer aparece en "Vencidas" y suma al KPI. Al completarla desaparece de ahí.
19. "Completar" con "Agendar seguimiento" crea una agendada nueva ligada al mismo registro.
20. Abrir `/actividades/nueva?oportunidad=<id>` precarga y fija la oportunidad, y después de guardar vuelve a la ficha.

**Cotizaciones**
21. Con un máximo de 10 %, una línea al 12 % muestra el aviso. "Enviar" deja la cotización pendiente y `crm_cotizacion_enviar` nunca la deja enviada. Después de "Aprobar" queda aprobada y el vendedor puede enviarla.
22. Un total manipulado en el cliente no se guarda: la RPC recalcula y devuelve el total correcto.
23. Una enviada no se puede editar. "Duplicar" crea un borrador con un número nuevo.
24. "Anular" exige motivo y deja la cotización anulada. El PDF muestra "ANULADA".
25. El PDF de un borrador lleva la marca "BORRADOR · NO VÁLIDA". El de una aprobada o enviada no lleva marca. La página de impresión sin `cotizacion.ver` no muestra datos.
26. Montos con `US$ 1,234.56`, C$ con la regla de P5 y fechas dd/mm/aaaa en hora de Managua.

**Configuración**
27. No se puede desactivar ni borrar la etapa ganada ni la perdida. Desactivar una etapa con oportunidades abiertas se rechaza con el número de oportunidades.
28. Reordenar etapas cambia el orden de las columnas del tablero.

**Dashboard y estados generales**
29. Con tablas vacías, el Dashboard muestra `EmptyState` con su siguiente paso, sin números inventados. Cada KPI coincide con un conteo manual en la base para un usuario de prueba (prefijo PRUEBA).
30. Cuando una RPC falla, se muestra un mensaje comprensible sin SQL ni ids. Cuando se guarda con éxito, aparece un toast y la lista se actualiza.
31. Todos los botones de solo icono tienen `aria-label`. Los diálogos se cierran con Escape y devuelven el foco (si se aprueba §2). No hay estados comunicados solo por color.
32. `pnpm verify` en verde.

## 9. Fuera de alcance

- El pedido comercial.
- Listas de precios.
- Enviar correos o WhatsApp desde Nexo: "Enviar" solo registra el envío.
- Notificaciones en el topbar.
- Una vista de calendario mensual.
- Geolocalización de visitas.
- Uso sin conexión: el uso offline lo cubrirá Nexo Mobile.
- Papelera o restauración de borrados.
- Reportes en Análisis más allá del Dashboard.
- Una sección de actividad comercial en la ficha de Cliente: se recomienda para el corte siguiente.
- Importar leads.
- Corregir que el ítem "Clientes" no revise su permiso: hallazgo aparte.

## 10. Preguntas abiertas para el usuario (RESPONDIDAS 2026-10-19)

> **Decisión del usuario (2026-10-19):** "De acuerdo con todo: acepto las recomendaciones de P1–P7 y los datos iniciales (S6)". Las recomendaciones de la tabla pasan a ser las reglas vigentes, y los supuestos S1–S6 también se aceptan. En S5, el vendedor no descarta sus borradores: se quedan como borradores. Los datos de la empresa para el encabezado del PDF (P3) se guardan como parámetros editables en Configuración del embudo.

| # | Pregunta | Recomendación |
|---|---|---|
| P1 | Sin listas de precios, el vendedor digita el precio. Cualquiera puede bajar el precio en vez de poner descuento y saltarse la aprobación. ¿Se acepta eso por ahora? | Aceptarlo en este corte: el control queda como declarativo y se documenta. Además, mostrar en la vista del aprobador el costo de referencia del producto a quien tenga `productos.catalogo.costo.ver`. Cerrar el hueco cuando existan listas de precios |
| P2 | ¿Las cotizaciones llevan IVA (15 %)? ¿Los precios se digitan con o sin IVA, y hay clientes exentos? | Precios sin IVA; IVA 15 % configurable en Configuración del embudo; casilla "Exento de IVA" por cotización |
| P3 | PDF: ¿basta con la impresión del navegador ("Guardar como PDF") o hace falta un archivo real para mandar por WhatsApp desde el teléfono, lo que requiere una dependencia nueva? ¿Qué datos de la empresa van en el encabezado (razón social, RUC, dirección, teléfono, logo)? | Empezar con la impresión del navegador, sin dependencia nueva. Sacar el encabezado del logo de `core.platform_settings` y de campos de la empresa que haya que confirmar |
| P4 | Para cotizar, ¿se crea una RPC del CRM que lea el catálogo de productos sin costos (`crm_productos_buscar`), o se asigna `productos.catalogo.producto.ver` a los vendedores? | La RPC del CRM, que exige `cotizacion.crear` o `cotizacion.editar`. No hace falta un permiso nuevo |
| P5 | ¿Qué tipo de cambio se usa para el C$ de referencia en la cotización? | Un parámetro en Configuración del embudo (por defecto 36.6243, como el importador), guardado en cada cotización al crearla y editable en el borrador |
| P6 | Validez y aceptación: ¿cuántos días es válida por defecto? ¿Se puede aceptar una cotización vencida? ¿Aceptar una cotización marca la oportunidad como ganada? | 15 días, configurable. Aceptar una vencida, con un aviso. Ofrecer "ganar la oportunidad" al aceptar, con la casilla marcada (§4.1) |
| P7 | ¿Quien aprueba puede aprobar sus propias cotizaciones? | No: la RPC rechaza la aprobación cuando quien aprueba es el responsable. El Administrador también queda sujeto a esa regla |

**Supuestos por defecto** (no bloquean; el coordinador los confirma o los corrige):
- **S1.** La oportunidad es opcional en la cotización; el cliente es obligatorio.
- **S2.** La primera actividad completada pasa un lead de nuevo a contactado.
- **S3.** Al convertir, las actividades agendadas del lead pasan a la oportunidad.
- **S4.** Agendar una actividad para otra persona exige `asignacion.gestionar`.
- **S5.** Un borrador de cotización que no se va a usar se anula con `cotizacion.anular`. El Vendedor no tiene ese permiso, así que sus borradores quedan como borradores. La alternativa es permitir descartar los borradores propios con `cotizacion.editar`; decidirlo al aprobar.
- **S6.** Datos iniciales que siembra la migración, editables después:
  - etapas: Nuevo 10 % · Calificado 25 % · Cotización enviada 50 % · Negociación 75 % · Ganada · Perdida;
  - orígenes: Sala de ventas, Llamada, WhatsApp, Referido, Redes sociales, Visita de campo;
  - motivos de pérdida: Precio, Sin stock, Tiempo de entrega, Compró a la competencia, Proyecto cancelado, Otro (pide detalle);
  - descuento máximo: 5 %.
  - **Hay que confirmarlos con el usuario antes de la migración.**

## Archivos relevantes

- C:\Users\Ventas03\Documents\GitHub\nexo\docs\plan\16-crm-embudo-comercial.md
- C:\Users\Ventas03\Documents\GitHub\nexo\docs\status-log\2026-10-19-crm-embudo-paso-cero.md
- C:\Users\Ventas03\Documents\GitHub\nexo\apps\crm\src\lib\nav.ts
- C:\Users\Ventas03\Documents\GitHub\nexo\apps\crm\src\lib\metas\permisos.ts
- C:\Users\Ventas03\Documents\GitHub\nexo\apps\crm\src\lib\metas\formato.ts
- C:\Users\Ventas03\Documents\GitHub\nexo\apps\crm\src\app\(app)\facturas\page.tsx (referencia de lista, filtros y paginación)
- C:\Users\Ventas03\Documents\GitHub\nexo\apps\crm\src\app\(app)\metas\page.tsx (referencia de alcance propio o de equipo)
- C:\Users\Ventas03\Documents\GitHub\nexo\apps\crm\src\app\(app)\configuracion\vendedores\tabla-vendedores.tsx (referencia de edición por fila, ConfirmDialog y toast)
- C:\Users\Ventas03\Documents\GitHub\nexo\apps\crm\src\app\(app)\dashboard\page.tsx
- C:\Users\Ventas03\Documents\GitHub\nexo\packages\ui\ConfirmDialog.tsx (no acepta `children` ni maneja el foco)
- C:\Users\Ventas03\Documents\GitHub\nexo\packages\ui\nexo-icons.tsx (faltan `funnel`, `phone` y `mail`)
- C:\Users\Ventas03\Documents\GitHub\nexo\supabase\migrations\20261016214634_productos_esquema.sql (líneas 554 y 600: permiso de productos)
- C:\Users\Ventas03\Documents\GitHub\nexo\supabase\migrations\20261018184849_metas_dentro_de_crm.sql (línea 64: permisos de la plantilla Vendedor)