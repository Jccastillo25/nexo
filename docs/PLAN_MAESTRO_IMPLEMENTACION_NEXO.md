# Nexo — Plan Maestro de Implementación

> **Fuente de verdad de ejecución.** Este documento define el orden de implementación, reglas de dominio, arquitectura objetivo y Definition of Done de Nexo. Antes de modificar código o base de datos se debe comparar contra `main`, el remoto real y `docs/IMPLEMENTATION_STATUS.md`.

## Decisiones de negocio vigentes — 2026-09-06

1. RRHH separa estrictamente **Expediente General** y **Expediente Laboral**.
2. El **PIN** no pertenece al alta general: nace únicamente al activar un contrato laboral válido.
3. El PIN es **exclusivamente para asistencia/kiosko**. No es contraseña de Web ni Mobile.
4. El acceso digital operativo usa **usuario + contraseña administrados por Supabase Auth**.
5. La identidad digital pertenece al empleado; Transporte/CRM/Fabricación agregan roles/permisos, no cuentas duplicadas.
6. El Panel de Conductor Web y Nexo Mobile comparten la misma identidad digital.
7. **Nexo Mobile no replica toda la versión Web**: solo muestra funciones operacionales aprobadas por rol/permisos.
8. Nexo debe prepararse desde ahora para Android/iOS mediante RPC/servicios reutilizables, no lógica encerrada en Next.js.

Fuente específica de acceso: [`DRIVER_ACCESS_AND_KIOSK.md`](DRIVER_ACCESS_AND_KIOSK.md).

---

# 1. Objetivo de Nexo

Nexo será una suite empresarial modular con backend común, identidad centralizada, permisos unificados y flujos conectados.

```text
CRM
 ↓
Pedido
 ↓
Inventario ── hay existencia ──────────────┐
 ↓                                         │
requiere fabricar                         │
 ↓                                         │
Fabricación                                │
 ↓                                         │
Producto terminado ────────────────────────┘
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
├── PIN de asistencia
├── jornadas
├── asistencia
├── planillas
└── identidad/habilitación laboral para módulos operativos
```

---

# 2. Arquitectura base que se conserva

- monorepo Turborepo + pnpm;
- una app Next.js Web por módulo en `apps/*`;
- un proyecto Vercel por app Web;
- dominio Web único `nexo.materialesjcastillo.com`;
- Multi-Zones con rewrites desde `apps/nexo`;
- un Supabase `nexo-core`;
- un schema PostgreSQL por módulo;
- `core` como capa neutral de permisos/integraciones;
- Supabase Auth como identidad digital;
- RLS y DENY-BY-DEFAULT;
- `core.fn_*`/RPC para operaciones atómicas cross-schema.

No migrar a microservicios sin una necesidad real que justifique perder transacciones simples dentro del mismo Postgres.

---

# 3. Tres superficies de acceso

```text
                    NEXO
                      │
        ┌─────────────┼─────────────┐
        │             │             │
  WEB ADMINISTRATIVO  KIOSKO     CONDUCTOR
       NEXO           RRHH       WEB + APP
        │              │            │
   SSO / Auth       SOLO PIN    USUARIO +
                                CONTRASEÑA
```

## 3.1 Web administrativo

- sesión Supabase Auth;
- acceso a módulos según permisos;
- administración de RRHH, CRM, Transporte, etc.;
- no comparte la credencial PIN del kiosko.

## 3.2 Kiosko RRHH

- dispositivo autorizado;
- empleado introduce únicamente PIN;
- backend valida contrato activo;
- determina entrada/salida según secuencia cuando sea inequívoco;
- registra asistencia;
- no crea una sesión Supabase Auth del empleado.

## 3.3 Panel de Conductor Web + Nexo Mobile

- usuario + contraseña;
- Supabase Auth;
- `auth.uid()` + permisos + RLS;
- contrato activo;
- habilitación como conductor;
- misma cuenta para Web, Android e iOS.

---

# 4. Estrategia móvil — Android + iOS

## 4.1 Una sola app: Nexo Mobile

Objetivo:

```text
apps/
├── nexo
├── rrhh
├── crm
├── flotilla
├── inventario        futuro
├── fabricacion       futuro
└── mobile            Android/iOS
```

Stack recomendado para spike técnico: **React Native + Expo + TypeScript**.

No usar WebView como arquitectura principal.

## 4.2 Mobile no replica Web

Mobile es una superficie operacional.

Ejemplo para conductor:

```text
NEXO MOBILE
├── Viaje actual
├── Mi vehículo
├── Inspección
├── Iniciar/continuar/finalizar viaje
├── GPS
├── Incidencias
├── Evidencia de entrega
├── Mis viajes
├── Liquidación
└── Perfil
```

No incluir por defecto:

- administración de empleados;
- planillas administrativas;
- permisos;
- configuración global;
- administración completa de flota;
- CRM completo;
- funciones que no correspondan al rol móvil.

## 4.3 Backend compartido

```text
Web ───────┐
           ├── RPC / servicio de dominio → PostgreSQL
Mobile ────┘
```

La lógica crítica reutilizable no puede existir solo dentro de una Server Action Web.

## 4.4 Seguridad móvil

- Supabase Auth;
- sesión en almacenamiento seguro de Android/iOS;
- biometría solo como desbloqueo local opcional;
- permisos del backend siempre autoritativos;
- revocaciones deben invalidar nuevas operaciones aunque exista caché local.

## 4.5 Offline-first

Prioridad:

1. Transporte — obligatorio.
2. Fabricación — deseable/operacional.
3. CRM — parcial.
4. RRHH — principalmente consulta/autoservicio; marcación móvil no se asume aprobada.

Toda escritura offline requiere idempotencia, reintentos, timestamp de cliente/servidor, estado de sincronización, estrategia de conflictos y auditoría.

---

# 5. RRHH — reglas obligatorias de dominio

## 5.1 Expediente General

Representa a la persona.

Incluye:

- código interno;
- nombres/apellidos;
- identidad;
- contacto;
- dirección y emergencia cuando se habiliten;
- documentos generales;
- datos no contractuales.

No es fuente de verdad de:

- puesto;
- departamento;
- sucursal;
- ingreso/salida laboral;
- modalidad;
- salario;
- jornada;
- estado laboral;
- PIN.

```text
Crear empleado ≠ contratar empleado
```

Debe poder existir Expediente General sin contrato, sin PIN y sin derecho a marcación.

## 5.2 Expediente Laboral

Un empleado puede tener múltiples contratos históricos, pero para el MVP un solo contrato activo simultáneo por empresa.

```text
Empleado
├── Contrato 1 — finalizado
├── Contrato 2 — finalizado
└── Contrato 3 — activo
```

Cada contrato relaciona:

- código/número;
- empleado/empresa;
- fechas;
- estado;
- puesto/departamento;
- sucursal cuando exista;
- modalidad;
- compensación;
- jornada;
- documentos laborales;
- auditoría.

Estados mínimos:

```text
borrador → activo → finalizado
```

Contratos activados no se borran físicamente.

## 5.3 PIN contractual = asistencia

Regla:

```text
SIN CONTRATO ACTIVO → SIN PIN
```

Flujo:

```text
Expediente General
      ↓
Contrato borrador
      ↓
Completar datos laborales
      ↓
Activar contrato
      ↓
Generar PIN automáticamente
      ↓
Mostrar una vez
      ↓
Guardar solo hash
```

Prohibido:

- PIN en alta general;
- PIN manual elegido por administrador;
- PIN sin `contrato_id`;
- PIN como password Web/Mobile;
- PIN que cree sesión Auth;
- marcación con contrato no vigente.

Regeneración:

```text
Contrato activo → regenerar → revocar anterior → PIN nuevo
```

Finalización del contrato revoca el PIN y bloquea nuevas marcaciones.

## 5.4 Entrada/salida

El kiosko infiere la transición cuando sea segura:

```text
sin entrada abierta → entrada
con entrada abierta → salida
```

Ejemplo:

```text
07:58 ENTRADA
12:03 SALIDA
13:01 ENTRADA
17:08 SALIDA
```

Si el estado es anómalo o ambiguo, crear incidencia; no inventar el resultado.

---

# 6. Identidad digital del empleado

La identidad digital es distinta del PIN.

```text
Empleado
   ↓
Identidad digital Nexo
   ↓
auth.users
   ↓
roles/permisos por módulo
```

No crear cuentas separadas por RRHH/Transporte/CRM/Fabricación.

## 6.1 Usuario y contraseña

Acceso digital:

```text
nombre_usuario + contraseña
```

La contraseña pertenece a Supabase Auth.

No guardar `password` ni `password_hash` propios en tablas de negocio.

Si se utiliza un identificador interno tipo `usuario@nexo.internal`, debe ser un detalle técnico transparente al usuario y validado antes de producción.

## 6.2 Primera contraseña

Al provisionar una cuenta:

```text
crear identidad digital
→ contraseña temporal segura
→ entrega controlada
→ primer login
→ cambio obligatorio
```

Nunca usar el PIN como contraseña temporal.

Debe existir capacidad de restablecer, bloquear/desbloquear y revocar sesiones mediante mecanismos soportados por Supabase Auth.

---

# 7. Habilitación como conductor

Ser empleado no implica ser conductor.

```text
Empleado
 + contrato activo
      ↓
Habilitar como conductor
      ↓
Crear/activar perfil operacional de Transporte
      ↓
Crear o REUTILIZAR identidad digital Nexo
      ↓
Asignar rol/permisos conductor
      ↓
Panel Conductor Web + Nexo Mobile
```

Si ya existe `auth.users`, no crear otra cuenta.

`flotilla.conductores` almacena solo atributos propios de conducción: licencia, categorías, estado operativo, etc. No duplica identidad general, contrato ni contraseña.

## 7.1 Deshabilitar conductor sin finalizar contrato

```text
Contrato = activo
Conductor = deshabilitado
```

Resultado:

- PIN de asistencia sigue vigente;
- RRHH/autoservicio puede continuar si tiene permiso;
- Transporte deja de autorizar nuevos viajes;
- historial se conserva.

## 7.2 Finalizar contrato

- revocar PIN;
- impedir nueva marcación;
- impedir nuevos viajes;
- suspender/revocar habilitaciones laborales dependientes;
- conservar historial;
- no borrar `auth.users` automáticamente si existen otros accesos válidos.

---

# 8. Modelo de datos objetivo RRHH

Nunca editar migraciones aplicadas; usar migraciones nuevas y deprecación gradual.

## 8.1 `rrhh.empleados`

Expediente General.

Campos laborales/credenciales actuales (`puesto`, `departamento`, `fecha_ingreso`, `fecha_baja`, `estado`, `pin_hash`, `nombre_usuario`, etc.) son deuda de migración y deben dejar de ser fuente de verdad.

## 8.2 `rrhh.contratos`

Mínimo:

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
sucursal_id
modalidad_contrato
created_at / created_by
activado_at / activado_by
finalizado_at / finalizado_by
updated_at
```

## 8.3 Compensación contractual

```text
rrhh.contrato_compensacion
contrato_id
company_id
salario_base
frecuencia_pago
vigencia
updated_by
```

## 8.4 Credencial de asistencia

```text
rrhh.contrato_credenciales
id
company_id
contrato_id
pin_hash
activo
creado_at/by
revocado_at/by
rotacion_numero
```

## 8.5 Jornadas

```text
rrhh.jornadas
rrhh.jornada_dias
rrhh.contrato_jornadas
rrhh.feriados
```

## 8.6 Asistencia

`rrhh.asistencia_marcas` debe incluir `contrato_id`.

Nueva capa:

```text
rrhh.asistencia_resumen_diario
```

Incluye pares, minutos trabajados, ordinarios, extra, tardanzas, descansos, incidencias y reglas aplicadas.

## 8.7 Planilla

`rrhh.planilla_detalles` debe incluir `contrato_id` y snapshots históricos de salario, modalidad, jornada, horas, movimientos, parámetros legales y total.

---

# 9. Paso Cero de permisos

Antes de tablas/UI nuevas, consultar remoto y presentar el diff de matriz.

RRHH debe evaluar permisos de contratos/credenciales de asistencia.

Transporte debe evaluar permisos de habilitación/acceso conductor, por ejemplo:

```text
flotilla.conductores.perfil.ver
flotilla.conductores.perfil.habilitar
flotilla.conductores.perfil.deshabilitar
flotilla.conductores.acceso.provisionar
flotilla.conductores.acceso.bloquear
flotilla.conductores.acceso.restablecer
flotilla.conductores.viajes.ver
flotilla.conductores.viajes.operar
```

Los nombres finales se aprueban antes de implementar.

---

# 10. FASE 1 — Cerrar RRHH

No iniciar CRM/Fabricación antes de RRHH MVP completo.

## F1.0 — Auditoría real

Verificar:

- `main`;
- Supabase remoto;
- Vercel;
- datos;
- permisos/roles;
- RPC;
- security advisors;
- migraciones existentes;
- `nombre_usuario`, `user_id`, `pin_hash`;
- `fn_validar_acceso_operativo()`;
- cualquier consumidor del diseño PIN de doble propósito.

Actualizar `IMPLEMENTATION_STATUS.md` con la realidad.

## F1.1 — Separar Expediente General/Laboral

`expedientes/nuevo` solo crea datos generales.

## F1.2 — Contratos + compensación contractual

Crear permisos aprobados, tablas, RLS, RPC, UI histórica y transiciones de contrato.

## F1.3 — PIN exclusivamente de asistencia

- generar solo al activar contrato;
- hash y retorno una vez;
- kiosko valida contrato activo;
- revocar al finalizar;
- regenerar solo con contrato activo;
- eliminar/deprecar uso de PIN como login operativo;
- mantener rate-limit/anti-enumeración.

## F1.4 — Jornadas mínimas

Jornadas, días, horarios, descanso, tolerancias, feriados y asignación contractual.

## F1.5 — Consolidación asistencia

```text
marcas → pares → contrato+jornada → cálculo → incidencias → resumen diario
```

## F1.6 — Incidencias/justificaciones

Supervisor corrige/justifica/rechaza antes de planilla cuando corresponda.

## F1.7 — Motor de planillas

Período → contratos → asistencia consolidada → compensación → parámetros legales → movimientos → snapshot → borrador/revisión/cierre.

## F1.8 — Administración de kioscos

UI para listar, crear, editar, activar/desactivar y revocar kioscos.

## F1.9 — Seguridad/RBAC/E2E

Probar roles, RLS, RPC directa, PIN inválido, contrato finalizado, kiosko inválido, rate limit y advisors.

## F1.10 — Definition of Done RRHH

```text
1 Crear Expediente General
2 Confirmar sin PIN
3 Crear contrato borrador
4 Confirmar sin PIN
5 Completar compensación/jornada
6 Activar contrato
7 Recibir PIN una vez
8 Marcar entrada
9 Marcar salida
10 Consolidar horas
11 Resolver incidencias
12 Generar planilla
13 Verificar reporte
14 Finalizar contrato
15 Confirmar PIN revocado
16 Confirmar historial intacto
17 Probar roles/denegaciones
```

---

# 11. FASE 2 — Kernel compartido + identidad operacional

- completar `@nexo/supabase`;
- completar `@nexo/auth`;
- centralizar sesión/tipos/errores;
- definir relación empleado ↔ `auth.users`;
- definir provisión/restablecimiento/bloqueo de cuentas operativas;
- eliminar dependencia de login por PIN;
- preparar contratos API Web/Mobile;
- smoke tests SSO/permisos.

---

# 12. FASE 3 — CRM MVP real

Construir:

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

```text
Lead → Oportunidad → Cotización → Pedido
```

Toda lógica reutilizable debe servir Web/Mobile sin duplicación.

---

# 13. FASE 4 — Transporte / Flotilla + Panel de Conductor

Reutilizar `apps/flotilla`; no reconstruir desde cero.

Adaptar:

- schema a `nexo-core`;
- permisos Nexo;
- Multi-Zone;
- vehículos;
- inspecciones;
- anomalías/autorizaciones;
- viajes/eventos GPS;
- evidencias;
- despachos;
- liquidaciones.

## F4.1 Identidad conductor

```text
Empleado RRHH + contrato activo
        ↓
Habilitar conductor
        ↓
crear/reutilizar auth.users
        ↓
rol/permisos Transporte
```

Eliminar identidad/persona duplicada de Ruta360.

## F4.2 Panel de Conductor Web

Login propio operacional por **usuario + contraseña**, aunque use el mismo backend Supabase Auth.

Contenido mínimo:

- viaje actual;
- vehículo;
- inspección;
- operación de viaje;
- incidencias;
- evidencias;
- historial;
- liquidaciones cuando aplique.

No exponer administración completa.

## F4.3 Primera vertical Mobile

Esta fase debe dejar operativo el primer flujo móvil real de conductor.

---

# 14. FASE 5 — Inventario mínimo

```text
productos
almacenes
existencias
movimientos
reservas
```

Movimientos trazables: entrada, salida, transferencia, reserva/liberación, consumo, producción, ajuste.

---

# 15. FASE 6 — Fabricación

Paso Cero antes de tablas/UI.

Módulos:

- productos fabricables;
- BOM versionada;
- órdenes;
- planificación;
- reservas;
- ejecución;
- consumos;
- mermas;
- calidad;
- producto terminado;
- costos;
- integraciones.

```text
Pedido → Orden → BOM → Reserva → Producción → Consumo/Merma → Calidad → Terminado
```

---

# 16. FASE 7 — Nexo Mobile consolidado Android/iOS

Aunque se prepara desde Fase 1, aquí se consolida como producto distribuible.

## NM-01 Spike técnico

Validar React Native/Expo, Supabase Auth, secure storage, navegación, cámara/GPS, offline y builds.

## NM-02 Shell operacional

- login usuario+contraseña;
- sesión segura;
- home por permisos;
- perfil;
- logout/revocación;
- actualización mínima compatible.

## NM-03 Transporte conductor

- viaje;
- inspección;
- GPS;
- cámara;
- evidencia;
- offline;
- sincronización idempotente.

## NM-04 RRHH autoservicio

- perfil;
- contrato;
- jornada;
- asistencia;
- justificaciones;
- comprobantes.

## NM-05 CRM móvil

Solo flujos de campo aprobados: clientes, oportunidades, actividades/seguimiento y acciones móviles necesarias.

## NM-06 Fabricación móvil

Órdenes, consumos, producción, merma, calidad, fotos/QR según aprobación.

## NM-07 Distribución

- package/bundle IDs;
- icono/splash;
- privacidad;
- permisos nativos;
- builds firmados;
- TestFlight;
- Google Play testing;
- estrategia de versiones.

---

# 17. FASE 8 — Integración completa

```text
CRM pedido
→ Inventario
→ Fabricación si falta
→ producto terminado
→ despacho
→ conductor con contrato activo
→ Panel Web/Mobile
→ inspección/viaje/evidencia
→ cierre entrega
→ CRM actualizado
```

---

# 18. Integraciones internas

Las UIs no escriben directamente en schemas ajenos.

Ejemplos:

```text
core.fn_confirmar_pedido(...)
core.fn_solicitar_fabricacion(...)
core.fn_cerrar_orden_fabricacion(...)
core.fn_solicitar_despacho(...)
core.fn_cerrar_entrega(...)
```

Web y Mobile consumen la misma lógica.

---

# 19. Orden definitivo

```text
FASE 1  RRHH completo + separar PIN de login
FASE 2  Kernel compartido + identidad digital operacional
FASE 3  CRM real
FASE 4  Transporte adaptado + Panel Conductor + primera vertical Mobile
FASE 5  Inventario mínimo
FASE 6  Fabricación
FASE 7  Nexo Mobile consolidado Android/iOS
FASE 8  Integración completa
```

---

# 20. Definition of Done universal

## Infraestructura

- app/schema;
- permisos/roles;
- RLS;
- Auth;
- deployment/build.

## Funcionalidad

Caso principal de punta a punta.

## Integración

No duplica fuentes de verdad y conecta módulos correctamente.

## Validación

- roles;
- sin permiso;
- seguridad;
- errores;
- auditoría;
- transacciones;
- E2E;
- documentación actualizada.

Para Mobile además:

- Android probado;
- iOS probado;
- permisos nativos;
- secure storage;
- offline/reconexión;
- sincronización idempotente.

---

# 21. Protocolo obligatorio para Claude

Antes:

1. leer `CLAUDE.md`;
2. leer este Plan;
3. leer `IMPLEMENTATION_STATUS.md`;
4. leer `DRIVER_ACCESS_AND_KIOSK.md` cuando toque RRHH/Transporte/Auth/Mobile;
5. leer documentación específica;
6. verificar remoto cuando aplique.

Comparar:

```text
PLAN
vs
MAIN
vs
MIGRACIONES
vs
BASE REMOTA
vs
DEPLOYMENT
vs
ESTADO DOCUMENTADO
```

Durante:

- ejecutar una subfase concreta;
- Paso Cero de permisos;
- no editar migraciones aplicadas;
- no duplicar identidad ni fuentes de verdad;
- lógica reutilizable Web/Mobile en RPC/servicios;
- no considerar hecho solo porque compila.

Después:

- tests/build;
- remoto verificado;
- actualizar `IMPLEMENTATION_STATUS.md`;
- actualizar docs específicos;
- actualizar ROADMAP/MODULES cuando cambie estado;
- registrar commit/migraciones/pruebas;
- commit + push de código y documentación.

---

# 22. Prioridad inmediata

```text
F1.0 Auditoría RRHH
 ↓
F1.1 Expediente General/Laboral
 ↓
F1.2 Contratos
 ↓
F1.3 PIN solo asistencia
 ↓
F1.4 Jornadas
 ↓
F1.5 Asistencia
 ↓
F1.6 Incidencias
 ↓
F1.7 Planillas
```

En paralelo conceptual, preparar la identidad digital sin implementar todavía duplicaciones:

```text
Persona
├── Contrato → PIN → Kiosko
└── auth.users → roles/permisos → Panel Conductor Web / Nexo Mobile
```

Ese es el modelo obligatorio hacia adelante.
