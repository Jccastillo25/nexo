# 2026-09-17 — Auditoría del botón "Crear borrador", reglas de contratación y endurecimiento del bloque pre-F1.5

> Continuación del bloque "pre-F1.5" (ver
> [`2026-09-16-rrhh-pre-f1-5.md`](2026-09-16-rrhh-pre-f1-5.md)), sin
> iniciar F1.5. Todos los cambios de este bloque se dejaron inicialmente
> **locales**: código y migraciones quedaron escritos y verificados con
> `next build`/`tsc`/`eslint`, pero **ninguna migración se aplicó al
> proyecto remoto `nexo-core`** ni se hizo push/deploy — instrucción
> explícita del usuario para esa sesión. Aplicar la migración y subir el
> código requería autorización aparte.
>
> **✅ Resuelto 2026-09-17/18**: el usuario autorizó ambos pasos por
> separado. Código commiteado y pusheado a `main` (`392f676`, 2026-09-17).
> Migración aplicada a `nexo-core` el 2026-09-18 con `apply_migration`,
> previo un precheck de solo lectura (migración no registrada, 0
> contratos, 0 puestos sin departamento, 0 puestos activos sin plantilla
> activa, firmas remotas de los 4 RPC todavía con la firma antigua) y un
> postcheck posterior (migración registrada con versión remota
> `20260918043955`, columnas `NOT NULL` confirmadas, firmas nuevas de los
> 4 RPC confirmadas, `anon`/`PUBLIC` sin `EXECUTE`, límites del bucket
> confirmados, `get_advisors(security)` sin hallazgos nuevos). El archivo
> local, escrito el 17/09 con el prefijo `20260917100000`, se renombró
> después a `20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql`
> (con `git mv`, sin tocar su SQL) para que el nombre coincida con la
> versión remota real que quedó registrada — ver sección 8.

## 1. Causa real del botón "Crear borrador" deshabilitado

Reportado: en `/rrhh/contratacion/contratos/nuevo` el botón aparecía
deshabilitado "aun con empleado y datos seleccionados". Auditoría (no
asumida) de `empleadoId`, `tieneContratoAbierto`, permisos y las consultas
de contratos:

- **Permisos**: si `rrhh.expedientes.contratos.crear` fuera `false` la
  página entera muestra un `EmptyState`, no el formulario con botón
  deshabilitado — descartado como causa (el formulario se estaba
  mostrando).
- **`tieneContratoAbierto`**: verificado contra `nexo-core` remoto —
  `rrhh.contratos` tenía **0 filas** en el momento del reporte, así que
  ningún empleado podía tener realmente un contrato abierto. Descartado.
- **Causa real, confirmada en el código**: el `<select size={n}>` de
  empleados (`nuevo-contrato-form.tsx`) no tenía ninguna `<option
  value="">` — cuando `empleadoId` está en `""` y ninguna opción real
  coincide con ese valor, el navegador resalta visualmente el **primer
  empleado de la lista** (comportamiento nativo de un `<select>` sin
  opción vacía), mientras el estado de React (`empleadoId`) seguía en
  `""`. El usuario veía "un empleado ya elegido" — y con puesto/
  departamento llenos, parecía que "todo estaba completo" — pero el botón
  seguía deshabilitado por `!empleadoId`, sin ningún mensaje visible que
  lo explicara (el único aviso existente, la nota ámbar de "ya tiene un
  contrato abierto", solo aparecía cuando `seleccionado` no era `null`).

### Corrección

- `nuevo-contrato-form.tsx`: se agrega `<option value="">— Elegí un
  empleado —</option>` explícita, siempre presente — el navegador ya no
  tiene un "primer real" que resaltar por defecto.
- Banner de motivo **siempre visible** junto al botón, en orden de
  prioridad: sin empleado → contrato abierto existente (con **link
  directo** a `/contratacion/contratos/{id}`, antes solo se avisaba que
  existía) → sin departamento → sin puesto (o "sin puestos activos en ese
  departamento") → sin plantilla (o "sin plantillas asignadas a ese
  puesto") → "Guardando…" mientras se envía. El botón solo se deshabilita
  por una de esas razones reales o por estar guardando — nunca sin
  explicación.
- `contratacion/contratos/nuevo/page.tsx`: la consulta de "contrato
  abierto" ahora trae también el `id` del contrato (antes solo
  `empleado_id, estado`), necesario para el link de arriba.

## 2. Reglas de negocio de creación de contratos (pedido explícito del usuario)

1. **Sin "Fecha fin prevista" al crear**: el campo se retira del
   formulario de creación y `rrhh.fn_crear_contrato` **ya no tiene ese
   parámetro** — estructuralmente imposible de mandar, se llame desde la
   UI o por RPC directo. Se puede seguir completando al **editar** un
   contrato en borrador (`fn_editar_contrato` sí lo acepta) — la regla es
   solo sobre el nacimiento del borrador.
2. **Departamento primero**: el selector de puesto inicia vacío/
   deshabilitado hasta elegir un departamento, y solo lista puestos
   activos de ese departamento. Cambiar el departamento limpia el puesto
   (y la plantilla, que depende del puesto) si ya no pertenece a él.
   Aplicado tanto en el formulario de creación como en la edición
   (`contrato-ficha.tsx`).
3. **Puesto, departamento y plantilla obligatorios**: ya no son
   "Sin asignar" — el RPC de creación no acepta `null` en ninguno de los
   tres.
4. **Cada puesto pertenece a un único departamento**: `rrhh.puestos.departamento_id`
   pasa de opcional a `NOT NULL` (0 puestos sin departamento verificado en
   remoto antes de escribir la migración). El catálogo de Puestos
   (`puestos-panel.tsx`/`actions.ts`) ahora exige departamento para
   crear/editar un puesto.
5. **La plantilla elegida se persiste**: `rrhh.contratos` gana la columna
   `plantilla_contrato_id` (`NOT NULL`, con FK compuesta al mismo tenant)
   — reemplaza el concepto de "plantilla_sugerida_id" (que Fase 3 del
   2026-09-16 solo devolvía como dato informativo, nunca guardado). La
   ficha de contrato (`contrato-ficha.tsx`) ahora muestra y permite editar
   la plantilla persistida.
6. **Validación 100% server-side**: `rrhh.fn_crear_contrato`/
   `fn_editar_contrato` (reescritas, `DROP` + `CREATE` por cambio de
   firma) verifican en el propio RPC — nunca solo en los `<select>` del
   navegador — que puesto/departamento/plantilla pertenecen a la misma
   empresa, que el puesto realmente pertenece al departamento indicado, y
   que la plantilla está asignada y activa para ese puesto
   (`rrhh.puesto_plantillas`). También rechazan crear un **segundo**
   contrato abierto (activo/borrador) para el mismo empleado — antes solo
   existía un `unique index` parcial para `estado='activo'`, así que una
   llamada RPC directa podía crear un segundo borrador sin que la base de
   datos lo impidiera.
7. **Sin pérdida de histórico**: `rrhh.contratos.puesto`/`.departamento`
   (texto, ya deprecadas desde el 2026-09-16) no se tocan. Los `NOT NULL`
   nuevos se aplican solo después de verificar 0 filas nulas en remoto
   (documentado en la cabecera de la migración), con una guarda explícita
   (`raise exception`) que aborta la migración si esa condición dejó de
   ser cierta para cuando se aplique.

Migración (aplicada a `nexo-core` el 2026-09-18, ver sección 8):
[`20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql`](../../supabase/migrations/20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql)
(secciones 1, 5, 6 y 7 de esa migración — ver también la sección 3 de este
documento para el resto).

## 3. Hallazgos de seguridad/integridad del bloque pre-F1.5 (auditoría solicitada)

- **Integridad multiempresa**: `rrhh.empleados`, `rrhh.departamentos`,
  `rrhh.puestos` y `rrhh.plantillas_contrato` ganan una `UNIQUE (id,
  company_id)`, y cada tabla que guardaba `company_id` por separado del
  recurso que referencia (`rrhh.contratos`, `rrhh.empleado_direccion`,
  `rrhh.empleado_info_complementaria`, `rrhh.empleado_cuentas_bancarias`,
  `rrhh.empleado_beneficiarios`, `rrhh.empleado_documentos`,
  `rrhh.puesto_plantillas`) gana una FK **compuesta** contra esa unique —
  antes RLS solo validaba que el `company_id` enviado tuviera el permiso,
  no que ese `company_id` realmente fuera el dueño del `empleado_id`/
  `puesto_id`/etc. referenciado. Verificado en remoto: todas las tablas de
  expediente ampliado están en 0 filas hoy — sin riesgo de romper datos
  existentes.
- **Geografía de Nicaragua**: `core.geografia_ni_municipios` gana `UNIQUE
  (id, departamento_id)`, y `rrhh.empleado_direccion` gana una FK
  compuesta `(municipio_geo_id, departamento_geo_id) → (id,
  departamento_id)` + un `CHECK` que exige departamento si hay municipio
  — un municipio elegido ya no puede quedar "suelto" de un departamento
  distinto o ausente (antes no había ninguna validación de esa relación).
- **Condición de carrera en beneficiarios**: el trigger
  `rrhh.fn_validar_porcentaje_beneficiarios()` (creado el 2026-09-16) leía
  la suma de porcentajes con un `SELECT` simple antes de escribir — dos
  transacciones concurrentes insertando/activando beneficiarios del mismo
  empleado podían leer el mismo total y ambas pasar la validación,
  superando 100% en conjunto (TOCTOU clásico). Corregido con `perform 1
  from rrhh.empleados where id = new.empleado_id for update;` al inicio
  del trigger — serializa cualquier escritura concurrente de beneficiarios
  del mismo empleado.
- **Storage sin límites de infraestructura**: el bucket
  `rrhh-documentos-privados` (creado 2026-09-16) no tenía
  `file_size_limit`/`allowed_mime_types` configurados a nivel de bucket —
  toda la validación vivía únicamente en la Server Action. Se agregó el
  mismo límite (10 MB, PDF/JPG/PNG/DOCX) también en `storage.buckets`
  como defensa en profundidad.
- **Metadata de documento no verificada**: `confirmarDocumentoSubido`
  (`documentos-actions.ts`) insertaba `mime_type`/`tamano_bytes` tal como
  los reportaba el **navegador**, sin comprobar el objeto real en
  Storage — un cliente manipulado podía declarar un tamaño/tipo falso para
  la fila de metadata. Ahora se lee el objeto real con
  `admin.storage.from(BUCKET).list(carpeta, { search: nombre })` y se usan
  (y validan) su `size`/`mimetype` reales, nunca los del cliente. También
  se rechaza explícitamente si el objeto no aparece en Storage (subida
  fallida o incompleta).
- **Service role**: revisado — no se agregó ni expuso ninguna variable de
  service role al cliente; `createAdminClient()` sigue viviendo
  exclusivamente en Server Actions (`documentos-actions.ts`), sin cambios
  en ese patrón.

## 4. Navegación e identidad visual

Decisión vigente del usuario (2026-09-17):

- **`/` de Nexo es EXCLUSIVAMENTE el App Launcher**: se movió
  `apps/nexo/src/app/(app)/page.tsx` a `apps/nexo/src/app/page.tsx` (fuera
  del grupo `(app)`, que hasta ahora envolvía la raíz con `NexoShell` —
  sidebar + topbar con breadcrumb/buscador/menú de usuario incluido "Configuración
  de marca"). La nueva página raíz no usa `NexoShell`: header propio
  mínimo ("Nexo" en texto fijo sin link + correo + "Cerrar sesión", sin
  dropdown, sin buscador) seguido de la grilla de aplicaciones — misma
  lógica de agrupamiento por categoría que antes, sin KPIs (sin cambios
  respecto a la reconciliación del 2026-09-14). La sesión sigue protegida
  igual — el middleware (`lib/supabase/middleware.ts`) protege por
  path, no por pertenecer al grupo `(app)`.
- **`/configuracion/marca` sigue funcional**, sin cambios de
  comportamiento — conserva su propio `NexoShell` (ahora es la única
  ruta que envuelve `(app)/layout.tsx`). Ya no se llega ahí desde un menú
  del Launcher (el Launcher no tiene topbar/menú de usuario) — sigue
  accesible por URL directa o por cualquier link explícito que apunte ahí.
- **Sidebar de RRHH/CRM/Nexo — sin logo/ícono gráfico**: `NexoSidebar`
  (compartido por las 3 apps vía `NexoShell`) mostraba el logo de marca
  (`core.platform_settings.logo_url`, o una "N" azul de respaldo) junto al
  nombre del módulo activo (ej. "RRHH"). Se reemplaza por **texto fijo
  "Nexo"**, sin ícono ni imagen, igual en las 3 apps — nunca sustituido
  por el nombre de la app activa. El nombre de la app sigue apareciendo en
  el breadcrumb (`NexoTopbar`, ya lo arma `NexoShell` a partir de
  `moduleLabel`) y en el contenido de cada página — no se perdió esa
  información, solo se sacó del encabezado que sirve para volver al
  Launcher. `logoUrl` se retira de `NexoSidebar`/`NexoShell` (props y
  wiring en los 3 `(app)/layout.tsx`) por quedar sin ningún consumidor ahí
  — `core.platform_settings.logo_url`, `getLogoUrl()` y `/configuracion/marca`
  siguen existiendo sin cambios (todavía los usa `BackToPanelLink` en las
  pantallas `sin-acceso` y el login, que **no se tocaron**).
- **No se alteró**: branding de login, favicon, ni los menús internos
  propios de cada módulo (`RRHH_NAV_ITEMS`/`CRM_NAV_ITEMS` sin cambios de
  contenido, solo se renombró el ítem "Dashboard"→"Inicio" de
  `NEXO_NAV_ITEMS` para reflejar que "/" ya no es un dashboard).

## 5. Archivos modificados

**Migraciones**: `supabase/migrations/20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql` (nueva; escrita el 17/09 con el prefijo `20260917100000`, renombrada el 18/09 tras aplicarla — ver sección 8).

**RRHH**:
- `contratacion/contratos/actions.ts` (nuevo tipo `CrearContratoInput`, `ContratoInput` gana `plantillaContratoId`, llamadas RPC actualizadas).
- `contratacion/contratos/nuevo/{page.tsx,nuevo-contrato-form.tsx}` (reescritos).
- `contratacion/contratos/[id]/{page.tsx,contrato-ficha.tsx}` (cascada departamento→puesto→plantilla, muestra/edita plantilla persistida).
- `contratacion/catalogos/puestos/{actions.ts,puestos-panel.tsx}` (departamento obligatorio).
- `expedientes/[id]/documentos-actions.ts` (verificación real de metadata en `confirmarDocumentoSubido`).
- `lib/supabase/database.types.ts` (RPC `crear_contrato`/`editar_contrato`, tablas `contratos`/`puestos`).
- `lib/nav.ts`: sin cambios de contenido.

**Compartido (`packages/ui`)**: `NexoSidebar.tsx` (logo/moduleLabel → texto fijo "Nexo"), `NexoShell.tsx` (retira `logoUrl`, deja de pasar `moduleLabel`/`moduleHref` a `NexoSidebar`).

**Nexo**: `src/app/page.tsx` (nuevo, Launcher fuera de `(app)`), `src/app/(app)/page.tsx` (eliminado), `src/app/(app)/layout.tsx` (retira `logoUrl`), `src/lib/nav.ts` ("Dashboard"→"Inicio").

**CRM**: `src/app/(app)/layout.tsx` (retira `getLogoUrl`/`logoUrl`).

## 6. Validación ejecutada

- `tsc --noEmit` en `apps/rrhh`: limpio.
- `next build` (Turbopack) en `apps/rrhh`, `apps/nexo` (`nexo-panel`) y `apps/crm`: los tres compilan y generan todas las rutas sin error.
- `eslint` en `apps/rrhh`: limpio.
- `eslint` en `apps/nexo`/`apps/crm`: cada uno tiene errores/warnings **preexistentes, en archivos no tocados en esta sesión** (`marca-form.tsx` — comillas sin escapar; `DeleteClienteButton.tsx` — `setState` síncrono en efecto; `SearchBox.tsx`/`clientes/actions.ts` — warnings de variables/eslint-disable sin uso). No se corrigieron por estar fuera del alcance de esta tarea — quedan como deuda preexistente, no introducida aquí.
- **No se ejecutó** ninguna migración contra `nexo-core` (remoto) ni local (sin Supabase CLI/stack local disponible en este entorno) en esta sesión inicial — la migración fue revisada manualmente línea por línea (firmas `DROP`/`CREATE` verificadas contra las firmas reales de `20260916150000`, nombres de constraint verificados <63 caracteres y sin colisión, guardas `raise exception` antes de cada `NOT NULL`/FK nuevo) pero **no probada por ejecución** en ese momento. **✅ Aplicada el 2026-09-18** con `apply_migration` tras un precheck/postcheck de solo lectura — ver sección 8.
- **No se ejecutó** ningún recorrido autenticado en navegador (mismo motivo que las sesiones anteriores: sin credenciales de prueba en este entorno). Sigue sin ejecutarse — no se declara "validado" el flujo end-to-end, solo "implementado, compilado y con la migración aplicada".
- **No se hizo** `git push` ni deploy en esta sesión inicial — instrucción explícita del usuario. **✅ Resuelto**: commit `392f676` pusheado a `main` el 2026-09-17 (turno posterior, autorizado explícitamente por el usuario).

## 7. Riesgos y deuda pendiente

1. ~~La migración `20260917100000_...` no fue aplicada ni probada por
   ejecución (ni local ni remota)~~ — **✅ resuelto 2026-09-18**: aplicada
   a `nexo-core` con `apply_migration`, con prechecks/postchecks de solo
   lectura (ver sección 8). No se probó antes en un branch de Supabase ni
   en un stack local (seguía sin estar disponible en este entorno) — el
   riesgo se mitigó en cambio verificando exhaustivamente el estado de
   datos antes (0 filas en todas las tablas afectadas) y las firmas/
   constraints/permisos después.
2. Sigue pendiente de sesiones anteriores: `core.geografia_ni_municipios`
   vacía, falta `SUPABASE_SERVICE_ROLE_KEY` en el proyecto Vercel de
   RRHH, columnas deprecadas (`rrhh.contratos.puesto`/`.departamento`)
   sin limpieza física.
3. `puesto_plantillas` sigue sin UI para asignar más de una plantilla no
   predeterminada a un puesto (solo la predeterminada se gestiona desde
   Catálogos → Puestos) — no bloqueante hoy porque el formulario de
   contrato ya filtra correctamente por las plantillas asignadas
   (predeterminadas o no), solo la gestión masiva queda manual (upsert
   directo, no una pantalla).
4. ~~Nada de este bloque fue subido a `main` ni desplegado~~ — **✅
   resuelto**: commit `392f676` en `main` (push autorizado explícitamente
   el 2026-09-17). Sigue sin confirmarse que el deployment de Vercel
   disparado por ese push haya terminado `READY` en producción — no
   verificado en ninguna sesión hasta ahora.

## 8. Aplicación de la migración a `nexo-core` (2026-09-18)

Autorizado explícitamente por el usuario, en un turno aparte, únicamente
para el proyecto `nexo-core` (`yrbjlmiqhkyxtlcerowh`).

**Prechecks de solo lectura** (todos pasaron):

- La migración no estaba registrada en `list_migrations`.
- `rrhh.contratos`: 0 filas.
- `rrhh.puestos`: 0 filas sin `departamento_id`.
- `rrhh.puestos` activos: 0 sin al menos una plantilla activa asignada
  en `rrhh.puesto_plantillas`.
- Firmas remotas de `public.crear_contrato`/`rrhh.fn_crear_contrato`/
  `public.editar_contrato`/`rrhh.fn_editar_contrato`: confirmadas con la
  firma **antigua** (con `p_fecha_fin_prevista`, sin
  `p_plantilla_contrato_id`), coincidiendo exactamente con los `DROP
  FUNCTION` de la migración.
- Contenido del archivo local verificado por hash MD5 contra el blob del
  commit `392f676` (`git show 392f676:...`) — sin drift, se aplicó
  exactamente lo commiteado.

**Aplicación**: `apply_migration` (mecanismo oficial, transaccional) —
sin SQL manual fuera del archivo, sin duplicar la migración. Quedó
registrada con versión remota `20260918043955`.

**Postchecks** (todos confirmados):

- Migración registrada en `list_migrations`/`supabase_migrations.schema_migrations`
  como `20260918043955 rrhh_contratos_reglas_y_endurecimiento` — única
  versión con ese nombre, ninguna versión `20260917100000`.
- `rrhh.contratos.plantilla_contrato_id`/`puesto_id`/`departamento_id`:
  `is_nullable = NO` en los tres.
- `rrhh.puestos.departamento_id`: `is_nullable = NO`.
- Firmas remotas nuevas de los 4 RPC confirmadas con
  `pg_get_function_identity_arguments`: `crear_contrato`/
  `fn_crear_contrato` sin `p_fecha_fin_prevista`, con
  `p_plantilla_contrato_id` obligatorio; `editar_contrato`/
  `fn_editar_contrato` con `p_plantilla_contrato_id` y
  `p_fecha_fin_prevista` opcionales.
- `has_function_privilege`: `anon.can_exec = false`,
  `authenticated.can_exec = true` en `crear_contrato`/`editar_contrato`
  (`PUBLIC` ya estaba revocado explícitamente por la propia migración).
- `storage.buckets` (`rrhh-documentos-privados`): `file_size_limit =
  10485760`, `allowed_mime_types` = pdf/jpeg/png/docx.
- `get_advisors(security)`: sin hallazgos nuevos atribuibles a esta
  migración — los `WARN` de `SECURITY DEFINER` en `crear_contrato`/
  `editar_contrato` son el mismo patrón preexistente e intencional que el
  resto de RPCs de RRHH.

**Renombre del archivo local** (sin tocar su SQL): `apply_migration`
registra la versión remota con un timestamp propio (fecha/hora real de
aplicación), no con el prefijo del nombre del archivo local — mismo
comportamiento ya visto en migraciones anteriores de este proyecto (ej.
`20260916150000_...` quedó como `20260916152106` en remoto). Para que el
archivo del repositorio refleje la versión remota real, se renombró con
`git mv` de `20260917100000_rrhh_contratos_reglas_y_endurecimiento.sql`
a `20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql` — el
`diff` de Git lo registra como una renombrada pura (100% similitud), sin
ninguna línea de SQL modificada. Sin commit todavía — pendiente de
autorización aparte del usuario.

Sin errores durante la aplicación ni las verificaciones. No se ejecutó
ningún DDL manual fuera del contenido de la migración, no se duplicó el
SQL, no se tocó `Grupo CT/`, no se hizo commit/push/deploy en este paso.
