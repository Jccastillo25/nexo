# Plan Maestro — Reglas de dominio RRHH, identidad digital, conductor y modelo de datos

> Parte de [`PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`](../PLAN_MAESTRO_IMPLEMENTACION_NEXO.md) (índice). Misma vigencia y jerarquía que el documento madre. Lectura obligatoria para cualquier tarea que toque RRHH, identidad digital o habilitación de conductor — ver también [`DRIVER_ACCESS_AND_KIOSK.md`](../DRIVER_ACCESS_AND_KIOSK.md).

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
