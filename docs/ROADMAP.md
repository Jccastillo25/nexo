# Roadmap de Nexo

> El orden objetivo detallado vive en `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`. Este documento resume el avance macro. No confundir infraestructura desplegada con MVP funcional validado.

Actualizado: **2026-09-06**.

---

# 1. Infraestructura ya implementada

| Área | Estado | Nota |
|---|---|---|
| Monorepo Turborepo/pnpm | ✅ | Base Nexo creada. |
| `nexo-core` / `core.*` | ✅ | Supabase común, permisos y catálogo de apps. |
| Nexo launcher | ✅ | Login, módulos y Multi-Zones operativos. |
| CRM infraestructura | ✅ | Adaptado a `nexo-core`; MVP actual todavía es principalmente clientes. |
| RRHH infraestructura | ✅ | Schema, RLS, permisos, expedientes básicos y kiosko desplegados. |
| Flotilla/Ruta360 en monorepo | ✅ código importado | Falta adaptación a Nexo. |
| Nexo Mobile | ⏳ | Arquitectura definida; `apps/mobile` todavía no existe. |

---

# 2. Correcciones de arquitectura aprobadas antes de continuar RRHH

El RRHH desplegado contiene decisiones que deben refactorizarse antes de construir horas/planillas encima.

## Expediente

```text
Expediente General ≠ Expediente Laboral
```

Puesto, relación laboral, salario, jornada y fechas pertenecen al contrato.

## PIN

```text
SIN CONTRATO ACTIVO → SIN PIN
PIN = SOLO ASISTENCIA
```

El PIN no se usa para login de conductor ni para crear una sesión digital.

## Identidad digital

```text
usuario + contraseña → Supabase Auth
```

Una sola identidad digital Nexo por empleado, reutilizada por roles/permisos.

## Conductor

```text
Empleado + contrato activo
→ habilitar conductor
→ crear/reutilizar identidad digital
→ permisos Transporte
→ Panel Conductor Web / Nexo Mobile
```

Fuente: [`DRIVER_ACCESS_AND_KIOSK.md`](DRIVER_ACCESS_AND_KIOSK.md).

---

# 3. Orden de implementación vigente

| Fase | Objetivo | Estado |
|---|---|---|
| 1 | **Cerrar RRHH**: expediente general/laboral, contratos, PIN solo asistencia, jornadas, consolidación, incidencias, planillas y E2E | ⏳ Próxima fase activa |
| 2 | **Kernel compartido + identidad operacional**: `@nexo/auth`, `@nexo/supabase`, relación empleado↔Auth, provisión/restablecimiento de cuentas y APIs reutilizables | ⏳ |
| 3 | **CRM MVP real**: leads, oportunidades, pipeline, actividades, cotizaciones y pedido | ⏳ |
| 4 | **Transporte/Flotilla**: adaptar Ruta360, Panel Conductor Web, identidad Nexo y primera vertical Mobile | ⏳ |
| 5 | **Inventario mínimo**: productos, almacenes, existencias, movimientos y reservas | ⏳ |
| 6 | **Fabricación**: BOM, órdenes, reserva, producción, merma, calidad y terminado | ⏳ |
| 7 | **Nexo Mobile Android/iOS**: consolidar shell y verticales operativas para distribución | ⏳ |
| 8 | **Integración E2E Nexo**: CRM→Inventario→Fabricación→Transporte→Entrega | ⏳ |

---

# 4. Fase 1 — RRHH

Orden inmediato:

```text
F1.0 Auditoría remota/código
 ↓
F1.1 Expediente General / Laboral
 ↓
F1.2 Contratos + compensación
 ↓
F1.3 PIN solo asistencia
 ↓
F1.4 Jornadas
 ↓
F1.5 Consolidación
 ↓
F1.6 Incidencias
 ↓
F1.7 Planillas
 ↓
F1.8 Administración kioscos
 ↓
F1.9 Seguridad/RBAC/E2E
 ↓
F1.10 RRHH MVP validado
```

F1.0 debe revisar específicamente la infraestructura heredada de:

- `fn_crear_empleado` generando PIN;
- `nombre_usuario` en empleado;
- `user_id`;
- `fn_validar_acceso_operativo()`;
- PIN de doble propósito;
- compensación ligada 1:1 al empleado.

No editar migraciones aplicadas; usar migraciones nuevas.

---

# 5. Estado MVP operativo

| Módulo | Estado |
|---|---|
| Nexo Launcher | ✅ Validado |
| CRM cliente CRUD | ✅ Validado como capacidad actual; no equivale al CRM completo objetivo |
| RRHH | ❌ No validado E2E |
| Transporte/Flotilla Nexo | ⏳ Sin adaptar |
| Inventario | ⏳ No existe |
| Fabricación | ⏳ No existe |
| Nexo Mobile | ⏳ No existe app integrada |

RRHH no se declara listo hasta completar el recorrido definido en [`RRHH_MVP.md`](RRHH_MVP.md).

---

# 6. Mobile

Nexo Mobile se prepara desde Fase 1 pero se consolida en Fase 7.

Principio:

**No replica toda la Web.**

Primera vertical productiva: **Transporte / conductor**.

La misma identidad digital debe funcionar en:

```text
Panel Conductor Web
+
Android
+
iOS
```

mientras el PIN contractual continúa siendo exclusivo del kiosko.

---

# 7. Próximo hito concreto

La próxima ejecución no debe empezar por el motor de planillas.

Debe empezar por:

```text
F1.0 — Auditoría real de RRHH
```

Luego presentar el diff de permisos/modelo para F1.1–F1.3 y corregir primero la raíz:

```text
Persona
├── Contrato → PIN asistencia → Kiosko
└── Identidad digital → roles/permisos → Web/Mobile
```

Solo después continuar con jornada, consolidación y planilla.
