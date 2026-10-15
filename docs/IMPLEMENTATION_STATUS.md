# Nexo — Estado Vivo de Implementación (dashboard)

**Última actualización documental: 2026-10-15 — Atención:** la pantalla de turnos anuncia "Turno 5, Juan Pérez, será atendido por María López en Puesto 2" (decisión del usuario que revierte "solo números y puestos"). Migración `20261015151609` aplicada y probada en transacción revertida; en producción (PR #22, `main` `9e52219`, `nexo-atencion` READY); sin probar en un televisor real. [Detalle](status-log/2026-10-15-atencion-pantalla-nombres.md).

**2026-10-14 — ticket #18:** matriz mínima aprobada y aplicada; Dashboard separado en `apps/agencia` y proyecto Vercel creado. Lint, typegen, tipos y build locales en Agencia/Nexo OK, 12 pruebas técnicas de denegación OK. Previews preparados; revisión final de Claude en curso; merge, publicación/activación y pruebas manuales pendientes. No se declara validación completa. [Detalle](status-log/2026-10-14-agencia-independiente.md).


> Tracker operativo. Debe actualizarse en cada sesión que cambie código, base de datos, permisos, despliegue o estado funcional. La fuente del objetivo es `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`; este archivo registra la realidad verificada.
>
> **Este archivo es un dashboard corto, no el historial completo.** Desde 2026-09-11 el detalle narrativo de cada subfase (qué se auditó, qué migraciones se aplicaron, qué se verificó paso a paso) vive en archivos individuales bajo [`docs/status-log/`](status-log/), enlazados desde la tabla de la sección 0 de abajo. Las secciones 1-7 de este archivo son el estado consolidado vigente — se leen siempre; el log detallado se lee solo si hace falta el detalle de verificación de una subfase puntual.

También **2026-10-14** (administración de usuarios y roles — Paso Cero +
esquema/`has_permission`/RPC aplicados en `nexo-core` y pantallas en la
rama `feat/usuarios-roles-nexo`, que desde el mismo día **incluye el
ticket #18 de Agencia** por merge; ver
[`status-log/2026-10-14-usuarios-roles-esquema.md`](status-log/2026-10-14-usuarios-roles-esquema.md),
[`status-log/2026-10-14-usuarios-roles-pantallas.md`](status-log/2026-10-14-usuarios-roles-pantallas.md)
y [`plan/12`](plan/12-administracion-usuarios-roles.md)).
Referencia documental anterior: **2026-09-17** (auditoría del botón
"Crear borrador" deshabilitado en `/contratacion/contratos/nuevo` +
reglas de negocio de creación de contratos (departamento→puesto→plantilla
obligatorios y en cascada, plantilla persistida, sin fecha fin al crear) +
endurecimiento de seguridad/integridad del bloque pre-F1.5 (FKs
compuestas multiempresa, condición de carrera en beneficiarios, límites
reales del bucket de Storage, verificación de metadata real de
documentos) + App Launcher sin ningún chrome de módulo + sidebar con
texto fijo "Nexo" en vez de logo/nombre de app; ver
[`status-log/2026-09-17-contratos-reglas-y-endurecimiento.md`](status-log/2026-09-17-contratos-reglas-y-endurecimiento.md).
Código commiteado y pusheado a `main` (`392f676`); migración
[`20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql`](../supabase/migrations/20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql)
**aplicada a `nexo-core`** con ese nombre de archivo (versión remota real
`20260918043955` — el archivo se creó localmente con el prefijo
`20260917100000` y se renombró después, sin tocar su SQL, para que
coincida con la versión que quedó registrada en
`supabase_migrations.schema_migrations`; ver detalle en el status-log).
Antes, bloque "pre-F1.5" del 2026-09-16: cédula
obligatoria, favicon en RRHH/CRM, catálogos de Contratación
(puestos/departamentos/plantillas), Storage privado de documentos y
expediente ampliado (Dirección/Información complementaria/Cuentas
bancarias/Beneficiario); ver
[`status-log/2026-09-16-rrhh-pre-f1-5.md`](status-log/2026-09-16-rrhh-pre-f1-5.md).
Antes de eso, reconciliación funcional y visual del 2026-09-14 — bug P0 de
Marca, App Launcher puro + logo en el sidebar, Expediente separado de
Contratación, edición real del Expediente General; ver
[`status-log/2026-09-14-reconciliacion-navegacion-rrhh.md`](status-log/2026-09-14-reconciliacion-navegacion-rrhh.md)).

## Estados

- ✅ Validado — recorrido ejecutado y comprobado.
- 🟡 En progreso — existe parcialmente.
- ⛔ Bloqueado — falta decisión/requisito.
- ⏳ Pendiente — no iniciado.
- ⚠️ Deuda/refactor — existe, pero contradice o no cumple el modelo objetivo.

---

# 0. Log detallado (`docs/status-log/`)

Cada fila es una subfase o bloque ya cerrado, con el detalle completo de qué se auditó/migró/verificó. Leer solo la fila relevante a la tarea actual, no todas.

| Fecha | Entrada | Resumen de una línea |
|---|---|---|
| 2026-10-14 | [Agencia digital independiente](status-log/2026-10-14-agencia-independiente.md) | Matriz mínima aplicada e inactiva; app/proyecto propio y compilación local preparados. Previews preparados; revisión final de Claude, merge, activación y pruebas manuales pendientes. |
| 2026-09-07 | [F1.0 — Auditoría real](status-log/2026-09-07-f1-0-auditoria-real.md) | Comparación Plan vs `main` vs migraciones vs remoto vs Vercel; detectó `main` local 13 commits atrás (reconciliado) y el hallazgo de seguridad D-06. |
| 2026-09-07 | [F1.0.1 — Cierre de acceso operativo PIN heredado](status-log/2026-09-07-f1-0-1-cierre-pin-heredado.md) | `EXECUTE` de `public.validar_acceso_operativo` revocado de `anon`/`authenticated` (hotfix inmediato). |
| 2026-09-07 | [Paso Cero — matriz de permisos de contratos/credenciales](status-log/2026-09-07-paso-cero-permisos-contratos-credenciales.md) | 7 códigos de permiso nuevos en el dominio `expedientes`, asignados a los 5 roles reales de RRHH. |
| 2026-09-07 | [F1.1 — Separar Expediente General/Laboral](status-log/2026-09-07-f1-1-expediente-general-laboral.md) | `fn_crear_empleado` ya no acepta datos laborales/PIN; columnas viejas deprecadas, no eliminadas. |
| 2026-09-07 | [F1.2 — `rrhh.contratos` + compensación contractual](status-log/2026-09-07-f1-2-contratos-compensacion.md) | Tabla de contratos con máquina de estados, RLS, trigger de transición y RPC; `contrato_compensacion` 1:1 con el contrato. |
| 2026-09-07 | [F1.3 — PIN exclusivamente contractual](status-log/2026-09-07-f1-3-pin-contractual.md) | `rrhh.contrato_credenciales` nueva; PIN nace al activar, se revoca al finalizar; kiosko migrado; verificado end-to-end real (23 pasos). |
| 2026-09-07 | [F1.4 — Jornadas mínimas](status-log/2026-09-07-f1-4-jornadas-minimas.md) | `jornadas`/`jornada_dias`/`contrato_jornadas`/`feriados`; jornada obligatoria para activar contrato; gap de rol señalado (`gestor_expedientes` sin `turnos.ver`). |
| 2026-09-07 | [Nexo Enterprise UI — rediseño visual transversal](status-log/2026-09-07-nexo-enterprise-ui.md) | Sidebar azul + topbar con breadcrumb (`NexoShell`) en `apps/nexo`/`rrhh`/`crm`, tema claro por defecto, kit compartido nuevo en `packages/ui`. |
| 2026-09-08 | [Fix de estabilización RRHH](status-log/2026-09-08-fix-estabilizacion-rrhh.md) | P0: bug real que tumbaba `/expedientes/[id]` (función pasada a Client Component). P1: paralelización de round-trips. P2: UX de Expedientes/Contratos/Jornadas + fix de acordeón del sidebar. |
| 2026-09-11 | [Limpieza de datos de prueba residuales](status-log/2026-09-11-limpieza-datos-prueba-residuales.md) | Verificación remota de rutina encontró 1 empleado/contrato/PIN de prueba sin limpiar en `nexo-core` (contradecía "0 filas" documentado) — borrado con aprobación explícita del usuario; también corrige una imprecisión de conteo de migraciones de F1.0 (duplicados inertes del bootstrap, sin impacto). |
| 2026-09-14 | [Reconciliación de navegación — Marca, Launcher, Expediente/Contratación](status-log/2026-09-14-reconciliacion-navegacion-rrhh.md) | Bloque pedido explícitamente (P0-P4, sin iniciar F1.5): fix P0 real de `/configuracion/marca` (límite de body + error boundary global), App Launcher puro sin KPIs con logo en la cabecera del sidebar, Expediente General separado de Contratación (ciclo contractual completo movido a `/contratacion/contratos`), edición real del Expediente General (`rrhh.fn_editar_empleado` nuevo). Mergeado a `main` (`4cc8a6a`, fast-forward) y verificado `READY` en Vercel producción el mismo día — smoke test autenticado NO ejecutado (sin credenciales; el usuario eligió cerrar documentando la limitación). |
| 2026-09-16 | [Bloque "pre-F1.5" — cédula, favicon, catálogos, Storage privado, expediente ampliado](status-log/2026-09-16-rrhh-pre-f1-5.md) | Bloque pedido explícitamente antes de F1.5: cédula obligatoria (DB+RPC+UI), favicon dinámico en RRHH/CRM, catálogos de Contratación (`rrhh.puestos`/`rrhh.departamentos`/`rrhh.plantillas_contrato`/`rrhh.puesto_plantillas`, `rrhh.contratos.puesto_id`/`departamento_id`), Storage privado (`rrhh-documentos-privados`, subida por URL firmada directa — evita el techo de 4.5MB de Vercel), expediente ampliado (Dirección con geografía de Nicaragua en `core.geografia_ni_*`, Información complementaria, Cuentas bancarias, Beneficiario). `next build`+`eslint` limpios en `apps/rrhh`/`apps/crm`, sin smoke test autenticado (sin credenciales). Deuda explícita: `core.geografia_ni_municipios` queda vacía (fuente web no confiable, ver detalle), falta `SUPABASE_SERVICE_ROLE_KEY` en el proyecto Vercel de RRHH. |
| 2026-10-15 | [Atención — nombres en la pantalla](status-log/2026-10-15-atencion-pantalla-nombres.md) | `atencion_pantalla_estado` devuelve cliente y agente de los turnos llamados (`20261015151609`); voz y TV: "Turno N, cliente, será atendido por agente en puesto". Riesgo de privacidad aceptado por el usuario. Sin prueba en TV real. |
| 2026-10-14 | [Atención — pantallas y Sucursales](status-log/2026-10-14-atencion-pantallas.md) | `/configuracion/sucursales` y sucursales en Usuarios (Nexo); nueva `apps/atencion` con Iniciar/Cerrar atención, recepción, puesto, configuración y pantalla de TV. Build/lint limpios; sin proyecto Vercel ni activación. |
| 2026-10-14 | [Atención — esquema, RPC y pg_cron](status-log/2026-10-14-atencion-esquema.md) | Sucursales + schema `atencion` (7 tablas, 3 particionadas), 19 RPC con asignación automática de puesto y cierre a medianoche, `pg_cron` instalado (`20261014224341`). Probado de punta a punta en transacción revertida. App inactiva; pantallas pendientes. |
| 2026-10-14 | [Paso Cero — módulo Atención](status-log/2026-10-14-atencion-paso-cero.md) | Sistema de turnos de sala de espera (`atencion`): app registrada inactiva, 15 permisos + 2 de sucursales, plantillas Recepción/Agente/Supervisor (`20261014222454`). Tablas, RPC y pantallas pendientes. |
| 2026-10-14 | [Pantallas de usuarios, roles y auditoría](status-log/2026-10-14-usuarios-roles-pantallas.md) | `/configuracion/usuarios`, `/roles` (editor opción A con plantillas), `/auditoria`, `/cambiar-contrasena` + Server Actions de Auth; fix de redirección abierta en el login. `next build`/`eslint` limpios; sin recorrido con sesión real. |
| 2026-10-14 | [Esquema de usuarios y roles + nueva `has_permission`](status-log/2026-10-14-usuarios-roles-esquema.md) | `core.roles`/`rol_permisos`/`perfiles`, un rol por usuario, `has_permission` con módulo habilitado + usuario activo + rol de empresa, 14 RPC `admin_*` con anti-escalada y auditoría (`20261014203144`). Validada antes con 15 pruebas en transacción revertida. Pantallas sin implementar. |
| 2026-10-14 | [Paso Cero — administración de usuarios y roles](status-log/2026-10-14-paso-cero-administracion-usuarios-roles.md) | Decisiones del usuario (1 rol por usuario, rol = apps + permisos internos, contraseña puesta por el admin, vínculo RRHH) + 9 códigos `nexo.administracion.*` aplicados en `nexo-core` (`20261014201119`). Esquema/RPC/UI solo diseñados en [`plan/12`](plan/12-administracion-usuarios-roles.md). Detectada migración `agencia_dashboard_access` en remoto sin estar en `main`. |
| 2026-09-17 | [Auditoría botón "Crear borrador" + reglas de contratación + endurecimiento](status-log/2026-09-17-contratos-reglas-y-endurecimiento.md) | Causa real del botón deshabilitado: `<select>` de empleados sin opción vacía (bug de UI, no de negocio — 0 contratos en remoto en el momento del reporte). Reglas nuevas: puesto/departamento/plantilla obligatorios y en cascada, sin fecha fin al crear, plantilla persistida (no solo sugerida), validación 100% server-side (`fn_crear_contrato`/`fn_editar_contrato` reescritas). Endurecimiento: FKs compuestas multiempresa en toda tabla de expediente ampliado/catálogos, condición de carrera corregida en beneficiarios, límites reales del bucket de Storage, verificación de metadata real (no la del navegador) al confirmar una subida. Launcher de Nexo sin ningún chrome de módulo; sidebar de RRHH/CRM/Nexo con texto fijo "Nexo" en vez de logo/nombre de app. Código commiteado y pusheado a `main` (`392f676`); migración `20260918043955_rrhh_contratos_reglas_y_endurecimiento` **aplicada a `nexo-core`** (2026-09-18, prechecks/postchecks de solo lectura verificados, archivo local renombrado de `20260917100000_...` a `20260918043955_...` sin tocar su SQL para reflejar la versión remota real). |

Deuda general no bloqueante detectada de paso (rendimiento pre-existente fuera de RRHH): ver el cierre de la entrada de F1.0 de arriba.

---

# 1. Estado general

| Área | Estado | Realidad conocida / siguiente paso |
|---|---|---|
| Agencia digital | 🟡 Preparada, sin activar | `apps/agencia`, `/agencia`, proyecto `nexo-agencia`; matriz aplicada, código compilado y pruebas técnicas OK. Revisión final de Claude y activación pendientes; cuentas y visualización manuales. |
| Nexo Core / Launcher | ✅ Validado | Monorepo, SSO, Multi-Zones, permisos y `nexo-core` operativos según última documentación verificada. Desde 2026-09-14, `/` es un App Launcher puro (selector de aplicaciones, sin KPIs) — ver fila siguiente. |
| Administración de usuarios y roles (`apps/nexo`) | 🟡 En producción 2026-10-14 (PR #20, `main` `ff46bce`), sin validar con sesión real | Pantallas `/configuracion/usuarios`, `/roles`, `/auditoria`, `/cambiar-contrasena` + tarjeta "Configuración" en el Launcher; `nexocore` READY en Production; sin sesión redirige al login (verificado en el dominio público). Base de datos: Paso Cero (`20261014201119`) + esquema (`20261014203144`) — roles de empresa (un rol por usuario), `core.has_permission` reescrita, 14 RPC `admin_*` con anti-escalada y auditoría, vínculo con `rrhh.empleados.user_id`; 15 pruebas SQL. Pendiente: recorrido con sesión real. Ver [status-log](status-log/2026-10-14-usuarios-roles-pantallas.md) y [`plan/12`](plan/12-administracion-usuarios-roles.md). |
| Nexo Enterprise UI (shell/navegación) | 🟡 Pusheado a `main` 2026-09-17 (`392f676`), sin verificar en producción | Sidebar azul persistente + topbar con breadcrumb en RRHH/CRM (`NexoShell`). Desde 2026-09-17: la cabecera del sidebar muestra **texto fijo "Nexo"** (sin logo/ícono, nunca el nombre de la app activa) en vez del logo dinámico + nombre de módulo de 2026-09-14 — el nombre de la app sigue en el breadcrumb/contenido. `/` de `apps/nexo` (App Launcher) se movió fuera del grupo `(app)` y ya no usa `NexoShell` en absoluto (sin sidebar/topbar/buscador/menú) — header propio mínimo. `/configuracion/marca` conserva su `NexoShell` sin cambios de comportamiento. Código en `main`, `next build` limpio en las 3 apps — sin recorrido autenticado real ni verificación visual del deployment de Vercel disparado por el push. |
| RRHH infraestructura | ✅ Desplegada | Schema, permisos, RLS, expedientes básicos y kiosko existen. |
| RRHH modelo Expediente General/Laboral | ✅ F1.1 (datos) + reconciliación de UI 2026-09-14 + expediente ampliado 2026-09-16 | `rrhh.empleados` ya no acepta datos laborales/credenciales en el alta (2026-09-07); `documento_identidad` obligatorio desde 2026-09-16. Columnas viejas deprecadas, no eliminadas — limpieza final pendiente. `/expedientes/[id]` (persona) tiene sus 6 pestañas con modelo real desde 2026-09-16 (Datos personales, Dirección, Información complementaria, Cuentas bancarias, Beneficiario, Documentos) — ver fila "RRHH expediente ampliado" abajo. El ciclo contractual completo sigue en `/contratacion/contratos`. |
| RRHH contratos | ✅ Reglas nuevas aplicadas en `nexo-core` 2026-09-18 | `rrhh.contratos`/`rrhh.contrato_compensacion` existen, con RLS, trigger de estado y RPC (2026-09-07); `puesto_id`/`departamento_id` desde 2026-09-16. Desde la migración `20260918043955_rrhh_contratos_reglas_y_endurecimiento` (aplicada a `nexo-core`, verificado post-aplicación): puesto/departamento/plantilla son `NOT NULL` con FKs compuestas al mismo tenant, `plantilla_contrato_id` nueva (persistida, no solo sugerida), sin `fecha_fin_prevista` al crear, `fn_crear_contrato`/`fn_editar_contrato` validan la relación completa server-side y rechazan un segundo contrato abierto por empleado. Código en `main` (`392f676`), sin recorrido autenticado real todavía. |
| RRHH catálogos de Contratación | ✅ CRUD 2026-09-16 + departamento obligatorio aplicado 2026-09-18 | `rrhh.puestos`/`rrhh.departamentos`/`rrhh.plantillas_contrato`/`rrhh.puesto_plantillas` — CRUD real en Contratación → Catálogos. `rrhh.puestos.departamento_id` es `NOT NULL` en `nexo-core` (con FK compuesta a `rrhh.departamentos` del mismo tenant) — el formulario de Puestos ya exige departamento. Plantillas sin archivo adjunto todavía (catálogo de nombre solamente). |
| RRHH Storage privado (documentos) | 🟡 Implementado 2026-09-16, endurecido y aplicado 2026-09-18, sin validar con credenciales reales | Bucket `rrhh-documentos-privados` + `rrhh.empleado_documentos`, subida por URL firmada directa (evita el techo de 4.5MB de Vercel). `confirmarDocumentoSubido` verifica el objeto y su metadata REALES en Storage (antes confiaba en lo que reportaba el navegador); el bucket ya tiene `file_size_limit=10485760`/`allowed_mime_types` reales en `nexo-core` (verificado post-aplicación). Pendiente: `SUPABASE_SERVICE_ROLE_KEY` en el proyecto Vercel de RRHH y un recorrido autenticado real de subir/descargar. |
| RRHH expediente ampliado (Dirección/Info. complementaria/Cuentas/Beneficiario) | 🟡 Implementado 2026-09-16, endurecido y aplicado 2026-09-18, geografía de municipios pendiente | Modelo + UI real para las 4 pestañas + Documentos (fila de arriba). `core.geografia_ni_departamentos` sembrada (17 filas); `core.geografia_ni_municipios` **vacía a propósito**. Ya aplicado en `nexo-core`: FK compuesta multiempresa `(empleado_id, company_id)` en las 4 tablas + `empleado_documentos`; FK compuesta que exige que el municipio elegido pertenezca al departamento geográfico elegido; corregida una condición de carrera real en el trigger de validación de porcentaje de beneficiarios (dos escrituras concurrentes podían superar 100% en conjunto). |
| RRHH PIN contractual | ✅ F1.3 completada | El PIN nace solo al activar contrato, se revoca al finalizar, kiosko validado end-to-end contra la nueva credencial (2026-09-07). |
| RRHH jornadas | ✅ F1.4 completada (modelo mínimo) | `rrhh.jornadas`/`jornada_dias`/`contrato_jornadas`/`feriados` existen, con RLS, RPC de asignación e interfaz de lectura para F1.5 (2026-09-07). Jornada obligatoria para activar contrato. Falta el motor de consolidación (F1.5) y las decisiones de negocio (hora extra, feriado pagado, etc.), explícitamente no implementadas. |
| RRHH consolidación de asistencia | ⏳ Pendiente | No existe marcas → horas consolidadas. |
| RRHH planillas | ⏳ Pendiente | Ruta actual es placeholder; falta motor/reporte. |
| Kiosko RRHH | ✅ Migrado a PIN contractual | `rrhh.fn_registrar_marca_kiosko` valida contra `rrhh.contrato_credenciales` desde F1.3 (2026-09-07), verificado end-to-end. Misma UI/rate-limit de antes. |
| Identidad digital de empleados | ⚠️ Refactor de PIN cerrado, identidad digital sigue pendiente | `nombre_usuario + PIN` para acceso operativo ya no existe como diseño vigente (D-06 cerrado F1.3). Falta construir usuario+contraseña vía Supabase Auth (Fase 2, `core.identidad`) — diseño objetivo documentado, sin implementar. |
| Panel de Conductor Web | 🟡 Código legacy aprovechable | Ruta360 tiene flujo de conductor, pero falta adaptación a identidad Nexo, contrato RRHH y permisos unificados. |
| CRM | 🟡 MVP muy básico | Cliente CRUD y dashboard; faltan leads, oportunidades, actividades, cotizaciones/pedido. |
| Transporte / Flotilla | 🟡 Código aprovechable, sin adaptar | Ruta360 importado; falta migración al modelo Nexo y eliminar identidad duplicada de conductores. |
| Inventario mínimo | ⏳ Pendiente | Necesario antes de Fabricación. |
| Fabricación | ⏳ Pendiente | No existe app/schema. |
| Nexo Mobile Android/iOS | ⏳ Preparación arquitectónica | No existe `apps/mobile`. La app será operacional y no replicará toda la Web. Primera vertical productiva prevista: conductor/Transporte. |
| Kernel compartido `@nexo/supabase/@nexo/auth` | ⚠️ Deuda | Existe estructura, pero la arquitectura documenta duplicación de clientes/middleware entre apps. |

---

# 2. Divergencias conocidas: estado actual vs modelo objetivo

Confirmadas en remoto durante **F1.0** (2026-09-07, ver [`status-log/2026-09-07-f1-0-auditoria-real.md`](status-log/2026-09-07-f1-0-auditoria-real.md)). Pendientes de corregirse mediante migraciones nuevas en F1.1–F1.3 (la mayoría ya resuelta, ver estado de cada una).

## D-01 — `rrhh.empleados` mezcla identidad y relación laboral

**Confirmado por `information_schema.columns` contra `nexo-core` remoto.** `rrhh.empleados` tiene hoy, en producción: `puesto`, `departamento`, `fecha_ingreso` (`NOT NULL`), `fecha_baja`, `estado` (`NOT NULL`), `pin_hash`, `nombre_usuario` (`NOT NULL`, único por `company_id`), `pin_bloqueado`, `intentos_fallidos`, `user_id` (único).

Objetivo: `rrhh.empleados` = Expediente General. Puesto, departamento, fechas laborales, estado y PIN dependen del contrato.

**Estado: ✅ resuelto en F1.1** — columnas deprecadas explícitamente (nullable + `comment on column`), `fn_crear_empleado` ya no las acepta. Las columnas en sí siguen existiendo (sin eliminar) hasta una migración de limpieza posterior tras F1.2.

## D-02 — `fn_crear_empleado` generaba PIN

**Estado: ✅ completamente resuelto (F1.1 + F1.3)** — `rrhh.fn_crear_empleado` ya no acepta ni genera nada de eso; `rrhh.fn_activar_contrato` genera el PIN automáticamente al activar. Flujo completo verificado end-to-end.

## D-03 — compensación ligada al empleado

**Confirmado**: `rrhh.empleado_compensacion` tenía `primary key (empleado_id)` — 1:1 real con el empleado, verificado en `pg_constraint` remoto.

**Estado: ✅ resuelto en F1.2** — `rrhh.contrato_compensacion` ahora es 1:1 con `rrhh.contratos`, no con `rrhh.empleados`. `rrhh.empleado_compensacion` (la vieja) sigue existiendo, sin datos, pendiente de una migración de limpieza posterior.

## D-04 — marcas no contienen `contrato_id`

Objetivo: cada marca válida debe quedar contextualizada con el contrato laboral vigente.

**Estado: ⏳ sigue pendiente, ahora desbloqueado** — `rrhh.contratos` (F1.2) y `rrhh.contrato_jornadas`/`rrhh.fn_jornada_vigente_contrato` (F1.4) ya existen, pero `rrhh.asistencia_marcas.contrato_id` todavía no se agregó. Corresponde a F1.5 (consolidación de asistencia).

## D-05 — planilla sin motor

Las tablas base (`rrhh.planillas`, `rrhh.planilla_detalles`) existen y están vacías (0 filas); el motor consolidación → planilla no está construido.

Estado: ⏳ confirmado.

## D-06 — PIN usado como login operativo

Existe la migración `20260902000008_rrhh_nicaragua_and_contracts.sql`, aplicada en remoto, que define `nombre_usuario + PIN` y `rrhh.fn_validar_acceso_operativo()`/`public.validar_acceso_operativo()` como mecanismo de acceso operativo. Sin consumidor en ningún frontend del monorepo.

**Estado: ✅ refactor de PIN completamente cerrado (F1.3)** — `rrhh.fn_registrar_marca_kiosko` ya no depende en absoluto de `rrhh.empleados.pin_hash`; el PIN vive exclusivamente en `rrhh.contrato_credenciales`, ligado al ciclo de vida del contrato. Pendiente solo la mitad de identidad digital (usuario+contraseña), que es Fase 2 y no bloquea RRHH.

## D-07 — identidad de conductor no debe ser independiente

Ruta360 legacy (`apps/flotilla`) mantiene sus propios conceptos de conductor/login, con su propio `supabase/migrations` apuntando a un proyecto Supabase distinto al de Nexo. Confirmado que no consume nada de `nexo-core` y que no tiene proyecto Vercel dentro del equipo de Nexo.

Estado: ⚠️ confirmado, Fase 4, con preparación desde Fase 1/2. Sin código actual que lo contradiga (Ruta360 todavía no está conectado a Nexo).

## D-08 — quinto rol RRHH: `consulta`

`core.app_roles` (`module_slug='rrhh'`) tiene 5 filas, no 4: `admin` (36 permisos), `supervisor_asistencia` (16), `especialista_planillas` (12), `gestor_expedientes` (9) y **`consulta`** (7, solo lectura). Cualquier Paso Cero de permisos nuevo debe asignar explícitamente el alcance de `consulta`.

Estado: ℹ️ hallazgo de F1.0, sin urgencia — no contradice el modelo objetivo, solo estaba subdocumentado.

---

# 3. Fase 1 — tablero de ejecución RRHH

| ID | Entregable | Estado | Evidencia / nota |
|---|---|---|---|
| F1.0 | Auditoría real `main` + Supabase + Vercel + permisos + datos | ✅ | [Detalle](status-log/2026-09-07-f1-0-auditoria-real.md). Sin código/DB pendiente de revisión. |
| F1.0.1 | Cierre de acceso operativo PIN heredado (D-06) | ✅ | [Detalle](status-log/2026-09-07-f1-0-1-cierre-pin-heredado.md). |
| F1.1 | Separar Expediente General / Expediente Laboral | ✅ | [Detalle](status-log/2026-09-07-f1-1-expediente-general-laboral.md). |
| F1.2 | `rrhh.contratos` + compensación contractual | ✅ | [Detalle](status-log/2026-09-07-f1-2-contratos-compensacion.md). |
| F1.3 | PIN generado solo al activar contrato | ✅ | [Detalle](status-log/2026-09-07-f1-3-pin-contractual.md). Verificado end-to-end real (23 pasos), incl. 2 bugs reales encontrados y corregidos. |
| F1.4 | Jornadas/turnos/feriados mínimos | ✅ | [Detalle](status-log/2026-09-07-f1-4-jornadas-minimas.md). Gap de rol señalado (`gestor_expedientes` sin `turnos.ver`), pendiente de aprobación aparte. |
| F1.5 | Consolidación diaria de asistencia | ⏳ | Marcas → horas/incidencias. **Próximo trabajo** — ver sección 7. |
| F1.6 | Incidencias/justificaciones | ⏳ | Validación previa a planilla. |
| F1.7 | Motor de planillas + snapshots | ⏳ | No integración contable todavía. |
| F1.8 | UI administración de kioscos | ⏳ | Eliminar SQL manual como operación normal. |
| F1.9 | Seguridad/RBAC/E2E | ⏳ | Roles + RPC directa + RLS + advisors + contrato finalizado + PIN revocado. Incluye las pruebas por rol real pendientes de F1.3/F1.4 (ver esas entradas del log). |
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

En cada subfase ejecutada, actualizar este archivo en el mismo commit o conjunto de commits que cambia el producto:

1. Crear una entrada nueva en `docs/status-log/YYYY-MM-DD-slug.md` con el detalle completo (qué se auditó/migró/verificó, evidencia, deuda pendiente) — **no** volver a convertir este archivo en un monolito narrativo.
2. Agregar una fila a la tabla de la sección 0 (arriba) apuntando a esa entrada.
3. Actualizar las secciones 1-7 de este archivo (estado general, divergencias, tablero de fase, próxima acción) para que reflejen la realidad nueva — son el dashboard que se lee siempre, deben quedar correctas sin tener que abrir el log.

Registrar como mínimo en la entrada de `status-log/`:

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

**Bloque complementario #18:** revisar Claude/Previews y obtener aprobación humana antes de publicar Agencia, fusionar su integración y habilitar la tarjeta. El orden de RRHH de abajo no cambia. Las pruebas de navegador son manuales por decisión del usuario.

```text
F1.0   — Auditoría de realidad RRHH        ✅ completada 2026-09-07
F1.0.1 — Cierre PIN heredado (D-06)        ✅ completada 2026-09-07
Paso Cero — Matriz contratos/credenciales  ✅ aplicada 2026-09-07
F1.1   — Separar Expediente General/Laboral ✅ completada 2026-09-07
F1.2   — rrhh.contratos + compensación      ✅ completada 2026-09-07
F1.3   — PIN exclusivamente contractual     ✅ completada 2026-09-07
F1.4   — Jornadas mínimas                   ✅ completada 2026-09-07
Nexo Enterprise UI — rediseño visual        ✅ completada 2026-09-07
Fix estabilización RRHH — nav/UX/bug P0     ✅ completado 2026-09-08
Reconciliación func./visual — Marca/Launcher/
  Expediente-Contratación/edición real       ✅ completado y en producción 2026-09-14
                                              (main 4cc8a6a, Vercel READY)
Bloque "pre-F1.5" — cédula/favicon/catálogos/
  Storage privado/expediente ampliado         ✅ implementado y compilado 2026-09-16
                                              (build+lint limpios, sin merge a main todavía —
                                               ver docs/status-log/2026-09-16-rrhh-pre-f1-5.md)
Bloque 2026-09-17 — reglas de contratación,
  endurecimiento de seguridad e integridad,
  Launcher/sidebar sin chrome de módulo        ✅ código en main (392f676) + migración
                                              APLICADA a nexo-core (2026-09-18,
                                               versión remota 20260918043955) —
                                               ver docs/status-log/2026-09-17-contratos-reglas-y-endurecimiento.md
Paso Cero — administración de usuarios/roles ✅ aplicado 2026-10-14
                                              (20261014201119, rama feat/usuarios-roles-nexo)
 ↓
Administración de usuarios/roles — esquema + RPC ✅ aplicado 2026-10-14
                                              (20261014203144, 15 pruebas SQL)
 ↓
Administración de usuarios/roles — pantallas  🟡 EN PRODUCCIÓN 2026-10-14 (PR #20,
                                              main ff46bce, nexocore READY); falta
                                              recorrido con sesión real (crear rol/usuario,
                                              primer ingreso, desactivar)
Agencia digital (#18)                         ⏸ en espera por decisión del usuario: código en
                                              main, app inactiva en nexo-core, sin
                                              AGENCIA_APP_URL de Production (/dashboard no
                                              funciona hasta activarla)
 ↓
Atención (turnos de sala de espera) — Paso Cero ✅ aplicado 2026-10-14 (20261014222454)
 ↓
Atención — tablas + RPC + pg_cron  ✅ aplicado 2026-10-14 (20261014224341), app inactiva
 ↓
Atención — pantallas (Sucursales en Configuración, apps/atencion, pantalla pública)  🟡 implementadas
                                              2026-10-14 (build/lint limpios)
 ↓
Atención — proyecto Vercel nexo-atencion ✅ creado 2026-10-14 + ATENCION_APP_URL (Preview)
 ↓
Atención — activada en nexo-core 2026-10-14 (20261014230022), antes del merge por decisión
                                              del usuario: la tarjeta ya aparece en producción
                                              pero /atencion solo funciona en el preview
 ↓
Atención — ATENCION_APP_URL de Production ✅ configurada 2026-10-14 (efectiva tras el merge)
 ↓
Atención — merge a main + prueba real en producción  ⏳ siguiente
 ↓
Atención — nombre del cliente y del agente en la pantalla  🟡 en producción 2026-10-15
                                              (PR #22, main 9e52219, nexo-atencion READY,
                                              migración 20261015151609); falta prueba en el televisor
 ↓
F1.5 — Consolidación de asistencia  ⏳ pendiente (sigue explícitamente NO iniciado —
                                          "no iniciar F1.5" fue parte del alcance de ambos
                                          bloques anteriores — pendiente de instrucción
                                          explícita del usuario)
```

Antes de dar el bloque "pre-F1.5" por completamente cerrado (no solo
implementado): completar `core.geografia_ni_municipios` con una fuente
oficial verificada, agregar `SUPABASE_SERVICE_ROLE_KEY` al proyecto
Vercel de RRHH, y ejecutar un recorrido autenticado real (subir/descargar
un documento, CRUD de cada catálogo, alta con cédula duplicada) — ver
deuda completa en
[`status-log/2026-09-16-rrhh-pre-f1-5.md`](status-log/2026-09-16-rrhh-pre-f1-5.md).

**Bloque 2026-09-17/18 — cerrado**: código commiteado y pusheado a `main`
(`392f676`), migración
[`20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql`](../supabase/migrations/20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql)
**aplicada a `nexo-core`** el 2026-09-18 (prechecks de solo lectura antes
de aplicar, postchecks de firma/`NOT NULL`/permisos/bucket después,
`get_advisors(security)` sin hallazgos nuevos). El archivo se creó
localmente con el prefijo `20260917100000` (fecha de escritura) y se
renombró a `20260918043955` (fecha/hora real de aplicación) sin modificar
su SQL, para que el nombre del archivo coincida con la versión que quedó
registrada en `supabase_migrations.schema_migrations` — mismo criterio ya
usado en migraciones anteriores de este proyecto (ej. `20260916150000_...`
quedó como `20260916152106` en remoto). Pendiente, sin relación con la
migración: un recorrido autenticado real en navegador (sin credenciales
de prueba en este entorno) y verificar que el deployment de Vercel
disparado por el push de `392f676` terminó `READY`. Ver deuda completa en
[`status-log/2026-09-17-contratos-reglas-y-endurecimiento.md`](status-log/2026-09-17-contratos-reglas-y-endurecimiento.md).

Detalle completo del recorrido de verificación de F1.3 (23 pasos) y de la comparación explícita `Plan vs main vs migraciones vs remoto vs Vercel vs permisos vs datos` de F1.0: ver [`status-log/2026-09-07-f1-3-pin-contractual.md`](status-log/2026-09-07-f1-3-pin-contractual.md) y [`status-log/2026-09-07-f1-0-auditoria-real.md`](status-log/2026-09-07-f1-0-auditoria-real.md) respectivamente.

Solo después de aprobado el Paso Cero correspondiente se inicia cada tramo de la migración hacia:

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
