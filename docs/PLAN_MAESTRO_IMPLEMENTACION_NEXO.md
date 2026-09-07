# Nexo — Plan Maestro de Implementación

> **Fuente de verdad de ejecución.** Este documento define el orden de implementación de Nexo y el resultado funcional esperado de cada fase. Antes de modificar código o base de datos, comparar siempre este plan contra el estado remoto real, el código de `main` y `docs/IMPLEMENTATION_STATUS.md`.
>
> Decisión de negocio incorporada el **2026-09-06**: RRHH separa estrictamente **Expediente General** y **Expediente Laboral**. El **PIN no pertenece al alta general del empleado**: solo puede ser generado por el sistema al activar un contrato laboral válido. No puede generarse desde el expediente general ni mediante una acción independiente sobre `rrhh.empleados`.

---

## 1. Objetivo de Nexo

Nexo será una suite empresarial modular con un solo dominio, un solo login, permisos centralizados y una base de datos compartida por schemas.

Flujo operacional objetivo:

```text
CRM
  ↓
Pedido / necesidad
  ↓
Inventario ────── si hay existencia ───────────────┐
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

RRHH participa transversalmente como fuente de verdad de las personas que trabajan en la operación:

```text
RRHH
├── empleados
├── contratos
├── jornadas
├── asistencia
├── planillas
└── habilitación laboral de conductores/operadores
```

---

## 2. Arquitectura que se conserva

Se mantiene la arquitectura ya adoptada por Nexo:

- monorepo Turborepo + pnpm;
- una app Next.js por módulo en `apps/*`;
- un proyecto Vercel por app;
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

# 3. Reglas de dominio obligatorias de RRHH

Estas reglas prevalecen sobre cualquier código o documentación anterior que las contradiga.

## 3.1 Expediente General

El **Expediente General** representa a la persona/empleado y contiene información que no depende de un contrato específico.

Debe incluir, según lo que esté aprobado para el MVP:

- código interno de empleado;
- nombres;
- apellidos;
- documento de identidad;
- información de contacto;
- dirección u otros datos generales cuando se habiliten;
- información de emergencia cuando se habilite;
- documentos generales de identidad;
- datos administrativos no contractuales.

El Expediente General **NO es la fuente de verdad** de:

- puesto;
- departamento;
- sucursal laboral;
- fecha de ingreso laboral;
- fecha de salida laboral;
- modalidad contractual;
- salario;
- jornada;
- estado laboral vigente;
- PIN.

Esos datos pertenecen al Expediente Laboral/Contrato.

### Invariante

```text
Crear empleado ≠ contratar empleado
```

Debe ser posible tener un Expediente General creado sin contrato y, por tanto, sin PIN y sin permiso de marcación.

---

## 3.2 Expediente Laboral

El **Expediente Laboral** es el historial de la relación contractual del empleado con la empresa.

Un empleado puede tener múltiples contratos a lo largo del tiempo:

```text
Empleado
├── Contrato 2024 ─ finalizado
├── Contrato 2025 ─ finalizado
└── Contrato 2026 ─ vigente
```

Para el MVP, salvo decisión futura en contrario, se aplica la regla:

> Un empleado solo puede tener **un contrato activo simultáneo por empresa**.

Cada contrato debe contener o relacionar:

- número/código de contrato;
- empleado;
- empresa;
- fecha de inicio;
- fecha de finalización prevista, si aplica;
- fecha real de finalización;
- estado contractual;
- puesto;
- departamento;
- sucursal/centro de trabajo cuando se implemente;
- modalidad contractual;
- jornada/turno asignado;
- compensación aplicable;
- documentos del contrato;
- observaciones;
- auditoría de creación, activación, modificación y finalización.

Estados mínimos recomendados:

```text
borrador
   ↓
activo
   ↓
finalizado
```

Estados adicionales permitidos cuando la implementación los necesite:

- anulado: contrato en borrador cancelado antes de activarse;
- suspendido: solo si se define una regla operacional clara;
- vencido: puede derivarse por fecha o persistirse de forma controlada.

Un contrato activado no debe borrarse físicamente. La trazabilidad laboral es histórica.

---

## 3.3 Regla obligatoria del PIN

El PIN es una **credencial derivada de una relación laboral activa**, no un atributo general de la persona.

### Regla principal

```text
SIN CONTRATO ACTIVO → SIN PIN
```

### Único flujo válido de primera generación

```text
Expediente General
      ↓
Crear Contrato en borrador
      ↓
Completar datos laborales obligatorios
      ↓
Activar Contrato
      ↓
Sistema genera PIN automáticamente
      ↓
PIN se muestra en texto plano una sola vez
      ↓
Se almacena exclusivamente su hash
```

### Prohibiciones

No se permite:

- generar PIN al crear `rrhh.empleados`;
- enviar un PIN manual en `crearEmpleado`;
- generar PIN desde una pantalla general del empleado;
- mantener una función pública tipo `set_pin_empleado` que genere/asigne PIN sin `contrato_id`;
- habilitar marcación a un empleado sin contrato activo;
- conservar acceso operativo después de finalizar su contrato.

### Regeneración

Si el PIN debe regenerarse por pérdida o compromiso, la acción sigue perteneciendo al contrato:

```text
Contrato activo
   ↓
Regenerar PIN
   ↓
Invalidar credencial anterior
   ↓
Generar PIN nuevo automáticamente
```

Nunca se acepta un PIN elegido manualmente por el usuario administrativo.

La función de regeneración debe recibir `contrato_id`, comprobar que el contrato está activo y exigir el permiso correspondiente.

### Finalización de contrato

Al finalizar un contrato:

- el PIN asociado queda inmediatamente revocado;
- el empleado deja de poder marcar;
- cualquier acceso operativo dependiente del contrato deja de ser válido;
- se conserva la trazabilidad histórica del contrato y de sus marcas.

Si posteriormente existe una recontratación:

```text
Nuevo contrato → nueva credencial → nuevo PIN
```

---

## 3.4 Fuente única de verdad

Después de la migración:

| Dato | Propietario |
|---|---|
| identidad/datos generales | `rrhh.empleados` |
| relación laboral | `rrhh.contratos` |
| puesto/departamento | contrato activo |
| fecha de ingreso/salida | contrato |
| salario/modalidad | compensación del contrato |
| jornada | contrato/asignación del contrato |
| PIN | credencial del contrato |
| estado laboral | contrato activo, no `empleados.estado` |
| asistencia | marca ligada a empleado **y contrato** |
| planilla | detalle ligado a empleado **y contrato** |

No duplicar estos datos en dos tablas como fuentes paralelas.

---

# 4. Modelo de datos objetivo de RRHH

El modelo exacto se implementará mediante migraciones nuevas; nunca editar migraciones ya aplicadas.

## 4.1 `rrhh.empleados`

Debe quedar como Expediente General.

Campos laborales actuales como `puesto`, `departamento`, `fecha_ingreso`, `fecha_baja`, `estado` laboral y `pin_hash` deben considerarse **deuda de migración** y dejar de ser fuente de verdad.

La eliminación física de columnas debe hacerse solo después de:

1. verificar datos remotos reales;
2. migrar/backfillear cualquier dato existente;
3. migrar código lector/escritor;
4. validar producción;
5. ejecutar una migración posterior de limpieza.

## 4.2 `rrhh.contratos`

Nueva tabla contractual recomendada:

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
sucursal_id (cuando exista catálogo)
modalidad_contrato
created_at / created_by
activado_at / activado_by
finalizado_at / finalizado_by
updated_at
```

Debe existir un índice/constraint que impida más de un contrato activo simultáneo por empleado y empresa para el MVP.

## 4.3 `rrhh.contrato_compensacion`

La compensación sigue separada por sensibilidad, igual que el diseño actual de `empleado_compensacion`, pero debe pertenecer al contrato.

```text
contrato_id
company_id
salario_base
frecuencia_pago
otros parámetros aprobados
vigente_desde
updated_at
updated_by
```

`rrhh.empleado_compensacion` se migra/depreca después de verificar datos remotos.

## 4.4 `rrhh.contrato_credenciales`

Credencial 1:1 o versionada por contrato:

```text
id
company_id
contrato_id
pin_hash
activo
creado_at
creado_by
revocado_at
revocado_by
rotacion_numero
```

El PIN se genera solo mediante RPC de activación/regeneración contractual.

Requisito adicional: el PIN activo debe ser inequívoco dentro de la empresa para el kiosco, porque el kiosco autentica por PIN sin conocer previamente al empleado.

## 4.5 Jornadas

Mínimo necesario:

```text
rrhh.jornadas
rrhh.jornada_dias
rrhh.contrato_jornadas
rrhh.feriados
```

La jornada debe relacionarse con el contrato, no con la identidad general del empleado.

## 4.6 Asistencia

`rrhh.asistencia_marcas` debe terminar relacionando:

```text
empleado_id
contrato_id
kiosko_id
tipo
marcado_en
origen
```

Una marca válida debe resolver un **contrato activo** en el instante de marcación.

Nueva capa consolidada:

```text
rrhh.asistencia_resumen_diario
```

Mínimo por contrato/empleado/día:

- primera entrada;
- última salida;
- minutos trabajados;
- minutos ordinarios;
- minutos extra;
- minutos de tardanza;
- minutos de salida anticipada;
- descanso aplicado;
- estado/incidencias;
- versión/regla utilizada para el cálculo.

## 4.7 Planilla

`rrhh.planilla_detalles` debe incorporar `contrato_id` y snapshots suficientes para reconstruir históricamente el cálculo.

Una planilla cerrada nunca debe depender del salario o parámetros actuales para mostrar qué ocurrió en el pasado.

Snapshot mínimo recomendado:

- contrato_id;
- salario aplicado;
- modalidad aplicada;
- jornada/reglas aplicadas;
- horas ordinarias;
- horas extra;
- bonos;
- deducciones;
- parámetros legales aplicados;
- total.

---

# 5. Matriz de permisos — cambio requerido antes de código nuevo

La norma de Nexo exige Paso Cero: antes de crear tablas/UI nuevas, comparar la matriz actual con el remoto y aprobar el diff.

La implementación necesita como mínimo evaluar/agregar estos permisos:

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

Los permisos existentes de `rrhh.expedientes.compensacion.*` pueden conservar su código si su semántica se migra de compensación del empleado a compensación contractual; documentar explícitamente el cambio.

También revisar la relación de roles:

- `admin`;
- `gestor_expedientes`;
- `supervisor_asistencia`;
- `especialista_planillas`;
- `consulta`.

### Regla de aprobación

Claude debe:

1. consultar `core.permissions_catalog`, `core.app_roles` y `core.app_role_permissions` en `nexo-core`;
2. comparar contra el SQL versionado;
3. presentar el diff de matriz;
4. obtener aprobación explícita antes de aplicar la migración de permisos;
5. solo entonces crear/migrar tablas y UI.

---

# 6. FASE 1 — CERRAR RRHH

**Esta es la primera fase de ejecución. No empezar CRM/Fabricación mientras RRHH no alcance su Definition of Done.**

## F1.0 — Auditoría de realidad y baseline

Antes de tocar código:

- verificar rama `main` actual;
- revisar commits posteriores a la última documentación;
- consultar el estado remoto de `nexo-core`;
- contar filas reales de:
  - `rrhh.empleados`;
  - `rrhh.empleado_compensacion`;
  - `rrhh.asistencia_marcas`;
  - `rrhh.planillas`;
  - `rrhh.planilla_detalles`;
- verificar funciones RPC actuales;
- verificar permisos actuales;
- verificar proyecto/deployment Vercel `nexo-rrhh`;
- ejecutar o revisar security advisors;
- actualizar `docs/IMPLEMENTATION_STATUS.md` con el baseline real.

No asumir que el estado documentado el 2026-09-05 sigue siendo idéntico.

## F1.1 — Refactor de dominio: Expediente General vs Laboral

Resultado esperado:

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

El formulario `expedientes/nuevo` solo crea datos generales.

Debe desaparecer del alta general:

- salario;
- modalidad contractual;
- fecha de ingreso como atributo del empleado;
- generación/entrada de PIN;
- cualquier credencial operacional.

## F1.2 — Contratos y compensación contractual

Construir:

- matriz de permisos aprobada;
- `rrhh.contratos`;
- `rrhh.contrato_compensacion`;
- RLS;
- RPCs/Server Actions;
- UI de listado/histórico de contratos;
- crear contrato borrador;
- editar borrador;
- activar;
- finalizar/anular según estado.

Activar contrato debe ser una operación transaccional validada.

## F1.3 — PIN ligado exclusivamente al contrato

Refactor obligatorio del flujo actual.

Eliminar conceptualmente:

```text
crearEmpleado() → genera PIN
```

Reemplazar por:

```text
crearEmpleado()
  → solo expediente general

crearContrato()
  → borrador, todavía sin PIN

activarContrato()
  → valida contrato
  → genera credencial
  → genera PIN
  → muestra PIN una vez
```

Trabajo técnico:

- crear `rrhh.contrato_credenciales` o estructura equivalente aprobada;
- crear RPC `activar_contrato(...)`;
- generación automática de PIN de 4 dígitos;
- comprobar inequívocamente el PIN dentro de la empresa para credenciales activas;
- almacenar bcrypt/hash, nunca texto plano;
- devolver texto plano una sola vez;
- deprecar `rrhh.fn_set_pin_empleado` como vía independiente;
- modificar `registrar_marca_kiosko` para validar credencial + contrato activo;
- finalizar contrato revoca credencial;
- regeneración solo mediante `contrato_id` activo y permiso específico;
- tests anti-enumeración/rate-limit existentes deben seguir funcionando.

## F1.4 — Jornadas y turnos mínimos

El motor de asistencia no puede calcular correctamente tardanzas/horas extra sin jornada.

Construir:

- jornada;
- días y horas de jornada;
- descanso;
- tolerancias;
- asignación a contrato;
- feriados;
- UI mínima de configuración/asignación.

No hardcodear una jornada universal en el motor.

## F1.5 — Consolidación de asistencia

Flujo:

```text
marcas crudas
   ↓
validar pares entrada/salida
   ↓
resolver contrato + jornada
   ↓
calcular tiempo trabajado
   ↓
detectar incidencia
   ↓
resumen diario
```

Casos mínimos:

- entrada/salida correcta;
- marca impar/faltante;
- múltiples pares en un día;
- tardanza;
- salida anticipada;
- descanso;
- horas extra;
- día no laborable;
- feriado;
- contrato no vigente.

## F1.6 — Incidencias y justificaciones

Construir flujo de revisión:

```text
incidencia detectada
  ↓
supervisor
  ↓
corregir / justificar / rechazar
  ↓
día validado
```

Una planilla no debe calcularse directamente desde marcas crudas no revisadas cuando existen incidencias bloqueantes.

## F1.7 — Motor de planillas

Secuencia:

```text
crear período
  ↓
seleccionar contratos activos/aplicables
  ↓
leer asistencia consolidada
  ↓
leer compensación contractual
  ↓
leer parámetros legales vigentes
  ↓
aplicar movimientos
  ↓
generar snapshot por empleado/contrato
  ↓
borrador
  ↓
revisión/cierre
```

Debe existir:

- generación de planilla;
- movimientos (bonos, deducciones, ajustes);
- reporte por empleado;
- totales matemáticamente verificables;
- historial inmutable/snapshot suficiente.

La integración contable queda fuera del MVP mientras no exista Contabilidad.

## F1.8 — Administración de kioscos

Construir UI para:

- listar kioscos;
- crear;
- activar/desactivar;
- editar nombre/ubicación;
- revocar;
- ver estado básico.

Eliminar la necesidad operativa de insertar un kiosco mediante SQL manual.

## F1.9 — Seguridad, permisos y E2E

Validar al menos:

- admin RRHH;
- gestor de expedientes;
- supervisor de asistencia;
- especialista de planillas;
- usuario autenticado sin RRHH;
- kiosco anónimo autorizado;
- kiosco inválido;
- PIN inválido;
- PIN de contrato finalizado;
- empleado sin contrato;
- rate limiting;
- llamada RPC directa intentando evadir UI;
- RLS;
- `SECURITY DEFINER` con `search_path` fijo;
- security advisors sin nuevos hallazgos críticos.

## F1.10 — Cierre del MVP RRHH

RRHH solo se declara terminado cuando el siguiente recorrido se ejecuta de punta a punta con datos de prueba realistas:

```text
1. Crear Expediente General
2. Confirmar que NO existe PIN
3. Crear contrato borrador
4. Confirmar que TODAVÍA NO existe PIN
5. Completar compensación y jornada
6. Activar contrato
7. Recibir PIN generado una sola vez
8. Marcar entrada en kiosco
9. Marcar salida
10. Consolidar horas
11. Resolver incidencias si existen
12. Generar planilla de prueba
13. Revisar reporte y total
14. Finalizar contrato de prueba
15. Confirmar que ese PIN ya NO permite marcar/acceder
16. Confirmar historial general + laboral intacto
17. Probar roles y denegaciones
```

---

# 7. FASE 2 — Kernel compartido de Nexo

Antes de crear más apps, reducir duplicación de infraestructura.

Objetivo:

- completar `@nexo/supabase`;
- completar `@nexo/auth`;
- centralizar middleware/session refresh;
- centralizar tipos de base de datos generados;
- base `tsconfig` compartida;
- manejo homogéneo de errores de Server Actions;
- smoke tests de SSO/permisos;
- CI por aplicación;
- evitar que cada módulo copie clientes Supabase propios.

No reescribir por reescribir: migrar primero RRHH y CRM a la capa común y validar antes de eliminar wrappers locales.

---

# 8. FASE 3 — CRM MVP real

El CRM existente es hoy principalmente gestión de clientes. Evolucionarlo a:

1. clientes y contactos;
2. leads;
3. oportunidades;
4. pipeline;
5. actividades/seguimientos;
6. cotizaciones;
7. pedido comercial MVP;
8. vista 360 del cliente;
9. dashboard;
10. E2E con permisos.

Flujo:

```text
Lead → Calificado → Oportunidad → Cotización → Pedido
```

El pedido será el punto de integración con Inventario/Fabricación/Transporte.

---

# 9. FASE 4 — Transporte / Flotilla

Aprovechar `apps/flotilla`; no reconstruir desde cero.

Objetivo de adaptación:

- migrar schema al `nexo-core`;
- adoptar SSO y permisos Nexo;
- Multi-Zone `/flotilla`;
- migrar vehículos;
- inspecciones;
- anomalías/autorizaciones;
- viajes/eventos GPS;
- evidencias;
- liquidaciones;
- solicitudes de despacho.

## Regla de identidad

Transporte no vuelve a crear una persona como conductor.

```text
RRHH empleado + contrato activo
        ↓
habilitación de conductor en Transporte
```

La extensión de conductor puede almacenar datos operacionales como licencia/categorías, pero nombres, identidad y relación laboral pertenecen a RRHH.

Un conductor sin contrato laboral activo no debe iniciar un nuevo viaje.

---

# 10. FASE 5 — Inventario mínimo

Fabricación necesita una fuente real de materiales y existencias.

MVP mínimo:

```text
inventario.productos
inventario.almacenes
inventario.existencias
inventario.movimientos
inventario.reservas
```

Tipos mínimos de movimiento:

- entrada;
- salida;
- transferencia;
- reserva;
- liberación;
- consumo de fabricación;
- producción;
- ajuste.

Los movimientos deben ser trazables e inmutables o modificables solo mediante reversos controlados.

---

# 11. FASE 6 — Fabricación

No iniciar tablas/UI antes de su Matriz de Permisos aprobada.

Módulos internos:

1. dashboard;
2. productos fabricables;
3. BOM/fórmulas versionadas;
4. órdenes de fabricación;
5. planificación;
6. reserva de materiales;
7. ejecución;
8. consumos;
9. mermas;
10. control de calidad;
11. producto terminado;
12. costo estimado vs real;
13. integración CRM;
14. integración Transporte;
15. E2E.

Flujo:

```text
Pedido CRM
  ↓
Necesidad de fabricar
  ↓
Orden de fabricación
  ↓
BOM versionada
  ↓
Reserva de materia prima
  ↓
Producción
  ↓
Consumo + merma
  ↓
Calidad
  ↓
Ingreso producto terminado
  ↓
Disponible para despacho
```

El cierre de una orden debe ejecutar consumo + producción + merma + cambio de estado en una sola transacción.

---

# 12. FASE 7 — Integración completa de Nexo

Escenario de aceptación de la suite:

```text
1. CRM crea cliente
2. CRM crea oportunidad
3. CRM emite cotización
4. Cotización se acepta
5. CRM confirma pedido
6. Inventario analiza disponibilidad
7. Si falta producto, genera necesidad de fabricación
8. Fabricación reserva insumos
9. Fabricación produce
10. Calidad libera producto
11. Inventario registra producto terminado
12. Se genera solicitud de despacho
13. Transporte asigna vehículo
14. Transporte selecciona empleado/conductor con contrato RRHH activo
15. Conductor ejecuta inspección y viaje
16. Se captura evidencia de entrega
17. Transporte cierra entrega
18. CRM refleja pedido entregado
19. Auditoría permite rastrear el recorrido completo
```

---

# 13. Integraciones internas — regla técnica

Las apps no deben escribir directamente en schemas ajenos desde la UI.

Usar funciones neutrales en `core` para cambios cross-module:

```text
core.fn_confirmar_pedido(...)
core.fn_solicitar_fabricacion(...)
core.fn_cerrar_orden_fabricacion(...)
core.fn_solicitar_despacho(...)
core.fn_cerrar_entrega(...)
```

Cuando los schemas viven en el mismo Postgres, estas funciones deben aprovechar transacciones atómicas.

---

# 14. Orden definitivo

```text
FASE 1  RRHH completo
FASE 2  Kernel compartido Nexo
FASE 3  CRM real
FASE 4  Transporte adaptado
FASE 5  Inventario mínimo
FASE 6  Fabricación
FASE 7  Integración completa
```

No avanzar a la siguiente fase porque “hay muchas pantallas terminadas”. Avanzar cuando el flujo y sus criterios de aceptación estén validados.

---

# 15. Definition of Done universal de un módulo

Un módulo se declara MVP cuando cumple cuatro niveles:

## Nivel A — Infraestructura

- app;
- schema;
- permisos;
- roles;
- RLS;
- SSO;
- Multi-Zone;
- deployment.

## Nivel B — Flujo funcional

El caso de uso principal funciona de principio a fin con datos realistas.

## Nivel C — Integración

Consume y entrega datos a otros módulos sin duplicar fuentes de verdad.

## Nivel D — Validación

- admin;
- operador;
- sin permiso;
- errores;
- auditoría;
- seguridad;
- rollback/transacciones;
- pruebas E2E;
- documentación actualizada.

---

# 16. Protocolo obligatorio para Claude al ejecutar este plan

Claude debe tratar `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md` y `docs/IMPLEMENTATION_STATUS.md` como fuentes de verdad operativa.

En **cada sesión de implementación**:

## Antes de programar

1. Leer `CLAUDE.md`.
2. Leer este Plan Maestro.
3. Leer `docs/IMPLEMENTATION_STATUS.md`.
4. Leer la documentación específica del módulo.
5. Consultar el estado real remoto cuando la tarea dependa de Supabase/Vercel.
6. Comparar:

```text
PLAN ESPERADO
vs
CÓDIGO EN MAIN
vs
BASE REMOTA
vs
DEPLOYMENT
vs
ESTADO DOCUMENTADO
```

7. Si existe divergencia, corregir primero `IMPLEMENTATION_STATUS.md` con la realidad; no ejecutar basándose en una suposición antigua.

## Durante la implementación

- trabajar una subfase concreta;
- respetar Paso Cero de permisos;
- nunca editar migraciones aplicadas;
- usar migraciones nuevas;
- mantener SSO/Multi-Zones/RLS;
- no crear fuentes duplicadas de verdad;
- no marcar una tarea como terminada solo porque compila.

## Después de la implementación

Claude debe, dentro del mismo trabajo:

1. verificar build/tests aplicables;
2. verificar remoto cuando corresponda;
3. actualizar `docs/IMPLEMENTATION_STATUS.md`;
4. actualizar el documento específico del módulo si cambió su realidad;
5. actualizar `docs/ROADMAP.md`/`docs/MODULES.md` si cambió el estado del módulo;
6. registrar evidencia: fecha, commit, migración y resultado de prueba;
7. hacer commit de código **y documentación de estado**;
8. subir/push al repositorio;
9. no dejar documentación diciendo “pendiente” si ya está verificado ni “hecho” si todavía no pasó E2E.

### Regla de visibilidad de avance

Toda subfase debe reflejarse en GitHub mediante el tracker vivo. El usuario debe poder abrir el repo y saber:

- qué está terminado;
- qué está en curso;
- qué está bloqueado;
- qué falta;
- qué se verificó realmente;
- en qué commit/migración quedó.

---

# 17. Prioridad inmediata

La siguiente ejecución de Claude debe empezar exclusivamente por **F1.0 — Auditoría de realidad y baseline de RRHH** y luego **F1.1/F1.2**, no por el motor de planilla directamente.

Motivo: el modelo actual genera el PIN durante el alta de empleado y mezcla datos laborales dentro de `rrhh.empleados`. Construir horas/planilla encima de ese modelo consolidaría una relación de dominio que acaba de ser corregida.

Primero se corrige la raíz:

```text
Persona → Contrato → Credencial/PIN → Jornada → Asistencia → Planilla
```

Ese es el nuevo orden funcional obligatorio de RRHH.
