# Norma de Diseño Universal — suite Nexo

Documento de arquitectura UX/UI para todo el ecosistema (hoy Transporte/Flotilla,
CRM y RRHH; escalable a cualquier módulo futuro). Es la capa **estratégica**
sobre la que ya está construido [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md)
(la guía operativa que se dispara junto con `CLAUDE.md`) y
[`planning/DISENO_UX_UI.md`](DISENO_UX_UI.md) (el estudio de SAP Fiori/Odoo que
originó los tokens actuales). Este documento no reemplaza a esos dos — los
extiende con las piezas que todavía no estaban formalizadas: paleta agnóstica
completa, reglas de componentes, y el comportamiento del shell en vistas
especializadas (Torre de Control, PWA operativa, Kiosko).

Cuando algo de acá quede implementado, se sincroniza a `DESIGN_SYSTEM.md` igual
que ya se hizo con la regla de "volver al panel" — ese documento es la fuente
de verdad de lo que **ya existe**; este es la norma completa de lo que la
suite **debe ser**.

---

## 1. Sistema de Diseño Base (minimalismo y homogeneidad)

### 1.1 Filosofía visual

La regla de oro: **si un elemento no comunica información o no dispara una
acción, no existe.** Nada de bordes, sombras o color puestos "porque se ve
bien" — cada uno tiene que justificar su presencia.

- **Whitespace como estructura, no como relleno.** La jerarquía entre
  secciones se resuelve con espacio (escala de 4px: `4, 8, 12, 16, 24, 32, 48,
  64`), no con líneas divisorias. Un `<hr>` o un `border-b` decorativo es una
  señal de que falta espaciado, no una solución.
- **Bordes: uno solo, uno de gris, sin excepción.** `border-neutral-200`
  (`#E5E5E5`) es el único borde permitido en estado normal. Nada de bordes de
  color para "decorar" una tarjeta — el color de categoría ya cumple esa
  función donde hace falta (ver 1.2).
- **Sombra: solo para indicar elevación real (flota sobre el contenido).**
  Modales, dropdowns, tooltips y el menú del App Launcher pueden usar
  `shadow-md`. Tarjetas, tablas y contenedores en el flujo normal de la
  página **no** llevan sombra — se separan del fondo con `bg-white` sobre
  `--nexo-bg` (`#F5F5F5`), no con `box-shadow`.
- **Color con intención, nunca decorativo.** Un color fuera de la escala de
  grises solo aparece para: (a) la categoría del módulo, (b) el acento
  primario en una acción o estado activo, o (c) estados semánticos
  (éxito/error/advertencia). Si no entra en ninguna de esas tres, es gris.
- **Una acción primaria por pantalla.** Máximo un botón `primary` (relleno,
  color de acento) visible a la vez; el resto son `secondary` (outline) o
  `ghost` (texto). Esto es lo que hace que el ojo sepa qué hacer sin leer.

### 1.2 Paleta de colores agnóstica

Dos capas, sin mezclarlas:

**Capa 1 — neutrales y acento (chrome + UI, igual en todos los módulos):**

| Token | Valor | Uso |
|---|---|---|
| `--nexo-neutral-50` | `#FAFAFA` | Texto sobre fondo oscuro (`ShellBar`) |
| `--nexo-neutral-100` | `#F5F5F5` | Fondo de página (`--nexo-bg`, ya vigente) |
| `--nexo-neutral-200` | `#E5E5E5` | Bordes, divisores |
| `--nexo-neutral-400` | `#A3A3A3` | Texto deshabilitado, placeholders |
| `--nexo-neutral-600` | `#525252` | Texto secundario |
| `--nexo-neutral-900` | `#18181B` | Texto principal / fondo de `ShellBar` (`--nexo-shell-bg`, ya vigente) |
| `--nexo-accent` | `#2563EB` (indigo/blue-600) | Botón primario, foco, links, estado activo del sidebar |
| `--nexo-accent-hover` | `#1D4ED8` | Hover/active del acento |
| `--nexo-success` | `#16A34A` | Confirmaciones, estados "activo/al día" |
| `--nexo-warning` | `#D97706` | Alertas no bloqueantes |
| `--nexo-danger` | `#DC2626` | Errores, acciones destructivas |

`--nexo-accent` es deliberadamente un azul neutro: no es el color de ninguna
categoría existente (verde Finanzas, rosa Ventas, morado Cadena de suministro,
ámbar RRHH, índigo-claro Servicios), así que un botón "Guardar" se ve igual
en el CRM que en RRHH — es UI, no es marca. **No se cambia por módulo bajo
ningún motivo**; un módulo que necesite destacar su propia marca lo hace en
su contenido (capa 2), nunca reemplazando este token en un componente
compartido.

**Capa 2 — color de categoría** (ya vigente en
[`packages/ui/category-colors.ts`](../../packages/ui/category-colors.ts)):
identifica de qué módulo viene algo — el tile en el launcher, el borde
izquierdo de un widget en la Torre de Control (ver 3.1), una etiqueta. Nunca
se usa para botones ni inputs.

**Capa 3 — retirada (2026-08-30).** La versión original de esta norma
dejaba una "identidad del módulo puertas adentro" libre — paleta y
tipografía de marca propia en el contenido, siempre que no invadiera el
shell. El CRM la usó (paleta `concreto`/`acero`/`naranja`, `Archivo
Black`/`Work Sans`/`IBM Plex Mono`) y el resultado, aun con la barra
superior ya unificada, seguía sintiéndose como un software distinto por
dentro. Decisión explícita del usuario: se retira esta capa. Todo el
contenido de todos los módulos usa la Capa 1 (neutrales + acento) y la
tipografía única de abajo — no queda ninguna capa de identidad libre por
módulo, solo el color de categoría (Capa 2) en puntos puntuales.

### 1.3 Tipografía

**Una sola tipografía para toda la suite, sin excepción: Inter.** Chrome
compartido (`ShellBar`, `Sidebar`, launcher, notificaciones, Omnibar),
componentes de `@nexo/ui` (botones, inputs, tablas, modales) **y** el
contenido propio de cada módulo — los tres antes tenían reglas distintas
(la Capa 3 de arriba lo permitía), ahora es una sola regla. Ver el bug
real que esto corrigió en `DESIGN_SYSTEM.md` (el CRM cargaba Archivo
Black/Work Sans/IBM Plex Mono).

- **Escala:** `12px` (metadatos/labels), `14px` (cuerpo, default de
  formularios y tablas), `16px` (cuerpo destacado), `20px`/`24px` (títulos de
  sección), `32px`+ (KPIs de la Torre de Control). Sin tamaños intermedios
  sueltos — si no está en esta lista, no se usa.

### 1.4 Reglas de componentes (`@nexo/ui`)

Estas reglas aplican a **todo** componente de `packages/ui`, sin excepción
por módulo:

- **Botones:** 3 variantes only — `primary` (fondo `--nexo-accent`, texto
  blanco), `secondary` (borde `neutral-200`, fondo transparente, texto
  `neutral-900`), `ghost` (sin fondo ni borde, solo texto). Radio `6px`.
  Padding fijo `8px 16px` (default) / `6px 12px` (`sm`). Sin variantes de
  color por módulo.
- **Inputs:** borde `neutral-200`, radio `6px`, foco = borde
  `--nexo-accent` + `ring` de 2px del mismo color al 20% de opacidad. Un solo
  estilo de input para texto, número, fecha y select — el mismo componente,
  no reinventado por módulo.
- **Modales:** overlay `neutral-900` al 40%, panel `bg-white`, radio `8px`,
  `shadow-md` (única sombra permitida fuera del chrome). Header con título +
  botón de cerrar (`ghost`), footer con acciones alineadas a la derecha
  (`secondary` primero, `primary` al final).
- **Tablas de datos:** fila con `border-b neutral-200` (nunca bordes
  verticales), header en `neutral-600` uppercase `12px`, hover de fila en
  `neutral-50`, densidad configurable (`compact`/`comfortable`) pero un solo
  componente `<DataTable>` para los tres módulos — si RRHH necesita una
  columna de estado con pastilla de color, es una prop (`statusColor`), no
  una tabla nueva.

---

## 2. Estructura del App Shell

### 2.1 Top Bar Global (`ShellBar` extendido)

Hoy `ShellBar` (ver [`packages/ui/ShellBar.tsx`](../../packages/ui/ShellBar.tsx))
resuelve marca + volver al panel + usuario + salir. Para completar el App
Shell le faltan tres piezas, todas van **dentro del mismo componente
compartido** — ningún módulo las reimplementa:

- **App Launcher:** ícono de grilla (3x3) a la izquierda, junto al link
  "Nexo". Al hacer clic abre un panel flotante (no navega) con los módulos a
  los que el usuario tiene acceso, agrupados por categoría igual que hoy la
  grilla de `apps/nexo` — es la misma data (`core.apps` + permisos), solo
  que accesible sin salir del módulo actual. Clic en un módulo = navegación
  completa (cruza Multi-Zones, igual que `BackToPanelLink`).
- **Omnibar (buscador global):** campo de búsqueda centrado en la barra,
  activable también con `Cmd/Ctrl+K`. Busca por nombre de módulo (atajo de
  navegación) y, cuando cada módulo exponga su propio índice de búsqueda,
  por registros (cliente, empleado, viaje). Fase 1 (ya con lo que existe
  hoy): solo navegación a módulos. Fase 2 (cuando haya API de búsqueda por
  módulo): resultados mezclados con el ícono de categoría de origen.
- **Notificaciones:** ícono de campana con contador; el panel desplegable
  lista eventos de cualquier módulo (mismo patrón que el Launcher: un solo
  componente, contenido agregado). Requiere una tabla `core.notifications`
  aún no creada — se documenta acá como parte del shell, implementación
  queda en el roadmap.

Estas tres piezas viven en `--nexo-shell-bg` (`neutral-900`), con
`--nexo-neutral-50` como texto — igual que hoy. Ninguna cambia de color por
módulo.

### 2.2 Sidebar contextual

Pieza nueva, hoy ningún módulo la tiene (CRM usa solo el header). Reglas:

- Aparece **solo** dentro de un módulo (nunca en `apps/nexo`, que ya tiene su
  propia grilla como "sidebar" conceptual).
- Ancho fijo `240px`, fondo `bg-white`, borde derecho `neutral-200` (el único
  borde de la pantalla junto con los internos de tablas).
- Contenido: exclusivamente los ítems de navegación **del módulo activo** —
  nunca mezcla con otro módulo (para eso está el Launcher). Cada módulo
  define su propia lista de secciones (ej. CRM: Clientes, Oportunidades,
  Reportes); el componente `<Sidebar items={...} />` es compartido, la lista
  de `items` es propia del módulo.
- Ítem activo: texto `--nexo-accent` + fondo `neutral-50`, sin borde
  izquierdo grueso ni iconografía de color — el acento ya es suficiente
  señal.
- Colapsable a solo-íconos (`64px`) con un toggle al pie — el estado se
  guarda por usuario (localStorage o `core.user_preferences` a futuro), no
  por módulo, para que la preferencia viaje con la persona.

---

## 3. Aplicación a vistas especializadas

El shell (2.1 + 2.2) y los tokens (1.2–1.4) son la base; lo que cambia por
contexto de uso es **cuánto shell se muestra**, nunca el lenguaje visual.

### 3.1 Torre de Control (dashboard gerencial)

Vive dentro del shell completo (Top Bar + sin sidebar propio, porque cruza
módulos — es más parecido a `apps/nexo` que a un módulo individual).

- Grid de **widgets**, todos el mismo componente `<StatWidget>` (unificación
  ya marcada como pendiente en `DESIGN_SYSTEM.md` — este es el lugar donde
  se vuelve obligatorio): `bg-white`, radio `8px`, sin sombra, borde
  `neutral-200`, padding `24px`.
- Cada widget lleva un borde izquierdo de `4px` con el color de categoría del
  módulo del que viene el dato (ventas → rosa, viajes activos → morado,
  asistencia → ámbar) — es la única inyección de color de categoría fuera
  del launcher, y es intencional: ayuda a escanear de qué módulo es cada
  número sin romper la homogeneidad de la tarjeta en sí.
- Contenido interno del widget: label `12px` `neutral-600` uppercase, valor
  `32px` `neutral-900` bold, variación (`+12%` / `-3%`) en `--nexo-success` o
  `--nexo-danger` con flecha, `14px`.
- Grid responsivo: `4` columnas en desktop, `2` en tablet, `1` en mobile —
  mismo breakpoint set que el resto de la suite (ver 3.2 para cuándo esto
  colapsa a vista operativa en vez de a un grid angosto).

### 3.2 Vistas operativas móviles (ej. panel de conductores, PWA)

Estas vistas **retiran** el shell, no lo reinterpretan — es la aplicación más
literal del principio de la sección 1.1 ("si no comunica o no dispara una
acción, no existe"): en una pantalla de teléfono en movimiento, hasta el
Top Bar es ruido.

- Sin `ShellBar`, sin sidebar, sin Launcher. Header propio mínimo: botón
  atrás (si aplica) + título de la tarea actual, `56px` de alto, `bg-white`,
  borde inferior `neutral-200`.
- Una tarea por pantalla — nunca dos formularios o dos decisiones
  compitiendo por atención.
- Botones táctiles grandes: mínimo `48x48px`, recomendado `56px+` de alto
  para la acción principal, ancho completo, fijo al pie de la pantalla
  (`position: sticky`/`fixed`), siempre `variant="primary"` con
  `--nexo-accent`.
- Alto contraste para confirmación de estado: al completar una tarea, el
  feedback ocupa la pantalla (banda de color completa, no un toast
  discreto) — verde `--nexo-success` para éxito, rojo `--nexo-danger` para
  rechazo/error, con ícono + texto grande.
- Sigue siendo Inter, sigue siendo la misma escala de espaciado y radios que
  el resto de la suite — el usuario que después entra al panel desde una PC
  tiene que reconocer la misma "mano" visual, aunque la densidad de
  información sea radicalmente menor.
- Esta vista **no** lleva el link de "volver al panel" (regla de
  `DESIGN_SYSTEM.md` §1) — es una excepción documentada: un conductor en
  ruta no necesita ni debe navegar al panel administrativo desde su PWA. Si
  el rol de esa persona también tiene acceso al panel completo, lo hace
  desde otro dispositivo/sesión.

### 3.3 Vistas de kiosko (ej. marcaje de RRHH)

Más restrictiva aún que 3.2: pantalla completa, un solo propósito, sin salida
para el usuario final (solo un administrador desbloquea/configura).

- Sin ningún elemento de navegación — ni header propio siquiera. La pantalla
  es 100% el propósito (teclado numérico de PIN o visor de cámara para QR).
- Misma tipografía (Inter) y misma paleta de acento (`--nexo-accent` para el
  botón de "Confirmar", `--nexo-success`/`--nexo-danger` para el resultado)
  que el resto de la suite — es la señal de que sigue siendo "software de
  Nexo" aunque no se vea un solo pixel de chrome.
- Teclado numérico: botones `80x80px` mínimo (mayor aún que la PWA de 3.2,
  porque además de tocarse rápido tiene que verse a distancia/ángulo en una
  tablet montada en pared), grid `3x4`, radio `8px`, `neutral-100` en reposo,
  `--nexo-accent` al presionar.
- Resultado de marcaje: pantalla completa cambia a `--nexo-success` (check +
  nombre del empleado) o `--nexo-danger` (PIN inválido) por 2–3 segundos y
  vuelve sola al estado inicial — sin que nadie tenga que tocar nada para
  "salir" de la confirmación.
- Excepción documentada igual que 3.2: no lleva "volver al panel" ni ningún
  link de salida visible para el usuario que marca — la salida del modo
  kiosko es un gesto/PIN administrativo fuera de este flujo, no parte del
  design system de navegación.

---

## 4. Reglas anti-fragmentación

Tres directrices obligatorias para cualquier desarrollo frontend nuevo en la
suite, sin importar qué módulo sea ni quién lo escriba:

1. **Ningún componente de UI genérico se reescribe dentro de `apps/<módulo>`.**
   Botones, inputs, modales, tablas, tarjetas de estadística, badges de
   estado: si el componente representa una pieza de interfaz genérica (no
   contenido de negocio específico del módulo), vive en `packages/ui` y se
   importa. Si la variante que necesitás no existe todavía, se agrega ahí
   mismo — con una prop, no con una copia — **en el mismo PR** que la usa.
   Un `<button className="...">` a mano fuera de `packages/ui` en código
   nuevo es una señal de que el componente compartido está incompleto, no
   una excusa para no usarlo.

2. **Ningún valor de diseño (color, tipografía, radio, sombra, espaciado del
   shell) se hardcodea fuera de sus fuentes de verdad.** Los tokens de la
   sección 1.2 y `packages/ui/category-colors.ts` son los únicos lugares
   donde un color entra al sistema. Un hex suelto (`#3B82F6`, `bg-blue-500`)
   en un componente de shell o en `@nexo/ui` no se aprueba en revisión de
   código — se agrega como token nombrado primero, y se referencia después.
   El contenido propio del módulo (capa 3 de 1.2) es la única zona exenta,
   y solo para su propia paleta de marca, nunca para el chrome.

3. **Antes de construir una vista nueva, se busca si ya existe un patrón
   equivalente en otro módulo — y si existe, se generaliza en vez de
   duplicarse.** Ejemplo activo: `StatCard` hoy existe tres veces distintas
   entre RRHH y Flotilla; cuando se adapten a Multi-Zones (Fases 5/6), esa
   duplicación se resuelve moviendo una sola versión a `packages/ui` con las
   props que cubran los tres casos, no eligiendo "la mejor de las tres" y
   dejando que las otras dos sigan vivas. La pregunta antes de escribir
   cualquier componente nuevo es "¿esto ya existe en otro módulo con otro
   nombre?", no "¿esto ya existe en `packages/ui`?" — la primera atrapa la
   duplicación antes de que se congele ahí también.

---

## Estado de implementación

| Pieza | Estado |
|---|---|
| Tokens de neutrales + acento (§1.2 capa 1) | ✅ En uso — `neutral-*`/`blue-600` de Tailwind directo (sin CSS vars `--nexo-*` todavía, pero el valor y el uso son los documentados) |
| Capa 3 (identidad propia por módulo) | **Retirada** — ver principio revisado en §1.2. CRM reskineado a la paleta única el mismo día que se escribió esta norma |
| Reglas de componentes `@nexo/ui` (§1.4) | Parcial — `ShellBar`, `Sidebar`, `BackToPanelLink` cumplen; `Button`/`Input`/`Modal`/`DataTable` genéricos **no existen aún** como paquete compartido (el CRM sigue con inputs/botones propios, aunque ya con los tokens correctos) |
| App Launcher — íconos de categoría (§2.1) | ✅ `packages/ui/category-icons.tsx` — SVG a mano, uno por categoría, sin dependencia externa |
| Omnibar / Notificaciones / Avatar en `ShellBar` (§2.1) | ✅ UI implementada (buscador sin backend real, notificaciones estáticas) — falta el índice de búsqueda real y `core.notifications` |
| Sidebar contextual (§2.2) | ✅ Componente listo y **cableado en el CRM** (una sola sección, "Clientes") — falta en RRHH/Flotilla (no migrados aún) |
| Torre de Control (§3.1) | **Pendiente** — no existe la vista; depende de que RRHH/Flotilla estén en `nexo-core` para cruzar datos |
| PWA conductores / Kiosko RRHH (§3.2, §3.3) | **Pendiente** — dependen de las Fases 5/6 del roadmap |
| Reglas anti-fragmentación (§4) | **Vigente desde hoy** — es proceso, no código; aplica a partir de este commit |

Este documento se referencia desde [`docs/README.md`](../README.md) y desde
la introducción de [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). A medida
que cada pieza pasa de "Pendiente" a implementada, se sincroniza a
`DESIGN_SYSTEM.md` con su ejemplo real de código, igual que ya pasó con la
regla de "volver al panel".
