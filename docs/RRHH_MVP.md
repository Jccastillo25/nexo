# RRHH — MVP operativo: fuente de verdad

> Actualizado **2026-09-06**. Este documento define qué significa “RRHH MVP listo”. Debe leerse junto a `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`, `IMPLEMENTATION_STATUS.md` y `DRIVER_ACCESS_AND_KIOSK.md`.

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

```text
SIN CONTRATO ACTIVO → SIN PIN
```

El PIN:

- se genera automáticamente al activar contrato;
- se muestra una sola vez;
- se guarda solo como hash;
- se usa exclusivamente para asistencia en kiosko;
- se revoca al finalizar contrato;
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

Mínimo:

```text
borrador → activo → finalizado
```

Un contrato activo simultáneo por empleado/empresa para el MVP.

Debe conservar historial y no borrarse físicamente luego de activación.

## 4.3 Compensación contractual

La compensación pertenece al contrato, no a la identidad general del empleado.

## 4.4 Jornada

El contrato debe tener jornada/asignación suficiente para calcular:

- ordinarias;
- descanso;
- tolerancias;
- tardanza;
- horas extra;
- feriados/no laborables.

No hardcodear una jornada universal.

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

Paso Cero obligatorio antes de las nuevas tablas/UI.

Evaluar/agregar permisos de:

```text
rrhh.expedientes.contratos.*
rrhh.expedientes.credenciales.*
```

Los permisos actuales de compensación pueden conservar nomenclatura si se documenta su semántica contractual.

Roles a validar:

- admin;
- gestor_expedientes;
- supervisor_asistencia;
- especialista_planillas;
- consulta;
- usuario sin RRHH.

---

# 10. Deuda heredada que debe migrarse

El código actual conocido contiene:

- `puesto/departamento/fecha_ingreso/estado` dentro de `rrhh.empleados`;
- `pin_hash` dentro de `rrhh.empleados`;
- `nombre_usuario` y `user_id` dentro de `rrhh.empleados`;
- `rrhh.empleado_compensacion` 1:1 con empleado;
- `fn_crear_empleado` que puede generar PIN;
- `fn_validar_acceso_operativo()` que usa `nombre_usuario + PIN` para acceso digital.

Esas migraciones aplicadas no se editan.

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

1. Crear expediente general sin PIN.
2. Crear contrato borrador sin PIN.
3. Intentar marcar antes de activar: debe fallar.
4. Completar jornada/compensación.
5. Activar contrato y recibir PIN una sola vez.
6. PIN inválido: error genérico.
7. PIN válido: entrada.
8. Segundo PIN válido: salida.
9. Verificar marcas con contrato correcto.
10. Consolidar horas y comprobar manualmente.
11. Probar una incidencia.
12. Generar planilla de prueba.
13. Verificar total manualmente.
14. Finalizar contrato.
15. Intentar usar PIN anterior: debe fallar.
16. Verificar historial intacto.
17. Probar admin.
18. Probar supervisor asistencia.
19. Probar especialista planillas.
20. Probar usuario sin permiso.
21. Probar llamada RPC directa intentando evadir UI.
22. Ejecutar security advisors.

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

Hasta entonces permanece **en validación / en progreso**.
