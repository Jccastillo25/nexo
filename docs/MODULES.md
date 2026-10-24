# Catálogo de módulos

**Actualización 2026-10-14 — Agencia digital:** app independiente en `apps/agencia`, zona `/agencia`, proyecto Vercel `nexo-agencia`. Código separado y compilado; matriz mínima aplicada, app todavía inactiva. Previews preparados; revisión final de Claude, merge y activación pendientes. Solo lectura y datos de ejemplo del ticket #13. [Detalle](status-log/2026-10-14-agencia-independiente.md).


> Estado funcional de alto nivel. Para objetivo y orden de implementación ver `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`; para realidad detallada ver `IMPLEMENTATION_STATUS.md`.

Historial anterior: **2026-09-18** (auditoría del botón "Crear borrador" +
reglas de contratación (puesto/departamento/plantilla obligatorios y en
cascada, plantilla persistida) + endurecimiento de seguridad/integridad +
App Launcher sin ningún chrome de módulo + sidebar con texto fijo "Nexo"
— código en `main` (`392f676`), **migración aplicada a `nexo-core`**
(versión remota `20260918043955`); antes 2026-09-16,
bloque "pre-F1.5" — cédula obligatoria, favicon en RRHH/CRM, catálogos de
Contratación, Storage privado y expediente ampliado; antes 2026-09-14,
reconciliación de navegación — App Launcher, Expediente/Contratación
separados, edición real de expediente; antes 2026-09-08, fix de
estabilización RRHH — ver `IMPLEMENTATION_STATUS.md`).

| Módulo / superficie | Ruta / plataforma | Estado | Nota |
|---|---|---|---|
| Panel Nexo | `/` | ✅ Operativo | Login, launcher y módulos por permiso. Desde 2026-09-17 (código en `main`, `392f676`): `/` es exclusivamente el App Launcher, sin ningún chrome de módulo (sin sidebar/topbar/buscador) — deployment de Vercel disparado por el push, sin verificar `READY`. |
| Atención (turnos de sala de espera) | `/atencion` (+ `/atencion/pantalla/<id>` pública) | 🟡 En producción (2026-10-15), sin recorrido completo con sesión real | `apps/atencion`: Iniciar/Cerrar atención con puesto automático; recepción con factura única por sucursal; puesto con fila en tiempo real (Realtime), aviso sonoro, cronómetros de espera/atención, reactivar "no se presentó"; pantalla de TV pública con datos configurables (cliente, agente, puesto, factura); dashboards "Mis métricas" y "Reportes". Ver [plan 13](plan/13-atencion-turnos.md) y los status-log del 2026-10-15. |
| Agencia digital | `/agencia` | 🟡 Activada (2026-10-17), sin recorrido con sesión | App y deploy propio; Dashboard de solo lectura con datos de ejemplo. Activada para la empresa por decisión del usuario (`20261017171359`): ya aparece en el Launcher de producción. `AGENCIA_APP_URL` de Production (`https://nexo-agencia.vercel.app`) está creada en `nexocore` desde el 2026-10-17; `/agencia` abre en producción desde el deploy del 2026-10-18 (`main` `9e11e82`). En local funciona (zona en 3003). |
| Listas de precios | `/precios` (app `precios`, inactiva) | ⏳ Paso Cero del plan 17 aplicado (2026-10-20) | App aparte de Productos. Aparece como "Próximamente" en el Launcher. Replicará las escalas de precio y los multiprecios de AG Negocio en la etapa R3 del [plan 18](plan/18-replica-ag-negocio.md). |
| ERP (réplica de AG Negocio) | `/erp` (app `erp`, inactiva) | 🟡 Inventario hecho (2026-10-20); falta el Paso Cero | Replica completo el ERP actual (AG Negocio, de AG Software, S.A.) y luego lo mejora: cuentas por cobrar y ventas, cuentas por pagar y compras, inventario, contabilidad, bancos y retenciones, informes y activos fijos. Son 144 pantallas en 11 grupos, sin el bloque académico. Productos, Listas de precios y Presupuesto siguen como apps aparte. Ver [plan 18](plan/18-replica-ag-negocio.md). |
| Presupuesto | `/presupuesto` (app `presupuesto`, activa desde `20261020192310`) | 🟡 Esquema aplicado, app en local y activada (2026-10-20), recorrida con la sesión del usuario y con datos reales (47 301 facturas del Excel y presupuesto 2026). Sin despliegue: el mosaico de producción no abre todavía | `apps/presupuesto`, puerto 3001. Paso Cero `20261020183127` y esquema `20261020184030` (14 RPC). App aparte que vivirá en el proyecto de Vercel `nexo-crm`, sin crear uno nuevo. [Detalle](status-log/2026-10-20-presupuesto-app.md). Fase 1: presupuesto anual de ventas, metas por vendedor, avance y facturas importadas de AG Negocio. El código sale de la rama `respaldo/crm-2026-10-20`. Fase 2: presupuesto por centro de costo y comparativo contra lo real. Ver [plan 19](plan/19-presupuesto.md). |
| CRM | — | ❌ Retirado (2026-10-20) | Borrado por pedido del usuario junto con Metas y el embudo comercial, sin datos (`20261020143821`). El código está en la rama local `respaldo/crm-2026-10-20`. Los clientes, las cotizaciones y la facturación pasan a la app ERP. [Detalle](status-log/2026-10-20-retiro-crm-replica-ag-negocio.md). |
| RRHH | `/rrhh` | 🟡 En validación | Expediente General (persona) y Contratación (relación laboral: contratos/PIN/jornadas/catálogos) separados como dominios reales desde 2026-09-14. Desde 2026-09-16: cédula obligatoria, catálogos de puestos/departamentos/plantillas, Storage privado de documentos y expediente ampliado (Dirección/Info. complementaria/Cuentas bancarias/Beneficiario). Desde 2026-09-18 (migración `20260918043955_...` aplicada a `nexo-core`, código en `main`): puesto/departamento/plantilla obligatorios y validados server-side al crear un contrato, plantilla persistida, integridad multiempresa reforzada (FKs compuestas), condición de carrera corregida en beneficiarios, límites reales del bucket de Storage — implementado, compilado y aplicado en remoto, sin recorrido autenticado real (sin credenciales de prueba) ni municipios de Nicaragua cargados (ver `IMPLEMENTATION_STATUS.md`). Falta consolidación de asistencia y planillas (F1.5+). |
| Asistencia | `/rrhh/asistencia` | 🟡 En producción desde 2026-10-18 (`main` `9e11e82`), sin recorrido con sesión real | App propia del Launcher, separada de RRHH por decisión del usuario, pero con el mismo código y deploy (`apps/rrhh`, route group `(asistencia)`). Se lleva el kiosco y su configuración: Dashboard (marcas de hoy y dispositivos activos), Marcas (movida desde `/rrhh/marcas`, que redirige), Dispositivos (registrar, editar, desactivar y reactivar) e Incidencias/Justificaciones como "Pronto". RRHH conserva expedientes, contratación, PIN, jornadas, feriados y planillas. Registrada en `core.apps` (`20261017173701`, aplicada): visibilidad `asistencia.ver_modulo`, que hoy solo tiene el owner; el contenido usa los permisos `rrhh.asistencia.*` que ya existían. [Detalle](status-log/2026-10-17-asistencia-app.md). **Reportes (2026-10-18, solo en local, RPC aplicadas):** el grupo Análisis tiene diaria, resumen por persona, tardanzas y salidas, incidencias y tarjeta individual, con PDF y vista de impresión auditados ([detalle](status-log/2026-10-18-asistencia-reportes.md)). |
| Kiosko (terminal de marcación) | `/rrhh/kiosco` | ✅ Migrado a PIN contractual | Pertenece a Asistencia desde 2026-10-17 (la ruta no cambia y no aparece en ningún menú). Dispositivo + PIN, validado contra `rrhh.contrato_credenciales` desde F1.3 (2026-09-07), verificado end-to-end. **Enrolamiento (2026-10-17, implementado en local, migraciones aplicadas):** en Dispositivos se genera un código de 10 dígitos; la terminal lo canjea en `/rrhh/kiosco?asignar=1` y guarda una credencial en cookie httpOnly; se puede revocar. Convive con la env `NEXO_KIOSKO_ID` hasta retirarla (después se cierra H5). Sin recorrido con sesión real. |
| Flotilla / Transporte admin | `/flotilla` | 🟡 Zona adaptada (E1) y esquema aplicado (E2, 2026-10-24) | `apps/flotilla` (`nexo-flotilla`, puerto 3006) usa `basePath`, login único, `NexoShell` y los permisos `flotilla.*` (Paso Cero `20261024034727`), y está habilitada para la empresa. Ruta360 heredado retirado. Schema `flotilla` aplicado (`20261024140400`). En producción desde el 2026-10-24 (PR #51, proyecto de Vercel `nexo-flotilla`). Faltan las RPC y pantallas de órdenes (E3 en adelante). Plan: [22](plan/22-flotilla-entregas.md). |
| Panel de Conductor Web | ruta final por definir dentro de `/flotilla` | ⏳ Pendiente de adaptación | Superficie operacional distinta del panel administrativo. Login con usuario+contraseña; misma identidad que Mobile. |
| Nexo Mobile | Android/iOS (`apps/mobile` futuro) | ⏳ Planeado | App operacional por rol; no replica toda la Web. Primera vertical: conductor/Transporte. |
| Productos (catálogo maestro) | `/productos` | 🟡 Esquema aplicado y app implementada en local (2026-10-16), activada para probar; la tarjeta de producción no abre hasta el deploy | `apps/productos`: dashboard, listado, ficha (ID inmutable, código `CCTTKK-NNN` editable), clasificación, catálogos, importación/exportación del Excel del ERP. Schema `productos` + RPC en `nexo-core`, sin datos. Sin commit ni recorrido con sesión real. El proyecto Vercel `nexo-productos` sí existe y tiene un deploy de producción READY (verificado el 2026-10-20; los docs anteriores decían que no había proyecto). Ver [plan 14](plan/14-productos.md). |
| Inventario | dentro de la app ERP (`/erp`) | ⏳ Planeado | Desde el plan 18 (2026-10-20) ya no es una app aparte: es el grupo "Inventario" del ERP, con bodegas y kárdex a costo promedio ponderado ([plan 18 §3.3](plan/18-replica-ag-negocio.md)). Lee el catálogo de Productos. (Listas de precios ya tiene su fila arriba; la fila duplicada se retiró en la revisión del 2026-10-20.) |
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
- motor de planillas (F1.7): PL2a, PL2b y PL2c están aplicadas en `nexo-core` (`20261021191441` y `20261021235639` a `20261022001922`) y las pantallas de Planilla están construidas en local, sin commit y sin recorrido visual con sesión ([PL2a](status-log/2026-10-21-planilla-pl2a-motor.md), [PL2b, PL2c y pantallas](status-log/2026-10-21-planilla-pl2b-pl2c-pantallas.md));
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

## RRHH — entrega local 2026-10-16
RRHH: P1–P6 aplicadas en `nexo-core` el 2026-10-17 (postchecks y P7 sección A en verde); código en PR #47 sin fusionar ni desplegar — el kiosco desplegado falla cerrado hasta el merge. Sin piloto autorizado. El MVP completo sigue pendiente.
[Paquete único](RRHH_PAQUETE_OPERADOR.md).
