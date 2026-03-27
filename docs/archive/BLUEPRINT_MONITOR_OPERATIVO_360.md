# BLUEPRINT TÉCNICO: Monitor Operativo 360°
## Sistema de Marcación Omnicanal para Grupo CT

---

## 1. INTRODUCCIÓN

Este documento consolida la arquitectura técnica, requisitos funcionales y decisiones de implementación para el sistema de marcación de asistencia omnicanal (Kiosk + Monitor Operativo).

### Incluye:
- Estructura de datos y esquema de BD (RLS, enums, validaciones)
- Lógica de sincronización real-time (Supabase Realtime + Webhooks)
- Interfaz de usuario (Monitor Grid, ActionDrawer, jerarquía visual)
- Gestión de justificantes (Storage Supabase + Google Drive híbrido)

---

## 2. ESTRUCTURA DE DATOS Y BACKEND

### 2.1 Tabla: `job_positions` (Refactor)

Campos a crear o ajustar:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Primary Key |
| `company_id` | UUID FK | Referencia a `companies(id)` |
| `name` | TEXT | Ej: "Jefe de Bodega", "Operario" |
| `level` | NUMERIC | 1, 2, 3, 3.1... Define profundidad jerárquica |
| `parent_id` | UUID FK | Self-reference a `job_positions(id)` o NULL si es nivel top |
| `icon_name` | TEXT | Material Icon: "inventory_2", "supervisor_account" |
| `default_break_mins` | INT | Meta en minutos para cronómetro (ej: 30) |
| `can_view_monitor` | BOOLEAN | ¿Puede acceder a Monitor Operativo? |
| `supervision_scope` | ENUM | DIRECT_ONLY \| RECURSIVE |
| `created_at` | TIMESTAMP | Metadata |
| `updated_at` | TIMESTAMP | Metadata |

**DECISIÓN (Gap 1):** `supervision_scope = DIRECT_ONLY`
- Un supervisor solo ve empleados con `parent_id = su ID`
- No acceso recursivo (por simplicidad inicial)
- Implementar recursión en fase 2 si es necesario

---

### 2.2 Tabla: `attendance_logs` (Extensión)

Campos a agregar:

| Campo Nuevo | Tipo | Descripción |
|-------------|------|-------------|
| `source_origin` | ENUM | `KIOSK` \| `MONITOR_ADMIN` - ¿Quién marcó? |
| `executed_by` | UUID FK | `profiles.id` del empleado (KIOSK) o supervisor (MONITOR_ADMIN) |
| `device_metadata` | JSONB | `{ ip: string, user_agent: string, device_id?: string }` |

**Ejemplo de `device_metadata`:**
```json
{
  "ip": "192.168.1.50",
  "user_agent": "Mozilla/5.0...",
  "device_id": "TABLET_001"
}
```

---

### 2.3 Tabla: `absence_attachments` (Nueva)

Almacena referencias a justificantes (híbrido Supabase Storage + Google Drive):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Primary Key |
| `absence_log_id` | BIGINT FK | Referencia a `absence_logs(id)` |
| `file_name` | TEXT | Nombre original del archivo |
| `file_type` | VARCHAR | pdf, image/png, image/jpeg, etc |
| `file_size_bytes` | INT | Tamaño en bytes |
| `storage_provider` | ENUM | `SUPABASE` \| `GOOGLE_DRIVE` |
| `supabase_path` | TEXT | Ruta en Supabase Storage (NULL si Google Drive) |
| `google_drive_id` | TEXT | ID del archivo en Google Drive (NULL si Supabase) |
| `uploaded_by` | UUID FK | `employees.id` |
| `is_verified` | BOOLEAN | ¿Ha sido revisado por supervisor? |
| `verification_notes` | TEXT | Comentarios del supervisor |
| `created_at` | TIMESTAMP | Metadata |

**DECISIÓN (Gap 2): Storage Híbrido**
- Archivos < 10MB y tipos simples (PDF, JPG) → Supabase Storage (ruta: `/company_id/absence_id/filename`)
- Archivos > 10MB o tipos complejos → Google Drive (integración OAuth, acceso compartido)
- UI muestra ambas opciones en el formulario de carga

---

## 3. LÓGICA DE SINCRONIZACIÓN REAL-TIME

### 3.1 Flujo de Eventos

Cuando un supervisor marca asistencia desde Monitor Operativo:

1. **ActionDrawer** llama a `rpc_monitor_mark_attendance(employee_id, action, notes)`
2. **Validación:** Supervisor en misma compañía, employee existe, transición de estado válida
3. **INSERT/UPDATE** en `attendance_logs` con `source_origin='MONITOR_ADMIN'`
4. **Trigger automático** → INSERT en `audit_logs`
5. **UPDATE** en `employees.current_status` (broadcast Realtime)
6. **Kiosk Hub** escucha cambios vía `useAttendanceRealtime()` → UI se actualiza
7. **Monitor Grid** ve cambio en tiempo real (polling + Realtime)

### 3.2 Validaciones de Reglas de Negocio

En `rpc_mark_attendance_action()`:

- ❌ No permitir `CLOCK_OUT` si `status = ON_BREAK`
- ⚠️ Si `CLOCK_OUT` antes de 17:30 (admin shift end), campo 'notes' es **OBLIGATORIO**
- ❌ No permitir múltiples `CLOCK_IN` sin `CLOCK_OUT`
- ✅ Registrar en `audit_logs` con `source` (KIOSK vs MONITOR_ADMIN)

### 3.3 Latencia Real-Time

**DECISIÓN (Gap 3): Timing Pragmático**

- **Target:** 1-2 segundos (no 500ms) por realidad de Supabase + React render
- **Con <30 empleados:** Esta latencia es invisible al usuario
- **Implementación:** Realtime + polling cada 3s si Realtime falla
- **Mejoras futuras:** Optimizar índices, websocket dedicado

**Estimación de latencia actual:**
1. Kiosk → `rpc_kiosk_mark_attendance()` (10-50ms)
2. BD procesa trigger + audit log (20-100ms)
3. Supabase publica evento Realtime (50-200ms)
4. Monitor recibe y renderiza (50-150ms)
5. **Total: 130-500ms en el mejor escenario**

---

## 4. INTERFAZ DE USUARIO: MONITOR OPERATIVO

### 4.1 Layout Jerárquico (MonitorGrid.tsx)

Componente raíz que agrupa empleados por `job_position.level` y `parent_id`.

**Estructura esperada:**
```
Jefe de Bodega (Level 1)
  ├─ Operario 1 (Level 2, parent=Jefe)
  ├─ Operario 2 (Level 2, parent=Jefe)
     └─ Asistente (Level 3.1, parent=Operario 2)
Jefe de Turno (Level 1)
  ├─ Inspector (Level 2, parent=Jefe de Turno)
```

**DECISIÓN (User Input):** Sin texto visible de 'level'
- Solo fichas de empleados, indentadas dinámicamente por profundidad
- Indentación: `margin-left = parent_depth * 40px`

---

### 4.2 Componente: EmployeeCard.tsx

Ficha de empleado individual:

- **Nombre + Job Position**
- **Status badge** (CLOCKED_IN, CLOCKED_OUT, ON_BREAK) con color
- **Botón "Acciones"** → abre ActionDrawer
- **Icono pequeño** (job_position.icon_name) para contexto visual

---

### 4.3 Componente: ActionDrawer.tsx

Panel lateral (drawer) que emula la interfaz Kiosk:

**Secciones del ActionDrawer:**

**A. Cabecera**
- Nombre empleado + hora sincronizada del servidor

**B. Estado Actual**
- Ficha grande (CLOCKED_IN, CLOCKED_OUT, ON_BREAK)

**C. Botonera (Táctil / Click)**
- Entrada (CLOCK_IN)
- Descanso (START_BREAK)
- Salida (CLOCK_OUT)
- Reanudar (END_BREAK)

**D. Cronómetro**
- Muestra tiempo desde última marcación

**E. Formulario de Incidencias**
- Selector: Tipo de incidencia (Permiso, Ausencia, Justificante)
- Textarea: Notas / Explicación
- File picker: Supabase Storage o Google Drive

**F. Botón Submit**
- Envía `rpc_monitor_mark_attendance()`

---

## 5. REFACTOR GLOBAL: CONTEXTO Y CONFIGURACIÓN

### 5.1 GlobalContext.tsx

Cambios:

- **ELIMINAR** selector de empresa del Header
- `company_id` se extrae del Dashboard (primer paso) y se almacena en contexto
- Todos los queries filtran por `company_id` del contexto

### 5.2 ContractWizard.tsx (Paso 2)

Agregar selector de Job Position:

- Dropdown con `job_positions` de la compañía (donde `can_view_monitor = true`)
- Al seleccionar, mostrar: "Este empleado estará bajo supervisión de: [nombre supervisor]"
- Guardar `employee.job_position_id`

---

## 6. PLAN DE IMPLEMENTACIÓN (ORDEN RECOMENDADO)

| Fase | Tarea | Archivos/Componentes | Duración Est. |
|------|-------|----------------------|---------------|
| 1 | Crear `absence_attachments` table + RLS | `20260324_schema_attachments.sql` | 15 min |
| 1 | Refactor `attendance_logs` (source_origin, executed_by, device_metadata) | `20260324_alter_attendance_logs.sql` | 20 min |
| 1 | Refactor `job_positions` (supervision_scope, can_view_monitor) | `20260324_alter_job_positions.sql` | 15 min |
| 2 | Crear RPC: `rpc_validate_supervision()` (verificar permisos) | `20260324_rpc_supervision.sql` | 20 min |
| 2 | Actualizar `rpc_monitor_mark_attendance()` con validaciones | `20260324_rpc_monitor_updated.sql` | 20 min |
| 3 | Componente `MonitorGrid.tsx` (agrupa por level + parent_id) | `components/Monitor/MonitorGrid.tsx` | 1h |
| 3 | Componente `EmployeeCard.tsx` (ficha individual) | `components/Monitor/EmployeeCard.tsx` | 45 min |
| 3 | Componente `ActionDrawer.tsx` (marcación + incidencias) | `components/Monitor/ActionDrawer.tsx` | 2h |
| 4 | Hook: `useAttendanceRealtime()` (subscribe a cambios) | `hooks/useAttendanceRealtime.ts` | 1h |
| 4 | Hook: `useAttachmentUpload()` (Supabase + Google Drive) | `hooks/useAttachmentUpload.ts` | 1.5h |
| 5 | Actualizar `ContractWizard` Paso 2 (job position selector) | `components/Wizard/ContractWizard.tsx` | 1h |
| 5 | Refactor `GlobalContext` (remover empresa selector) | `context/GlobalContext.tsx` | 30 min |

**Tiempo Total Estimado: 9-10 horas** (distribuidas en 2-3 sesiones)

---

## 7. DECISIONES Y TRADE-OFFS

### Gap 1: Supervisión Jerárquica (DIRECT_ONLY)

✓ Menos complejidad en RLS y autorización
✗ Requiere lógica recursiva si supervisores ven subordinados indirectos
💡 Implementación: `supervision_scope` ENUM, campo en `job_positions`

### Gap 2: Storage Híbrido (Supabase + Google Drive)

✓ Máxima flexibilidad
✗ Complejidad en gestión de permisos (CORS, OAuth)
💡 Implementación: `absence_attachments.storage_provider` ENUM + hooks separados

### Gap 3: Latencia Real-Time (1-2s, no 500ms)

✓ Realista con <30 empleados y Supabase free tier
✗ Requiere polling fallback
💡 Implementación: `useAttendanceRealtime()` con retry logic + `setTimeout(3000ms)`

---

## 8. PRÓXIMOS PASOS

1. ✅ Revisar Blueprint (este documento)
2. ✅ Ejecutar scripts SQL (Fase 1: Schema)
3. ⏳ Implementar Frontend (Fase 3-5: Componentes)
4. ⏳ Testing y validación
5. ⏳ Deploy a producción

**¿Confirmáis este blueprint antes de proceder?**
