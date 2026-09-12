# Nexo — Estado Vivo de Implementación (dashboard)

> Tracker operativo. Debe actualizarse en cada sesión que cambie código, base de datos, permisos, despliegue o estado funcional. La fuente del objetivo es `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`; este archivo registra la realidad verificada.
>
> **Este archivo es un dashboard corto, no el historial completo.** Desde 2026-09-11 el detalle narrativo de cada subfase (qué se auditó, qué migraciones se aplicaron, qué se verificó paso a paso) vive en archivos individuales bajo [`docs/status-log/`](status-log/), enlazados desde la tabla de la sección 0 de abajo. Las secciones 1-7 de este archivo son el estado consolidado vigente — se leen siempre; el log detallado se lee solo si hace falta el detalle de verificación de una subfase puntual.

Última actualización documental: **2026-09-11** (limpieza de datos de
prueba residuales en `nexo-core` + corrección de una imprecisión de
conteo de migraciones, detectadas por una verificación remota de rutina;
ver
[`status-log/2026-09-11-limpieza-datos-prueba-residuales.md`](status-log/2026-09-11-limpieza-datos-prueba-residuales.md).
Antes de eso, fix de estabilización RRHH — expedientes, contratos,
jornadas y navegación; ver
[`status-log/2026-09-08-fix-estabilizacion-rrhh.md`](status-log/2026-09-08-fix-estabilizacion-rrhh.md)).

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

Deuda general no bloqueante detectada de paso (rendimiento pre-existente fuera de RRHH): ver el cierre de la entrada de F1.0 de arriba.

---

# 1. Estado general

| Área | Estado | Realidad conocida / siguiente paso |
|---|---|---|
| Nexo Core / Launcher | ✅ Validado | Monorepo, SSO, Multi-Zones, permisos y `nexo-core` operativos según última documentación verificada. |
| Nexo Enterprise UI (shell/navegación) | ✅ Implementado (2026-09-07) | Sidebar azul persistente + topbar con breadcrumb en Nexo/RRHH/CRM (`NexoShell`), tema claro por defecto. No verificado visualmente en navegador — ver build de Vercel post-push. |
| RRHH infraestructura | ✅ Desplegada | Schema, permisos, RLS, expedientes básicos y kiosko existen. |
| RRHH modelo Expediente General/Laboral | ✅ F1.1 completada | `rrhh.empleados` ya no acepta datos laborales/credenciales en el alta (2026-09-07). Columnas viejas deprecadas, no eliminadas — limpieza final pendiente de F1.2. |
| RRHH contratos | ✅ F1.2 completada | `rrhh.contratos`/`rrhh.contrato_compensacion` existen, con RLS, trigger de estado y RPC (2026-09-07). Falta F1.3 (PIN al activar) para el flujo completo. |
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
 ↓
F1.5 — Consolidación de asistencia  ⏳ próximo trabajo (fuera del alcance aprobado en la
                                          última sesión — "No avances todavía a F1.5" — pendiente
                                          de instrucción explícita del usuario)
```

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
