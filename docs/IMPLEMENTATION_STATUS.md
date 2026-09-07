# Nexo — Estado Vivo de Implementación

> Tracker operativo. Debe actualizarse en cada sesión que cambie código, base de datos, permisos, despliegue o estado funcional. La fuente del objetivo es `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`; este archivo registra la realidad verificada.

Última actualización documental: **2026-09-06**.

## Estados

- ✅ Validado — recorrido ejecutado y comprobado.
- 🟡 En progreso — existe parcialmente.
- ⛔ Bloqueado — falta decisión/requisito.
- ⏳ Pendiente — no iniciado.
- ⚠️ Deuda/refactor — existe, pero contradice o no cumple el modelo objetivo.

---

# 1. Estado general

| Área | Estado | Realidad conocida / siguiente paso |
|---|---|---|
| Nexo Core / Launcher | ✅ Validado | Monorepo, SSO, Multi-Zones, permisos y `nexo-core` operativos según última documentación verificada. |
| RRHH infraestructura | ✅ Desplegada | Schema, permisos, RLS, expedientes básicos y kiosko existen. |
| RRHH modelo Expediente General/Laboral | ⚠️ Refactor obligatorio | El código actual mezcla datos laborales y credenciales dentro de `rrhh.empleados`. F1.0 debe verificar remoto antes de migrar. |
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

Estas divergencias deben comprobarse en remoto durante **F1.0** y después corregirse mediante migraciones nuevas.

## D-01 — `rrhh.empleados` mezcla identidad y relación laboral

Código versionado conocido incluye dentro de `rrhh.empleados`:

- `puesto`;
- `departamento`;
- `fecha_ingreso`;
- `fecha_baja`;
- `estado` laboral;
- `pin_hash`;
- `nombre_usuario`;
- estado/bloqueo de PIN.

Objetivo: `rrhh.empleados` = Expediente General. Puesto, departamento, fechas laborales, estado y PIN dependen del contrato.

Estado: ⚠️.

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

Estado: ⚠️ prioridad F1.1–F1.3.

## D-03 — compensación ligada al empleado

Existe `rrhh.empleado_compensacion` 1:1 con empleado.

Objetivo: compensación ligada al contrato para conservar historial de recontrataciones/cambios.

Estado: ⚠️.

## D-04 — marcas no contienen `contrato_id`

Objetivo: cada marca válida debe quedar contextualizada con el contrato laboral vigente.

Estado: ⚠️/⏳ según remoto.

## D-05 — planilla sin motor

Las tablas base existen, pero el motor consolidación → planilla no está construido según la última verificación documental.

Estado: ⏳.

## D-06 — PIN usado como login operativo

Existe una migración que define `nombre_usuario + PIN` y `rrhh.fn_validar_acceso_operativo()` como mecanismo de acceso del chofer.

Nueva decisión:

```text
PIN = solo asistencia en kiosko
usuario + contraseña = identidad digital Web/Mobile
```

El diseño de PIN de doble propósito queda como deuda/refactor.

Estado: ⚠️ prioridad arquitectónica.

## D-07 — identidad de conductor no debe ser independiente

Ruta360 legacy mantiene sus propios conceptos de conductor/login.

Objetivo:

```text
rrhh.empleado
  + contrato activo
  + identidad digital Nexo (auth.users)
  + habilitación/rol conductor
  = acceso Transporte
```

No crear un segundo usuario si el empleado ya tiene identidad digital Nexo.

Estado: ⚠️ Fase 4, con preparación desde Fase 1/2.

---

# 3. Fase 1 — tablero de ejecución RRHH

| ID | Entregable | Estado | Evidencia / nota |
|---|---|---|---|
| F1.0 | Auditoría real `main` + Supabase + Vercel + permisos + datos | ⏳ | Debe ser el próximo trabajo. Incluir revisión de `fn_validar_acceso_operativo`, `nombre_usuario`, `user_id` y PIN de doble propósito. |
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
F1.0 — Auditoría de realidad RRHH
```

Debe comparar explícitamente:

```text
Plan Maestro
vs
main
vs
migraciones
vs
nexo-core remoto
vs
Vercel
vs
permisos
vs
datos existentes
```

Y revisar específicamente la deuda de autenticación:

```text
nombre_usuario + PIN (actual)
          ↓ refactor
PIN → solo kiosko/asistencia
usuario+contraseña → Supabase Auth Web/Mobile
```

Solo después se presenta el diff de permisos/arquitectura y se inicia la migración hacia:

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
