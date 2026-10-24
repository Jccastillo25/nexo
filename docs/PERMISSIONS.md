# Norma de permisos v3.0 — guía obligatoria

Extiende la norma de permisos v2.0 de Gestor360 a toda la suite Nexo, para
el escenario de **un solo usuario para todos los módulos**. Esta guía se
repite, literal, en el `CLAUDE.md` raíz del repo — por eso se dispara sola
cada vez que se trabaja en este monorepo con Claude Code, sin depender de
que alguien se acuerde de leer este documento primero.

## Principio (sin cambios respecto a v2.0)

**DENY BY DEFAULT.** Todo permiso arranca en `FALSE`/inexistente. Un
usuario `owner`/`admin` tiene acceso total **solo si no hay fila explícita**
en `core.user_permissions` para ese código de permiso.

## Lo que cambia en v3.0 (y por qué)

Con un solo usuario para Gestor360, Ruta360 y el CRM, un permiso ambiguo o
mal registrado en un módulo ya no es un bug aislado — es una fuga entre
productos distintos. Por eso v3.0 agrega una regla que v2.0 no tenía:

> **Un `permission_code` que no existe en `core.permissions_catalog` se
> trata como INVÁLIDO, no como "sin definir".** Toda la lógica de la norma
> vive en una sola función SQL, `core.has_permission()` (ver
> [`supabase/migrations/20260830000001_core_schema.sql`](../supabase/migrations/20260830000001_core_schema.sql)),
> y deniega en ese caso — para todos, incluidos owners/admins. Las apps la
> llaman vía RPC (`public.has_permission`) desde
> [`packages/permissions/index.ts`](../packages/permissions/index.ts); las
> políticas de RLS la llaman directo. **Una sola fuente de verdad**, no una
> copia en SQL y otra en TypeScript que se puedan desincronizar.

Consecuencia práctica: si alguien escribe una función nueva y llama a
`requirePermission(ctx, "flotilla.viajes.cancelar")` pero nadie insertó ese
código en `permissions_catalog`, **la función no funciona para nadie** —
falla cerrada, en vez de quedar abierta por accidente. Esto reemplaza la
dependencia de que un humano se acuerde de "agregar el checkbox al
matrix de permisos".

## Qué se dispara SOLO (automático, a nivel de base de datos)

Al insertar una fila en `core.apps` (registrar un módulo nuevo), un
trigger de Postgres (`trg_seed_module_permission`, ver
[`supabase/migrations/20260830000001_core_schema.sql`](../supabase/migrations/20260830000001_core_schema.sql))
crea automáticamente el permiso `<slug>.ver_modulo` en
`core.permissions_catalog`. **Nadie tiene que acordarse de esto** — se
verificó en vivo el 2026-08-30: los 4 módulos actuales generaron sus 4
permisos de visibilidad solos, sin ningún INSERT manual a
`permissions_catalog`.

Esto cubre la creación de **módulos**. La creación de **funciones/acciones
dentro de un módulo ya existente** no puede detectarse desde la base de
datos sola (es código de aplicación) — para eso está el checklist de abajo
y la regla en `CLAUDE.md`.

## Checklist obligatorio al crear una función/acción/página nueva

Se aplica a: server actions, route handlers, botones/checkboxes/toggles
nuevos en cualquier `apps/<módulo>`.

1. **Define el código de permiso** siguiendo la convención
   `<modulo>.<dominio>.<recurso>.<verbo>`, ej.
   `rrhh.talento.empleados.crear`, `flotilla.viajes.cancelar`.
2. **Regístralo en `permissions_catalog`** con una migración nueva en
   `supabase/migrations/`:
   ```sql
   insert into core.permissions_catalog (code, module_slug, domain, label, description)
   values ('flotilla.viajes.cancelar', 'flotilla', 'viajes', 'Cancelar viajes', '...');
   ```
3. **Envuelve la función** con el helper de `packages/permissions` antes de
   cualquier otra lógica:
   ```ts
   import { requirePermission } from "@nexo/permissions";

   export async function cancelarViaje(supabase: SupabaseClient, companyId: string, viajeId: string) {
     await requirePermission({ supabase, companyId }, "flotilla.viajes.cancelar");
     // ... el resto de la funcion
   }
   ```
   `requirePermission` llama a `public.has_permission` (RPC) — el `user_id`
   sale de la sesión autenticada del lado del servidor, nunca de un
   parámetro que el llamador pueda falsear.
4. **Oculta/deshabilita en la UI** el botón/checkbox correspondiente cuando
   el usuario no tiene el permiso — la verificación de servidor de
   arriba es la que de verdad protege, esto es solo UX.
   **Desde 2026-10-20, la UI no llama a `hasPermission` código por código.**
   Antes, Productos hacía 17 RPC en el layout y otras 17 en la página, y en
   remoto se midieron unas 20 por carga de página. Ahora cada app tiene un
   `permisosDe()` en `lib/` que llama a `misPermisos(LISTA)` de `@nexo/auth`
   con **una sola lista constante** de los códigos que usa su UI:
   ```ts
   import { misPermisos } from "@nexo/auth";
   const LISTA = Object.values(P); // siempre la misma lista: cada lista distinta es otra consulta
   export const permisosDe = () => misPermisos(LISTA); // ReadonlySet<string>, cacheado por request
   ```
   `misPermisos` hace **una** llamada a `public.mis_permisos(empresa,
   códigos[])` por request, compartida entre layout y página, con la misma
   lógica de `core.has_permission`. Si la RPC no existiera (por ejemplo, en
   una base nueva sin migrar), cae sola a `has_permission` por código. **La
   RPC está aplicada en `nexo-core` desde el 2026-10-21 (`20261021164649`).**
   Se verificó así: como owner devuelve solo los códigos que tiene; sin
   sesión devuelve `{}`. `cache` de React no memoriza dentro
   de Server Actions, así que **en una mutación siempre va
   `requirePermission`**, nunca la lista cacheada.
5. Si el permiso debe verse en el panel de administración de permisos,
   agrégalo también a `packages/permissions` (matriz visual) — pendiente de
   construir en la Fase 4.

Si falta el paso 2, el paso 3 deniega solo (ver sección anterior) — el
checklist existe para que la función funcione, no solo para "cumplir la
norma".

## Dominios

Ya no son un enum fijo de 6-7 valores compartido por toda la suite (como en
v2.0, pensado solo para RRHH). En v3.0, `domain` es un texto libre **scoped
por módulo** en `permissions_catalog.module_slug` — cada módulo define sus
propios dominios según su negocio:

| Módulo | Dominios (heredados/propuestos) |
|---|---|
| RRHH | Centro de Control, Talento, Turnos, Asistencia, Nómina, Sistema *(los 6 de v2.0, sin cambios)* |
| Flotilla | `dashboard`, `entregas` (orden_propia, orden, pago, material, cliente, cobro, recepcion, evidencia), `rutas` (recorrido, parada), `bodega` (carga, retorno), `conductor` (recorrido_propio), `incidencias`, `flota` (vehiculo), `conductores` (perfil), `configuracion` (reglas, excepcion), `reportes` (Paso Cero de Entregas 2026-10-23, `20261024034727`: 35 códigos + `ver_modulo`; plantillas Vendedor 8, Coordinador 24, Bodega 12, Administración 10, Conductor 4, Gerencia 36; ver [plan/22-flotilla-entregas.md](plan/22-flotilla-entregas.md) §19). Viajes heredados de Ruta360 y liquidaciones quedan para la Fase 4 completa |
| CRM — **retirado el 2026-10-20** (`20261020143821`: la app y sus 34 códigos `crm.*` se borraron sin datos; la réplica de AG Negocio va en `erp`, ver [plan/18-replica-ag-negocio.md](plan/18-replica-ag-negocio.md)). Lo que sigue es solo historia | `clientes` (3 segmentos, anteriores a la norma); desde 2026-10-18 también `metas` (avance_propio, avance_equipo, meta_vendedor, presupuesto), `ventas` (factura_propia, factura: ver/importar) y `configuracion` (vendedor), de 4 segmentos (`20261018184849`; plantillas Vendedor/Gerente de ventas/Administrador de ventas; "propio" = vendedor vinculado al usuario, lo filtra la RPC; ver [plan/15-metas-ventas.md](plan/15-metas-ventas.md)). **Embudo comercial, desde 2026-10-19** (`20261019152215`): `ventas.lead` (ver, crear, editar, convertir, eliminar), `ventas.oportunidad` y `ventas.actividad` (ver, crear, editar, eliminar), `ventas.cotizacion` (ver, crear, editar, aprobar, anular), `ventas.equipo.ver`, `ventas.asignacion.gestionar` y `configuracion.embudo.gestionar`. Sin `equipo.ver`, cada quien opera solo lo que tiene asignado, y la RPC lo filtra. `lead.convertir` crea el cliente sin necesitar `crm.clientes.crear`. Plantillas: Vendedor 17, Gerente 27, Administrador 34. Ver [plan/16-crm-embudo-comercial.md](plan/16-crm-embudo-comercial.md) |
| Atención | `recepcion`, `puesto`, `cola`, `cliente`, `configuracion`, `reportes` (Paso Cero 2026-10-14; ampliado 2026-10-15 con `reportes.mis_metricas.ver` y `cola.turno.reactivar`; plantillas Recepción/Agente/Supervisor; ver [plan/13-atencion-turnos.md](plan/13-atencion-turnos.md)) |
| Productos | `dashboard`, `catalogo` (producto, costo, fiscal), `configuracion` (clasificación, marca, unidad, proveedor, característica, contable) (Paso Cero 2026-10-16, `20261016203638`; plantillas Consulta/Editor/Contabilidad/Administrador; costo y datos fiscales con permisos aparte; ver [plan/14-productos.md](plan/14-productos.md)) |
| Presupuesto (`presupuesto`) | `metas` (avance_propio.ver, avance_equipo.ver, meta_vendedor.gestionar), `ventas` (presupuesto_anual.gestionar, factura_propia.ver, factura.ver, factura.importar) y `configuracion` (vendedor.gestionar). Son 8 códigos de 4 segmentos más `ver_modulo`. Paso Cero del 2026-10-20 (`20261020183127`), app inactiva. Plantillas: Vendedor 3, Gerente de ventas 7 y Administrador de ventas 9. "Propio" es el vendedor vinculado al usuario, y lo filtra la RPC. Solo el Administrador define el presupuesto anual y vincula vendedores. El dominio `contable` queda reservado para el presupuesto por centro de costo (fase 2). Funciones del 2026-10-20 (`20261020194816`), sin códigos nuevos: elegir los vendedores del cuadro de meta usa `metas.meta_vendedor.gestionar`; Clientes y Mis clientes usan `ventas.factura.ver` (todos) o `ventas.factura_propia.ver` (solo el vendedor vinculado), y la RPC fija el alcance. Ver [plan/19-presupuesto.md](plan/19-presupuesto.md) |
| Listas de precios (`precios`) | `dashboard`, `listas` (lista, precio, costo), `clientes` (clasificacion), `reglas` (politica). Paso Cero del 2026-10-20 (`20261020064732`), app inactiva. Plantillas: Consulta, Analista y Administrador. Ver [plan/17-erp.md](plan/17-erp.md) |
| ERP (`erp`) | `dashboard`, `inventario`, `compras`, `ventas`, `caja`, `cxc`, `cxp`, `bancos`, `contabilidad` y `fiscal`, con 51 códigos. Paso Cero del 2026-10-20 (`20261020064732`), app inactiva. Hay 9 plantillas, desde Bodeguero hasta Administrador. Nadie aprueba lo propio y los documentos fiscales y contables son inmutables; las dos reglas las aplica la RPC. Ver [plan/17-erp.md](plan/17-erp.md). Desde el 2026-10-20 la referencia es AG Negocio ([plan/18](plan/18-replica-ag-negocio.md)). Sus roles son una matriz recurso × acción: lista, crear, actualizar, eliminar, anular, exportar a Excel, exportar a PDF, reimprimir, más acciones especiales como aprobar, des-anular, editar precio o tasa y vender bajo costo. El Paso Cero de cada etapa R1–R8 ajustará estos códigos a esa matriz, y el usuario lo aprueba antes de crear tablas |
| Nexo (panel) | `administracion` — usuarios, roles, auditoría y sucursales (`nexo.administracion.sucursales.ver/gestionar`, 2026-10-14) (Paso Cero aplicado 2026-10-14, 9 códigos `nexo.administracion.*`; ver [plan/12-administracion-usuarios-roles.md](plan/12-administracion-usuarios-roles.md), ; roles de empresa y RPC de administración aplicados 2026-10-14, ver "Modelo vigente" abajo — pantallas **sin implementar**) |
| Nexo (panel) — plataforma | `plataforma` — super admin, **fuera de toda empresa**: `empresas.{ver,crear,editar,desactivar,entrar}`, `modulos.asignar`, `administradores.gestionar`, `auditoria.ver` y `marca.editar` (Paso Cero aplicado 2026-10-23, `20261024033541`). Se evaluarán con `core.has_platform_permission` (usuario activo en `core.platform_admins`), no con `has_permission`; ningún rol de empresa podrá incluirlos. Esquema, evaluación y pantallas pendientes. Ver [plan/21-plataforma-empresas.md](plan/21-plataforma-empresas.md) |
| Todos (incluye `nexo`) | `acceso` — dominio reservado para el permiso `<slug>.ver_modulo` que crea el trigger |

## Dos capas de enforcement, no solo una

1. **RLS en la base de datos** (la capa fuerte): cualquier tabla de un
   módulo que use `core.has_permission()` en sus policies queda protegida
   aunque alguien se salte por completo el código de la app (una query
   directa, un bug en la server action, etc.). Ejemplo real en
   `crm.clientes` (ver [`supabase/migrations/20260830000003_crm_schema.sql`](../supabase/migrations/20260830000003_crm_schema.sql)).
2. **`requirePermission()` en la server action** (la capa de UX): permite
   devolver un mensaje de error entendible en vez de que la query falle con
   un error crudo de Postgres. No es la que de verdad protege los datos —
   eso lo hace la policy de RLS — pero sin ella el usuario ve un error feo
   en vez de "No tienes permiso para esto".

`core.has_permission()` necesita saber el **rol** del usuario en la empresa
para el bypass owner/admin — eso vive en `core.company_memberships`
(`user_id`, `company_id`, `role`), una tabla que no estaba en el diseño
original de la Fase 2 y se agregó al implementar la Fase 3 porque
`hasPermission()` no tenía de dónde sacar el rol sin ella.

## Multi-tenant: `core.company_apps`

Un permiso técnico concedido (`granted = true`) no basta para ver un
módulo si la empresa del usuario no lo tiene contratado. El panel siempre
cruza `core.company_apps` (¿la empresa tiene el módulo activo?) **y**
`core.user_permissions` (¿el usuario tiene `<slug>.ver_modulo` concedido?)
— las dos condiciones, no una sola.

## Paso Cero — ley, previa a construir cualquier módulo o función nueva

**Prohibido generar código de frontend o crear tablas de datos para una
app/módulo nuevo sin antes haber diseñado, presentado y hecho aprobar
explícitamente su Matriz de Permisos y Roles, e insertado esa matriz en
el catálogo** (`core.permissions_catalog` + `core.app_roles` +
`core.app_role_permissions` si aplica capa 2) — nomenclatura estricta de
4 segmentos `[app].[modulo].[recurso].[accion]`, sin excepción para
código nuevo. Extiende el checklist de la norma v3.0 de más abajo: ese
checklist ya exigía el permiso *antes* de que la función funcione (falla
cerrada si falta), Paso Cero exige además que el permiso exista *antes*
de que exista la tabla o la página. Detalle completo y el precedente real
(matriz de RRHH): [planning/ARQUITECTURA_MVP_ESCALABLE.md §6](planning/ARQUITECTURA_MVP_ESCALABLE.md#6-playbook-para-agregar-una-nueva-app).

**Verificación Remota Obligatoria** — antes de escribir un script de
`insert` hacia `core.permissions_catalog`/`core.app_roles`, se consulta
el estado real del proyecto remoto (`core.apps`, `core.permissions_catalog`,
`core.app_roles` filtrados por `module_slug`) para confirmar que no hay
colisión y anclar el script a la realidad — nunca asumir el estado a
partir de esta documentación, que puede estar desactualizada.

## Modelo vigente desde 2026-10-14: roles de empresa (un rol por usuario)

Decisión del usuario, aplicada en `20261014203144_nexo_usuarios_roles_esquema`
(diseño en [plan/12-administracion-usuarios-roles.md](plan/12-administracion-usuarios-roles.md)):

- Los roles los crea la empresa desde `apps/nexo` (`core.roles`): nombre +
  **apps con acceso** (`<app>.ver_modulo` dentro del rol) + **permisos
  internos** de cada app (`core.rol_permisos`).
- Cada usuario tiene **un solo rol** (`core.company_memberships.rol_id`).
  El owner no lleva rol: tiene acceso total.
- `core.has_permission()` (misma firma) evalúa en orden: código registrado →
  módulo activo y habilitado para la empresa (**incluso para el owner**) →
  membresía activa → excepción individual en `core.user_permissions` →
  owner → rol de empresa. Ya no hay bypass por membresía `admin`.
- Anti-escalada (en las RPC `public.admin_*`): nadie otorga ni asigna
  permisos que no tiene; nadie edita su propio rol ni se cambia su propio
  rol/estado; solo el owner modifica al owner; todo cambio queda en
  `core.audit_log` (`admin.*`).
- Un módulo nuevo **sigue necesitando su Paso Cero** (catálogo): sus
  permisos aparecen solos en el editor de roles una vez registrados y
  habilitados en `core.company_apps`. `core.app_roles` pasa a ser solo
  plantillas ("Cargar plantilla") — un Paso Cero puede seguir sembrándolas.

## Extensión: rol por app (capa 2, entre suite y permiso fino) — reemplazada 2026-10-14

> Histórico. Desde 2026-10-14 `core.has_permission` ya no evalúa
> `core.user_app_roles` (tenía 0 filas); ver la sección anterior.

`core.company_memberships.role` (owner/admin/member) es un rol de
**suite** — todo o nada por empresa. `core.user_permissions` es un
permiso **fino** — uno por uno. Falta la capa intermedia para el caso
"admin de RRHH pero solo lectura en Contabilidad" sin otorgar 20
permisos a mano: `core.app_roles` / `core.app_role_permissions` /
`core.user_app_roles`, más una versión extendida (retrocompatible) de
`core.has_permission()` que evalúa las 3 capas en orden. Diseño completo
y migración SQL en
[planning/ARQUITECTURA_MVP_ESCALABLE.md §3](planning/ARQUITECTURA_MVP_ESCALABLE.md#3-matriz-de-roles-y-permisos-granulares-rbacabac)
(`supabase/migrations/20260902000001_app_scoped_roles.sql`, pendiente de
aplicar al proyecto remoto).

## Agencia digital — matriz mínima aprobada (2026-10-14)

App `agencia`: permiso reservado `agencia.ver_modulo` generado por el trigger y permiso funcional `agencia.dashboard.resumen.ver` (cuatro segmentos). Rol de app `consulta` con ambos permisos; sin asignación automática de usuarios. Owner/admin conserva el fallback sujeto al deny explícito. Matriz aprobada por el usuario y aplicada mediante `20261014181353_agencia_dashboard_access`, inicialmente con app inactiva y ninguna empresa habilitada. No cambia el motor RBAC ni inicia el proyecto integral de usuarios/roles. [Detalle, evidencia y activación](status-log/2026-10-14-agencia-independiente.md).

> **Ajuste por el modelo de roles de empresa (mismo día, `20261014203144`):**
> `core.has_permission` ya no evalúa `core.user_app_roles` ni el bypass
> `admin` — el rol de app `consulta` de Agencia queda como **plantilla** del
> editor de roles. Acceso efectivo: el owner (una vez la app esté activa y
> habilitada para la empresa) y cualquier usuario cuyo rol de empresa
> incluya "Agencia digital" (`agencia.ver_modulo` + `agencia.dashboard.resumen.ver`),
> asignado desde Configuración → Roles. Mientras `core.apps.active = false`
> o la empresa no la tenga en `core.company_apps`, nadie la ve (tampoco el owner).

## RRHH P3 — pendiente de aplicar (2026-10-16)
P3 preparado (no aplicado): escritura directa de marcas retirada a authenticated en padre y particiones. SELECT y marcas.ver se conservan. Codigos crear/editar/eliminar siguen registrados sin via directa; correccion auditada queda fuera del piloto.

## Asistencia — app con visibilidad propia y permisos de RRHH (2026-10-17)

Primer caso de una app del Launcher cuyo permiso de visibilidad y cuyos permisos de contenido pertenecen a módulos distintos. `asistencia.ver_modulo` (módulo `asistencia`, generado por el trigger con `20261017173701`) decide si se ve el mosaico y si se entra a `/rrhh/asistencia`. Lo que se puede hacer dentro lo deciden los permisos que ya existían, `rrhh.asistencia.{marcas,kioskos,justificaciones,turnos,feriados}.*`, que siguen en el módulo `rrhh` y caen si RRHH se desactiva. Las Server Actions validan solo el permiso de contenido, igual que RLS: la visibilidad es una barrera de interfaz, no de datos. Hoy solo el owner tiene `asistencia.ver_modulo`; asignarlo a roles requiere aprobación (Paso Cero). En el editor de roles, Asistencia aparece solo con "Acceso" y sus permisos funcionales bajo RRHH. [Detalle](status-log/2026-10-17-asistencia-app.md).

### Reportes: `reportes.ver` y `reportes.exportar` (2026-10-18)

Paso Cero aprobado y aplicado (`20261018014012`). `rrhh.asistencia.reportes.ver` permite consultar los 5 reportes en pantalla, incluidos los horarios y las tolerancias de la jornada. `rrhh.asistencia.reportes.exportar` permite el PDF y la vista de impresión; cada exportación queda en `core.audit_log` como `rrhh.asistencia.reporte.exportado`.

Plantillas:
- Administrador de RRHH, Supervisor de Asistencia y Especialista de Planillas: ver y exportar.
- Consulta General: solo ver.

## Planilla — Paso Cero y separación de funciones (2026-10-21)

Paso Cero aprobado y aplicado (`20261021160943`). El diseño está en el [plan 20 §8](plan/20-planilla.md). Agrega 15 códigos al dominio `planillas` de RRHH, que llega a 25:
- **Régimen:** `regimen.ver` y `regimen.cambiar`. El régimen va en cada contrato y puede ser laboral o de servicios profesionales; el usuario pidió dejar preparadas las dos opciones.
- **Conceptos:** `conceptos.ver` y `conceptos.gestionar`.
- **Pago:** `planilla.pagar`.
- **Vacaciones:** `vacaciones.ver`, `vacaciones.registrar` y `vacaciones.aprobar`.
- **Préstamos:** `prestamos.ver` y `prestamos.gestionar`.
- **Liquidaciones:** `liquidaciones.ver`, `liquidaciones.calcular` y `liquidaciones.aprobar`.
- **Declaraciones y colillas:** `declaraciones.generar` y `colillas.enviar`.

**Separación de funciones:** quien genera la planilla no la aprueba ni la anula, y quien calcula una liquidación no la aprueba.
- `especialista_planillas` ya no tiene `planilla.aprobar` ni `planilla.anular`.
- Cambiar el régimen, pagar, aprobar o anular una planilla y aprobar liquidaciones queda solo en la plantilla `admin`.
- Las RPC del motor deben además impedir que un mismo usuario genere y apruebe la misma corrida, aunque tenga los dos permisos. **PL2a (`20261021191441`, aplicada):** `planilla_aprobar` rechaza a quien creó o calculó la planilla, con aprobación estricta por decisión del usuario.
- Fijar `contratos.fecha_antiguedad` usa `rrhh.planillas.liquidaciones.aprobar` (decisión del usuario del 2026-10-21; no es un código nuevo), porque decide el monto de la liquidación. Las nuevas vigencias de parámetros usan `parametros.editar` por RPC auditada, sin escritura directa.

| Plantilla | Permisos de planillas |
|---|---|
| admin | 27 (todos; desde PL2b también pagar y anular liquidaciones) |
| especialista_planillas | 18 (genera y prepara; no aprueba, no anula, no paga ni cambia el régimen) |
| consulta | 7 (solo ver) |
| supervisor_asistencia | 2 (ver y aprobar vacaciones) |
| gestor_expedientes | 1 (ver régimen) |

**Paso Cero de PL2b (`20261021235639`, aplicado el 2026-10-22):** `rrhh.planillas.liquidaciones.pagar` y `rrhh.planillas.liquidaciones.anular`, solo en la plantilla `admin` (decisión del usuario: "Dos permisos nuevos, solo admin"). El dominio `planillas` queda con 27 códigos. Aprobar una liquidación exige además `rrhh.expedientes.contratos.finalizar`, porque al aprobarla se finaliza el contrato. Las RPC de PL2b y PL2c aplican separación de funciones también en vacaciones (quien registra un movimiento no lo aprueba) y en liquidaciones (no la aprueba quien la creó ni quien la calculó).

Ningún rol de empresa tiene estos permisos todavía. Se asignan desde Configuración → Roles. Hoy solo el owner de la empresa puede usar Planilla.

`marcas.ver` y `reportes.ver` son independientes. Ningún rol de empresa los tiene todavía. Las RPC validan con `core.has_permission`, y el Route Handler y la vista de impresión validan antes de llamarlas.

### Enrolamiento de terminales: `kioskos.asignar` y `kioskos.revocar` (2026-10-17)

Paso Cero aprobado por el usuario y aplicado (`20261017180753`): `rrhh.asistencia.kioskos.asignar` (generar el código que vincula un equipo a un dispositivo) y `rrhh.asistencia.kioskos.revocar` (quitar el equipo o cancelar un código), solo en la plantilla Administrador de RRHH; el Supervisor de Asistencia no los recibe. Se separan de `kioskos.editar` porque emitir o retirar una credencial de máquina pesa más que renombrar un dispositivo. Las Server Actions de Dispositivos llaman a `requirePermission` y las RPC vuelven a validar con `core.has_permission`.
