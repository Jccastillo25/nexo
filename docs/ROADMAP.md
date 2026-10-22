# Roadmap de Nexo

**Bloque complementario pedido por el usuario, 2026-10-14:** separar Agencia digital en `apps/agencia` con proyecto Vercel e icono en el Launcher. Matriz mínima aprobada y aplicada; código y compilación preparados, revisión técnica/publicación/activación pendientes. No inicia las fases RRHH ni el proyecto integral de permisos. [Detalle](status-log/2026-10-14-agencia-independiente.md).


> El orden objetivo detallado vive en `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`. Este documento resume el avance macro. No confundir infraestructura desplegada con MVP funcional validado.

Historial anterior: **2026-09-06**.

---

# 1. Infraestructura ya implementada

| Área | Estado | Nota |
|---|---|---|
| Monorepo Turborepo/pnpm | ✅ | Base Nexo creada. |
| `nexo-core` / `core.*` | ✅ | Supabase común, permisos y catálogo de apps. |
| Nexo launcher | ✅ | Login, módulos y Multi-Zones operativos. |
| CRM | ❌ Retirado 2026-10-20 | Borrado por pedido del usuario (código, app del Launcher, esquemas `crm` y `metas`), sin datos. Respaldo en la rama local `respaldo/crm-2026-10-20`. Lo reemplaza la réplica de AG Negocio en la app ERP. |
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
| 2 | **Kernel compartido + identidad operacional**: `@nexo/auth`, `@nexo/supabase`, relación empleado↔Auth, provisión/restablecimiento de cuentas y APIs reutilizables | 🟡 Kernel de código hecho en local (2026-10-20/21, revisión integral): `@nexo/supabase`, `@nexo/auth`, `getPermisos`/`misPermisos` y `@nexo/config`, con las 6 apps migradas y `pnpm verify` en verde. La RPC `mis_permisos` está aplicada en `nexo-core` (`20261021164649`, 2026-10-21). Faltan la relación empleado↔Auth, la provisión de cuentas, los datos maestros en `core` y los eventos entre módulos (propuesta pendiente de aprobación). [Detalle](status-log/2026-10-21-mejoras-revision-integral.md) |
| 3 | ~~CRM MVP real~~: retirado el 2026-10-20. Clientes, cotizaciones y facturación pasan a la réplica de AG Negocio (fila ERP de abajo) | ❌ Retirado |
| 4 | **Transporte/Flotilla**: adaptar Ruta360, Panel Conductor Web, identidad Nexo y primera vertical Mobile | ⏳ |
| — | **Productos (catálogo maestro) → Listas de precios**: adelantado por decisión del usuario 2026-10-16, en paralelo a RRHH ([plan 14](plan/14-productos.md)) | 🟡 Productos: esquema aplicado, app en local |
| — | ~~Metas y Presupuesto dentro del CRM~~ ([plan 15](plan/15-metas-ventas.md)) | ❌ Retirado el 2026-10-20 con el CRM; vuelve como app Presupuesto (fila de abajo) |
| — | **Presupuesto, app aparte en el proyecto de Vercel `nexo-crm`** (pedido del usuario 2026-10-20). Fase 1: presupuesto de ventas y metas (recupera el plan 15). Fase 2: presupuesto por centro de costo de AG Negocio ([plan 19](plan/19-presupuesto.md)) | 🟡 Fase 1: Paso Cero y esquema aplicados (`20261020183127`, `20261020184030`); app en local; falta activar y desplegar |
| — | **Réplica de AG Negocio dentro de Nexo** (pedido del usuario 2026-10-20): copiar completo el ERP actual y luego mejorarlo, sin el bloque académico. Son 144 pantallas en 11 grupos, en las etapas R0 a R9 ([plan 18](plan/18-replica-ag-negocio.md)) | 🟡 R0 hecho: CRM retirado (`20261020143821`). Sigue el Paso Cero de R1 y R2 |
| — | *Antes:* **ERP/CRM de Materiales J Castillo dentro de Nexo, con ERPNext como referencia funcional** (decisión del usuario 2026-10-19; el embudo se retiró el 2026-10-20). No se instala ERPNext: se siguen el login único, Supabase `nexo-core` y la norma de permisos. De ERPNext se toman los procesos (ventas, inventario, compras, contabilidad), igual que con NextCRM (MIT) para el embudo. Primer corte: embudo comercial del CRM ([plan 16](plan/16-crm-embudo-comercial.md)) | 🟡 Embudo: Paso Cero y esquema aplicados (2026-10-19/20, 48 RPC); UI en curso. ERP ([plan 17](plan/17-erp.md)): Paso Cero aplicado el 2026-10-20 (apps `precios` y `erp` inactivas). Etapas: E1 Precios → E2 Contabilidad → E3 Inventario → E4 Compras/CxP/Bancos → E5 Ventas/Facturación DGI/Caja/CxC → E6 Cierre y corte |
| 5 | **Inventario mínimo**: almacenes, existencias, movimientos y reservas (el catálogo de productos ya viene de la app Productos) | ⏳ |
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
| CRM | ❌ Retirado el 2026-10-20 (reemplazado por la réplica de AG Negocio) |
| ERP (réplica de AG Negocio) | 🟡 Inventario y retiro del CRM hechos; Paso Cero pendiente |
| RRHH | ❌ No validado E2E |
| Transporte/Flotilla Nexo | ⏳ Sin adaptar |
| Productos (catálogo maestro) | 🟡 Esquema aplicado y app implementada en local 2026-10-16; sin validar ni desplegar |
| Listas de precios | ⏳ No existe (siguiente después de Productos) |
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

## RRHH — entrega local 2026-10-16
RRHH: corte P2–P6 preparado en rama con pruebas locales; aplicación y P7 pendientes. No cambia orden de fases ni cierra consolidación, planillas o corrección auditada.
[Paquete único](RRHH_PAQUETE_OPERADOR.md).
