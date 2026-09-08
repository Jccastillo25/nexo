# Catálogo de módulos

> Estado funcional de alto nivel. Para objetivo y orden de implementación ver `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`; para realidad detallada ver `IMPLEMENTATION_STATUS.md`.

Actualizado: **2026-09-08** (fix de estabilización RRHH — expedientes,
contratos, jornadas y navegación, ver `IMPLEMENTATION_STATUS.md`).

| Módulo / superficie | Ruta / plataforma | Estado | Nota |
|---|---|---|---|
| Panel Nexo | `/` | ✅ Operativo | Login, launcher y módulos por permiso. |
| CRM | `/crm` | 🟡 Base operativa | Cliente CRUD + dashboard. Falta CRM completo: leads, oportunidades, actividades, cotizaciones y pedido. |
| RRHH | `/rrhh` | 🟡 En validación | Expediente General/Laboral, contratos, PIN contractual y jornadas mínimas completos (F1.1-F1.4, 2026-09-07). Bug crítico de `/expedientes/[id]` (500 real en producción, ver sección abajo) corregido 2026-09-08. Falta consolidación de asistencia y planillas (F1.5+). |
| Kiosko RRHH | `/rrhh/kiosco` | ✅ Migrado a PIN contractual | Dispositivo + PIN, validado contra `rrhh.contrato_credenciales` desde F1.3 (2026-09-07), verificado end-to-end. |
| Flotilla / Transporte admin | `/flotilla` | ⏳ Código importado | Ruta360 está en el monorepo pero sin adaptar a `nexo-core`, Multi-Zones ni permisos Nexo. |
| Panel de Conductor Web | ruta final por definir dentro de `/flotilla` | ⏳ Pendiente de adaptación | Superficie operacional distinta del panel administrativo. Login con usuario+contraseña; misma identidad que Mobile. |
| Nexo Mobile | Android/iOS (`apps/mobile` futuro) | ⏳ Planeado | App operacional por rol; no replica toda la Web. Primera vertical: conductor/Transporte. |
| Inventario | `/inventario` | ⏳ Planeado | Requisito previo a Fabricación. |
| Fabricación | `/fabricacion` | ⏳ Planeado | BOM, órdenes, producción, merma, calidad y producto terminado. |
| Web Corporativo | dominio aparte | ✅ Operativo | No forma parte del panel Nexo. |

---

# RRHH

## Estado actual conocido

Infraestructura desplegada:

- proyecto Vercel RRHH;
- Multi-Zone `/rrhh`;
- schema `rrhh`;
- RLS/grants;
- permisos;
- expediente básico;
- kiosko;
- rate-limit y endurecimiento de seguridad.

Completo y verificado (F1.1-F1.4, 2026-09-07): contratos del nuevo
modelo, PIN contractual, jornadas mínimas (plantilla + asignación
histórica al contrato, obligatoria para activar).

No validado de punta a punta todavía:

- consolidación de asistencia (F1.5);
- incidencias (F1.6);
- motor de planillas (F1.7);
- E2E completo con usuarios reales por rol (F1.9).

Fuente: [`RRHH_MVP.md`](RRHH_MVP.md).

---

# Transporte / Flotilla

El código de Ruta360 contiene valor reutilizable, pero no se considera adaptado a Nexo.

La adaptación debe separar dos superficies:

```text
TRANSPORTE WEB
├── Panel administrativo
└── Panel de Conductor
```

## Panel administrativo

Para usuarios con permisos de administración de flota:

- vehículos;
- conductores;
- autorizaciones;
- incidencias;
- viajes;
- liquidaciones;
- configuraciones operativas.

## Panel de Conductor

Para el empleado habilitado como conductor:

- viaje actual;
- vehículo asignado;
- inspección;
- iniciar/continuar/finalizar viaje;
- GPS/eventos;
- incidencias;
- evidencia de entrega;
- historial;
- liquidación/gastos cuando aplique.

No debe exponer administración completa.

Acceso:

```text
Empleado RRHH
+ contrato activo
+ conductor habilitado
+ identidad digital Nexo
      ↓
usuario + contraseña
      ↓
Supabase Auth
      ↓
permisos Transporte
```

Fuente específica: [`DRIVER_ACCESS_AND_KIOSK.md`](DRIVER_ACCESS_AND_KIOSK.md).

---

# Nexo Mobile

Nexo Mobile no se trata como un espejo de todas las apps Web.

Su contenido depende del rol y del diseño móvil aprobado.

Primera vertical prevista: **conductor/Transporte**.

La misma identidad digital debe servir para:

```text
Panel Conductor Web
+
Nexo Mobile Android
+
Nexo Mobile iOS
```

Mientras:

```text
PIN contractual = exclusivamente kiosko/asistencia
```

---

# Regla de identidad

No duplicar personas ni cuentas por módulo.

```text
rrhh.empleados
      ↓
identidad digital Nexo / auth.users
      ↓
roles y permisos por módulo
```

`flotilla.conductores` es una extensión operacional de un empleado, no una identidad paralela.

---

# Definition of Done de un módulo

Un módulo no se marca `✅` solo porque:

- el schema existe;
- despliega;
- una pantalla carga.

Debe completar:

1. infraestructura;
2. flujo funcional de punta a punta;
3. permisos/RLS;
4. integración con fuentes de verdad;
5. pruebas E2E;
6. documentación actualizada.
