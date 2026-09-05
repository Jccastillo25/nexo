# RRHH — MVP operativo: fuente de verdad

Este documento define el **único** alcance que cuenta como "MVP de RRHH
listo": un recorrido concreto y comprobable, no una lista de features.
Mientras este recorrido no se haya ejecutado completo contra datos
reales o de prueba realistas, RRHH permanece en "en validación" en
[MODULES.md](MODULES.md) y [ROADMAP.md](ROADMAP.md), sin importar cuánta
infraestructura esté desplegada.

Última verificación contra el proyecto remoto (`nexo-core`,
`yrbjlmiqhkyxtlcerowh`) y Vercel: **2026-09-04**. Estado de datos a esa
fecha: `rrhh.empleados` = 0 filas, `rrhh.asistencia_marcas` = 0 filas,
`rrhh.planillas` = 0 filas, `rrhh.kiosko_dispositivos` = 1 fila (creada
ese día para habilitar la marcación física, todavía sin confirmar en
producción).

## Alcance del MVP

El MVP de RRHH es exclusivamente este recorrido de 6 pasos:

1. Un administrador autorizado crea un empleado con datos básicos, fecha
   de ingreso, modalidad, salario y PIN.
2. El empleado registra entrada y salida en un kiosco autorizado.
3. El sistema consolida las marcas del período en horas trabajadas.
4. Un administrador genera una planilla de prueba.
5. El informe de planilla muestra por empleado: período, entradas,
   salidas, horas calculadas, salario base, ajustes/deducciones y total
   resultante.
6. El acceso se prueba con administrador, operador autorizado y usuario
   sin permisos.

Nada fuera de esta lista es parte del MVP, aunque exista código para
ello (ver "Exclusiones" más abajo).

## Flujo, paso a paso — qué existe hoy y qué falta

| Paso | Mecanismo real | Estado |
|---|---|---|
| 1. Alta de empleado | UI `/rrhh/expedientes/nuevo` → Server Action `crearEmpleado` → RPC `crear_empleado` → `rrhh.fn_crear_empleado` (autogenera `nombre_usuario` y PIN de 4 dígitos si no se proveen; PIN se hashea con bcrypt, se muestra en texto plano una única vez) | ✅ Construido. **Sin ejecutar con un empleado real** (0 filas en `rrhh.empleados`) |
| 2. Marca en kiosco | `/rrhh/kiosco` (fuera del guard de sesión, ver `apps/rrhh/src/proxy.ts`) → Server Action `marcarAsistencia` → RPC `registrar_marca_kiosko` → `rrhh.fn_registrar_marca_kiosko` (valida PIN contra `pin_hash`, alterna entrada/salida según la última marca, inserta en `rrhh.asistencia_marcas`) | ✅ Construido, con rate-limiting básico. **Sin ejecutar de punta a punta**: requiere `NEXO_KIOSKO_ID` configurado en el proyecto Vercel `nexo-rrhh` (pendiente de confirmar tras el alta del dispositivo del 2026-09-04) y al menos un empleado con PIN real |
| 3. Consolidación de marcas → horas trabajadas | — | ❌ **No existe.** No hay función ni vista que agregue `rrhh.asistencia_marcas` (pares entrada/salida) en horas por empleado por período. Es el primer bloqueador real del MVP |
| 4. Generar planilla de prueba | `/rrhh/planillas` | ❌ **No existe.** La ruta es un placeholder explícito en el código (`apps/rrhh/src/app/(app)/planillas/page.tsx`): "Motor de planillas — pendiente de construir en un turno aparte". No hay función que inserte en `rrhh.planillas`/`rrhh.planilla_detalles` a partir de horas consolidadas + `rrhh.empleado_compensacion` + `rrhh.parametros_ley` |
| 5. Informe de planilla por empleado | — | ❌ **No existe** (depende de 3 y 4) |
| 6. Prueba de acceso con 3 roles | Permisos ya definidos y con RLS real (ver tabla de permisos abajo) | 🟡 Mecanismo listo, **prueba manual sin ejecutar** — ver checklist de pruebas |

Los pasos 3 y 4 son el trabajo pendiente real para cerrar el MVP — no es
ajuste de configuración como los pasos 1 y 2, es construir el motor de
cálculo. No se debe iniciar ese trabajo sin definir primero las
"Decisiones de negocio pendientes" de más abajo: calcular horas extra o
descuentos sin esas reglas confirmadas produce un número con apariencia
correcta que en realidad está inventado.

## Permisos involucrados

Todos ya cargados en `core.permissions_catalog` (verificado 2026-09-04),
con RLS real en las tablas correspondientes — ninguno de estos permisos
falta por crear.

| Paso | Código de permiso | Rol que lo tiene por defecto |
|---|---|---|
| Alta de empleado | `rrhh.expedientes.empleados.crear` | `admin`, `gestor_expedientes` |
| Fijar salario/modalidad al dar de alta | `rrhh.expedientes.compensacion.editar` | `admin` |
| Ver PIN generado en texto plano | `rrhh.expedientes.compensacion.ver` | `admin` |
| Ver listado de empleados | `rrhh.expedientes.empleados.ver` | `admin`, `gestor_expedientes`, `supervisor_asistencia` |
| Marca en kiosco | *(sin permiso — autenticación por PIN+kiosko_id, no por `auth.uid()`)* | n/a |
| Ver marcas de asistencia | `rrhh.asistencia.marcas.ver` | `admin`, `supervisor_asistencia` |
| Corregir una marca manual | `rrhh.asistencia.marcas.crear` / `.editar` | `admin`, `supervisor_asistencia` |
| Generar planilla (cuando exista) | `rrhh.planillas.planilla.generar` | `admin`, `especialista_planillas` |
| Ver planilla | `rrhh.planillas.planilla.ver` | `admin`, `especialista_planillas` |
| Aprobar planilla | `rrhh.planillas.planilla.aprobar` | `admin` |
| Ver el módulo en el panel | `rrhh.ver_modulo` | Todo rol de `rrhh` |

Catálogo completo (37 códigos) en `core.permissions_catalog`, dominio
`rrhh.*` — ver [PERMISSIONS.md](PERMISSIONS.md) para la norma general.

## Tablas involucradas

`rrhh.empleados`, `rrhh.empleado_compensacion`, `rrhh.kiosko_dispositivos`,
`rrhh.asistencia_marcas` (particionada), `rrhh.parametros_ley`,
`rrhh.planillas`, `rrhh.planilla_detalles`. Detalle de columnas, RLS y
funciones en [DATABASE.md](DATABASE.md#schema-rrhh--detalle-completo).
`rrhh.seguridad_accesos` no participa de este flujo (es del módulo móvil
de choferes, fuera de alcance del MVP — ver Exclusiones).

## Criterios de aceptación

El MVP se considera **listo** solo cuando, en un entorno de prueba
(nunca directo en producción con datos reales de empleados), todo lo
siguiente es verificablemente cierto al mismo tiempo:

1. Un usuario con `rrhh.expedientes.empleados.crear` da de alta un
   empleado de prueba con fecha de ingreso, modalidad de contrato,
   salario base y PIN, y el alta queda en `rrhh.empleados` +
   `rrhh.empleado_compensacion`.
2. Ese empleado marca al menos una entrada y una salida reales en
   `/rrhh/kiosco` usando su PIN, y ambas marcas quedan en
   `rrhh.asistencia_marcas` con `origen = 'kiosko'`.
3. Existe una función/vista que, dado un período, calcula las horas
   trabajadas de ese empleado a partir de sus pares entrada/salida —
   con las reglas de jornada, tolerancias y horas extra ya confirmadas
   por el usuario (no inventadas, ver más abajo).
4. Un usuario con `rrhh.planillas.planilla.generar` genera una planilla
   de prueba para ese período y ese empleado queda en
   `rrhh.planilla_detalles` con horas consolidadas correctas.
5. El reporte de esa planilla muestra, por empleado: período, hora(s)
   de entrada, hora(s) de salida, horas calculadas, salario base,
   ajustes/deducciones aplicados (aunque sean $0 en la prueba) y el
   total resultante — y ese total es matemáticamente correcto contra
   los datos de entrada.
6. Se ejecutó el checklist de acceso con los 3 roles de la sección
   siguiente y cada resultado fue el esperado.

**No se marca el MVP como listo sin haber ejecutado personalmente los 6
puntos de arriba en un entorno de prueba** — no alcanza con que el
código "debería funcionar".

## Pruebas manuales ejecutables (checklist)

Ejecutar en este orden, contra un entorno de prueba (compañía/datos de
prueba, nunca contra empleados reales hasta pasar el checklist completo):

1. **Alta con permiso correcto**: loguearse como un usuario con rol
   `admin` de `rrhh`, ir a `/rrhh/expedientes/nuevo`, crear un empleado
   de prueba. Confirmar que aparece en `/rrhh/expedientes` y que
   `rrhh.empleados`/`rrhh.empleado_compensacion` tienen la fila.
2. **Alta sin permiso de compensación**: loguearse como un usuario con
   `rrhh.expedientes.empleados.crear` pero sin
   `rrhh.expedientes.compensacion.editar`, intentar fijar salario al dar
   de alta. Confirmar que el alta falla (o se crea sin compensación,
   según lo que decida la UI) con un mensaje claro, no un error crudo de
   Postgres.
3. **Marca en kiosco — caso válido**: en `/rrhh/kiosco`, ingresar el PIN
   del empleado de prueba. Confirmar mensaje "Entrada registrada", y
   luego, en un segundo intento, "Salida registrada". Confirmar 2 filas
   en `rrhh.asistencia_marcas`.
4. **Marca en kiosco — PIN inválido**: ingresar un PIN que no existe.
   Confirmar el mensaje genérico ("PIN incorrecto o kiosko inactivo"),
   nunca un mensaje que distinga "no existe" de "PIN incorrecto" (norma
   anti-enumeración ya implementada en `fn_registrar_marca_kiosko`).
5. **Rate limit del kiosco**: intentar más de 8 marcas en menos de 60
   segundos desde el mismo dispositivo. Confirmar que el kiosko empieza
   a responder "Demasiados intentos. Esperá un minuto."
6. **Consolidación de horas** *(bloqueado hasta construir el paso 3 del
   flujo)*: con las 2 marcas del punto 3, confirmar que el cálculo de
   horas trabajadas para ese período da el valor esperado a mano.
7. **Generar planilla de prueba** *(bloqueado hasta construir el paso 4
   del flujo)*: como usuario con `rrhh.planillas.planilla.generar`,
   generar la planilla del período de prueba. Confirmar que
   `rrhh.planillas` queda en `estado = 'borrador'` y que
   `rrhh.planilla_detalles` tiene una fila para el empleado de prueba.
8. **Reporte de planilla** *(bloqueado hasta construir el paso 4)*:
   abrir el detalle de esa planilla y confirmar que muestra período,
   entradas, salidas, horas, salario base, ajustes/deducciones y total,
   y que el total es correcto a mano.
9. **Acceso — administrador**: confirmar que un usuario con rol `admin`
   de `rrhh` ve expedientes, asistencia y (cuando exista) planillas, y
   puede ejecutar cada acción de esa sección.
10. **Acceso — operador autorizado**: confirmar que un usuario con un
    rol acotado (ej. `supervisor_asistencia`, que no tiene
    `rrhh.expedientes.empleados.crear` ni `rrhh.planillas.planilla.aprobar`)
    ve asistencia pero no puede dar de alta empleados ni aprobar
    planillas — ni desde la UI (botón oculto) ni llamando la Server
    Action/RPC directamente.
11. **Acceso — usuario sin permisos**: confirmar que un usuario
    autenticado sin ningún rol de `rrhh` no ve el módulo en el panel
    (`rrhh.ver_modulo` ausente) y que, si accede a una URL de `/rrhh/*`
    a mano, recibe la pantalla de "sin acceso", no un error ni datos
    parciales.
12. **`get_advisors(type=security)` limpio de hallazgos nuevos**: correr
    el linter de seguridad de Supabase después de cualquier migración
    nueva del motor de planillas, antes de dar el MVP por cerrado.

## Exclusiones (explícitamente fuera de este MVP)

- **Módulo móvil de choferes** (`rrhh.fn_validar_acceso_operativo`,
  `rrhh.seguridad_accesos`, provisión de `auth.users` vía
  `@kiosko.internal`): la infraestructura de base ya existe (mismo PIN,
  doble propósito) pero la UI del módulo móvil y la emisión de sesión
  sin exponer password están documentadas como diseño, no construidas.
- **Aprobación de planilla y asiento contable** (`rrhh.planillas.planilla.aprobar`,
  `core.fn_aprobar_planilla`, `asiento_contable_id`): depende del schema
  `contabilidad`, que no existe todavía (Fase 2 del roadmap). El MVP
  llega hasta "planilla de prueba en borrador con su reporte", no hasta
  "planilla aprobada con asiento contable real".
- **Justificaciones de ausencia, turnos/horarios, documentos de legajo**:
  tienen permisos ya reservados en el catálogo (`rrhh.asistencia.justificaciones.*`,
  `rrhh.asistencia.turnos.*`, `rrhh.expedientes.documentos.*`) pero cero
  tablas o UI construidas — quedan para una fase posterior al MVP.
- **CRUD de kioscos desde la UI**: hoy un dispositivo nuevo se inserta
  por SQL directo (no hay pantalla de administración de
  `rrhh.kiosko_dispositivos` todavía, aunque los 4 permisos y las 4
  policies ya existen).
- **Exportación de planilla** (`rrhh.planillas.reportes.exportar`) y
  edición de movimientos individuales (`rrhh.planillas.movimientos.*`):
  el MVP pide un reporte visible, no necesariamente exportable ni con
  edición fila por fila de bonos/deducciones.

## Decisiones de negocio pendientes

**Ninguna de estas reglas está definida todavía y ninguna se inventa en
este documento ni se debe inventar al construir el motor de planillas.**
El motor de consolidación de horas y el generador de planilla no se
construyen hasta que el usuario confirme cada punto:

- **Frecuencia de pago**: ¿quincenal, mensual, ambas según el tipo de
  empleado?
- **Jornada laboral**: horas por día/semana consideradas "tiempo
  completo", y si varía por puesto o sucursal (Materiales JCastillo,
  Ferretería la Máxima, Zona Gypsum).
- **Descansos**: ¿se descuenta tiempo de almuerzo/refrigerio de las
  horas marcadas, o el empleado marca salida/entrada también para eso?
- **Tolerancias**: minutos de gracia antes de considerar una entrada
  tardía o una salida temprana como incidencia.
- **Horas extra**: umbral a partir del cual una hora cuenta como extra,
  y si el recargo difiere entre entre semana/fin de semana/feriado (la
  ley nicaragüense típicamente distingue estos casos, pero el porcentaje
  exacto a aplicar debe confirmarlo el usuario, no asumirse).
- **Feriados**: calendario de feriados nacionales/de la empresa y cómo
  afectan el cálculo (¿se paga el día aunque no se trabaje?, ¿recargo si
  se trabaja?).
- **Deducciones**: cuáles aplican por defecto en cada corrida (INSS
  laboral ya está parametrizado en `rrhh.parametros_ley` con 7%, pero
  **ese valor y el de INATEC/INSS patronal deben confirmarse como los
  oficiales vigentes, no darse por buenos solo porque están sembrados**
  — y `techo_inss` está sembrado con un valor de ejemplo, `100000.00`,
  explícitamente marcado como no verificado en el código
  ([`20260902000008`](../supabase/migrations/20260902000008_rrhh_nicaragua_and_contracts.sql)
  línea ~57)).
- **Fórmula de nómina exacta**: cómo se combinan salario base + horas
  extra + bonos − deducciones para el `total` de `rrhh.planilla_detalles`,
  y cómo se trata la modalidad `comisionista_destajo` (variable, no
  salario fijo) frente a `nomina_estandar`.

## Riesgos de seguridad antes de producción

Auditoría obligatoria de cada función `SECURITY DEFINER` del schema
`rrhh` antes de dar el MVP por listo para producción real (no solo para
un entorno de prueba). Hallazgos ya confirmados con
`get_advisors(type=security)` el 2026-09-04 — ver detalle en
[DATABASE.md](DATABASE.md#riesgos-de-seguridad-detectados-pendientes-de-resolver-antes-de-producción):

1. **`rrhh.fn_crear_empleado` y `rrhh.fn_set_pin_empleado` son
   ejecutables directamente por `anon`** a nivel de `GRANT` de Postgres,
   pese a que sus wrappers en `public` sí revocan ese acceso. Mitigado en
   la práctica por el chequeo interno de `core.has_permission()`, pero es
   una capa de defensa menos de la que el diseño pretende tener.
   **Acción pendiente**: `REVOKE EXECUTE ... FROM anon` explícito en
   ambas funciones del schema `rrhh`, en una migración dedicada.
2. **Privilegios de ejecución de cada función deben quedar así, y no
   más amplios**:
   - `anon` — solo `fn_registrar_marca_kiosko` y
     `fn_validar_acceso_operativo` (autenticación por credencial física,
     sin `auth.uid()`, por diseño).
   - `authenticated` con permiso interno verificado — `fn_crear_empleado`,
     `fn_set_pin_empleado`.
   - Nadie más debería tener `EXECUTE` sobre ninguna función interna del
     schema `rrhh`.
3. **`search_path`**: todas las funciones `SECURITY DEFINER` de `rrhh`
   ya fijan `search_path` explícito (`set search_path = rrhh, ...`) —
   confirmado, no es un hallazgo pendiente, pero **cualquier función
   nueva del motor de planillas debe seguir el mismo patrón desde su
   creación**, nunca agregarlo como fix posterior.
4. **Verificación de permisos dentro de cada función, no solo en la
   RLS de la tabla**: las funciones que hacen `INSERT`/`UPDATE` como
   `SECURITY DEFINER` (que bypasean la policy de RLS de la tabla porque
   corren como el dueño de la función) deben seguir llamando a
   `core.has_permission(auth.uid(), ...)` puertas adentro — es la única
   capa de control real para esos casos. El motor de planillas que se
   construya debe respetar exactamente este patrón.
5. **Protección del PIN**: confirmado — nunca se guarda en texto plano
   (`pin_hash`, bcrypt vía `pgcrypto`), y el único momento en que existe
   en texto plano es el valor de retorno de `fn_crear_empleado`/UI
   inmediatamente después del alta (gateado por
   `rrhh.expedientes.compensacion.ver`). Verificar que ningún log de
   servidor (Vercel `get_runtime_logs`) imprima el PIN en texto plano —
   no auditado todavía.
6. **Acceso directo a particiones**: cada partición mensual de
   `rrhh.asistencia_marcas`/`rrhh.seguridad_accesos` se crea con RLS
   habilitado (confirmado, `get_advisors` no reporta ninguna partición
   sin RLS más allá del "sin policy" esperado en `seguridad_accesos`) —
   pero las particiones **heredan las policies de la tabla padre**
   automáticamente en Postgres; confirmar explícitamente (no asumido en
   esta auditoría) que una policy modificada en la tabla padre se refleja
   en las particiones ya creadas antes de depender de esto en producción.
7. **El kiosco anónimo debe mantenerse limitado a registrar marcas, sin
   exponer datos personales**: `fn_registrar_marca_kiosko` hoy devuelve
   `empleado_nombre` (nombre completo) en la respuesta — es el mínimo
   necesario para el feedback visual del kiosko ("Juan Pérez — Entrada
   registrada"), pero es un dato personal expuesto sin autenticación.
   Confirmar con el usuario si ese nivel de exposición es aceptable para
   el MVP o si el feedback debe reducirse (ej. sin apellido, o sin
   nombre en absoluto).
8. **`auth_leaked_password_protection` deshabilitado** a nivel de
   proyecto — no específico de RRHH, pero afecta a cualquier cuenta
   administrativa que use este módulo. Activar antes de producción real.

Ninguno de estos 8 puntos se corrigió al escribir este documento — es
una lista de auditoría pendiente, no un checklist ya resuelto.
