---
name: nexo-ui
description: Diseño e implementación de interfaces en las apps Next.js de Nexo con el kit compartido @nexo/ui (Nexo Enterprise UI, tema claro, Inter, una sola paleta). Usar al planear o construir una pantalla, formulario, tabla, dashboard o menú, o al ajustar uno existente.
---

# Nexo UI — diseñar y construir pantallas de la suite

Adaptación estable al proyecto. Fuente y licencia: [SOURCE.md](SOURCE.md). Las
instrucciones de cada tarea (qué pantalla, archivos autorizados, criterios)
las da el coordinador en el encargo; esta skill no las reemplaza.

## Cuándo se utiliza

- Planear (ux-planner) o implementar (ui-frontend) una pantalla, formulario, tabla, dashboard o menú en `apps/*`.
- Ajustar el aspecto o los textos de una pantalla existente.
- No se usa para lógica de base de datos, migraciones ni despliegues.

## Contexto que debe consultar (en este orden)

1. `CLAUDE.md`: reglas obligatorias (NexoShell, menú desplegable, `next/link`, Dashboard de KPIs, una sola paleta/Inter, permisos, datos reales).
2. `docs/DESIGN_SYSTEM.md`: kit, menú lateral desplegable, Launcher.
3. `packages/ui/index.ts`: componentes reales disponibles (`NexoShell`, `PageHeader`, `MetricCard`, `FormTabs`, `FormSection`, `StatusBadge`, `EmptyState`, `ConfirmDialog`, `useToast`, `DataTable`, `FilterBar`, `NexoIcon`, `AppTileIcon`, …) y sus props en el archivo de cada uno.
4. Una pantalla parecida ya hecha en el mismo módulo u otro (`apps/*/src/app/(app)/`). Es la referencia de estilo: copia su estructura, no inventes otra.
5. `apps/<módulo>/src/lib/nav.ts` y `lib/permisos.ts` del módulo.

## Procedimiento

1. **Planear antes de codificar.** Escribe un plan corto con:
   - qué componentes del kit usarás;
   - la jerarquía de la página (encabezado con `PageHeader`, métricas, contenido, acciones);
   - los estados (carga, vacío, error, éxito, acceso denegado);
   - dónde va en el menú (grupo e icono).
2. **Revisar el plan** contra la pantalla de referencia y las reglas. Si algo es genérico o duplica un componente existente, corrígelo y anota qué cambiaste.
3. **Construir** con el kit:
   - clases Tailwind con la escala `neutral-*`/`blue-*` que ya usan las apps;
   - tarjetas `rounded-xl border border-neutral-200 bg-white shadow-sm`;
   - botón primario `bg-blue-600 hover:bg-blue-700`;
   - inputs como los de la pantalla de referencia.
4. **Criticar** el resultado:
   - quita un elemento decorativo que no sirva a la tarea;
   - comprueba que cada borde, separador o etiqueta signifique algo;
   - si hay navegador disponible, revisa móvil, tablet y escritorio.
5. **Textos** (en español, voz de la interfaz, sin relleno):
   - desde la perspectiva del usuario; nombra las cosas como las conoce el negocio, no como se llaman en la base;
   - botones con verbo específico ("Crear producto", no "Enviar");
   - errores que dicen qué pasó y cómo resolverlo;
   - estados vacíos que invitan a la acción siguiente.
6. **Filtro anti-relleno** (ver la sección siguiente) antes de entregar.

## Anti-relleno: texto y decoración genéricos

Ideas tomadas de antislop (MIT, ver [SOURCE.md](SOURCE.md)) y reducidas a lo
que aplica a una suite interna de gestión. No es una lista de palabras
prohibidas para aplicar a ciegas: se busca el **patrón**, y un caso aislado se
corrige solo si no aporta información.

**Textos de la interfaz**
- Botones y enlaces con la acción concreta del negocio. Evitar los genéricos
  "Enviar", "Continuar", "Más información", "Empezar", "Explorar", "Descubrir",
  "Ver más" cuando existe un verbo preciso: "Guardar contrato", "Calcular
  planilla", "Ver liquidación", "Importar facturas".
- Sin adjetivos de folleto: "potente", "inteligente", "revolucionario", "de
  última generación", "sin fricciones", "todo en uno", "impulsado por IA". Se
  dice qué hace la pantalla: "Calcula INSS, IR e INATEC del período".
- Sin muletillas: "Es importante destacar que", "Cabe mencionar", "A
  continuación podrás", "Con el fin de". Ir directo al dato o la instrucción.
- El sistema no "entiende", "sabe" ni "decide": muestra, calcula, valida o
  rechaza. Y cuando importa quién hizo algo, se nombra ("Aprobada por
  M. López", no "Fue aprobada").
- Una sola cautela por frase ("puede tardar unos minutos"), no "podría
  posiblemente tardar".
- Listas con los elementos que de verdad hay, no siempre tres.
- Sin emojis en títulos, botones, menús, insignias ni mensajes.
- En frases de la interfaz no se usa la raya (—) para unir ideas: se usa punto,
  coma, dos puntos o paréntesis. Se mantiene el uso ya establecido en el repo de
  "—" como valor vacío en una celda o campo de solo lectura.
- Nada inventado: ni cifras, ni nombres, ni fechas, ni "más de 100 empresas lo
  usan", ni afirmaciones de seguridad o rendimiento sin evidencia. Si falta el
  dato, `EmptyState`, "Pendiente de integración" o se omite la frase (es la
  regla de cero datos de ejemplo de `CLAUDE.md`).

**Decoración**
- `StatusBadge` solo para un estado real del registro (Borrador, Aprobada,
  Pagada). Nada de insignias decorativas ("Nuevo", "Beta", "Rápido") ni una
  insignia encima del título que repite lo que dice el `PageHeader`.
- Un punto de color marca un estado real, sin brillo y sin pulso infinito
  (`animate-pulse`/`animate-ping` solo mientras algo está en curso de verdad).
- Iconos de `NexoIcon` elegidos por lo que hace el ítem; nada de destellos,
  estrellas o robots de relleno. Si ningún icono encaja, se pide uno nuevo en
  `packages/ui/nexo-icons.tsx`.
- Flechas solo donde indican dirección (paginación, "Ver detalle" en una
  fila), no en cada botón.
- Sombra solo para marcar elevación (la tarjeta estándar ya trae `shadow-sm`;
  diálogos y menús flotantes, más). No se suman sombras, brillos ni bordes de
  color a cada elemento.
- Una franja de color a la izquierda solo si marca un estado (alerta, activo).
- Cada control tiene comportamiento real. Lo que no existe todavía no se
  muestra como botón activo; en el menú es un hijo sin `href` ("Pronto").
- En un dashboard, cada tarjeta responde a una pregunta del usuario y toda
  variación indica contra qué período se compara (detalle en `nexo-dashboards`).

## Restricciones

- **Sin identidad visual propia del módulo**: nada de fuentes, colores hex o temas propios. La única excepción son los iconos a color del Launcher (`AppTileIcon`).
- No construir header ni sidebar: `NexoShell`. No duplicar un componente que ya existe: si falta uno genérico, se propone en `packages/ui`.
- Menú: Dashboard suelto, todo lo demás en grupos desplegables, con un icono en cada ítem (`NexoIcon`).
- Nunca datos de ejemplo: si no hay fuente real, `EmptyState` o "Pendiente de integración".
- Movimiento solo cuando muestra un cambio de estado; respetar `prefers-reduced-motion`; no animar todas las tarjetas.
- No agregar dependencias de UI (librerías de componentes, iconos o animación) sin aprobación del coordinador.

## Entregables

- Planner: el plan (componentes, jerarquía, estados, menú, textos clave) dentro de la especificación.
- Frontend: código en los archivos autorizados, más una lista de los componentes del kit usados y de cualquier componente nuevo propuesto.

## Comprobaciones

- `npx.cmd --yes pnpm@9.15.9 --filter <app> run typecheck` y `run lint` sin errores.
- Recorrer la [lista de verificación de nexo-ui-review](../nexo-ui-review/SKILL.md) sobre los archivos tocados.
- Buscar en el diff colores hex (`#[0-9a-f]{3,6}`) y `font-family` nuevos: no debe haber.
- Releer los textos nuevos contra "Anti-relleno": botones genéricos, adjetivos de folleto, emojis, raya dentro de frases y cifras sin fuente.

## Si falta información o una herramienta

- Falta la especificación, el permiso o la decisión de negocio: no la inventes. Detente y pídela al coordinador con la pregunta concreta.
- No hay componente adecuado en el kit: propón la generalización en `packages/ui` y espera aprobación.
- No hay navegador: entrega con "aspecto y responsivo no comprobados visualmente".
