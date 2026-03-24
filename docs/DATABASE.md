# Esquema de Base de Datos — Gestor360

Este documento describe las tablas, columnas y relaciones de la base de datos en **Supabase (PostgreSQL)**.

---

## Tablas

### `companies`
Empresas registradas en el sistema (arquitectura multitenant).

| Columna           | Tipo        | Descripción                                      |
|-------------------|-------------|--------------------------------------------------|
| `id`              | `uuid` PK   | Identificador único                              |
| `display_name`    | `text`      | Nombre comercial de la empresa                   |
| `legal_name`      | `text`      | Razón social / nombre legal                      |
| `slug`            | `text` UNIQUE | Identificador URL-amigable                     |
| `tax_id`          | `text`      | RUC / NIT fiscal                                 |
| `address`         | `text`      | Dirección física                                 |
| `phone`           | `text`      | Teléfono de contacto                             |
| `report_logo_url` | `text`      | URL del logo para reportes                       |
| `is_active`       | `bool`      | Estado activo/inactivo                           |
| `created_at`      | `timestamptz` | Fecha de creación                              |

---

### `branches`
Sucursales pertenecientes a una empresa.

| Columna      | Tipo        | Descripción                              |
|--------------|-------------|------------------------------------------|
| `id`         | `uuid` PK   | Identificador único                      |
| `company_id` | `uuid` FK   | Empresa propietaria → `companies.id`     |
| `name`       | `text`      | Nombre de la sucursal                    |
| `code`       | `text`      | Código corto (usado en device_code)      |
| `address`    | `text`      | Dirección de la sucursal                 |
| `is_active`  | `bool`      | Estado activo/inactivo                   |
| `created_at` | `timestamptz` | Fecha de creación                      |

---

### `employees`
Empleados de la empresa, con perfil completo.

| Columna              | Tipo        | Descripción                                    |
|----------------------|-------------|------------------------------------------------|
| `id`                 | `uuid` PK   | Identificador único                            |
| `company_id`         | `uuid` FK   | Empresa → `companies.id`                       |
| `branch_id`          | `uuid` FK   | Sucursal asignada → `branches.id`              |
| `employee_code`      | `text`      | PIN de marcación (4 dígitos, único por empresa)|
| `first_name`         | `text`      | Nombre(s)                                      |
| `last_name`          | `text`      | Apellido(s)                                    |
| `email`              | `text`      | Correo electrónico                             |
| `phone`              | `text`      | Teléfono                                       |
| `hire_date`          | `date`      | Fecha de ingreso                               |
| `birth_date`         | `date`      | Fecha de nacimiento                            |
| `gender`             | `text`      | Género                                         |
| `address`            | `text`      | Dirección de residencia                        |
| `national_id`        | `text`      | Número de cédula / DUI                         |
| `social_security_id` | `text`      | Número de INSS                                 |
| `tax_id`             | `text`      | NIT personal                                   |
| `photo_url`          | `text`      | URL de foto en Storage                         |
| `job_position_id`    | `uuid` FK   | Puesto de trabajo → `job_positions.id` (Nivel Jerárquico) |
| `current_status`     | `text`      | Estado para Monitor: `active`, `on_break`, `offline`, `absent` |
| `last_status_change` | `timestamptz` | Última actualización de estado para el Monitor |
| `is_active`          | `bool`      | Estado administrativo (Habilitado/Baja)         |
| `created_at`         | `timestamptz` | Fecha de creación                            |

---

### `employee_pins`
Historial de PINs asignados para auditoría de seguridad.

| Columna       | Tipo      | Descripción                            |
|---------------|-----------|----------------------------------------|
| `id`          | `uuid` PK | Identificador único                    |
| `employee_id` | `uuid` FK | Empleado → `employees.id`              |
| `pin`         | `text`    | PIN de 4 dígitos                       |
| `is_active`   | `bool`    | Indica si el PIN está actualmente activo |
| `created_at`  | `timestamptz` | Fecha de asignación                |

---

### `job_positions` (Jerarquía de Puestos)
Define el árbol organizativo y reglas de descanso.

| Columna              | Tipo        | Descripción                                      |
|----------------------|-------------|--------------------------------------------------|
| `id`                 | `uuid` PK   | Identificador único                              |
| `company_id`         | `uuid` FK   | Empresa → `companies.id`                         |
| `name`               | `text`      | Nombre del puesto (Ej. "Cajero")                 |
| `level`              | `numeric`   | Nivel jerárquico (Ej. 1.0, 2.5)                  |
| `parent_id`          | `uuid` FK   | Puesto supervisor → `job_positions.id`           |
| `default_break_mins` | `int`       | Minutos reglamentarios de descanso               |
| `is_active`          | `bool`      | Estado activo/inactivo                           |
| `created_at`         | `timestamptz` | Fecha de creación                              |

---

### `employee_status_logs`
Historial de estados y auditoría de los tiempos de descanso de los empleados.

| Columna                | Tipo        | Descripción                                      |
|------------------------|-------------|--------------------------------------------------|
| `id`                   | `uuid` PK   | Identificador único                              |
| `employee_id`          | `uuid` FK   | Empleado → `employees.id`                        |
| `start_time`           | `timestamptz` | Hora exacta real a la que inicio la pausa      |
| `end_time_scheduled`   | `timestamptz` | start_time + default_break_mins                |
| `end_time_actual`      | `timestamptz` | Cierre real de la pausa                        |
| `is_complete_override` | `bool`      | Supervisor validó "descanso completo"          |
| `authorized_by`        | `uuid` FK   | Supervisor que autorizó la acción anticipada   |
| `created_at`           | `timestamptz` | Fecha del registro                             |

---

### `shifts`
Turnos disponibles con horarios y tolerancias.

| Columna           | Tipo      | Descripción                                   |
|-------------------|-----------|-----------------------------------------------|
| `id`              | `uuid` PK | Identificador único                           |
| `name`            | `text`    | Nombre del turno (ej. "Turno Mañana")         |
| `start_time`      | `time`    | Hora de inicio                                |
| `end_time`        | `time`    | Hora de finalización                          |
| `break_minutes`   | `int`     | Minutos de descanso                           |
| `tolerance_in`    | `int`     | Minutos de tolerancia para entrada            |
| `tolerance_out`   | `int`     | Minutos de tolerancia para salida             |
| `is_active`       | `bool`    | Estado activo/inactivo del turno              |
| `created_at`      | `timestamptz` | Fecha de creación                         |

---

### `employee_shifts`
Asignación de turno a un empleado. Solo puede haber una asignación activa por empleado a la vez.

| Columna       | Tipo      | Descripción                                    |
|---------------|-----------|------------------------------------------------|
| `id`          | `uuid` PK | Identificador único                            |
| `employee_id` | `uuid` FK | Empleado → `employees.id`                      |
| `shift_id`    | `uuid` FK | Turno → `shifts.id`                            |
| `start_date`  | `date`    | Fecha desde la que aplica la asignación        |
| `is_active`   | `bool`    | Solo uno puede estar activo por empleado       |
| `created_at`  | `timestamptz` | Fecha de asignación                        |

---

### `attendance_logs`
Maneja las marcaciones del sistema omnicanal (Kiosk + Monitor). **Sustituye a `time_records`**.

| Columna       | Tipo        | Descripción                                      |
|---------------|-------------|--------------------------------------------------|
| `id`          | `uuid` PK   | Identificador único                              |
| `company_id`  | `uuid` FK   | Empresa → `companies.id`                         |
| `employee_id` | `uuid` FK   | Empleado → `employees.id`                        |
| `action`      | `varchar`   | `CLOCK_IN`, `CLOCK_OUT`, `START_BREAK`, `END_BREAK` |
| `status`      | `varchar`   | `CLOCKED_IN`, `CLOCKED_OUT`, `ON_BREAK`          |
| `recorded_at` | `timestamptz` | Hora oficial de la acción (servidor)           |
| `recorded_by` | `uuid` FK   | User ID del ejecutor (Kiosk o Supervisor)        |
| `source`      | `enum`      | `KIOSK`, `MONITOR`, `API`, `IMPORT`              |
| `notes`       | `text`      | Comentarios adicionales o justificaciones        |
| `created_at`  | `timestamptz` | Fecha de registro                               |

---

### `audit_logs`
Trazabilidad de cambios sensibles realizados por usuarios o procesos.

| Columna        | Tipo        | Descripción                                      |
|----------------|-------------|--------------------------------------------------|
| `id`           | `bigint` PK | Identificador autonumérico                       |
| `company_id`   | `uuid` FK   | Contexto de empresa                              |
| `table_name`   | `text`      | Nombre de la tabla afectada                      |
| `action`       | `text`      | Tipo de acción (`INSERT`, `UPDATE`, `DELETE`, `MARK_ATTENDANCE`) |
| `record_id`    | `uuid`      | ID del registro afectado                         |
| `user_id`      | `uuid`      | Usuario de Supabase Auth                         |
| `performed_by_profile_id` | `uuid` | Perfil que realizó la acción                |
| `source`       | `text`      | Fuente del cambio                                |
| `details`      | `jsonb`     | Antes/Después de los datos                      |
| `created_at`   | `timestamptz` | Fecha del log                                  |

---

### `time_records` (LEGACY)
> [!WARNING]
> Esta tabla está en proceso de depreciación. Favor usar `attendance_logs` para nuevos desarrollos.
Registro de marcaciones (entradas y salidas).

| Columna             | Tipo        | Descripción                                          |
|---------------------|-------------|------------------------------------------------------|
| `id`                | `uuid` PK   | Identificador único                                  |
| `employee_id`       | `uuid` FK   | Empleado → `employees.id`                            |
| `branch_id`         | `uuid` FK   | Sucursal → `branches.id`                             |
| `event_type`        | `text`      | `clock_in` o `clock_out`                             |
| `recorded_at`       | `timestamptz` | Timestamp exacto de la marcación                   |
| `tardiness_minutes` | `int`       | Minutos de tardanza (0 si es puntual)                |
| `status`            | `text`      | `pending`, `confirmed`, `corrected`                  |
| `device_code`       | `text`      | Código del kiosco que registró la marcación          |
| `created_at`        | `timestamptz` | Fecha de inserción                                 |

---

### `time_corrections`
Solicitudes de corrección de marcaciones erróneas.

| Columna       | Tipo        | Descripción                                          |
|---------------|-------------|------------------------------------------------------|
| `id`          | `uuid` PK   | Identificador único                                  |
| `record_id`   | `uuid` FK   | Registro original → `time_records.id`                |
| `employee_id` | `uuid` FK   | Empleado solicitante                                 |
| `reason`      | `text`      | Motivo de la corrección                              |
| `new_time`    | `timestamptz` | Hora correcta propuesta                            |
| `status`      | `text`      | `pending`, `approved`, `rejected`                    |
| `created_at`  | `timestamptz` | Fecha de solicitud                                 |

---

### `incidents`
Incidencias de asistencia (tardanzas graves, ausencias, horas extra, etc.).

| Columna       | Tipo        | Descripción                               |
|---------------|-------------|-------------------------------------------|
| `id`          | `uuid` PK   | Identificador único                       |
| `employee_id` | `uuid` FK   | Empleado implicado                        |
| `type`        | `text`      | Tipo de incidencia                        |
| `status`      | `text`      | `open`, `closed`                          |
| `notes`       | `text`      | Notas descriptivas                        |
| `created_at`  | `timestamptz` | Fecha de registro                       |

---

### `absence_logs`
Almacena ausencias justificadas o no, con aprobación de supervisores.

| Columna       | Tipo        | Descripción                                      |
|---------------|-------------|--------------------------------------------------|
| `id`          | `uuid` PK   | Identificador único                              |
| `employee_id` | `uuid` FK   | Empleado → `employees.id`                        |
| `start_date`  | `date`      | Inicio del periodo                               |
| `end_date`    | `date`      | Fin del periodo                                  |
| `reason`      | `text`      | Motivo (Enfermedad, Familiar, etc.)              |
| `notes`       | `text`      | Comentarios adicionales                          |
| `approved_by` | `uuid` FK   | Supervisor o RRHH que aprobó                     |
| `created_at`  | `timestamptz` | Fecha de registro                               |

---

### `leave_requests`
Solicitudes de permisos y ausencias autorizadas.

| Columna       | Tipo        | Descripción                                      |
|---------------|-------------|--------------------------------------------------|
| `id`          | `uuid` PK   | Identificador único                              |
| `employee_id` | `uuid` FK   | Empleado solicitante → `employees.id`            |
| `type`        | `text`      | Tipo (Vacaciones, Permiso médico, Día administrativo, etc.) |
| `start_date`  | `date`      | Fecha de inicio del permiso                      |
| `end_date`    | `date`      | Fecha de fin del permiso                         |
| `status`      | `text`      | `pending`, `approved`, `rejected`                |
| `notes`       | `text`      | Observaciones adicionales                        |
| `created_at`  | `timestamptz` | Fecha de solicitud                             |

---

### `company_memberships`
Vincula usuarios autenticados (Supabase Auth) con empresas y les asigna un rol.

| Columna      | Tipo      | Descripción                                      |
|--------------|-----------|--------------------------------------------------|
| `id`         | `uuid` PK | Identificador único                              |
| `user_id`    | `uuid` FK | Usuario de Supabase Auth                         |
| `company_id` | `uuid` FK | Empresa → `companies.id`                         |
| `role`       | `text`    | `owner`, `admin`, `rrhh`, `supervisor`, `viewer` |
| `is_active`  | `bool`    | Membresía habilitada o no                        |
| `created_at` | `timestamptz` | Fecha de alta                                |

---

### `kiosk_devices`
Dispositivos kiosco registrados por sucursal.

| Columna       | Tipo        | Descripción                                           |
|---------------|-------------|-------------------------------------------------------|
| `id`          | `uuid` PK   | Identificador único                                   |
| `branch_id`   | `uuid` FK   | Sucursal → `branches.id`                              |
| `device_code` | `text` UNIQUE | Código único generado: `{empresa}-{sucursal}-ki-{nn}`|
| `name`        | `text`      | Nombre descriptivo del dispositivo                    |
| `location`    | `text`      | Ubicación física dentro de la sucursal                |
| `notes`       | `text`      | Notas adicionales                                     |
| `is_active`   | `bool`      | Estado activo/inactivo                                |
| `last_seen`   | `timestamptz` | Última vez que el dispositivo registró una marcación|
| `created_at`  | `timestamptz` | Fecha de registro                                   |

---

### `app_settings`
Configuración global de la aplicación en formato clave-valor.

| Columna  | Tipo   | Descripción              |
|----------|--------|--------------------------|
| `key`    | `text` | Clave de configuración   |
| `value`  | `text` | Valor de configuración   |

**Claves conocidas:**

| Clave                  | Descripción                              |
|------------------------|------------------------------------------|
| `logo_url`             | URL del logo del kiosco                  |
| `favicon_url`          | URL del favicon dinámico                 |
| `kiosk_bg_url`         | URL de imagen de fondo del kiosco        |
| `company_name`         | Nombre de empresa mostrado en el kiosco  |
| `kiosk_custom_message` | Mensaje personalizado en el kiosco       |

---

## RPCs (Funciones PostgreSQL)

### `rpc_mark_attendance_action(...)`
Centraliza la lógica de marcación de asistencia. Valida transiciones de estado y genera registros de auditoría automáticamente.

### `rpc_monitor_mark_attendance(...)`
Permite a un supervisor marcar asistencia a un empleado bajo su cargo, inyectando el origen `MONITOR`.

### `create_company_with_owner(p_display_name, p_legal_name, p_slug, p_tax_id)`
Crea una empresa y automáticamente asigna al usuario autenticado como `owner` en `company_memberships`. Retorna el `id` de la nueva empresa.

### Server Actions (Alternativa a RPCs)

#### `processKioskEvent(branch_id, pin, event_type)`
Registra una marcación desde el kiosco. *(Funcionalidad migrada desde PostgreSQL hacia Next.js para mejorar la trazabilidad de errores RLS/Constraints)*:
1. Busca al empleado por `employee_code = pin` y `branch_id`.
2. Inserta el registro en `time_records` (requiere `company_id`).
3. Retorna nombre y código del empleado para la UI.

---

### `contracts`
Contrataciones legales de los empleados vinculadas con su turno y empresa.

| Columna          | Tipo        | Descripción                                      |
|------------------|-------------|--------------------------------------------------|
| `id`             | `uuid` PK   | Identificador único                              |
| `employee_id`    | `uuid` FK   | Empleado → `employees.id`                        |
| `schedule_id`    | `uuid` FK   | Horario/Turno → `shifts.id`                      |
| `company_id`     | `uuid` FK   | Empresa → `companies.id`                         |
| `branch_id`      | `uuid` FK   | Sucursal → `branches.id`                         |
| `contract_type`  | `text`      | Tipo (Indefinido, Temporal, etc.)                |
| `salary`         | `numeric`   | Salario mensual pactado                          |
| `start_date`     | `date`      | Fecha de inicio del contrato                     |
| `end_date`       | `date`      | Fecha de vencimiento (opcional)                  |
| `status`         | `text`      | `active`, `annulled`, `expired`, `terminated`    |
| `is_printed`     | `bool`      | Indica si ya se generó/imprimió el PDF           |
| `created_at`     | `timestamptz` | Fecha de creación                              |

---

## Diagrama de relaciones

```
companies
    │
    ├─── branches ──────────────── kiosk_devices
    │         │
    │         ├─────────────────── employees
    │         │                       │
    │         │            ┌──────────┼──────────────────┐
    │         │            │          │                  │
    │         │    employee_pins  employee_shifts    time_records
    │         │                       │                  │
    │         │                    shifts        time_corrections
    │         │
    │         └─────────────────── contracts
    │
    └─── company_memberships (users de Supabase Auth)

employees ──► leave_requests
employees ──► incidents

app_settings (global, sin FK)
```

---

*Documentación de base de datos — Gestor360 v0.3.0 — 24 de marzo de 2026*
