# Bitácora de migración

Orden de bitácora: más reciente arriba.

## 2026-09-07 — Nexo Enterprise UI: rediseño visual transversal

Contexto completo en [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
sección 0.15. Alcance predominantemente de UI/navegación
(`packages/ui`/`apps/nexo`/`apps/rrhh`/`apps/crm`) — solo 3 migraciones,
ninguna toca contratos/PIN/jornadas/asistencia/planillas.

**3 migraciones nuevas, aplicadas a `nexo-core` y verificadas con RPC
real** (mismo patrón: `apply_migration` primero, archivo de Git después
con el `version` que Supabase asignó):

- `20260907223910_nexo_enterprise_ui_favicon` — aditiva:
  `core.platform_settings.favicon_url`. `get_platform_settings`/
  `update_platform_settings` recreadas (`DROP FUNCTION` + `CREATE` —
  `RETURNS TABLE` cambia el tipo fila compuesto al agregar una columna,
  `create or replace` lo rechaza con error real, confirmado al
  intentarlo sin el drop). Probado end-to-end: `update_platform_settings`
  con favicon → `get_platform_settings` lo devuelve; limpiado después
  (favicon vuelto a `null`, cero residuo).
- `20260907224007_nexo_enterprise_ui_eliminar_empleado` —
  `rrhh.fn_eliminar_empleado`/`public.eliminar_empleado`: completa el
  hueco de UI de "eliminar empleado" (permiso `rrhh.expedientes.
  empleados.eliminar` y política RLS `DELETE` ya existían desde F1.1,
  sin consumidor hasta ahora). Ajuste obligatorio del usuario: valida
  **explícitamente** contra `rrhh.contratos` (cualquier estado) antes de
  eliminar, con mensaje de dominio claro — no depende de la violación de
  la FK. Verificado con 3 casos reales (sin contrato → elimina; con
  contrato borrador → rechazado por dominio; sin permiso → rechazado),
  cero residuo de datos de prueba.
- `20260907224240_fix_eliminar_empleado_anon_grant` — corrección el mismo
  turno: `get_advisors(security)` detectó que `public.eliminar_empleado`
  quedaba ejecutable por `anon` (default privileges de Postgres al crear
  una función nueva en `public`, mismo patrón ya visto en
  `20260902000009_fix_crear_empleado_anon_grant`) — revocado
  explícitamente, reverificado con `has_function_privilege`.

**Kit de UI compartido**: `AppShell`/`ShellBar`/`Sidebar`/`StatCard`
retirados de `packages/ui` (verificado por grep de `"@nexo/ui"` en todo
el monorepo antes de borrar — cero consumidores fuera de las 3 apps
migradas en este mismo commit); reemplazados por `NexoShell`/
`NexoSidebar`/`NexoTopbar`/`MetricCard` + el resto del kit nuevo
(`Breadcrumb`, `PageHeader`, `DashboardHero`, `ActivityFeed`,
`QuickActions`, `DataTable`, `FilterBar`, `StatusBadge`, `FormTabs`,
`FormSection`, `EmptyState`, `ConfirmDialog`, `Toast`/`useToast`).
`Toast` envuelve `sonner` (ya era dependencia real en uso en
`apps/crm`/`apps/rrhh`) en vez de duplicar un sistema de notificaciones —
`sonner` se agregó como dependencia real de `packages/ui` y `apps/nexo`.
`pnpm-lock.yaml` actualizado con `pnpm install --no-frozen-lockfile
--lockfile-only` (el `pnpm install` normal fallaba con `EPERM` de entorno
sobre binarios nativos de `turbo` al materializar `node_modules` — mismo
tipo de bloqueo de Windows/OneDrive ya documentado para `tsc`; el modo
`--lockfile-only` no escribe `node_modules`, evita el problema por
completo).

## 2026-09-07 — F1.4: Jornadas mínimas

Contexto completo en [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
sección 0.14. Rama `feat/rrhh-f1-4-jornadas-minimas` → `main`.

Revisión previa obligatoria del stash `feat/rrhh-jornadas-y-horas`
(trabajo de una sesión anterior a `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`):
contenía solo 5 archivos de **documentación** (`CLAUDE.md`,
`docs/PERMISSIONS.md`, `docs/README.md`, `docs/RRHH_IMPLEMENTATION_PLAN.md`,
`docs/planning/RRHH_JORNADAS_DISENO.md`) — **ninguna migración SQL ni
código de app**. Clasificado como incompatible/descartable para reutilizar
literalmente: sus FK cuelgan de `empleado_id` (no `contrato_id`, el modelo
vigente), y su alcance (evidencia fotográfica en kiosco, redondeo,
incidencias, consolidación) excede F1.4. El propio documento dice "nada de
esto se aplicó". Stash intacto, sin `pop` — nada se integró.

**3 migraciones nuevas, aplicadas a `nexo-core` y verificadas** (aplicadas
primero vía `apply_migration`, archivo de Git escrito después con el mismo
`version` que Supabase asignó — mismo patrón que las migraciones
anteriores de esta fecha):

- `20260907162904_f1_4_jornadas_permission_matrix` — Paso Cero. Inserta 4
  códigos nuevos (`rrhh.asistencia.feriados.{ver,crear,editar,eliminar}`),
  único permiso nuevo necesario. Reutiliza sin cambios
  `rrhh.asistencia.turnos.{ver,crear,editar,eliminar}` (existentes desde
  la matriz original de RRHH, nunca consumidos hasta ahora) para
  `rrhh.jornadas`/`rrhh.jornada_dias`, y `rrhh.expedientes.contratos.editar`
  (existente) para asignar jornada a un contrato — sin duplicar ningún
  código. Aprobado explícitamente por el usuario antes de aplicar.
- `20260907162929_fix_f1_4_feriados_admin_role_missing` — corrección el
  mismo día: la migración anterior asumía que el rol `admin` de RRHH
  recibe automáticamente los permisos nuevos de un dominio existente.
  Falso — verificado con una consulta real después de aplicar. Sin este
  fix, `admin` quedaba denegado (fail-closed) para feriados.
- `20260907163244_f1_4_rrhh_jornadas_minimas` — modelo mínimo de 4 tablas:
  - `rrhh.jornadas` / `rrhh.jornada_dias`: plantilla reutilizable + reglas
    por día (1=lunes..7=domingo), un único bloque entrada/salida por día
    (sin turnos nocturnos ni cruce de medianoche). Escritura directa
    protegida por RLS (mismo patrón que `rrhh.parametros_ley`).
  - `rrhh.contrato_jornadas`: histórico de asignación por rango de
    vigencia (`vigente_desde`/`vigente_hasta`), `EXCLUDE USING gist`
    (requiere `btree_gist`) contra solapamientos por `contrato_id`.
    Escritura SOLO vía `rrhh.fn_asignar_jornada_contrato` (cierra la
    vigencia abierta anterior y abre una nueva, atómicamente).
  - `rrhh.feriados`: catálogo por empresa, sin tipo/alcance ni pago
    (decisión de negocio pendiente).
  - RPC nuevas: `fn_asignar_jornada_contrato`, `fn_jornada_vigente_contrato`
    (interfaz de solo lectura para F1.5, sin motor de cálculo).
  - `rrhh.fn_activar_contrato` (`create or replace`, mismo tipo de
    retorno): ahora exige al menos una fila en `contrato_jornadas` para
    activar — decisión explícita del usuario (jornada obligatoria).
  - Estrategia de versionado: `jornada_dias` editable en vivo; la garantía
    de no alterar retroactivamente un período cerrado la da
    `contrato_jornadas` + que F1.5 deberá snapshotear las reglas del día
    en el momento del cálculo (mismo criterio que `planilla_detalles`).

Verificado con llamadas RPC reales (no solo `INSERT` crudo), simulando
`auth.uid()` vía `request.jwt.claims` (empleado/contrato/jornadas de
prueba, 0 filas antes y después): crear jornada → definir días → asignar a
contrato borrador → activar sin jornada rechazado → activar con jornada
aceptado (PIN generado) → jornada vigente por fecha resuelta correctamente
→ reasignación con vigencia histórica (cierra la anterior, abre la nueva,
sin sobreescribir) → solapamiento inválido rechazado (`EXCLUDE`) →
cross-company rechazado → usuario sin permiso rechazado (RPC y lectura) →
RLS directa (lectura e insert) rechazada sin permiso → jornada con
histórico protegida contra `DELETE` por FK → finalizar contrato conserva
el histórico de jornadas intacto → feriados CRUD + duplicado rechazado.
`get_advisors(security)`: sin exposición nueva a `anon`, solo los WARN ya
aceptados de `authenticated` (mismo patrón que el resto de RRHH).
`get_advisors(performance)`: solo INFO de FK sin índice de cobertura /
índice sin uso, misma deuda pre-existente ya documentada (sección 0.8 de
`IMPLEMENTATION_STATUS.md`), nada nuevo que bloquee.

**Gap de permisos detectado durante la UI, no cerrado en esta sesión**:
`gestor_expedientes` tiene `rrhh.expedientes.contratos.editar` (puede
asignar jornada vía RPC) pero NO `rrhh.asistencia.turnos.ver` (no puede
ver el listado de jornadas para elegir una en el selector de la UI) — la
matriz aprobada reutilizó `turnos.*` tal cual, sin extenderla a este rol.
Es una decisión de rol nueva, no cubierta por la aprobación de este Paso
Cero — queda señalada para aprobación aparte, no aplicada.

**No verificado en navegador/UI** — mismo `EPERM` de entorno ya
documentado (2026-09-05), reconfirmado en esta sesión. Verificación
equivalente ejecutada después del push a `main` (commit `a68c5e9`): build
real de Vercel para los 3 proyectos afectados (`nexo-rrhh`, `nexocore`,
`nexo-crm` — reconstruyen por el cambio en `packages/ui/Sidebar.tsx`),
los 3 en `readyState: READY`, sin `get_runtime_errors` nuevos en
`nexo-rrhh`. Frontend nuevo: `/rrhh/jornadas` (catálogo de jornadas +
días + feriados) y sección "Jornada" en `/rrhh/expedientes/[id]`
(asignar/reasignar por contrato). Verificado por revisión estática
cuidadosa del código + la verificación exhaustiva de esquema/RPC/RLS de
arriba + el build real de Vercel — no por interacción real en un
navegador.

## 2026-09-07 — F1.0 a F1.3 completas (auditoría, cierre D-06, Paso Cero, contratos, PIN contractual)

Contexto completo en [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
sección 0 y en la sección "F1.0.1" agregada en esta misma fecha.

- **F1.0 no generó migraciones** — fue una auditoría de solo lectura contra
  `main`, `nexo-core` remoto y Vercel. El único hallazgo con acción
  inmediata fue de seguridad (D-06, ver abajo).
- **1 migración nueva, aplicada a `nexo-core` y verificada**
  (`20260907151106_revoke_validar_acceso_operativo_public_execute`, rama
  `docs/f1-0-auditoria-rrhh` → `main`):
  - Revoca `EXECUTE` de `anon` y `authenticated` sobre
    `public.validar_acceso_operativo(p_nombre_usuario text, p_pin text)` —
    el wrapper público del diseño de "PIN de doble propósito" (login
    operativo con el mismo PIN del kiosko), rechazado como arquitectura
    final por `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`/`DRIVER_ACCESS_AND_KIOSK.md`.
    Confirmado por búsqueda estática en todo el monorepo que no tiene
    ningún consumidor real en el código.
  - No reescribe la migración histórica `20260902000008` que la creó.
  - No elimina `rrhh.fn_validar_acceso_operativo` ni el wrapper público:
    ambas quedan marcadas explícitamente como deprecadas vía
    `comment on function`, pendientes de una migración de limpieza
    posterior y separada (junto con `rrhh.seguridad_accesos` y las
    columnas `nombre_usuario`/`user_id`/`pin_bloqueado`/`intentos_fallidos`
    de `rrhh.empleados`, que F1.1–F1.3 van a reemplazar).
  - Verificado post-aplicación con `has_function_privilege`: `anon` y
    `authenticated` → `false`; `service_role`/`postgres` → `true` (sin
    cambio, esperado). El advisor de seguridad
    "Public Can Execute SECURITY DEFINER Function" para esta función ya
    no aparece en `get_advisors(security)`.
  - Migración aplicada primero vía `apply_migration` (MCP de Supabase) y
    el archivo en `supabase/migrations/` escrito después usando el mismo
    `version` que Supabase asignó (`20260907151106`) — evita a propósito
    la divergencia de historial que ocurrió el 2026-09-05 (ver entrada de
    abajo), sin necesitar ninguna reparación posterior.
- **1 migración más, Paso Cero de permisos, aplicada y verificada**
  (`20260907151643_rrhh_contratos_permission_matrix`, rama
  `docs/paso-cero-matriz-contratos` → `main`), aprobada explícitamente
  por el usuario antes de cualquier tabla/UI de F1.1–F1.3:
  - Inserta 7 códigos nuevos en `core.permissions_catalog`, reutilizando
    el dominio `expedientes` ya existente:
    `rrhh.expedientes.contratos.{ver,crear,editar,activar,finalizar}`,
    `rrhh.expedientes.credenciales.{ver,regenerar}`.
  - Asigna en `core.app_role_permissions`: `admin` los 7;
    `gestor_expedientes` ver/crear/editar de contratos + ver de
    credenciales; `supervisor_asistencia` solo ver de credenciales;
    `especialista_planillas`/`consulta` ninguno de los 7.
  - No inserta `core.identidad.cuenta.*` (capacidad transversal de Core,
    diseño objetivo sin implementar) ni `flotilla.conductores.acceso.*`
    (eliminado de la propuesta — la provisión/bloqueo de identidad es
    exclusiva de `core.identidad`) — decisión explícita del usuario.
  - Verificado post-aplicación con una consulta directa a
    `core.app_role_permissions` filtrada por los 7 códigos: coincide
    exactamente con la tabla de asignación aprobada.
  - Mismo patrón de versión que la migración anterior: aplicada primero,
    archivo de Git escrito después con el `version` real (`20260907151643`).
- **2 migraciones más, F1.1 (Separar Expediente General/Laboral), aplicadas
  y verificadas** (rama `docs/f1-1-expediente-general-laboral` → `main`):
  1. `20260907152301_f1_1_separar_expediente_general_laboral`: columnas
     laborales/credenciales de `rrhh.empleados` (`puesto`, `departamento`,
     `fecha_ingreso`, `fecha_baja`, `estado`, `pin_hash`, `nombre_usuario`,
     `pin_bloqueado`, `intentos_fallidos`, `user_id`) quedan nullable donde
     aplicaba y marcadas `DEPRECADAS` vía `comment on column` — no se
     eliminan todavía. `estado` recibe nuevo default `'sin_contrato'`.
     `rrhh.fn_crear_empleado`/`public.crear_empleado` reemplazadas por una
     versión de firma reducida (solo Expediente General) — la firma
     anterior (13 parámetros) se elimina con `drop function`, no se edita
     in place (Postgres distingue funciones por firma).
  2. `20260907152500_f1_1_fix_empleados_estado_check`: corrección
     necesaria — el `CHECK` de `estado` no incluía `'sin_contrato'`.
     Detectada por una prueba de inserción/borrado antes de dar F1.1 por
     terminado, sin dejar ninguna fila real inválida.
  - Verificado: inserción de prueba (borrada en la misma sesión) confirma
    que un alta con solo datos generales queda con las columnas
    deprecadas en `null`/default; `rrhh.fn_registrar_marca_kiosko`
    (kiosko en producción) verificado intacto — sigue exigiendo
    `estado = 'activo' and pin_hash is not null` hasta que F1.3 lo
    reemplace por la validación contractual.
  - Frontend actualizado en el mismo cambio: formulario y listado de
    `/rrhh/expedientes` (ya no piden/muestran puesto, departamento,
    compensación, PIN, usuario), dashboard (`Empleados activos` →
    `Expedientes`). Tipos (`database.types.ts` de `apps/rrhh` y su
    espejo en `apps/crm`) actualizados a mano.
- **1 migración más, F1.2 (`rrhh.contratos` + compensación contractual),
  aplicada y verificada** (`20260907153604_f1_2_rrhh_contratos`, rama
  `docs/f1-2-rrhh-contratos` → `main`):
  - Tabla `rrhh.contratos` (Expediente Laboral): `borrador → activo →
    finalizado`, un solo contrato activo por empleado (unique index
    parcial), trigger `trg_validar_transicion_contrato` (defensa en
    profundidad: transiciones válidas + inmutabilidad de datos base
    fuera de `borrador`). RLS `ver`/`crear`/`editar` (editar solo en
    `borrador`), sin `DELETE`.
  - Tabla `rrhh.contrato_compensacion` (1:1 con el contrato, no el
    empleado — D-03), reutiliza `rrhh.expedientes.compensacion.ver/editar`
    (permisos existentes, sin crear uno nuevo).
  - RPC `rrhh.fn_crear_contrato`/`fn_editar_contrato`/`fn_activar_contrato`/
    `fn_finalizar_contrato` + wrappers `public.*` (`authenticated`-only).
    `fn_activar_contrato`/`fn_finalizar_contrato` son solo transición de
    estado por ahora — F1.3 las reemplaza para generar/revocar el PIN.
  - Verificado con inserción/transición/borrado de prueba (0 filas antes
    y después): transición inválida rechazada, edición fuera de
    `borrador` rechazada, segundo contrato activo rechazado, reapertura
    de contrato finalizado rechazada. `pg_policies`/`has_function_privilege`
    confirmados; `get_advisors(security)` sin exposición nueva a `anon`.
  - Frontend nuevo: `/rrhh/expedientes/[id]` (ficha del empleado +
    Expediente Laboral), listado enlaza a cada ficha y muestra contrato
    activo real. **No verificado en navegador** — mismo `EPERM` de
    entorno ya documentado (2026-09-05), reconfirmado con `next dev` y
    `tsc --noEmit` hoy; sustituido por revisión estática cuidadosa.
- **3 migraciones más, F1.3 (PIN exclusivamente contractual) + 2
  correcciones, aplicadas y verificadas END-TO-END** (no solo esquema —
  ver abajo), rama `docs/f1-3-pin-contractual` → `main`:
  1. `20260907154715_f1_3_pin_exclusivamente_contractual`: tabla nueva
     `rrhh.contrato_credenciales` (1:1 con el contrato, RLS sin
     policies, sin GRANT de SELECT a nadie); `rrhh.fn_activar_contrato`
     reemplazada (cambia el tipo de retorno — requirió DROP) para
     generar el PIN; `rrhh.fn_finalizar_contrato` extendida para
     revocarlo; `rrhh.fn_regenerar_pin_contrato` y
     `rrhh.fn_estado_credencial_contrato` nuevas; `rrhh.fn_registrar_marca_kiosko`
     (kiosko en producción) reescrita para validar contra la nueva
     credencial en vez de `rrhh.empleados.pin_hash/estado/pin_bloqueado`
     — misma firma, mismo rate-limit, misma lógica anti-enumeración.
  2. `20260907154858_fix_crear_empleado_returning_ambiguous` y
     `20260907154942_fix_crear_contrato_returning_ambiguous`: **2 bugs
     reales encontrados durante la verificación end-to-end** — ni
     `fn_crear_empleado` (F1.1) ni `fn_crear_contrato` (F1.2) pudieron
     ejecutarse NUNCA desde que se crearon (`RETURNING` sin alias de
     tabla, ambiguo contra las variables `OUT` de `RETURNS TABLE`). Las
     pruebas de esquema de F1.1/F1.2 no lo detectaron porque hacían
     `INSERT` crudo, sin pasar por la función real.
  - **Verificación end-to-end real** (simulando `auth.uid()` vía
    `request.jwt.claims` contra un usuario `owner` real y datos de
    prueba borrados al final, 0 filas antes/después): crear empleado →
    crear contrato con salario → activar (PIN devuelto una vez) →
    marcar entrada → marcar salida → ver estado de credencial (sin
    PIN) → regenerar PIN → PIN anterior rechazado → PIN nuevo acepta
    marca → finalizar contrato → PIN rechazado después de finalizar.
    Negativos: usuario sin permiso rechazado; empresa cruzada rechazada.
  - `get_advisors(security)` sin exposición nueva a `anon` (solo los WARN
    esperados de `authenticated`, mismo patrón ya aceptado).
  - Frontend: reveal-once de PIN en "Activar"/"Regenerar PIN", badge de
    estado de credencial, en `contratos-panel.tsx` + `actions.ts`.
  - D-02 y D-06 quedan completamente cerrados (no solo el componente de
    seguridad inmediato de F1.0.1).

## 2026-09-05 — Auditoría de seguridad de RRHH cerrada en producción + fix de ruteo del kiosco

Continuación directa de la fase anterior: cierre de los riesgos de
seguridad documentados el 2026-09-04 (funciones internas de RRHH
ejecutables por `anon`), más un bug de ruteo real encontrado al
verificar el kiosco en producción. Detalle completo, matrices de
prueba y evidencia paso a paso en
[SECURITY_VALIDATION_HANDOFF.md](SECURITY_VALIDATION_HANDOFF.md).

- **5 migraciones nuevas, aplicadas a `nexo-core` y verificadas**
  (`20260905000001` a `20260905000005`, rama
  `security/rrhh-audit-hardening`, mergeada a `main` en el commit
  `ac9a487`):
  1. `revoke_rrhh_internal_anon_execute` — revoca `EXECUTE` de `anon` en
     `rrhh.fn_crear_empleado`, `rrhh.fn_set_pin_empleado` y
     `public.get_visible_apps`.
  2. `kiosko_minimize_exposure_and_bloqueo_check` — `fn_registrar_marca_kiosko`
     deja de devolver `empleado_nombre` (dato personal) y respeta
     `pin_bloqueado`.
  3. `rrhh_rls_wrap_auth_uid_initplan` — corrige el patrón de
     rendimiento `auth_rls_initplan` en las 25 policies de `rrhh`
     (`(select auth.uid())`), sin cambiar autorización.
  4. `revoke_rrhh_internal_public_execute` — corrige un fallo confirmado
     por validación local previa: revoca `EXECUTE` de `PUBLIC` (no solo
     `anon`) en `fn_crear_empleado`/`fn_set_pin_empleado`, ya que ambas
     conservaban el grant al pseudo-rol `PUBLIC` desde su creación.
  5. `rrhh_public_auth_hardening` — nueva tabla `rrhh.kiosko_rate_limits`
     (rate-limit persistente del kiosko: 8 fallos/1min → bloqueo 5min,
     sin datos personales, RLS sin policies); corrige un bug real de
     `RAISE EXCEPTION` post-escritura en `fn_validar_acceso_operativo`
     (y por diseño en `fn_registrar_marca_kiosko`) que impedía que el
     bloqueo a 3 fallos consecutivos persistiera; cierra `EXECUTE`
     directo de ambas funciones internas para todos los roles.
- **Validación local con Docker no se pudo ejecutar** (el entorno de la
  sesión no tenía WSL2/Docker operativo pese a instalarlo y reiniciar —
  se confirmó que la sesión corre en un entorno distinto a la máquina
  física del usuario). El usuario autorizó explícitamente aplicar
  directo a `nexo-core`, dado que `20260905000004` ya corregía un
  fallo real ya confirmado por una validación local anterior. Se
  verificó en su lugar, contra producción: privilegios (`has_function_privilege`
  antes/después para las 4 funciones internas + 2 wrappers públicos),
  RLS y ausencia de acceso directo en `rrhh.kiosko_rate_limits`, y
  `get_advisors` (security y performance) sin los WARN que esta
  auditoría vino a cerrar.
- **Divergencia de historial de migraciones, diagnosticada y reparada**:
  las 5 migraciones se aplicaron con `apply_migration` (MCP de
  Supabase), que registra su propio timestamp de versión en vez del que
  lleva cada archivo — el historial remoto quedó con 5 versiones
  auto-generadas (`20260905072348` etc.) sin correspondencia con
  `main`. Reparado con una transacción de `UPDATE` sobre
  `supabase_migrations.schema_migrations` (verificación interna con
  `ROLLBACK` automático ante discrepancia, sin tocar el esquema ni
  volver a ejecutar SQL de las migraciones) — historial remoto alineado
  1:1 con los 5 archivos de `main`.
- **Bug de ruteo real encontrado al verificar el kiosco en producción**:
  `/rrhh/kiosco` redirigía a `/login` del panel pese a que
  `apps/rrhh/src/proxy.ts` ya excluía `/kiosco` de su propio guard de
  sesión correctamente. Causa: `apps/nexo/src/proxy.ts` (zona raíz de
  Multi-Zones) interceptaba `/rrhh/*` antes de que el rewrite lo
  entregara a la zona `rrhh` — su `matcher` excluía `crm` de su guard
  pero nunca `rrhh`, pese a que esa zona tiene el mismo patrón de
  middleware propio. Corregido agregando `rrhh` a la misma exclusión
  (rama `fix/rrhh-kiosco-public-route`, mergeada a `main` en el commit
  `a3bcc5d`). Verificado en producción: `/rrhh/kiosco` carga sin
  sesión, `/rrhh/expedientes` sigue redirigiendo a login, `/crm` y `/`
  sin regresión.
- **Qué sigue sin cambiar**: el motor de consolidación de horas y el
  generador de planillas (pasos 3 y 4 del flujo del MVP) siguen sin
  construir — ninguno de estos dos cierres declara el MVP de RRHH
  completo. Ver [RRHH_MVP.md](RRHH_MVP.md).

## 2026-09-02 a 2026-09-04 — Adaptación de RRHH: schema, permisos, kiosco, despliegue en producción

Fase 6a del roadmap. A diferencia de CRM (migración de datos de un
proyecto Supabase existente), RRHH se **diseñó de cero** para Nexo —
Gestor360/`marcacion-grupo-ct` (importado el 2026-08-29) quedó como
referencia de producto, no como fuente de esquema a migrar 1:1.

- **Paso Cero cumplido**: matriz de permisos de RRHH (37 códigos bajo
  `rrhh.*`, dominios `expedientes`/`asistencia`/`planillas`) diseñada y
  aprobada antes de crear ninguna tabla —
  [`20260902000005_rrhh_permissions_and_roles.sql`](../supabase/migrations/20260902000005_rrhh_permissions_and_roles.sql).
  Roles con alcance por app (`app_scoped_roles`, extensión de `core`
  aplicada el mismo día): `admin`, `supervisor_asistencia`,
  `gestor_expedientes`, `especialista_planillas`.
- **Schema `rrhh` aplicado**
  ([`20260902000006`](../supabase/migrations/20260902000006_rrhh_schema_and_tables.sql)):
  8 tablas base (`empleados`, `empleado_compensacion`,
  `kiosko_dispositivos`, `asistencia_marcas`, `parametros_ley`,
  `seguridad_accesos`, `planillas`, `planilla_detalles`), 2 tablas de
  hechos particionadas por mes desde el día uno (`asistencia_marcas`,
  `seguridad_accesos`), RLS en las 8 con policies contra
  `core.has_permission()`. Extendido el mismo día
  ([`20260902000008`](../supabase/migrations/20260902000008_rrhh_nicaragua_and_contracts.sql))
  con parámetros de ley nicaragüense (INSS/INATEC, versionados), modalidad
  de contrato, y credenciales operativas (`nombre_usuario` + PIN
  compartido con el kiosko) para un futuro módulo móvil de choferes.
  Detalle completo de tablas y funciones en [DATABASE.md](DATABASE.md).
- **Kiosco de marcación** (`/rrhh/kiosco`): numpad de PIN, sin sesión de
  Supabase Auth a propósito (`rrhh.fn_registrar_marca_kiosko`,
  `SECURITY DEFINER`, callable por `anon`). Rate-limiting básico a nivel
  de Server Action (ventana de 60s, máx. 8 intentos, debounce de 600ms)
  además del bloqueo a 3 fallos consecutivos dentro de la función SQL.
- **UI de expedientes** (`/rrhh/expedientes`, `/rrhh/expedientes/nuevo`):
  listado y alta de empleados vía `rrhh.fn_crear_empleado`, que
  autogenera `nombre_usuario` y PIN si no se proveen y los devuelve en
  texto plano una única vez (gateado además por
  `rrhh.expedientes.compensacion.ver` para mostrar el PIN).
- **Habilitado en el panel**: `core.company_apps` con `rrhh` en
  `enabled = true`
  ([`20260903000001_enable_rrhh_company_app.sql`](../supabase/migrations/20260903000001_enable_rrhh_company_app.sql)).
- **Tres bugs de despliegue distintos, diagnosticados con datos (no
  supuestos) y corregidos en orden**, ya incorporados como checklist
  permanente en [`CLAUDE.md`](../CLAUDE.md) punto 5 de la regla crítica:
  1. `DNS_HOSTNAME_RESOLVED_PRIVATE` en `/rrhh` — `RRHH_APP_URL` faltaba
     en el allowlist `tasks.build.env` de `turbo.json`, Turborepo la
     descartaba en build y el rewrite caía a `localhost`. Corregido
     agregándola al allowlist (`769bb87`).
  2. 500 genérico en `/rrhh/dashboard` ("Falta NEXO_COMPANY_ID") — la
     variable existía en el proyecto Vercel `nexocore` pero **no en
     `nexo-rrhh`** (cada proyecto Vercel tiene sus propias Environment
     Variables, no se comparten). Se perdió tiempo real porque el
     usuario editó la variable en el proyecto equivocado dos veces antes
     de confirmarlo mirando directamente el dashboard de `nexo-rrhh`.
  3. 500 en `/rrhh/dashboard` con mensaje vacío tras resolver (2) —
     `42501 permission denied for schema rrhh`. RLS estaba correcto pero
     la migración que creó el schema nunca hizo el `GRANT USAGE`/`SELECT`
     base de Postgres para `authenticated` (mismo bug ya resuelto una vez
     para `crm` en `20260830000010`, nunca replicado al crear `rrhh`).
     Verificado con `has_schema_privilege()` y un `curl` directo con
     `Accept-Profile: rrhh` (`42501`, no un 404 — descarta que faltara
     exponer el schema) antes de escribir el fix. Corregido en
     [`20260904000001_fix_rrhh_schema_grants.sql`](../supabase/migrations/20260904000001_fix_rrhh_schema_grants.sql),
     aplicado al remoto y confirmado con `get_runtime_errors` limpio.
- **Provisión operativa post-fix (2026-09-04)**: creado el primer
  `rrhh.kiosko_dispositivos` real (`901098a8-dac4-4185-aa1c-530ab69b768b`,
  "Kiosko principal", sucursal Materiales JCastillo) para poder configurar
  `NEXO_KIOSKO_ID` en el proyecto `nexo-rrhh` y habilitar la marcación
  física. Pendiente de confirmar en producción tras esa configuración.
- **Auditoría de seguridad (`get_advisors`, 2026-09-04)**: confirmó que
  `rrhh.fn_crear_empleado` y `rrhh.fn_set_pin_empleado` (las funciones
  internas, no sus wrappers en `public`) son ejecutables directamente por
  `anon` — inconsistente con el `REVOKE` explícito que sí tienen sus
  wrappers. Riesgo mitigado en la práctica por el chequeo interno de
  `core.has_permission()`, pero **no corregido todavía** — ver
  "Riesgos de seguridad" en [DATABASE.md](DATABASE.md) y
  [RRHH_MVP.md](RRHH_MVP.md).
- **Qué falta validar** (por eso RRHH figura como infraestructura lista
  pero MVP sin validar en [ROADMAP.md](ROADMAP.md)): motor de
  consolidación de marcas → horas trabajadas, generador de planilla de
  prueba (`/rrhh/planillas` sigue siendo un placeholder explícito en el
  código), cero empleados/marcas/planillas reales cargados a esta fecha,
  y el recorrido completo con los 3 roles (admin/operador/sin permiso)
  sin ejecutar. Detalle en [RRHH_MVP.md](RRHH_MVP.md).

## 2026-08-30 — Diseño UX/UI (investigación SAP Fiori + Odoo) aplicado al panel

- Investigación pedida por el usuario, documentada completa en
  [planning/DISENO_UX_UI.md](planning/DISENO_UX_UI.md): shell bar +
  agrupación por categoría (Fiori Launchpad/Spaces), estética plana y
  colores por categoría (Odoo).
- `packages/ui` dejó de estar vacío: `ShellBar` (barra superior persistente)
  y `category-colors.ts` (tokens de color por categoría, no por módulo).
- `apps/nexo`: shell bar agregado, grilla agrupada por categoría (antes era
  plana), tipografía Inter para el chrome del panel.
- Nueva función `public.get_visible_apps` corregida: excluía mal a `nexo`
  de su propia lista (se listaba a sí mismo, un tile circular apuntando a
  "/") — detectado al escribir el código del home, corregido con una
  migración nueva antes de verificarlo en vivo.
- **Verificación real, no solo "debería compilar"**:
  - `pnpm install` de nuevo (dependencia nueva `@nexo/ui` en `apps/nexo`).
  - `next build` de `apps/nexo` y de `apps/crm` — ambos compilan y tipan
    limpio.
  - En el camino, `next build` de `apps/crm` encontró un bug real de tipos
    en `packages/permissions` (heredado de la Fase 3, no detectado hasta
    ahora porque nunca se había corrido un build real de esa app): el tipo
    `RpcClient.rpc()` pedía un `Promise` estricto pero `supabase.rpc()`
    devuelve un `PostgrestFilterBuilder` (`PromiseLike`, no `Promise`
    completo) — corregido.
  - `turbo run build` de **todo el monorepo** detectó una colisión real:
    `apps/rrhh` y `apps/web-corporativo` tenían el mismo `name` de paquete
    (`"web"`, heredado sin tocar de sus `create-next-app` originales) —
    renombrados a `rrhh` y `web-corporativo`.
  - Resultado final de `turbo run build`: **4 de 5 apps compilan limpio**
    (`web-corporativo`, `crm`, `nexo`, `transporte-app`/flotilla). `rrhh`
    falla por falta de variables de entorno de su propio Supabase original
    (`ofeuzkwjhmfsazqfyutu`) — **esperado**, esa app no se ha tocado desde
    el import crudo, le toca configurarse en su propia fase (6), no antes.
- **No verificado visualmente todavía**: la grilla de módulos con datos
  reales (tiles agrupados por categoría) — requiere un usuario autenticado
  con membresía en `core.company_memberships`, que no existe todavía (ver
  nota de la Fase 4 más abajo). Sí se verificó que compila y tipa sin
  errores.

## 2026-08-30 — Fase 4: panel `apps/nexo`, verificado en vivo

- Se construyó `apps/nexo`: login (Supabase Auth), middleware de sesión,
  home (`/`) que llama a `public.get_visible_apps(companyId)` para armar la
  grilla de módulos — nunca hardcodea qué mostrar.
- Nueva función `public.get_visible_apps`: cruza `core.company_apps`
  (contratado) y `core.has_permission` (autorizado). Mismo patrón que
  `has_permission` — wrapper en `public` para no depender de exponer el
  schema `core`.
- `next.config.ts` de `apps/nexo` implementa el rewrite de Multi-Zones
  hacia `/crm` (el único módulo adaptado hasta ahora).
- **Se corrió de verdad, no solo se escribió**: `pnpm install` en todo el
  monorepo (vía `npx pnpm@9`, porque no había pnpm global instalable sin
  permisos de administrador), y ambas apps (`crm` en :3001, `nexo` en :3000)
  levantadas con el Browser pane. Verificado en vivo:
  - `http://localhost:3000/` → redirige a `/login` sin sesión (middleware
    funcionando).
  - Login de Nexo con credenciales falsas → `"Correo o contraseña
    incorrectos."`, confirmando conexión real end-to-end con Supabase Auth
    de `nexo-core` (no un error de red).
  - `http://localhost:3000/crm` → la URL se queda en el puerto 3000 (un
    solo dominio) pero el contenido servido es el login real de la app CRM
    (`/crm/login`, con su branding y su propio middleware de auth) — **el
    rewrite de Multi-Zones funciona de punta a punta**.
  - Consola del navegador sin errores en ninguna de las dos pantallas.
- Se creó/corrigió `.claude/launch.json` en el directorio de trabajo
  principal (`jcastillo`, no `Nexo` — el Browser pane lee el launch.json
  del working directory principal de la sesión) con configuraciones `crm` y
  `nexo` que corren `pnpm --filter <app> dev` con `pnpm -C` apuntando al
  monorepo real.
- **No verificado todavía**: la grilla de módulos con un usuario real
  autenticado (`core.company_memberships` está vacío — hace falta crear un
  usuario y una membresía manualmente, ver `apps/nexo/README.md`).

## 2026-08-30 — Fase 3: adaptar `web-corporativo` + `crm`

- **`web-corporativo`**: no requirió ningún cambio. Es contenido estático,
  vive en el dominio raíz `materialesjcastillo.com` (no en Multi-Zones), no
  usa Supabase. Se documentó ese hecho en su README para que quede
  explícito que "no adaptado" no es lo mismo que "pendiente".
- **`crm`**: adaptado de punta a punta.
  - `next.config.ts`: `basePath: "/crm"` + `transpilePackages: ["@nexo/permissions"]`.
  - Cliente/servidor de Supabase re-apuntados a `nexo-core`
    (`yrbjlmiqhkyxtlcerowh`), en vez del proyecto original
    `materiales-jcastillo-crm` (`arzadwxsifnaolvfcvqk`).
  - Las 3 acciones de escritura (`createCliente`, `updateCliente`,
    `deleteCliente`) llaman a `requirePermission()` de `@nexo/permissions`
    antes de tocar la base de datos.
  - Se agregó `core.company_memberships` + la función única
    `core.has_permission()` (gap detectado al implementar: el diseño
    original de la Fase 2 no tenía de dónde sacar el rol owner/admin).
    **El usuario pidió resetear el schema `core` recién creado (sin datos
    reales) para incorporar esto desde cero en vez de parchearlo** — se hizo
    con `drop schema core cascade` + recrear, confirmado de bajo riesgo
    porque `core` no tenía ningún dato real todavía.
  - `crm.clientes` quedó con RLS real: las 4 policies (ver/crear/editar/eliminar)
    llaman a `core.has_permission()` directo — la protección de datos no
    depende solo de que el código de la app se acuerde de chequear.
  - `get_advisors` detectó y se corrigieron 2 warnings: `search_path`
    mutable en una función nueva, y el RPC `public.has_permission`
    ejecutable por el rol `anon` sin sesión (se revocó de `PUBLIC`, se dejó
    solo para `authenticated`).
- **Resuelto**: el clasificador de permisos de Claude Code denegó
  `restore_project` sobre el proyecto pausado `arzadwxsifnaolvfcvqk`
  (materiales-jcastillo-crm), así que no se pudo inspeccionar en vivo. El
  usuario confirmó que todo lo que había ahí era de prueba — **no hace
  falta copiar ningún dato**. La estructura de `crm.clientes` recreada a
  partir de `database.types.ts` (2026-08-29) es la definitiva, no un
  placeholder a completar después.
- **Pendiente manual, fuera del alcance de las herramientas MCP**: exponer
  el schema `crm` en Settings → API → Data API → Exposed schemas del
  proyecto `nexo-core`. Sin esto, `apps/crm` no puede conectarse de verdad
  todavía.
- **Sin verificar**: no se corrió un dev server real (no existe `apps/nexo`
  todavía para probar Multi-Zones de punta a punta) — el comportamiento de
  `proxy.ts`/`middleware.ts` con `basePath` activo queda pendiente de
  confirmar en la Fase 4.

## 2026-08-30 — Fase 2: proyecto `nexo-core` + schema `core` + norma v3.0

- Proyecto Supabase `nexo-core` creado (ref `yrbjlmiqhkyxtlcerowh`,
  org `Grupo CT`, `us-east-1`, plan gratuito).
- Aplicadas las migraciones `core_schema` y `core_seed_apps`: 7 tablas del
  schema `core`, trigger `trg_seed_module_permission`, RLS habilitado en
  las 7 tablas, `core.apps` sembrada con los 4 módulos actuales.
- Verificado en vivo: el trigger creó solo los 4 permisos de visibilidad
  (`nexo.ver_modulo`, `rrhh.ver_modulo`, `flotilla.ver_modulo`,
  `crm.ver_modulo`) sin ningún INSERT manual.
- `get_advisors` (security): sin alertas más allá de "RLS sin policy" en
  las 5 tablas que se dejaron así a propósito (provisional hasta Fase 3+).
- Se construyó el motor de permisos fail-closed en
  `packages/permissions/index.ts` (`hasPermission`/`requirePermission`):
  un `permission_code` no registrado en `core.permissions_catalog` deniega
  siempre, incluso para owners/admins.
- Se agregó `CLAUDE.md` en la raíz del repo con la regla obligatoria de
  permisos, para que se aplique automáticamente en cualquier sesión de
  Claude Code que trabaje en este monorepo (pedido explícito del usuario:
  "esto tiene que ser algo que se dispare siempre").
- Pendiente: nada de esto está conectado todavía a ningún `apps/<módulo>`
  real — es la base, la integración es la Fase 3+.

## 2026-08-29 — Import de código real (git subtree, historial preservado)

Se trajo el código de los 4 productos existentes a sus carpetas en `apps/`,
usando `git subtree` para conservar el historial de commits de cada uno
(decisión tomada con el usuario ese mismo día). **Solo se importó el
código** — nada de Multi-Zones (`basePath`/`rewrites`), nada de Supabase
(`nexo-core` no existe todavía), nada de adaptación de permisos. Eso es la
siguiente fase.

| Módulo | Origen | Método | Commits traídos |
|---|---|---|---|
| `apps/web-corporativo` | `WEB Corporativo jcastillo/apps/web` | `git subtree split --prefix=apps/web` + `subtree add` | 3 |
| `apps/crm` | `WEB Corporativo jcastillo/apps/crm` | `git subtree split --prefix=apps/crm` + `subtree add` | 1 |
| `apps/flotilla` | `Desktop/Transporte` (repo completo, rama `master`) | `git subtree add` directo | historial completo de Ruta360 |
| `apps/rrhh` | `jcaatillo/marcacion-grupo-ct`, solo la carpeta `web/` (clonado a una carpeta temporal, ya eliminada) | `git subtree split --prefix=web` + `subtree add` | historial completo de `web/` |

Notas:

- El `docs/` en la **raíz** de `marcacion-grupo-ct` (`business_rules.md`,
  `database.md`, `repository_map.md`, minúsculas) **no se trajo** — parecía
  superado por el `docs/` propio de `web/` (`BUSINESS_RULES.md`,
  `DATABASE.md`, etc., mayúsculas), que sí viajó dentro de `apps/rrhh/docs/`.
  Si algo de esos 3 archivos viejos tenía información que no esté en la
  versión nueva, falta rescatarlo a mano.
- Quedan dos remotes en este repo apuntando a las carpetas locales de los
  proyectos originales, para poder traer fixes futuros mientras dure la
  transición (`git subtree pull --prefix=apps/<modulo> <remote> <rama>`):
  - `ruta360` → `Desktop/Transporte` (rama `master`, sin split, se puede
    hacer `pull` directo)
  - `materiales-jcastillo` → `WEB Corporativo jcastillo` (para `crm`/`web-corporativo`
    hay que **regenerar el split** — `git subtree split --prefix=apps/crm -b split-crm`
    de nuevo en ese repo — antes de poder hacer `pull`, porque un subfolder-split
    no seatualiza solo)
  - No quedó remote para `rrhh` (se clonó a una carpeta temporal ya borrada);
    para traer fixes futuros de Gestor360 hay que re-clonar
    `jcaatillo/marcacion-grupo-ct` y repetir el split de `web/`.
- Verificado: ningún `node_modules/` ni `.next/` quedó commiteado en ninguno
  de los 4 imports (los `.gitignore` de origen ya los excluían). Tamaño
  final de `.git`: ~2.4 MB.

## 2026-08-29 — Repo creado

- Se crea el repositorio local `Nexo` (`C:\Users\Gerencia\Desktop\Nexo`),
  esqueleto de monorepo Turborepo + pnpm workspaces.
- Se copian los documentos de planeación
  (`PLAN_UNIFICACION_NEXO.md`, `PROPUESTA_MARCA_MODULOS.md`) a
  `docs/planning/`.
- Ningún módulo migrado todavía. Ningún proyecto Supabase (`nexo-core`)
  provisionado todavía.
- Pendiente: crear el repositorio remoto en GitHub cuando el usuario lo
  indique (aún no solicitado).

## Próximos pasos pendientes de ejecutar

1. Provisionar el proyecto Supabase `nexo-core` y las tablas de `core.*`.
2. Elegir el módulo piloto (`web-corporativo` recomendado, menor riesgo) y
   migrarlo completo (app + datos) para validar el patrón Multi-Zones de
   punta a punta.
3. Construir la app `nexo` (panel) real sobre ese primer módulo migrado.
