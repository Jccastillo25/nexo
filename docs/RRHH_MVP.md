# RRHH — MVP operativo: fuente de verdad

> Actualizado **2026-09-08** (fix de estabilización — expedientes, contratos, jornadas y navegación, sección 16; antes F1.4 — jornadas mínimas). Este documento define qué significa “RRHH MVP listo”. Debe leerse junto a `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`, `IMPLEMENTATION_STATUS.md` y `DRIVER_ACCESS_AND_KIOSK.md`.

RRHH no se considera terminado por cantidad de pantallas ni por infraestructura desplegada. Debe ejecutarse de punta a punta el flujo aprobado.

---

# 1. Estado conocido antes del refactor

Última verificación remota documentada previa a esta decisión: **2026-09-05**.

- `rrhh.empleados`: 0 filas;
- `rrhh.asistencia_marcas`: 0 filas;
- `rrhh.planillas`: 0 filas;
- `rrhh.kiosko_dispositivos`: 1 fila;
- kiosko accesible sin sesión Web;
- rate-limit persistente implementado;
- seguridad de RPC reforzada;
- motor marcas → horas: no existe;
- motor de planillas: no existe;
- `/rrhh/planillas`: placeholder.

La siguiente sesión debe verificar que este estado siga siendo real antes de migrar.

**Re-verificado en F1.0 (2026-09-07, `docs/IMPLEMENTATION_STATUS.md` sección 0):** sigue siendo exacto — 0 filas en `empleados`/`asistencia_marcas`/`planillas`/`empleado_compensacion`/`seguridad_accesos`, 1 fila en `kiosko_dispositivos`. Se agrega un hallazgo nuevo no listado arriba: `public.validar_acceso_operativo` (PIN de doble propósito, sección 10 de `DRIVER_ACCESS_AND_KIOSK.md`) sigue con `EXECUTE` concedido a `anon`/`authenticated` en producción, sin ningún consumidor real en el código — ver `IMPLEMENTATION_STATUS.md` 0.6/D-06.

---

# 2. Decisiones de dominio vigentes

## 2.1 Expediente General ≠ Expediente Laboral

```text
Expediente General
= identidad/datos personales

Expediente Laboral
= contratos + puesto + salario + jornada + documentos laborales
```

Crear empleado no significa contratarlo.

## 2.2 PIN

**✅ F1.3 cumplida (2026-09-07)** — verificado end-to-end real, ver `IMPLEMENTATION_STATUS.md` sección 0.13.

```text
SIN CONTRATO ACTIVO → SIN PIN
```

El PIN:

- se genera automáticamente al activar contrato (`rrhh.fn_activar_contrato`);
- se muestra una sola vez;
- se guarda solo como hash (`rrhh.contrato_credenciales`, sin `GRANT` de `SELECT` a nadie);
- se usa exclusivamente para asistencia en kiosko (`rrhh.fn_registrar_marca_kiosko`, reescrita para validar contra la credencial contractual);
- se revoca al finalizar contrato (`rrhh.fn_finalizar_contrato`);
- se regenera solo sobre un contrato activo (`rrhh.fn_regenerar_pin_contrato`);
- no es contraseña Web/Mobile;
- no crea sesión Supabase Auth.

## 2.3 Identidad digital

El empleado puede tener una identidad digital Nexo separada del PIN:

```text
usuario + contraseña → Supabase Auth
```

Esa identidad puede servir a RRHH autoservicio, Panel de Conductor Web, Nexo Mobile u otros módulos según permisos.

Fuente detallada: [`DRIVER_ACCESS_AND_KIOSK.md`](DRIVER_ACCESS_AND_KIOSK.md).

---

# 3. Flujo MVP aprobado

El recorrido obligatorio ahora es:

```text
1. Crear Expediente General
2. Confirmar que NO existe PIN
3. Crear contrato en borrador
4. Completar datos laborales, compensación y jornada
5. Confirmar que todavía NO existe PIN
6. Activar contrato
7. Sistema genera PIN automáticamente y lo muestra una vez
8. Empleado marca entrada en kiosko
9. Empleado marca salida
10. Sistema consolida marcas en horas
11. Resolver incidencias si existen
12. Generar planilla de prueba
13. Ver reporte por empleado y validar total
14. Finalizar contrato
15. Confirmar que el PIN dejó de funcionar
16. Confirmar historial intacto
17. Probar roles, RLS y denegaciones
```

Nada sustituye este E2E.

---

# 4. Qué debe existir

## 4.1 Expediente General

**✅ F1.1 cumplida (2026-09-07)**: `/rrhh/expedientes/nuevo` ya solo pide nombre, apellido, documento, correo y teléfono — sin salario, modalidad, fecha de ingreso, PIN ni credencial. Ver `IMPLEMENTATION_STATUS.md` sección 0.11. La UI de expediente individual con pestañas (Datos generales / Expediente laboral / Historial) de abajo sigue pendiente — hoy solo existe el listado y el alta.

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

`/rrhh/expedientes/nuevo` crea solo datos generales.

No debe pedir:

- salario;
- modalidad contractual;
- fecha de ingreso laboral;
- PIN;
- credencial operacional.

## 4.2 Contratos

**✅ F1.2 cumplida (2026-09-07)**: `rrhh.contratos` con exactamente este ciclo, ver `IMPLEMENTATION_STATUS.md` sección 0.12.

Mínimo:

```text
borrador → activo → finalizado
```

Un contrato activo simultáneo por empleado/empresa para el MVP — **enforced por un unique index parcial**, no solo por convención de UI.

Debe conservar historial y no borrarse físicamente luego de activación — **sin policy de `DELETE`** en `rrhh.contratos`.

## 4.3 Compensación contractual

**✅ F1.2 cumplida**: `rrhh.contrato_compensacion`, 1:1 con el contrato.

La compensación pertenece al contrato, no a la identidad general del empleado.

## 4.4 Jornada

**✅ F1.4 cumplida (2026-09-07)**: modelo mínimo de 4 tablas —
`rrhh.jornadas` (plantilla), `rrhh.jornada_dias` (reglas por día),
`rrhh.contrato_jornadas` (asignación al contrato, con histórico por
vigencia) y `rrhh.feriados` (calendario). Un contrato **no puede
activarse sin una jornada asignada** (decisión explícita del usuario,
`rrhh.fn_activar_contrato`). Ver `IMPLEMENTATION_STATUS.md` sección 0.14.

El contrato tiene jornada/asignación suficiente para **resolver** (no
todavía calcular — eso es F1.5):

- ordinarias (horario por día, un único bloque entrada/salida);
- descanso (minutos por día);
- tolerancias (entrada/salida, en minutos, por día);
- feriados/no laborables (catálogo `rrhh.feriados`, día no laborable
  vía `jornada_dias.laborable = false`).

No hardcodeada — `rrhh.jornadas` permite múltiples plantillas por
empresa. **Explícitamente sin implementar en F1.4** (decisión de negocio
pendiente, no inventada): tardanza/hora extra (regla de cálculo), pago de
feriado, nocturnidad, doble turno, jornada especial, redondeos, turnos
que cruzan medianoche. Ver sección 14 de este documento.

**Nexo Enterprise UI (2026-09-07)**: la pantalla se separó en dos rutas —
`/jornadas` (plantillas) y `/feriados` (calendario) — para reflejar el
árbol de navegación "Contratación → Jornadas / Feriados". Mismos
componentes/RPC/RLS de F1.4, sin cambios de lógica ni de DB;
`feriados-panel.tsx` se reutiliza desde la carpeta `jornadas/` en vez de
duplicarse.

---

# 5. Kiosko

El kiosko mantiene una ruta pública respecto a la sesión Web, pero el dispositivo debe estar autorizado.

```text
Kiosko autorizado
→ PIN contractual
→ contrato activo
→ determinar entrada/salida
→ registrar marca
```

## 5.1 Determinación entrada/salida

Cuando el estado sea inequívoco:

```text
sin entrada abierta → ENTRADA
con entrada abierta → SALIDA
```

Si existe una secuencia anómala, crear incidencia en vez de inventar una transición.

## 5.2 Seguridad

Mantener:

- hash del PIN;
- mensajes anti-enumeración;
- rate limit persistente;
- validación de kiosko activo;
- validación de contrato activo;
- `SECURITY DEFINER` endurecido;
- `search_path` fijo.

---

# 6. Consolidación de asistencia

Debe existir una capa calculada, por ejemplo `rrhh.asistencia_resumen_diario`.

Flujo:

```text
marcas crudas
→ pares entrada/salida
→ contrato + jornada
→ minutos trabajados
→ ordinarias/extra/tardanza/etc.
→ incidencias
→ resumen validable
```

Casos mínimos:

- entrada/salida correcta;
- múltiples pares;
- marca faltante;
- tardanza;
- salida anticipada;
- descanso;
- horas extra;
- feriado;
- día no laborable;
- contrato no vigente.

---

# 7. Incidencias y justificaciones

```text
incidencia detectada
→ supervisor
→ corregir / justificar / rechazar
→ día validado
```

Una planilla no debe usar silenciosamente marcas anómalas como si fueran correctas.

---

# 8. Planillas

Motor objetivo:

```text
período
→ contratos aplicables
→ asistencia consolidada
→ compensación contractual
→ parámetros legales vigentes
→ bonos/deducciones/ajustes
→ snapshot
→ borrador
→ revisión/cierre
```

Reporte por empleado debe permitir comprobar:

- período;
- contrato;
- marcas/resumen;
- horas ordinarias/extra;
- salario aplicado;
- movimientos;
- parámetros legales;
- total.

Una planilla histórica no debe recalcularse usando datos actuales.

Integración contable queda fuera mientras no exista Contabilidad.

---

# 9. Permisos

**Paso Cero cumplido (2026-09-07)**, antes de crear ninguna tabla/UI de F1.1–F1.3 — ver `IMPLEMENTATION_STATUS.md` sección 0.10 y `docs/MIGRATION_LOG.md`. Migración `20260907151643_rrhh_contratos_permission_matrix`, 7 códigos nuevos ya en `core.permissions_catalog` (dominio `expedientes` reutilizado, no uno nuevo):

```text
rrhh.expedientes.contratos.ver
rrhh.expedientes.contratos.crear
rrhh.expedientes.contratos.editar
rrhh.expedientes.contratos.activar
rrhh.expedientes.contratos.finalizar
rrhh.expedientes.credenciales.ver
rrhh.expedientes.credenciales.regenerar
```

Asignación ya aplicada en `core.app_role_permissions`:

| Permiso | admin | gestor_expedientes | supervisor_asistencia | especialista_planillas | consulta |
|---|---:|---:|---:|---:|---:|
| contratos.ver | ✅ | ✅ | — | — | — |
| contratos.crear | ✅ | ✅ | — | — | — |
| contratos.editar | ✅ | ✅ | — | — | — |
| contratos.activar | ✅ | — | — | — | — |
| contratos.finalizar | ✅ | — | — | — | — |
| credenciales.ver | ✅ | ✅ | ✅ | — | — |
| credenciales.regenerar | ✅ | — | — | — | — |

`credenciales.ver` es exclusivamente estado de la credencial (activa/bloqueada) — nunca el PIN en texto plano; el PIN se muestra una única vez, en `contratos.activar` o `credenciales.regenerar`.

**Paso Cero de F1.4 (2026-09-07)**: único código nuevo,
`rrhh.asistencia.feriados.{ver,crear,editar,eliminar}`. Reutiliza sin
cambios `rrhh.asistencia.turnos.*` (ya existían desde la matriz original,
sin consumidor hasta ahora) para `rrhh.jornadas`/`rrhh.jornada_dias`, y
`rrhh.expedientes.contratos.editar` para asignar jornada a un contrato.

| Permiso | admin | gestor_expedientes | supervisor_asistencia | especialista_planillas | consulta |
|---|---:|---:|---:|---:|---:|
| asistencia.turnos.ver (jornadas) | ✅ | ⚠️ ver nota | ✅ | — | ✅ |
| asistencia.turnos.crear/editar/eliminar | ✅ | — | ✅ | — | — |
| asistencia.feriados.ver | ✅ | — | ✅ | — | ✅ |
| asistencia.feriados.crear/editar/eliminar | ✅ | — | ✅ | — | — |
| expedientes.contratos.editar (asignar jornada al contrato) | ✅ | ✅ | — | — | — |

⚠️ **Gap detectado al construir la UI, señalado, no cerrado en esta
sesión**: `gestor_expedientes` completa la jornada del contrato (flujo
aprobado) con `contratos.editar`, pero no tiene `turnos.ver` — no puede
ver el listado de jornadas disponibles para elegir en el selector.
Extender `turnos.ver` (solo lectura) a `gestor_expedientes` es candidato
de fast-follow, pendiente de aprobación aparte (no formaba parte del
diff de Paso Cero aprobado para F1.4).

Los permisos actuales de compensación pueden conservar nomenclatura si se documenta su semántica contractual.

Identidad digital (`core.identidad.cuenta.*`) y habilitación de conductor (`flotilla.conductores.*`) quedan como diseño objetivo documentado, sin implementar — no forman parte del Paso Cero de RRHH ni del cierre de F1.1–F1.3. Ver `IMPLEMENTATION_STATUS.md` sección 0.10.

---

# 10. Deuda heredada que debe migrarse

Actualizado 2026-09-07 tras F1.0.1-F1.3 — ver `IMPLEMENTATION_STATUS.md` secciones 0.9/0.11/0.12/0.13:

- ✅ `fn_crear_empleado` ya NO genera PIN ni acepta puesto/departamento/modalidad/salario (F1.1) — columnas correspondientes en `rrhh.empleados` quedan nullable y `DEPRECADAS` vía `comment on column`, sin eliminarse todavía.
- ✅ `public.validar_acceso_operativo` ya NO es ejecutable por `anon`/`authenticated` (F1.0.1) — `rrhh.fn_validar_acceso_operativo()` y su wrapper quedan `DEPRECADAS`, sin eliminarse todavía.
- ✅ `rrhh.empleado_compensacion` 1:1 con empleado — reemplazada por `rrhh.contrato_compensacion` 1:1 con el contrato (F1.2). La tabla vieja sigue existiendo sin datos, pendiente de limpieza posterior.
- ✅ **`rrhh.fn_registrar_marca_kiosko` (el kiosko real) ya NO lee `rrhh.empleados.pin_hash/estado/pin_bloqueado`** (F1.3) — valida contra `rrhh.contrato_credenciales`. Esas columnas de `rrhh.empleados` quedan sin ningún consumidor real, en cualquier función, por primera vez.
- ⏳ `nombre_usuario`/`user_id`/`pin_hash`/`pin_bloqueado`/`intentos_fallidos` de `rrhh.empleados`, y `rrhh.empleado_compensacion`/`rrhh.fn_validar_acceso_operativo`/`rrhh.fn_set_pin_empleado` siguen existiendo físicamente, ya sin ningún consumidor — su eliminación real queda para una migración de limpieza posterior (no crítica, no bloquea F1.4).

Ninguna migración aplicada fue editada — todos los cambios de arriba se hicieron con migraciones nuevas.

Se corrigen con migraciones nuevas, backfill si existe información y deprecación progresiva.

El diseño de **PIN de doble propósito** queda rechazado como arquitectura final.

---

# 11. Panel de Conductor y RRHH

El Panel de Conductor no forma parte del cierre funcional de planillas, pero RRHH debe dejar preparado su modelo correcto:

```text
Empleado
├── Contrato → PIN asistencia
└── Identidad digital → usuario+contraseña
```

Cuando Transporte habilite al empleado como conductor:

```text
contrato activo
→ habilitación conductor
→ crear/reutilizar auth.users
→ permisos Transporte
```

No debe crearse un segundo usuario si ya existe identidad digital Nexo.

---

# 12. Checklist E2E RRHH

Pasos 1-9 **✅ verificados end-to-end real el 2026-09-07** (F1.1-F1.4, ver `IMPLEMENTATION_STATUS.md` secciones 0.13/0.14 para el detalle exacto — incluye el paso adicional de regenerar PIN, no listado originalmente aquí, y la jornada obligatoria de F1.4). Pasos 10-13 (consolidación/incidencias/planilla) son de F1.5 en adelante, todavía no construidos. Pasos 17-21 verificados solo parcialmente (ver nota abajo).

1. Crear expediente general sin PIN. ✅
2. Crear contrato borrador sin PIN. ✅
3. Intentar marcar antes de activar: debe fallar. ✅ (sin credencial, `fn_registrar_marca_kiosko` no encuentra match)
4. Completar jornada/compensación. ✅ compensación (F1.2) y jornada (F1.4) — activar rechaza sin jornada asignada
5. Activar contrato y recibir PIN una sola vez. ✅
6. PIN inválido: error genérico. ✅ (mensaje anti-enumeración sin cambios desde 2026-09-05)
7. PIN válido: entrada. ✅
8. Segundo PIN válido: salida. ✅
9. Verificar marcas con contrato correcto. ✅ (marcas quedan bajo el `empleado_id` correcto; `contrato_id` en `asistencia_marcas` sigue pendiente de F1.5, ver D-04 — F1.4 ya deja `rrhh.fn_jornada_vigente_contrato` como interfaz de resolución contrato+fecha→jornada para cuando F1.5 la use)
10. Consolidar horas y comprobar manualmente. ⏳ F1.5
11. Probar una incidencia. ⏳ F1.6
12. Generar planilla de prueba. ⏳ F1.7
13. Verificar total manualmente. ⏳ F1.7
14. Finalizar contrato. ✅
15. Intentar usar PIN anterior: debe fallar. ✅
16. Verificar historial intacto. ✅ (contrato queda `finalizado`, nunca se borra; marcas conservadas)
17. Probar admin. ✅ (vía `owner`, bypass equivalente)
18. Probar supervisor asistencia. ⚠️ no probado con una sesión real de ese rol específico — ver nota de `IMPLEMENTATION_STATUS.md` sección 0.13
19. Probar especialista planillas. ⚠️ mismo alcance que 18
20. Probar usuario sin permiso. ✅ (usuario sin ninguna fila de permiso, rechazado)
21. Probar llamada RPC directa intentando evadir UI. ✅ (todas las pruebas de F1.3 SON llamadas RPC directas, sin pasar por ninguna UI)
22. Ejecutar security advisors. ✅ sin exposición nueva a `anon`

---

# 13. Definition of Done

RRHH solo pasa a `✅ MVP listo` cuando:

- expediente general/laboral están separados;
- contrato gobierna estado laboral;
- PIN es contractual y solo de asistencia;
- jornada funciona;
- marcas se consolidan;
- incidencias pueden resolverse;
- planilla se genera y reporta correctamente;
- historial es reproducible;
- permisos/RLS se validan;
- contrato finalizado revoca PIN;
- documentación y remoto coinciden.

---

# 14. Decisiones de negocio pendientes (jornadas, F1.4)

**No inventadas por Claude** — el modelo de F1.4 quedó parametrizable
precisamente para no asumir ninguna de estas reglas sin que Materiales
J Castillo las confirme. Bloquean F1.5/F1.6/F1.7, no F1.4:

- cantidad de horas semanales "estándar" (para saber qué es hora extra);
- tolerancia universal (hoy es por día/jornada, sin un default de empresa);
- descanso universal (hoy es por día/jornada, sin un mínimo legal fijado);
- regla de cálculo de hora extra (recargo, tope diario/semanal);
- si un feriado se paga, y cómo (`rrhh.feriados` no tiene columna de tipo
  ni de pago a propósito — se agrega cuando se defina la regla);
- nocturnidad (recargo por horario nocturno);
- doble turno / jornada especial;
- redondeos de marca (¿se redondea a favor de quién, en qué intervalo?);
- turnos que cruzan medianoche (`rrhh.jornada_dias` modela un único
  bloque por día calendario — no soporta esto todavía);
- horario partido (2+ bloques por día) — hoy un único bloque
  entrada/salida por día, ver `rrhh.jornada_dias`.

Cuando se confirme cualquiera de estas reglas, se implementa con una
migración nueva (nunca editando `rrhh.jornada_dias`/`rrhh.feriados` para
"forzar" el caso) y se actualiza esta sección.

Hasta entonces permanece **en validación / en progreso**.

# 15. Decisiones de negocio pendientes (perfil ampliado y KPIs, Nexo Enterprise UI)

**No inventadas ni construidas por Claude** — quedaron explícitamente
fuera del commit de rediseño visual (2026-09-07) porque requieren tablas/
Storage/permisos que todavía no existen, y el propio rediseño no debía
mezclar UI/navegación con schema nuevo:

- **Catálogo Nicaragua (departamento/municipio)**: no existe ningún
  catálogo de geografía en `core` — el `departamento` actual de
  `rrhh.contratos` es texto libre y significa "departamento de trabajo"
  (ej. "Ventas"), no departamento administrativo de Nicaragua. Un
  catálogo real necesita su propia Paso Cero (¿vive en `core` para que
  otros módulos lo reutilicen? ¿se carga con un seed fijo de los 15
  departamentos/153 municipios oficiales?).
- **Perfil de empleado ampliado**: dirección estructurada, familiares,
  contacto de emergencia, tallas de uniforme, licencia (número/
  categorías/fechas/documento), cuentas bancarias, beneficiario,
  documentos adjuntos (cédula, INSS). Ninguno de estos campos/tablas
  existe en `rrhh.empleados` hoy. Las pestañas correspondientes en
  `/expedientes/[id]` (`FormTabs`) están preparadas y deshabilitadas con
  un `EmptyState` explícito — no hay datos inventados ni columnas nuevas
  todavía.
- **Documentos/Storage de RRHH**: no existe ningún bucket de Storage para
  documentos de empleado (cédula, INSS, licencia) — el único bucket real
  hoy es `platform-assets` (marca de Nexo, no RRHH). Necesita su propia
  decisión de privacidad (¿público o firmado?) antes de construirse.
- **KPIs cruzados del dashboard de Nexo** (empleados/clientes/viajes en
  un solo panel): cada dato vive en el schema de su propio módulo: una
  agregación real requeriría una RPC nueva por módulo (o una vista
  materializada en `core`), con su propio análisis de permisos —
  fuera de alcance de un cambio "solo visual". El dashboard de Nexo hoy
  muestra "Pendiente de integración" en vez de inventar un número.

Cuando se apruebe cualquiera de estas decisiones, se documenta la Paso
Cero correspondiente (matriz de permisos si aplica + modelo de datos)
antes de escribir la migración — mismo criterio que el resto de este
documento.

---

# 16. Fix de estabilización — expedientes, contratos, jornadas y navegación (2026-09-08)

Bloque de correcciones pedido explícitamente después de Nexo Enterprise UI
(2026-09-07), **sin iniciar F1.5**. Sin cambios de modelo de datos ni de
reglas de dominio — solo navegación, UI y un bug real de producción. Ver
`docs/IMPLEMENTATION_STATUS.md` para el detalle técnico completo (causa
raíz, migraciones — ninguna en este bloque — y verificación).

- **Bug P0 real (no hipotético)**: `/rrhh/expedientes/[id]` devolvía 500 en
  producción para cualquier usuario, siempre — causa raíz: `FormTabs`
  (`packages/ui`) recibía una función como `children` desde un Server
  Component, algo que React/Next.js rechaza en runtime al cruzar la
  frontera Server→Client. Confirmado con `get_runtime_errors` de Vercel
  antes de tocar código (8 ocurrencias, 2 usuarios, mismo día). El click en
  un empleado desde Contratación → Contratos compartía la misma causa (solo
  navegaba a la misma página rota).
- El Expediente Laboral (contratos/compensación/credencial/jornada) ahora
  es una sección aislada dentro de `/expedientes/[id]`: si falla, se
  muestra un error contenido sin tumbar el resto de la ficha (perfil, datos
  generales).
- **Nueva ruta mínima `/rrhh/contratacion/contratos/[id]`** (ficha de un
  contrato): separa "ver/editar un contrato puntual" (👁/✎ desde el listado
  de Contratos) de "ir al expediente del empleado" (click en el nombre).
  Permite editar los datos base de un contrato en borrador y asignar su
  jornada — mismas Server Actions/RPC que ya existían
  (`editarContrato`/`asignarJornada`), sin lógica de negocio nueva. El
  ciclo de vida completo (crear/activar/finalizar/regenerar PIN) sigue
  viviendo únicamente en el expediente del empleado, sin cambios.
- Texto de `/jornadas` corregido: ya no dice que la asignación de jornada
  "se hace desde el expediente del empleado" (dejó de ser exacto — perfil y
  contratación son procesos separados).
- Acciones visibles (👁 ✎ 🗑, con tooltip/foco/`aria-label`) reemplazan el
  menú "⋯" en Expedientes y se agregan en Contratos — componente nuevo
  compartido `packages/ui/RowActionIcons.tsx`.
- Eliminar empleado: la validación de backend (¿tiene algún contrato,
  cualquier estado?) ya existía desde el rediseño de Enterprise UI — este
  bloque agrega la señal preventiva en la UI (papelera deshabilitada +
  tooltip) para no depender solo del mensaje de error después del click.
- Rendimiento de navegación: consultas independientes de `/expedientes/[id]`
  (antes en cascada) ahora van en paralelo; se eliminó un round-trip
  redundante (la Server Action `verEstadoCredencial` repetía el mismo
  chequeo de permiso que la página ya había resuelto); `(app)/layout.tsx`
  ya no espera el permiso de módulo antes de pedir usuario/panel/logo.
  `loading.tsx` agregado a las rutas más pesadas (Suspense boundary de
  Next.js — feedback inmediato, no reemplaza la optimización real).
- Sidebar: el grupo activo ahora se re-sincroniza con la URL en cada
  navegación (antes solo se calculaba al montar) — un link a una hoja de
  otro grupo (ej. desde Contratos) ya no deja el acordeón correcto
  colapsado.
- Logo dinámico (`core.platform_settings.logo_url`, configurado en Nexo →
  Configuración → Marca) en el topbar de RRHH, con fallback al wordmark de
  Nexo si no hay logo configurado.

**Deuda/hallazgo nuevo, documentado, no resuelto en este bloque**: no
existe ningún formulario/RPC de edición del Expediente General (solo
alta, F1.1) — el ícono "Editar" de Expedientes navega hoy al mismo
`/expedientes/[id]` de solo lectura que "Visualizar". Construir edición
real requiere su propia decisión de campos editables y, si aplica, un RPC
nuevo — fuera de alcance de este bloque (solo navegación/visualización).
Además, `/rrhh/dashboard` mostró 3 veces en 4 días un error intermitente
con mensaje vacío (`get_runtime_errors`, última vez 2026-09-08) — no se
pudo establecer causa raíz con la evidencia disponible (no reproducible a
demanda); se mejoró la observabilidad (el error ya no se descarta si viene
sin `.message`) para diagnosticarlo la próxima vez que ocurra.
