# Nexo — Estado Vivo de Implementación

> Tracker operativo. Debe actualizarse en cada sesión que cambie código, base de datos, permisos, despliegue o estado funcional. La fuente del objetivo es `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`; este archivo registra la realidad verificada.

Última actualización documental: **2026-09-07** (F1.0 — Auditoría real ejecutada y verificada contra `main`, Supabase `nexo-core` remoto y Vercel; ver sección 0).

## Estados

- ✅ Validado — recorrido ejecutado y comprobado.
- 🟡 En progreso — existe parcialmente.
- ⛔ Bloqueado — falta decisión/requisito.
- ⏳ Pendiente — no iniciado.
- ⚠️ Deuda/refactor — existe, pero contradice o no cumple el modelo objetivo.

---

# 0. Resultado de F1.0 — Auditoría real (2026-09-07)

Ejecutada íntegramente antes de tocar código/migraciones de F1.1 en adelante, tal como exige el Plan Maestro §21. Alcance: comparación explícita `Plan Maestro` vs `IMPLEMENTATION_STATUS` (esta misma versión, antes de editarla) vs `main` vs migraciones versionadas vs `nexo-core` remoto vs Vercel vs permisos/roles vs datos reales.

## 0.1 Hallazgo de proceso — `main` local estaba 13 commits atrás de `origin/main`

Antes de auditar nada de RRHH, se detectó que el checkout local de `main` apuntaba a `4ec848e` mientras `origin/main` ya tenía `fd381e7` (13 commits `docs:` adelante, sin ningún cambio de código — verificado con `git diff --stat` excluyendo `docs/**`/`CLAUDE.md`, resultado vacío). Esos 13 commits son exactamente los que introdujeron `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`, `IMPLEMENTATION_STATUS.md` (este archivo) y `DRIVER_ACCESS_AND_KIOSK.md`, además de reescribir `CLAUDE.md`, `RRHH_MVP.md`, `ARCHITECTURE.md`, `MODULES.md`, `ROADMAP.md` y `README.md`. Es decir: la documentación "vigente" que este mismo protocolo pide leer primero no estaba en el `main` local hasta este momento.

Causa: la sesión anterior había dejado una rama `feat/rrhh-jornadas-y-horas` con cambios sin commitear (consolidación de permisos v3.0 para el diseño de jornadas) ramificada desde el `main` viejo (`4ec848e`), y nunca se hizo `git pull`/`fetch` de `main` desde entonces.

Resolución aplicada, sin perder nada:

1. `git stash push -u` de los 5 archivos sin commitear en `feat/rrhh-jornadas-y-horas` (quedan en el stash, rama intacta, recuperables con `git stash pop` — no se tocó la carpeta `Grupo CT/`, ajena a este trabajo).
2. `git checkout main && git merge --ff-only origin/main` — fast-forward limpio (`main` local no tenía commits propios que `origin/main` no tuviera).
3. Rama nueva `docs/f1-0-auditoria-rrhh` desde el `main` ya actualizado, para los cambios de esta auditoría.

El trabajo de jornadas/evidencia fotográfica sigue intacto en el stash de `feat/rrhh-jornadas-y-horas`; no se descartó ni se fusionó con este `main`. Queda pendiente de una decisión aparte (ver sección "Decisiones de negocio pendientes" del reporte de esta sesión) porque ese diseño se escribió *antes* de que `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`/`DRIVER_ACCESS_AND_KIOSK.md` existieran y no fue revisado contra el modelo de contratos/PIN contractual que el Plan Maestro define ahora.

## 0.2 `main` vs código real en `apps/rrhh` y `apps/flotilla`

Sin divergencia de código detectada: `apps/rrhh` en `main` es exactamente el código ya auditado en la sesión de seguridad del 2026-09-05 (`fn_crear_empleado`, `fn_set_pin_empleado`, `fn_registrar_marca_kiosko`, `fn_validar_acceso_operativo`, proxy/middleware). `apps/flotilla` (Ruta360) sigue siendo una app autocontenida con su propio `app/login`, `app/driver`, `app/supadmin/login` y su propio `supabase/migrations` — no consume ni referencia `rrhh.fn_validar_acceso_operativo` ni ninguna tabla de `nexo-core` todavía. No aparece como proyecto en el Vercel de Nexo (`julio-s-projects7`); el único proyecto de Transporte ahí es `transporte-saas`, de otro repo. Confirma D-07: la adaptación de identidad de conductor es trabajo de Fase 4 aún no iniciado, sin código que lo contradiga hoy.

## 0.3 Migraciones — `main` vs remoto

`list_migrations` contra `nexo-core` (proyecto `yrbjlmiqhkyxtlcerowh`) devuelve 30 migraciones aplicadas, la última `20260905000005_rrhh_public_auth_hardening`. Coincide 1:1 con las migraciones versionadas en `supabase/migrations/` de `main`. Sin migraciones pendientes de aplicar ni aplicadas fuera de Git.

## 0.4 Datos reales en `nexo-core` (verificado 2026-09-07, vía `execute_sql`)

| Tabla | Filas |
|---|---|
| `rrhh.empleados` | 0 |
| `rrhh.empleado_compensacion` | 0 |
| `rrhh.asistencia_marcas` | 0 |
| `rrhh.seguridad_accesos` | 0 |
| `rrhh.planillas` | 0 |
| `rrhh.kiosko_dispositivos` | 1 (`Kiosko principal`, activo) |
| `core.companies` | 1 (`materiales-jcastillo`) |
| `core.company_memberships` | 1 |
| `core.permissions_catalog` | 45 (36 de `rrhh` + `rrhh.ver_modulo`) |
| `core.app_roles` (`module_slug='rrhh'`) | 5 |

**Consecuencia directa para F1.1–F1.3**: cero filas dependientes del diseño `nombre_usuario`/PIN-de-doble-propósito. La separación Expediente General/Laboral y el PIN contractual pueden implementarse mediante migraciones nuevas (columnas/tablas) sin backfill de datos reales de empleados — solo hay que decidir qué hacer con `rrhh.kiosko_dispositivos` (1 fila, no afectada por el refactor) y las 45 filas de `permissions_catalog`/5 `app_roles` ya seedeados (sin tocar, se extienden).

## 0.5 Roles RRHH reales — 5, no 4

`core.app_roles` filtrado por `module_slug='rrhh'` en remoto: `admin` (36 permisos), `supervisor_asistencia` (16), `especialista_planillas` (12), `gestor_expedientes` (9) y **`consulta`** (7) — un quinto rol de solo-lectura que no aparecía mencionado en el resumen de sesiones anteriores. Cualquier matriz nueva de permisos (contratos, credenciales) debe decidir explícitamente el alcance de `consulta`, no solo de los otros cuatro.

## 0.6 Hallazgo de seguridad — `public.validar_acceso_operativo` expuesto a `anon` en producción (CERRADO en F1.0.1)

`get_advisors(security)` sobre `nexo-core` (2026-09-07, durante F1.0) reportó, sin cambios desde la auditoría del 2026-09-05, que `public.validar_acceso_operativo(p_nombre_usuario, p_pin)` es `SECURITY DEFINER` y tenía `EXECUTE` concedido a `anon` **y** `authenticated` (confirmado también con `has_function_privilege` directo). Es la función que implementa el "PIN de doble propósito" que `DRIVER_ACCESS_AND_KIOSK.md` rechaza como arquitectura final (sección 10 de ese documento).

Verificado además: **ningún archivo de `apps/`/`packages/` llama a este RPC** — ni desde `apps/rrhh` ni desde `apps/flotilla` ni desde ningún otro módulo. Era infraestructura muerta a nivel de frontend, pero no a nivel de superficie de ataque: cualquiera podía llamar `POST /rest/v1/rpc/validar_acceso_operativo` sin sesión y sin ningún rate-limit por IP (el único freno era el bloqueo a 3 fallos consecutivos *dentro* de la función).

**Cerrado el mismo día en F1.0.1** (sección 0.9, aprobado explícitamente por el usuario como hotfix inmediato, sin esperar a F1.3): `EXECUTE` revocado de `anon`/`authenticated` vía `20260907151106`. Ver sección 0.9 para el detalle y la verificación post-aplicación.

## 0.7 Vercel — `nexo-rrhh`

- Proyecto `nexo-rrhh` (`prj_6nP4PUDQZH5iq6Cp2t7ytxzrqerM`), equipo `julio-s-projects7`.
- Último deployment de producción: `dpl_23CzM4LQgVGwi7g7LTGj4itcfRFL`, commit `fd381e7` (el mismo HEAD real de `origin/main`), estado `READY`. Vercel ya había desplegado los 13 commits de documentación que el checkout local tenía atrasados.
- `get_runtime_errors` (ventana de 7 días, hasta 2026-09-07): sin errores nuevos. Los únicos 2 grupos de error registrados son del 2026-09-04 (`Falta NEXO_COMPANY_ID`, `No se pudo cargar el dashboard`), anteriores a los fixes de `a3bcc5d`/`ac9a487`/`4ec848e` ya documentados — no hay señal de regresión desde entonces.
- `/rrhh` y `/rrhh/kiosco` operativos según esta misma evidencia (sin errores runtime recientes en `/dashboard` ni otras rutas).
- No existe proyecto Vercel para `apps/flotilla` en este equipo — confirma que Transporte sigue sin desplegarse bajo Nexo.

## 0.9 F1.0.1 — Cierre de acceso operativo PIN heredado (ejecutado 2026-09-07)

Aprobado por el usuario como hotfix inmediato, sin esperar a F1.3. Migración nueva `20260907151106_revoke_validar_acceso_operativo_public_execute` (aplicada primero vía `apply_migration`, archivo de Git escrito después con el mismo `version` que Supabase asignó — evita a propósito la divergencia de historial del 2026-09-05):

- `revoke execute on function public.validar_acceso_operativo(p_nombre_usuario text, p_pin text) from anon, authenticated;` — no toca `20260902000008` (migración histórica, sin editar).
- `rrhh.fn_validar_acceso_operativo` y su wrapper `public.validar_acceso_operativo` quedan explícitamente marcadas como **DEPRECADAS** vía `comment on function` — no se eliminaron, pendiente de una migración de limpieza aparte que también decida `rrhh.seguridad_accesos` y `rrhh.empleados.nombre_usuario`/`user_id`/`pin_bloqueado`/`intentos_fallidos`.
- Verificado post-aplicación con `has_function_privilege`: `anon`→`false`, `authenticated`→`false`, `service_role`→`true`, `postgres`→`true` (sin cambio, esperado).
- `get_advisors(security)` re-ejecutado: el WARN "Public Can Execute SECURITY DEFINER Function" para esta función ya no aparece.

D-06 queda **parcialmente cerrado**: el componente de seguridad inmediato (exposición a `anon`/`authenticated`) está resuelto; el refactor arquitectónico completo (eliminar el concepto de PIN-de-doble-propósito y construir identidad digital real) sigue pendiente de F1.3/Fase 2.

## 0.10 Paso Cero — matriz de permisos de contratos/credenciales, APLICADA (2026-09-07)

Aprobada explícitamente por el usuario con nomenclatura y asignación exactas. Migración `20260907151643_rrhh_contratos_permission_matrix`, reutiliza el dominio `expedientes` ya existente (no crea un dominio `contratos` nuevo):

```text
rrhh.expedientes.contratos.ver
rrhh.expedientes.contratos.crear
rrhh.expedientes.contratos.editar
rrhh.expedientes.contratos.activar
rrhh.expedientes.contratos.finalizar
rrhh.expedientes.credenciales.ver
rrhh.expedientes.credenciales.regenerar
```

Asignación aplicada y verificada en remoto (`core.app_role_permissions`):

| Permiso | admin | gestor_expedientes | supervisor_asistencia | especialista_planillas | consulta |
|---|---:|---:|---:|---:|---:|
| contratos.ver | ✅ | ✅ | — | — | — |
| contratos.crear | ✅ | ✅ | — | — | — |
| contratos.editar | ✅ | ✅ | — | — | — |
| contratos.activar | ✅ | — | — | — | — |
| contratos.finalizar | ✅ | — | — | — | — |
| credenciales.ver | ✅ | ✅ | ✅ | — | — |
| credenciales.regenerar | ✅ | — | — | — | — |

`credenciales.ver` es exclusivamente estado de la credencial (activa/bloqueada) — nunca el PIN en texto plano. El PIN solo se muestra una vez, en `contratos.activar` o `credenciales.regenerar`.

**Explícitamente NO incluido** (decisión del usuario, diseño objetivo documentado pero sin implementar): `core.identidad.cuenta.ver/provisionar/bloquear/restablecer` — capacidad transversal de Nexo (Core), no de RRHH; no se asigna a `rrhh.admin`. `flotilla.conductores.acceso.*` — eliminado de la propuesta, la provisión/bloqueo de identidad es exclusiva de `core.identidad`, nunca duplicada por módulo. `flotilla.conductores.perfil.*`/`viajes.*` quedan previstos para el Paso Cero de Fase 4, sin insertar todavía.

Con esto, el Paso Cero de permisos para F1.1–F1.3 queda cerrado. Próximo paso: F1.1.

## 0.8 Deuda general no bloqueante para RRHH (detectada de paso)

`get_advisors(performance)` reporta deuda pre-existente fuera del alcance de F1.0: `auth_rls_initplan` sin optimizar todavía en 3 policies de `core.company_memberships`, `core.user_app_roles` y `crm.clientes` (no en `rrhh` — las 25 policies de RRHH ya usan el patrón `(select auth.uid())` desde el 2026-09-05), más FKs sin índice de cobertura e índices sin uso (esperable con 0 filas). No se toca en esta sesión — es candidato a una migración de rendimiento aparte, sin relación con el refactor de contratos/PIN.

---

# 1. Estado general

| Área | Estado | Realidad conocida / siguiente paso |
|---|---|---|
| Nexo Core / Launcher | ✅ Validado | Monorepo, SSO, Multi-Zones, permisos y `nexo-core` operativos según última documentación verificada. |
| RRHH infraestructura | ✅ Desplegada | Schema, permisos, RLS, expedientes básicos y kiosko existen. |
| RRHH modelo Expediente General/Laboral | ⚠️ Refactor obligatorio | El código actual mezcla datos laborales y credenciales dentro de `rrhh.empleados`. F1.0 verificó remoto (2026-09-07, sección 0): confirmado, sin datos reales que migrar. Pendiente Paso Cero de permisos antes de F1.1. |
| RRHH contratos | ⏳ Pendiente | No existe el modelo contractual objetivo del Plan Maestro. |
| RRHH PIN contractual | ⚠️ Contradice regla nueva | `fn_crear_empleado` actual genera PIN durante alta. Debe reemplazarse por generación exclusiva al activar contrato. |
| RRHH jornadas | ⏳ Pendiente funcional | Permisos de turnos existen, pero falta modelo/UI necesario para cálculo real. |
| RRHH consolidación de asistencia | ⏳ Pendiente | No existe marcas → horas consolidadas. |
| RRHH planillas | ⏳ Pendiente | Ruta actual es placeholder; falta motor/reporte. |
| Kiosko RRHH | 🟡 Base funcional | NumPad/ruteo/rate-limit existen. Debe migrarse a PIN contractual exclusivamente de asistencia. |
| Identidad digital de empleados | ⚠️ Refactor obligatorio | Existe diseño de `nombre_usuario + PIN` para acceso operativo. Nueva regla: usuario+contraseña vía Supabase Auth; PIN no crea sesión. |
| Panel de Conductor Web | 🟡 Código legacy aprovechable | Ruta360 tiene flujo de conductor, pero falta adaptación a identidad Nexo, contrato RRHH y permisos unificados. |
| CRM | 🟡 MVP muy básico | Cliente CRUD y dashboard; faltan leads, oportunidades, actividades, cotizaciones/pedido. |
| Transporte / Flotilla | 🟡 Código aprovechable, sin adaptar | Ruta360 importado; falta migración al modelo Nexo y eliminar identidad duplicada de conductores. |
| Inventario mínimo | ⏳ Pendiente | Necesario antes de Fabricación. |
| Fabricación | ⏳ Pendiente | No existe app/schema. |
| Nexo Mobile Android/iOS | ⏳ Preparación arquitectónica | No existe `apps/mobile`. La app será operacional y no replicará toda la Web. Primera vertical productiva prevista: conductor/Transporte. |
| Kernel compartido `@nexo/supabase/@nexo/auth` | ⚠️ Deuda | Existe estructura, pero la arquitectura documenta duplicación de clientes/middleware entre apps. |

---

# 2. Divergencias conocidas: estado actual vs modelo objetivo

Confirmadas en remoto durante **F1.0** (2026-09-07, ver sección 0). Pendientes de corregirse mediante migraciones nuevas en F1.1–F1.3.

## D-01 — `rrhh.empleados` mezcla identidad y relación laboral

**Confirmado por `information_schema.columns` contra `nexo-core` remoto.** `rrhh.empleados` tiene hoy, en producción:

- `puesto` (`text`, nullable);
- `departamento` (`text`, nullable);
- `fecha_ingreso` (`date`, **`NOT NULL`**);
- `fecha_baja` (`date`, nullable);
- `estado` (`text`, `NOT NULL`);
- `pin_hash` (`text`, nullable);
- `nombre_usuario` (`text`, `NOT NULL`, único por `company_id`);
- `pin_bloqueado` (`boolean`, `NOT NULL default false`);
- `intentos_fallidos` (`smallint`, `NOT NULL default 0`);
- `user_id` (`uuid`, nullable, `references auth.users(id)`, único).

Objetivo: `rrhh.empleados` = Expediente General. Puesto, departamento, fechas laborales, estado y PIN dependen del contrato.

Estado: ⚠️ confirmado. Sin datos reales (0 filas) — el refactor no requiere backfill.

## D-02 — `fn_crear_empleado` genera PIN

Actual:

```text
crear empleado
→ generar nombre_usuario
→ generar/aceptar PIN
→ guardar pin_hash
→ opcionalmente crear compensación
```

Objetivo:

```text
crear empleado
→ solo Expediente General

crear contrato
→ borrador sin PIN

activar contrato
→ generar PIN automáticamente
```

Estado: ⚠️ confirmado (`apps/rrhh/src/app/(app)/expedientes/nuevo/actions.ts` — un solo formulario/RPC recibe nombre, apellido, puesto, departamento, modalidad de contrato y salario base a la vez, y `rrhh.fn_crear_empleado` genera y devuelve el PIN en la misma llamada). Prioridad F1.1–F1.3.

## D-03 — compensación ligada al empleado

**Confirmado**: `rrhh.empleado_compensacion` tiene `primary key (empleado_id)` — 1:1 real con el empleado, verificado en `pg_constraint` remoto.

Objetivo: compensación ligada al contrato para conservar historial de recontrataciones/cambios.

Estado: ⚠️ confirmado. 0 filas — sin dato histórico que migrar.

## D-04 — marcas no contienen `contrato_id`

Objetivo: cada marca válida debe quedar contextualizada con el contrato laboral vigente.

Estado: ⚠️ confirmado — `rrhh.asistencia_marcas` no tiene columna `contrato_id` porque el concepto de contrato no existe todavía en el schema (no hay tabla `rrhh.contratos`). Depende de F1.2 antes de poder implementarse.

## D-05 — planilla sin motor

Las tablas base (`rrhh.planillas`, `rrhh.planilla_detalles`) existen y están vacías (0 filas); el motor consolidación → planilla no está construido.

Estado: ⏳ confirmado.

## D-06 — PIN usado como login operativo (exposición a `anon` CERRADA en F1.0.1; refactor arquitectónico sigue pendiente)

Existe la migración `20260902000008_rrhh_nicaragua_and_contracts.sql`, aplicada en remoto, que define `nombre_usuario + PIN` y `rrhh.fn_validar_acceso_operativo()`/`public.validar_acceso_operativo()` como mecanismo de acceso operativo (comparando contra el mismo `pin_hash` del kiosko). Sin consumidor en ningún frontend del monorepo (verificado por búsqueda estática en `apps/`/`packages/`).

**Componente de seguridad inmediato — CERRADO 2026-09-07 (F1.0.1, sección 0.9)**: el wrapper público tenía `EXECUTE` concedido a `anon` y `authenticated`; revocado vía `20260907151106`, verificado post-aplicación. Ambas funciones quedan marcadas `DEPRECADAS` vía `comment on function`, sin eliminarse todavía.

Nueva decisión (pendiente de implementar como refactor completo):

```text
PIN = solo asistencia en kiosko
usuario + contraseña = identidad digital Web/Mobile
```

Estado: ⚠️ refactor arquitectónico completo pendiente de F1.3/Fase 2 (eliminar el concepto, construir identidad digital real). El riesgo de seguridad inmediato ya no existe.

## D-07 — identidad de conductor no debe ser independiente

Ruta360 legacy (`apps/flotilla`) mantiene sus propios conceptos de conductor/login: `app/login`, `app/driver`, `app/supadmin/login`, con su propio `supabase/migrations` apuntando a un proyecto Supabase distinto al de Nexo. **Confirmado que no consume nada de `nexo-core`** (ni `rrhh.fn_validar_acceso_operativo` ni ninguna otra función/tabla) y que no tiene proyecto Vercel dentro del equipo de Nexo — el único proyecto de Transporte en ese equipo (`transporte-saas`) pertenece a otro repo.

Objetivo:

```text
rrhh.empleado
  + contrato activo
  + identidad digital Nexo (auth.users)
  + habilitación/rol conductor
  = acceso Transporte
```

No crear un segundo usuario si el empleado ya tiene identidad digital Nexo.

Estado: ⚠️ confirmado, Fase 4, con preparación desde Fase 1/2. Sin código actual que lo contradiga (Ruta360 todavía no está conectado a Nexo).

## D-08 — quinto rol RRHH no documentado en resúmenes previos: `consulta`

`core.app_roles` (`module_slug='rrhh'`) tiene 5 filas, no 4: `admin` (36 permisos), `supervisor_asistencia` (16), `especialista_planillas` (12), `gestor_expedientes` (9) y **`consulta`** (7, solo lectura). Cualquier Paso Cero de permisos para contratos/credenciales de F1.2–F1.3 debe asignar explícitamente el alcance de `consulta`, no solo de los otros cuatro roles.

Estado: ℹ️ hallazgo nuevo de F1.0, sin urgencia — no contradice el modelo objetivo, solo estaba subdocumentado.

---

# 3. Fase 1 — tablero de ejecución RRHH

| ID | Entregable | Estado | Evidencia / nota |
|---|---|---|---|
| F1.0 | Auditoría real `main` + Supabase + Vercel + permisos + datos | ✅ | Ejecutada 2026-09-07 (sección 0). Sin código/DB pendiente de revisión — el bloqueo real detectado fue de proceso (`main` local desactualizado, sección 0.1), ya resuelto. `fn_validar_acceso_operativo`, `nombre_usuario`, `user_id` y PIN de doble propósito confirmados como D-06. |
| F1.0.1 | Cierre de acceso operativo PIN heredado (D-06) | ✅ | Ejecutada 2026-09-07 (sección 0.9). Migración `20260907151106`, `EXECUTE` revocado de `anon`/`authenticated`, funciones marcadas deprecadas, verificado post-aplicación. |
| F1.1 | Separar Expediente General / Expediente Laboral | ⏳ | No tocar migraciones aplicadas. |
| F1.2 | `rrhh.contratos` + compensación contractual | ⏳ | Paso Cero de permisos antes de tablas/UI. |
| F1.3 | PIN generado solo al activar contrato | ⏳ | PIN exclusivo de asistencia; revocar al finalizar; regenerar solo por contrato activo. |
| F1.4 | Jornadas/turnos/feriados mínimos | ⏳ | Requisito del motor de asistencia. |
| F1.5 | Consolidación diaria de asistencia | ⏳ | Marcas → horas/incidencias. |
| F1.6 | Incidencias/justificaciones | ⏳ | Validación previa a planilla. |
| F1.7 | Motor de planillas + snapshots | ⏳ | No integración contable todavía. |
| F1.8 | UI administración de kioscos | ⏳ | Eliminar SQL manual como operación normal. |
| F1.9 | Seguridad/RBAC/E2E | ⏳ | Roles + RPC directa + RLS + advisors + contrato finalizado + PIN revocado. |
| F1.10 | Recorrido completo validado | ⏳ | Criterio para declarar RRHH MVP listo. |

---

# 4. Acceso de Conductores y Kiosko

Fuente específica: [`DRIVER_ACCESS_AND_KIOSK.md`](DRIVER_ACCESS_AND_KIOSK.md).

## Regla vigente

```text
PIN                 = asistencia
usuario+contraseña  = identidad digital
conductor            = habilitación/rol operacional
```

### Kiosko

- dispositivo autorizado;
- usuario introduce solo PIN;
- backend resuelve contrato activo;
- determina entrada/salida por secuencia cuando sea inequívoco;
- no crea sesión Auth.

### Panel de Conductor Web

- login con usuario + contraseña;
- Supabase Auth;
- valida contrato activo + habilitación conductor + permisos;
- misma identidad que Nexo Mobile.

### Habilitación conductor

```text
Empleado + contrato activo
→ habilitar conductor
→ crear/reutilizar auth.users
→ asignar rol/permisos Transporte
```

Si ya existe identidad digital, no crear otra.

### Deshabilitar conductor

- no nuevos viajes;
- Transporte deja de autorizar;
- PIN de asistencia sigue activo si el contrato sigue activo;
- historial se conserva.

### Finalizar contrato

- PIN revocado;
- no nueva marcación;
- no nuevos viajes;
- revocar habilitaciones laborales dependientes del contrato;
- conservar historial.

---

# 5. Preparación Nexo Mobile

## Estado actual

No existe una app móvil Nexo integrada al monorepo.

Ruta objetivo futura:

```text
apps/mobile
```

## Principio de alcance

**Nexo Mobile no replica la versión Web.** Es una superficie operacional por rol y permisos.

Ejemplo conductor:

```text
Viaje actual
Mi vehículo
Inspección
Iniciar/continuar/finalizar viaje
GPS
Incidencias
Evidencia de entrega
Mis viajes
Liquidación
Perfil
```

No debe incluir por defecto administración de empleados, planillas, permisos, configuración global o administración completa de flota.

## Requisitos que deben cumplirse desde ya

| Requisito | Estado |
|---|---|
| Lógica de negocio en RPC/servicio reutilizable, no solo Server Actions web | 🟡 aplicar a toda lógica nueva |
| Supabase Auth compartido | ✅ backend disponible; integración móvil futura |
| usuario+contraseña para sesiones operativas | ⏳ diseño aprobado; implementación pendiente |
| PIN separado de Auth | ⚠️ requiere refactor de diseño existente |
| permisos `core.has_permission()` como autoridad | ✅ modelo existente |
| tipos compartidos | ⚠️ centralización pendiente |
| `@nexo/supabase` maduro | ⚠️ Fase 2 |
| almacenamiento seguro móvil | ⏳ |
| offline queue/idempotencia | 🟡 existe experiencia legacy en Ruta360; falta adaptar a Nexo |
| GPS/cámara | 🟡 existe experiencia legacy en Ruta360; falta adaptar |
| push notifications | ⏳ |
| Android build | ⏳ |
| iOS build | ⏳ |

### Primera vertical móvil prevista

**Transporte / conductor**, porque requiere GPS, cámara y offline-first y el código legacy ya contiene esos flujos.

---

# 6. Protocolo de actualización para Claude

En cada subfase ejecutada, actualizar este archivo en el mismo commit o conjunto de commits que cambia el producto.

Registrar como mínimo:

- estado anterior;
- estado nuevo;
- fecha;
- commit SHA;
- migración(es);
- tablas/RPC afectadas;
- pruebas realizadas;
- resultado remoto;
- blockers pendientes.

Si el código/DB remoto contradice este tracker:

1. verificar la realidad;
2. corregir el tracker;
3. explicar la divergencia;
4. después continuar desarrollo.

Nunca ajustar la realidad para que coincida artificialmente con un documento viejo.

---

# 7. Próxima acción obligatoria

```text
F1.0   — Auditoría de realidad RRHH        ✅ completada 2026-09-07 (sección 0)
F1.0.1 — Cierre PIN heredado (D-06)        ✅ completada 2026-09-07 (sección 0.9)
Paso Cero — Matriz contratos/credenciales  ✅ aplicada 2026-09-07 (sección 0.10)
 ↓
F1.1 — Separar Expediente General/Laboral  ⏳ próximo trabajo
```

La comparación explícita de F1.0 ya se ejecutó y quedó registrada en la sección 0:

```text
Plan Maestro
vs
main               (estaba 13 commits atrás — reconciliado, ver 0.1)
vs
migraciones        (30 aplicadas, 1:1 con Git — ver 0.3)
vs
nexo-core remoto   (0 filas reales en las tablas afectadas — ver 0.4)
vs
Vercel             (último deploy = HEAD real de main, sin errores nuevos — ver 0.7)
vs
permisos           (45 códigos, 5 roles incl. `consulta` — ver 0.5/D-08)
vs
datos existentes   (ver 0.4)
```

Y se revisó específicamente la deuda de autenticación:

```text
nombre_usuario + PIN (actual, D-06)
          ↓ refactor
PIN → solo kiosko/asistencia
usuario+contraseña → Supabase Auth Web/Mobile
```

confirmando además que `public.validar_acceso_operativo` sigue con `EXECUTE` para `anon`/`authenticated` en producción sin ningún consumidor real (hallazgo 0.6) — corrección candidata a resolverse junto con el Paso Cero de F1.3, o antes si así se decide.

Solo después de aprobado el Paso Cero se inicia la migración hacia:

```text
Persona
→ Contrato
→ PIN asistencia
→ Jornada
→ Asistencia
→ Planilla

Persona
→ identidad digital Nexo
→ roles/habilitaciones
→ Panel Conductor Web / Nexo Mobile
```
