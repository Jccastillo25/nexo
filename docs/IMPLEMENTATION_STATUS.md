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
| RRHH infraestructura | ✅ Desplegada | Schema, permisos, RLS, expedientes básicos y kiosco existen. |
| RRHH modelo Expediente General/Laboral | ⚠️ Refactor obligatorio | El código actual mezcla datos laborales y credenciales dentro de `rrhh.empleados`. F1.0 debe verificar remoto antes de migrar. |
| RRHH contratos | ⏳ Pendiente | No existe el modelo contractual objetivo del Plan Maestro. |
| RRHH PIN contractual | ⚠️ Contradice regla nueva | `fn_crear_empleado` actual genera PIN durante alta. Debe reemplazarse por generación exclusiva al activar contrato. |
| RRHH jornadas | ⏳ Pendiente funcional | Permisos de turnos existen, pero falta modelo/UI necesario para cálculo real. |
| RRHH consolidación de asistencia | ⏳ Pendiente | No existe marcas → horas consolidadas. |
| RRHH planillas | ⏳ Pendiente | Ruta actual es placeholder; falta motor/reporte. |
| CRM | 🟡 MVP muy básico | Cliente CRUD y dashboard; faltan leads, oportunidades, actividades, cotizaciones/pedido. |
| Transporte / Flotilla | 🟡 Código aprovechable, sin adaptar | Ruta360 importado; falta migración al modelo Nexo y eliminar identidad duplicada de conductores. |
| Inventario mínimo | ⏳ Pendiente | Necesario antes de Fabricación. |
| Fabricación | ⏳ Pendiente | No existe app/schema. |
| Nexo Mobile Android/iOS | ⏳ Preparación arquitectónica | No existe `apps/mobile`; desde Fase 1 las APIs/RPC deben diseñarse reutilizables. Primera vertical productiva prevista: Transporte. |
| Kernel compartido `@nexo/supabase/@nexo/auth` | ⚠️ Deuda | Existe estructura, pero la arquitectura documenta duplicación de clientes/middleware entre apps. |

---

# 2. Divergencias conocidas: RRHH actual vs Plan Maestro

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

Objetivo: `rrhh.empleados` = Expediente General. Puesto, departamento, fechas laborales, estado y credencial deben depender del contrato.

Estado: ⚠️.

## D-02 — `fn_crear_empleado` genera PIN

Comportamiento actual versionado:

```text
crear empleado
→ generar nombre_usuario
→ generar/aceptar PIN
→ guardar pin_hash
→ opcionalmente crear compensación
```

Comportamiento obligatorio nuevo:

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

---

# 3. Fase 1 — tablero de ejecución RRHH

| ID | Entregable | Estado | Evidencia / nota |
|---|---|---|---|
| F1.0 | Auditoría real `main` + Supabase + Vercel + permisos + datos | ⏳ | Debe ser el próximo trabajo. |
| F1.1 | Separar Expediente General / Expediente Laboral | ⏳ | No tocar migraciones aplicadas. |
| F1.2 | `rrhh.contratos` + compensación contractual | ⏳ | Paso Cero de permisos antes de tablas/UI. |
| F1.3 | PIN generado solo al activar contrato | ⏳ | Revocar al finalizar; regenerar solo por contrato activo. |
| F1.4 | Jornadas/turnos/feriados mínimos | ⏳ | Requisito del motor de asistencia. |
| F1.5 | Consolidación diaria de asistencia | ⏳ | Marcas → horas/incidencias. |
| F1.6 | Incidencias/justificaciones | ⏳ | Validación previa a planilla. |
| F1.7 | Motor de planillas + snapshots | ⏳ | No integración contable todavía. |
| F1.8 | UI administración de kioscos | ⏳ | Eliminar SQL manual como operación normal. |
| F1.9 | Seguridad/RBAC/E2E | ⏳ | Roles + RPC directa + RLS + advisors. |
| F1.10 | Recorrido completo validado | ⏳ | Criterio para declarar RRHH MVP listo. |

---

# 4. Preparación Nexo Mobile

## Estado actual

No existe una app móvil Nexo integrada al monorepo.

Ruta objetivo futura:

```text
apps/mobile
```

Objetivo: una sola aplicación Android/iOS con módulos visibles según permiso.

## Requisitos que deben cumplirse desde ya

| Requisito | Estado |
|---|---|
| Lógica de negocio en RPC/servicio reutilizable, no solo Server Actions web | 🟡 aplicar a toda lógica nueva |
| Supabase Auth compartido | ✅ backend disponible; integración móvil futura |
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

### Regla RRHH móvil

Un usuario operacional derivado de RRHH solo puede mantener acceso si su contrato sigue activo. La futura sesión móvil no puede convertir un PIN en una credencial independiente del contrato.

---

# 5. Protocolo de actualización para Claude

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

Ejemplo:

```text
F1.2 — ✅ Validado
Fecha: YYYY-MM-DD
Commit: abc1234
Migraciones: 2026...
Pruebas: create/edit/activate contrato + roles + RLS
Remoto: nexo-core verificado
Notas: ...
```

## Regla anti-documentación-obsoleta

Si el código/DB remoto contradice este tracker:

1. verificar la realidad;
2. corregir el tracker;
3. explicar la divergencia;
4. después continuar desarrollo.

Nunca ajustar la realidad para que coincida artificialmente con un documento viejo.

---

# 6. Próxima acción obligatoria

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

Solo después se presenta el diff de permisos/arquitectura de **F1.1–F1.3** y se inicia la migración hacia:

```text
Persona → Contrato → Credencial/PIN → Jornada → Asistencia → Planilla
```

con preparación permanente para consumo desde **Nexo Web + Nexo Mobile Android/iOS**.
