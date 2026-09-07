# Nexo — Plan Maestro de Implementación

> **Fuente de verdad de ejecución.** Este documento define el orden de implementación de Nexo, sus reglas de dominio y el resultado funcional esperado de cada fase. Antes de modificar código o base de datos, comparar siempre este plan contra el estado remoto real, el código de `main` y `docs/IMPLEMENTATION_STATUS.md`.
>
> Decisiones de negocio incorporadas el **2026-09-06**:
> 1. RRHH separa estrictamente **Expediente General** y **Expediente Laboral**.
> 2. El **PIN no pertenece al alta general del empleado**: solo puede ser generado automáticamente al activar un contrato laboral válido. No puede generarse desde el expediente general ni mediante una acción independiente sobre `rrhh.empleados`.
> 3. Nexo debe quedar preparado desde ahora para una **app móvil única Nexo Mobile en Android e iOS**, compartiendo backend, identidad y permisos con la suite web.

---

# 1. Objetivo de Nexo

Nexo será una suite empresarial modular con un solo login, permisos centralizados, datos compartidos de forma controlada y flujos conectados de punta a punta.

Flujo operacional objetivo:

```text
CRM
  ↓
Pedido / necesidad
  ↓
Inventario ───── si hay existencia ───────────────┐
  ↓                                                │
si requiere fabricación                            │
  ↓                                                │
Fabricación                                        │
  ↓                                                │
Producto terminado ────────────────────────────────┘
  ↓
Transporte
  ↓
Entrega / evidencia
  ↓
CRM actualizado
```

RRHH participa transversalmente:

```text
RRHH
├── Expediente General
├── Expediente Laboral / contratos
├── jornadas
├── asistencia
├── planillas
└── habilitación laboral de conductores/operadores
```

Nexo Mobile será la superficie operativa de campo:

```text
NEXO MOBILE
├── RRHH / autoservicio del empleado
├── Transporte / conductor
├── CRM / vendedor en campo
└── Fabricación / operador de planta
```

Los módulos visibles dependerán de permisos y rol; no se crearán cuatro aplicaciones móviles independientes.

---

# 2. Arquitectura que se conserva

Se mantiene la arquitectura actual:

- monorepo Turborepo + pnpm;
- una app Next.js por módulo web en `apps/*`;
- un proyecto Vercel por app web;
- dominio público único `nexo.materialesjcastillo.com`;
- Multi-Zones mediante rewrites de `apps/nexo`;
- un solo Supabase `nexo-core`;
- schema PostgreSQL por módulo;
- `core` como capa neutral para permisos e integraciones cross-schema;
- SSO compartido;
- permisos DENY-BY-DEFAULT;
- RLS en datos;
- funciones `core.fn_*` para operaciones atómicas entre módulos.

No convertir Nexo en microservicios mientras no exista una necesidad técnica real que justifique romper la transacción única de PostgreSQL.

---

# 3. Estrategia móvil — Android + iOS

## 3.1 Una sola app: `Nexo Mobile`

Objetivo de arquitectura:

```text
apps/
├── nexo
├── rrhh
├── crm
├── flotilla
├── fabricacion        futuro
├── inventario         futuro
└── mobile             futuro — Android/iOS
```

Stack objetivo recomendado: **React Native + Expo + TypeScript**, sujeto a un spike técnico antes de comenzar el desarrollo móvil. La elección encaja con el monorepo TypeScript actual y permite compilar para Android e iOS desde una sola base de código.

No usar WebView como arquitectura principal. La app móvil debe ser nativa en sus capacidades operativas: cámara, GPS, almacenamiento seguro, notificaciones y trabajo offline.

## 3.2 Qué debe compartirse

La app móvil reutiliza:

- `nexo-core`;
- Supabase Auth;
- `core.has_permission()`;
- catálogo de permisos;
- roles por app;
- RPCs y funciones de dominio;
- tipos de datos compartidos;
- validaciones puras reutilizables;
- tokens de diseño donde sean agnósticos de plataforma.

No se debe intentar reutilizar directamente componentes React DOM de `@nexo/ui` dentro de React Native. Si se necesita, crear una capa `packages/mobile-ui` o compartir únicamente tokens y lógica no visual.

## 3.3 Identidad y seguridad móvil

La autoridad sigue siendo el backend:

```text
Dispositivo móvil
   ↓
Supabase Auth / sesión válida
   ↓
core.has_permission()
   ↓
RLS / RPC
```

Requisitos:

- guardar sesión/token en Keychain de iOS / Keystore de Android mediante almacenamiento seguro;
- no guardar secretos en texto plano;
- biometría puede desbloquear localmente una sesión existente, pero no reemplaza autorización del servidor;
- permisos del móvil son exactamente los mismos de la web;
- una revocación de rol/contrato debe impedir nuevas operaciones aunque el dispositivo conserve UI/cache local;
- soportar deep links/universal links cuando se implemente recuperación, notificaciones o navegación directa.

## 3.4 Offline-first

No todos los módulos requieren el mismo nivel offline.

Prioridad:

1. **Transporte** — obligatorio: viajes, inspección, GPS, fotos/eventos en cola y sincronización idempotente.
2. **Fabricación** — deseable: órdenes asignadas, consumos/producción temporal y sincronización controlada en planta.
3. **CRM** — parcial: clientes, actividades y tareas recientes disponibles; mutaciones sensibles pueden requerir conexión.
4. **RRHH** — lectura/autoservicio con caché; marcación móvil solo si se aprueba posteriormente como política laboral. El kiosco físico sigue siendo un flujo distinto.

Toda escritura offline debe tener:

- UUID generado cliente/servidor de forma idempotente;
- timestamp de dispositivo y timestamp autoritativo de servidor;
- estado `pending/synced/failed`;
- estrategia explícita de conflictos;
- reintentos seguros;
- auditoría de origen móvil.

## 3.5 Capacidades móviles previstas

### RRHH Mobile

- perfil personal;
- contrato vigente;
- jornada;
- historial de asistencia;
- incidencias/justificaciones;
- consulta de planillas/comprobantes cuando exista;
- notificaciones laborales.

El PIN contractual puede usarse en flujos operativos aprobados, pero su primera generación y regeneración siguen dependiendo del contrato y del backend.

### Transporte Mobile — primera prioridad móvil

Reutilizar el valor existente de Ruta360:

- login operativo;
- vehículo asignado;
- inspección;
- cámara;
- GPS;
- eventos de viaje;
- modo offline;
- novedades;
- evidencia de entrega;
- gastos/liquidación si corresponde.

### CRM Mobile

- clientes;
- contactos;
- leads;
- oportunidades;
- actividades;
- llamadas/seguimientos;
- cotización rápida cuando se defina.

### Fabricación Mobile

- órdenes asignadas;
- estación/línea;
- inicio/pausa/finalización;
- consumo de materiales;
- cantidades producidas;
- mermas;
- evidencias/fotos;
- lectura QR/código cuando se implemente trazabilidad.

## 3.6 Regla de preparación desde hoy

Toda nueva lógica de negocio debe residir en DB/RPC/servicios compartibles, no exclusivamente dentro de un Server Action web.

Incorrecto:

```text
Botón Next.js → lógica completa dentro de action.ts → DB
```

Preferido:

```text
Web ───────┐
           ├── RPC/servicio de dominio → PostgreSQL
Mobile ────┘
```

Los Server Actions web deben ser adaptadores delgados: autentican contexto, llaman permiso/RPC y traducen errores para UI.

---

# 4. Reglas obligatorias de dominio de RRHH

Estas reglas prevalecen sobre código o documentación anterior que las contradiga.

## 4.1 Expediente General

Representa a la persona/empleado y contiene información que no depende de un contrato específico:

- código interno;
- nombres;
- apellidos;
- documento de identidad;
- contacto;
- dirección cuando se implemente;
- contacto de emergencia cuando se implemente;
- documentos generales de identidad;
- otros datos administrativos no contractuales.

El Expediente General **NO es la fuente de verdad** de:

- puesto;
- departamento;
- sucursal laboral;
- fecha de ingreso;
- fecha de salida;
- modalidad contractual;
- salario;
- jornada;
- estado laboral vigente;
- PIN.

Invariante:

```text
Crear empleado ≠ contratar empleado
```

Debe ser posible crear Expediente General sin contrato, sin PIN y sin derecho a marcación.

## 4.2 Expediente Laboral

Es el historial de relaciones laborales.

```text
Empleado
├── Contrato A — finalizado
├── Contrato B — finalizado
└── Contrato C — activo
```

Para el MVP: un empleado solo puede tener **un contrato activo simultáneo por empresa**, salvo cambio de negocio explícito posterior.

Cada contrato contiene o relaciona:

- número/código;
- empleado;
- empresa;
- fechas;
- estado;
- puesto;
- departamento;
- sucursal/centro de trabajo cuando exista;
- modalidad contractual;
- compensación;
- jornada;
- documentos laborales;
- observaciones;
- auditoría.

Estados mínimos:

```text
borrador → activo → finalizado
```

Opcionales futuros: anulado/suspendido/vencido, solo con reglas definidas.

Un contrato activado no se borra físicamente.

## 4.3 PIN contractual

Regla principal:

```text
SIN CONTRATO ACTIVO → SIN PIN
```

Único flujo de primera generación:

```text
Expediente General
      ↓
Contrato borrador
      ↓
Completar datos laborales
      ↓
Activar contrato
      ↓
Sistema genera PIN
      ↓
Mostrar una sola vez
      ↓
Guardar solo hash
```

Prohibido:

- generar PIN al crear empleado;
- introducir PIN manual en alta general;
- generar PIN desde la ficha general;
- mantener `set_pin_empleado` como vía independiente sin `contrato_id`;
- marcar sin contrato activo;
- conservar acceso operativo luego de finalizar contrato.

Regeneración:

```text
Contrato activo → Regenerar PIN → Revocar anterior → Generar nuevo
```

El administrador no elige manualmente el PIN.

Finalización de contrato:

- revoca credencial;
- impide nuevas marcas;
- impide nuevo acceso operativo dependiente del contrato;
- conserva historia.

Recontratación:

```text
Nuevo contrato → nueva credencial → nuevo PIN
```

## 4.4 Fuente única de verdad

| Dato | Propietario |
|---|---|
| identidad/datos generales | `rrhh.empleados` |
| relación laboral | `rrhh.contratos` |
| puesto/departamento | contrato |
| fecha ingreso/salida | contrato |
| salario/modalidad | compensación contractual |
| jornada | contrato/asignación contractual |
| PIN | credencial contractual |
| estado laboral | contrato activo |
| asistencia | empleado + contrato |
| planilla | empleado + contrato |

---

# 5. Modelo de datos objetivo RRHH

Nunca editar migraciones ya aplicadas. El cambio se hace mediante migraciones nuevas, con backfill y deprecación gradual.

## 5.1 `rrhh.empleados`

Queda como Expediente General.

Los campos laborales actuales (`puesto`, `departamento`, `fecha_ingreso`, `fecha_baja`, `estado`, `pin_hash`, etc.) pasan a ser deuda de migración y dejan de ser fuente de verdad después del refactor.

Eliminar columnas solo después de verificar remoto, migrar datos, adaptar lectores/escritores y validar producción.

## 5.2 `rrhh.contratos`

Mínimo recomendado:

```text
id
company_id
empleado_id
numero_contrato
estado
fecha_inicio
fecha_fin_prevista
fecha_fin_real
puesto
departamento
sucursal_id (futuro)
modalidad_contrato
created_at / created_by
activado_at / activado_by
finalizado_at / finalizado_by
updated_at
```

Constraint/índice parcial para un contrato activo simultáneo por empleado/empresa.

## 5.3 `rrhh.contrato_compensacion`

Compensación sensible separada y ligada al contrato:

```text
contrato_id
company_id
salario_base
frecuencia_pago
vigente_desde
updated_at
updated_by
```

Migrar/deprecar `rrhh.empleado_compensacion` después de revisar datos reales.

## 5.4 `rrhh.contrato_credenciales`

```text
id
company_id
contrato_id
pin_hash
activo
creado_at / creado_by
revocado_at / revocado_by
rotacion_numero
```

El PIN activo debe ser inequívoco dentro de la empresa para que el kiosco pueda resolverlo.

## 5.5 Jornadas

```text
rrhh.jornadas
rrhh.jornada_dias
rrhh.contrato_jornadas
rrhh.feriados
```

La jornada pertenece a la relación laboral, no a la identidad general.

## 5.6 Asistencia

`rrhh.asistencia_marcas` debe terminar incluyendo `contrato_id`.

Nueva capa:

```text
rrhh.asistencia_resumen_diario
```

Por contrato/empleado/día:

- entrada/salida;
- minutos trabajados;
- ordinarios;
- extra;
- tardanza;
- salida anticipada;
- descanso;
- incidencias;
- reglas/versiones usadas.

## 5.7 Planilla

`rrhh.planilla_detalles` debe incorporar `contrato_id` y snapshots históricos:

- salario aplicado;
- modalidad;
- jornada/reglas;
- horas;
- bonos;
- deducciones;
- parámetros legales;
- total.

Una planilla cerrada no se recalcula con valores actuales.

---

# 6. Permisos RRHH — Paso Cero obligatorio

Antes de tablas/UI nuevas, verificar remoto y presentar el diff de permisos.

Permisos mínimos a evaluar/agregar:

```text
rrhh.expedientes.contratos.ver
rrhh.expedientes.contratos.crear
rrhh.expedientes.contratos.editar
rrhh.expedientes.contratos.activar
rrhh.expedientes.contratos.finalizar
rrhh.expedientes.contratos.anular
rrhh.expedientes.credenciales.ver
rrhh.expedientes.credenciales.regenerar
```

Los permisos existentes de compensación pueden mantener código si se documenta que pasan a representar compensación contractual.

Roles a revisar:

- admin;
- gestor_expedientes;
- supervisor_asistencia;
- especialista_planillas;
- consulta.

Claude debe consultar `core.permissions_catalog`, `core.app_roles` y `core.app_role_permissions`, presentar el diff y obtener aprobación antes de aplicar una nueva matriz.

---

# 7. FASE 1 — Cerrar RRHH

**Primera fase de ejecución. No empezar CRM/Fabricación mientras RRHH no alcance su Definition of Done.**

## F1.0 — Auditoría de realidad y baseline

Antes de tocar código:

- verificar `main`;
- revisar commits nuevos;
- consultar `nexo-core` remoto;
- contar filas de tablas RRHH;
- inventariar RPCs actuales;
- verificar permisos/roles;
- verificar `nexo-rrhh` en Vercel;
- revisar security advisors;
- comparar documentación vs realidad;
- actualizar `docs/IMPLEMENTATION_STATUS.md`.

No asumir que la verificación del 2026-09-05 sigue vigente.

## F1.1 — Separar Expediente General y Laboral

UI objetivo:

```text
/rrhh/expedientes/[empleado]
├── Datos generales
├── Expediente laboral
│   ├── Contratos
│   ├── Compensación
│   ├── Jornada
│   └── Documentos laborales
└── Historial
```

`expedientes/nuevo` solo crea datos generales.

Eliminar del alta general:

- salario;
- modalidad;
- fecha de ingreso laboral;
- PIN;
- credencial operacional.

## F1.2 — Contratos y compensación

Construir:

- permisos aprobados;
- `rrhh.contratos`;
- compensación contractual;
- RLS;
- RPCs;
- UI de historial;
- crear/editar borrador;
- activar;
- finalizar/anular según reglas.

## F1.3 — PIN exclusivamente contractual

Reemplazar:

```text
crearEmpleado() → PIN
```

por:

```text
crearEmpleado() → solo expediente general
crearContrato()  → borrador, sin PIN
activarContrato()→ genera PIN automáticamente
```

Implementar:

- credencial contractual;
- PIN automático de 4 dígitos;
- unicidad/inequívoco por empresa entre credenciales activas;
- bcrypt/hash;
- retorno en texto plano una sola vez;
- deprecación de `set_pin_empleado` independiente;
- kiosco valida contrato activo;
- finalizar contrato revoca PIN;
- regeneración recibe `contrato_id` y exige permiso;
- mantener anti-enumeración/rate-limit.

## F1.4 — Jornadas mínimas

Construir:

- jornadas;
- días/horarios;
- descanso;
- tolerancias;
- asignación contractual;
- feriados;
- UI mínima.

No hardcodear jornada universal.

## F1.5 — Consolidación de asistencia

```text
marcas → pares → contrato+jornada → cálculo → incidencias → resumen diario
```

Casos mínimos:

- entrada/salida correcta;
- marca faltante;
- múltiples pares;
- tardanza;
- salida anticipada;
- descanso;
- horas extra;
- feriado/no laborable;
- contrato no vigente.

## F1.6 — Incidencias y justificaciones

```text
incidencia → supervisor → corregir/justificar/rechazar → día validado
```

Planilla no debe usar marcas crudas con incidencias bloqueantes.

## F1.7 — Motor de planillas

```text
período
 ↓
contratos aplicables
 ↓
asistencia consolidada
 ↓
compensación contractual
 ↓
parámetros legales
 ↓
movimientos
 ↓
snapshot
 ↓
borrador/revisión/cierre
```

Construir movimientos, reporte por empleado, totales verificables e histórico.

Contabilidad queda fuera hasta existir su módulo.

## F1.8 — Administración de kioscos

UI para listar, crear, editar, activar/desactivar y revocar kioscos. Eliminar dependencia de SQL manual para operación diaria.

## F1.9 — Seguridad, roles y E2E

Probar:

- admin;
- gestor de expedientes;
- supervisor asistencia;
- especialista planillas;
- usuario sin permiso;
- kiosco anónimo autorizado;
- kiosco inválido;
- PIN inválido;
- empleado sin contrato;
- PIN de contrato finalizado;
- llamada RPC directa;
- RLS;
- `SECURITY DEFINER`/`search_path`;
- security advisors.

## F1.10 — Definition of Done RRHH

Recorrido obligatorio:

```text
1. Crear Expediente General
2. Confirmar SIN PIN
3. Crear contrato borrador
4. Confirmar todavía SIN PIN
5. Completar compensación y jornada
6. Activar contrato
7. Recibir PIN una sola vez
8. Marcar entrada
9. Marcar salida
10. Consolidar horas
11. Resolver incidencias
12. Generar planilla de prueba
13. Verificar reporte/total
14. Finalizar contrato
15. Confirmar PIN revocado
16. Confirmar historial intacto
17. Probar roles/denegaciones
```

---

# 8. FASE 2 — Kernel compartido Nexo

Antes de escalar módulos:

- completar `@nexo/supabase`;
- completar `@nexo/auth`;
- centralizar sesión/middleware;
- centralizar tipos generados;
- base tsconfig;
- errores de Server Actions homogéneos;
- smoke tests SSO/permisos;
- CI por app;
- preparar contratos/API reutilizables por Nexo Mobile.

Migrar primero RRHH/CRM a la capa común y validar antes de eliminar wrappers locales.

---

# 9. FASE 3 — CRM MVP real

Evolucionar el gestor actual a:

1. clientes/contactos;
2. leads;
3. oportunidades;
4. pipeline;
5. actividades;
6. cotizaciones;
7. pedido comercial MVP;
8. vista 360;
9. dashboard;
10. E2E.

Flujo:

```text
Lead → Oportunidad → Cotización → Pedido
```

Desde el diseño, RPCs y permisos deben poder ser consumidos también por Nexo Mobile.

---

# 10. FASE 4 — Transporte / Flotilla

Reutilizar `apps/flotilla`; no reconstruir.

Adaptar:

- schema a `nexo-core`;
- SSO/permisos;
- Multi-Zone;
- vehículos;
- inspecciones;
- anomalías/autorizaciones;
- viajes/eventos GPS;
- evidencias;
- solicitudes de despacho;
- liquidaciones.

Regla de identidad:

```text
Empleado RRHH + contrato activo
       ↓
Habilitación como conductor
       ↓
Transporte
```

Transportes no crea personas duplicadas.

**Esta fase debe dejar definida la primera versión operativa de Nexo Mobile**, porque conductor/GPS/cámara/offline es el caso móvil de mayor valor y ya existe lógica aprovechable en Ruta360.

---

# 11. FASE 5 — Inventario mínimo

Necesario antes de Fabricación:

```text
productos
almacenes
existencias
movimientos
reservas
```

Movimientos mínimos:

- entrada;
- salida;
- transferencia;
- reserva/liberación;
- consumo fabricación;
- producción;
- ajuste.

---

# 12. FASE 6 — Fabricación

Paso Cero: matriz de permisos antes de tablas/UI.

Módulos:

1. dashboard;
2. productos fabricables;
3. BOM versionada;
4. órdenes;
5. planificación;
6. reservas;
7. ejecución;
8. consumos;
9. mermas;
10. calidad;
11. producto terminado;
12. costos;
13. integración CRM;
14. integración Transporte;
15. E2E.

Flujo:

```text
Pedido → Orden → BOM → Reserva → Producción → Consumo/Merma → Calidad → Producto terminado
```

El cierre debe ser transaccional.

Diseñar las operaciones de planta para que después puedan consumirse desde Nexo Mobile sin duplicar lógica.

---

# 13. FASE 7 — Nexo Mobile Android/iOS

Aunque se prepara desde Fase 1, aquí se consolida como producto distribuible.

## NM-01 — Spike técnico

Validar:

- React Native + Expo dentro del monorepo;
- integración con paquetes compartidos;
- Supabase Auth;
- almacenamiento seguro;
- navegación/deep links;
- cámara/GPS;
- offline queue;
- build Android/iOS.

## NM-02 — Shell móvil

- login;
- sesión persistente segura;
- selector/home por permisos;
- perfil;
- logout/revocación;
- actualización mínima obligatoria de app cuando exista breaking API.

## NM-03 — Transporte móvil

Primera vertical productiva.

- conductor;
- viaje;
- inspección;
- GPS;
- cámara;
- evidencias;
- offline-first;
- sincronización idempotente.

## NM-04 — RRHH autoservicio

- datos propios;
- contrato vigente;
- jornada;
- asistencia;
- justificaciones;
- planillas/comprobantes.

## NM-05 — CRM móvil

- clientes;
- leads;
- oportunidades;
- actividades;
- seguimiento.

## NM-06 — Fabricación móvil

- órdenes;
- consumo;
- producción;
- merma;
- calidad/evidencia;
- QR/códigos cuando aplique.

## NM-07 — Distribución

Preparar:

- identificadores de bundle/package estables;
- iconografía/splash;
- políticas de privacidad;
- permisos de cámara/ubicación;
- builds firmados;
- TestFlight iOS;
- track de pruebas de Google Play;
- estrategia de versiones y actualización.

No publicar en stores hasta completar pruebas internas y política de privacidad aplicable.

---

# 14. FASE 8 — Integración completa de Nexo

Escenario de aceptación:

```text
1. CRM crea cliente/oportunidad/cotización/pedido
2. Inventario evalúa disponibilidad
3. Fabricación produce faltantes
4. Calidad libera
5. Inventario registra terminado
6. Se solicita despacho
7. Transporte selecciona conductor con contrato RRHH activo
8. Nexo Mobile ejecuta inspección/viaje/evidencia
9. Transporte cierra entrega
10. CRM refleja pedido entregado
11. Auditoría rastrea todo el recorrido
```

---

# 15. Integraciones internas — regla técnica

Las UIs no escriben directamente en schemas ajenos.

Usar funciones neutrales:

```text
core.fn_confirmar_pedido(...)
core.fn_solicitar_fabricacion(...)
core.fn_cerrar_orden_fabricacion(...)
core.fn_solicitar_despacho(...)
core.fn_cerrar_entrega(...)
```

Web y Mobile consumen la misma lógica.

---

# 16. Orden definitivo

```text
FASE 1  RRHH completo
FASE 2  Kernel compartido Nexo + preparación móvil
FASE 3  CRM real
FASE 4  Transporte adaptado + primera vertical móvil
FASE 5  Inventario mínimo
FASE 6  Fabricación
FASE 7  Nexo Mobile consolidado Android/iOS
FASE 8  Integración completa
```

Nexo Mobile no empieza conceptualmente en Fase 7: **la preparación comienza en Fase 1** mediante APIs/RPCs reutilizables, identidad única, permisos y datos sin dependencia exclusiva de Next.js.

---

# 17. Definition of Done universal

## Nivel A — Infraestructura

- app/schema;
- permisos/roles;
- RLS;
- SSO/Auth;
- deployment/build.

## Nivel B — Flujo funcional

Caso principal funciona de inicio a fin.

## Nivel C — Integración

No duplica fuentes de verdad y conecta módulos correctamente.

## Nivel D — Validación

- admin;
- operador;
- sin permiso;
- seguridad;
- errores;
- auditoría;
- transacciones/rollback;
- E2E;
- documentación actualizada.

Para móvil además:

- Android probado;
- iOS probado;
- permisos nativos correctos;
- recuperación ante pérdida de conexión;
- sincronización idempotente;
- sesión almacenada de forma segura.

---

# 18. Protocolo obligatorio para Claude

Claude debe tratar este documento y `docs/IMPLEMENTATION_STATUS.md` como fuentes operativas.

## Antes de programar

1. Leer `CLAUDE.md`.
2. Leer este Plan Maestro.
3. Leer `docs/IMPLEMENTATION_STATUS.md`.
4. Leer documentación del módulo.
5. Consultar remoto si depende de Supabase/Vercel.
6. Comparar:

```text
PLAN
vs
MAIN
vs
BASE REMOTA
vs
DEPLOYMENT
vs
ESTADO DOCUMENTADO
```

7. Si difieren, corregir primero el tracker con la realidad.

## Durante

- ejecutar una subfase concreta;
- respetar Paso Cero de permisos;
- no editar migraciones aplicadas;
- usar migraciones nuevas;
- no duplicar fuentes de verdad;
- colocar lógica reutilizable en RPC/servicios cuando deba servir a Web + Mobile;
- no declarar hecho solo porque compila.

## Después

Claude debe:

1. verificar build/tests;
2. verificar remoto cuando aplique;
3. actualizar `docs/IMPLEMENTATION_STATUS.md`;
4. actualizar documentación específica;
5. actualizar `ROADMAP.md`/`MODULES.md` si cambia estado global;
6. registrar fecha, commit, migración y pruebas;
7. commit de código + documentación;
8. push al repo;
9. dejar el estado visible y verificable en GitHub.

---

# 19. Prioridad inmediata

La próxima ejecución debe empezar por:

```text
F1.0 Auditoría real de RRHH
   ↓
F1.1 Separación Expediente General / Laboral
   ↓
F1.2 Contratos
   ↓
F1.3 PIN contractual
```

No empezar por planillas porque el modelo actual todavía mezcla identidad, relación laboral y credencial.

Nuevo orden obligatorio:

```text
Persona
  ↓
Contrato
  ↓
Credencial/PIN
  ↓
Jornada
  ↓
Asistencia
  ↓
Planilla
```

Y toda esa lógica debe quedar construida de forma reutilizable por la futura **Nexo Mobile para Android e iOS**.
