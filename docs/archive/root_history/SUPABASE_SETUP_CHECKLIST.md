# Gestor360: Checklist de Setup en Supabase

**Fecha:** 27 de Marzo de 2026
**Estado:** Instrucciones paso a paso

---

## ✅ CHECKLIST PRE-SETUP

Antes de empezar, verifica que tengas:

- [ ] Acceso a Supabase Dashboard
- [ ] URL de tu proyecto Supabase
- [ ] Credenciales correctas
- [ ] Archivo `20260327_global_schedule_system.sql` descargado o copiado

---

## 🚀 PASO 1: Ejecutar Migración SQL

### 1.1 Ir a SQL Editor

1. Abre: https://app.supabase.com
2. Selecciona tu **proyecto** (marcacion-grupo-ct)
3. Ve a: **SQL Editor** (en el menú lateral izquierdo)

### 1.2 Crear Nueva Query

1. Click en **"New query"**
2. Título: `Gestor360 - Global Schedule System`

### 1.3 Copiar SQL Completo

Copia TODO el contenido de:
```
web/db/migrations/20260327_global_schedule_system.sql
```

(Son ~250 líneas de SQL)

### 1.4 Ejecutar

1. Pega el SQL completo en el editor
2. Click en **"Run"** (abajo a la derecha)
3. **Espera** hasta que veas ✅ "Success"

### 1.5 Verificación Rápida

Si todo está bien, deberías ver:

```
Query Successful
Rows affected: 0 (Esto es normal para CREATE TABLE + CREATE POLICY)
Duration: X seconds
```

---

## 🔍 PASO 2: Verificar Que las Tablas Existan

### 2.1 Listar Tablas

1. Ve a: **Table Editor** (menú lateral)
2. Deberías ver estas **5 tablas nuevas**:
   - ✅ `shift_templates`
   - ✅ `global_schedules`
   - ✅ `employee_shift_overrides`
   - ✅ `branch_default_shifts`
   - ✅ `shift_change_logs`

**Si no aparecen:**
```
→ Recarga la página (F5)
→ Si aún no aparecen, la migración falló (revisar error en SQL Editor)
```

### 2.2 Verificar Estructura de Tablas

Haz click en cada tabla y verifica las columnas:

**shift_templates:**
- [ ] id (uuid)
- [ ] company_id (uuid)
- [ ] name (varchar)
- [ ] start_time (time)
- [ ] end_time (time)
- [ ] color_code (varchar)
- [ ] is_active (boolean)

**global_schedules:**
- [ ] id (uuid)
- [ ] company_id (uuid)
- [ ] job_position_id (uuid)
- [ ] shift_template_id (uuid)
- [ ] day_of_week (smallint)
- [ ] created_at (timestamptz)
- [ ] updated_at (timestamptz)
- [ ] deleted_at (timestamptz)

**employee_shift_overrides:**
- [ ] id (uuid)
- [ ] company_id (uuid)
- [ ] employee_id (uuid)
- [ ] shift_template_id (uuid)
- [ ] scheduled_date (date)
- [ ] reason (varchar)
- [ ] authorized_by (uuid)

**branch_default_shifts:**
- [ ] id (uuid)
- [ ] company_id (uuid)
- [ ] branch_id (uuid)
- [ ] day_of_week (smallint)
- [ ] shift_template_id (uuid)

**shift_change_logs:**
- [ ] id (uuid)
- [ ] company_id (uuid)
- [ ] action (text)
- [ ] entity_type (varchar)
- [ ] entity_id (uuid)
- [ ] changed_by (uuid)
- [ ] old_values (jsonb)
- [ ] new_values (jsonb)
- [ ] created_at (timestamptz)

---

## 🔐 PASO 3: Verificar RLS Policies

### 3.1 Ir a Authentication → Policies

1. Ve a: **Authentication** → **Policies**
2. Busca estas **5 tablas**:
   - [ ] shift_templates
   - [ ] global_schedules
   - [ ] employee_shift_overrides
   - [ ] branch_default_shifts
   - [ ] shift_change_logs

### 3.2 Verificar Policies por Tabla

Haz click en cada tabla. Deberías ver policies como:

**shift_templates:**
- [ ] "Enable read access for authenticated users" (SELECT)
- [ ] "Enable insert/update/delete for authenticated users" (ALL)

**global_schedules:**
- [ ] "Enable read access for authenticated users" (SELECT)
- [ ] "Enable insert/update/delete for authenticated users" (ALL)

**employee_shift_overrides:**
- [ ] "Enable read access for authenticated users" (SELECT)
- [ ] "Enable insert/update/delete for authenticated users" (ALL)

**branch_default_shifts:**
- [ ] "Enable read access for authenticated users" (SELECT)
- [ ] "Enable insert/update/delete for authenticated users" (ALL)

**shift_change_logs:**
- [ ] "Enable read access for authenticated users" (SELECT)

---

## 📊 PASO 4: Verificar Índices

### 4.1 Ir a SQL Editor

1. Ejecuta esta query:

```sql
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN (
  'shift_templates',
  'global_schedules',
  'employee_shift_overrides',
  'branch_default_shifts',
  'shift_change_logs'
)
ORDER BY tablename, indexname;
```

### 4.2 Verificar Resultados

Deberías ver **8 índices**:

```
shift_templates:
  - idx_shift_templates_company_id
  - idx_shift_templates_is_active

global_schedules:
  - idx_global_schedules_company_position
  - idx_global_schedules_company_dow
  - idx_global_schedules_deleted_at

employee_shift_overrides:
  - idx_employee_overrides_company_date
  - idx_employee_overrides_employee_date
  - idx_employee_overrides_deleted_at

branch_default_shifts:
  - (ninguno extra, usa PRIMARY KEY + UNIQUE)

shift_change_logs:
  - idx_shift_change_logs_company_created
```

---

## 🧪 PASO 5: Testing de Conexión desde la App

### 5.1 Verificar que las Tablas Sean Accesibles desde React

Ejecuta esta query en SQL Editor:

```sql
SELECT COUNT(*) as total FROM shift_templates;
SELECT COUNT(*) as total FROM global_schedules;
SELECT COUNT(*) as total FROM employee_shift_overrides;
```

Deberías ver `0` filas (está vacío, pero accesible).

### 5.2 Prueba de RLS

Ejecuta como usuario autenticado:

```sql
-- Esta query debe funcionar (RLS permite SELECT a usuarios autenticados)
SELECT * FROM shift_templates LIMIT 1;
```

Si ves datos o error de permisos → RLS está funcionando ✅

---

## 📝 PASO 6: Crear Datos Iniciales (Opcional)

Si quieres empezar con datos de prueba, ejecuta:

```sql
-- Asume que tienes una company_id
-- Reemplaza 'YOUR_COMPANY_UUID' con la UUID real

INSERT INTO public.shift_templates
  (company_id, name, start_time, end_time, color_code, is_active)
VALUES
  ('YOUR_COMPANY_UUID', 'Mañana', '08:00:00', '17:00:00', '#3B82F6', true),
  ('YOUR_COMPANY_UUID', 'Tarde', '17:00:00', '02:00:00', '#F59E0B', true),
  ('YOUR_COMPANY_UUID', 'Noche', '22:00:00', '07:00:00', '#8B5CF6', true);
```

---

## ⚠️ TROUBLESHOOTING

### Problema: "Table already exists"

**Solución:**
- Esto es normal si corriste la migración dos veces
- El SQL usa `IF NOT EXISTS`, no causa error
- Solo ignora el mensaje

### Problema: "Permission denied"

**Solución:**
- Asegúrate de estar logueado en Supabase
- Verifica que tengas permisos de admin en el proyecto
- Intenta en incógnito (a veces hay caché de sesión)

### Problema: "Foreign key constraint failed"

**Solución:**
- Esto ocurre si `companies` o `job_positions` no existen
- Verifica que esas tablas existan primero:

```sql
SELECT * FROM public.companies LIMIT 1;
SELECT * FROM public.job_positions LIMIT 1;
```

Si no existen, **no ejecutes la migración aún**. Crea esas tablas primero.

### Problema: "Invalid SQL"

**Solución:**
- Verifica que copiaste TODO el archivo SQL
- No debería haber líneas incompletas
- Si ves "Parse error", revisa caracteres especiales

---

## 🎯 VERIFICACIÓN FINAL

Si todo está bien, deberías poder:

### Test 1: Crear un turno

```sql
INSERT INTO public.shift_templates
  (company_id, name, start_time, end_time, color_code, is_active)
VALUES ('uuid-aqui', 'Test Turno', '09:00:00', '18:00:00', '#FF0000', true)
RETURNING *;
```

**Resultado esperado:** INSERT exitoso, 1 row affected ✅

### Test 2: Crear asignación global

```sql
INSERT INTO public.global_schedules
  (company_id, job_position_id, shift_template_id, day_of_week)
VALUES ('uuid-company', 'uuid-position', 'uuid-template', 1)
RETURNING *;
```

**Resultado esperado:** INSERT exitoso ✅

### Test 3: Leer desde React

En la app, navega a `/schedules/global-planning/` y verifica que:
- [ ] No hay errores en console
- [ ] Las tablas se cargan
- [ ] Puedes arrastrar turnos

---

## 📋 RESUMEN

| Paso | Tarea | Estado |
|------|-------|--------|
| 1 | Ejecutar migración SQL | ☐ |
| 2 | Verificar 5 tablas existen | ☐ |
| 3 | Verificar columnas correctas | ☐ |
| 4 | Verificar RLS policies | ☐ |
| 5 | Verificar 8 índices | ☐ |
| 6 | Test queries en SQL Editor | ☐ |
| 7 | Test desde React app | ☐ |

---

## 🎓 NOTAS IMPORTANTES

### Soft Deletes
Las tablas usan `deleted_at` en lugar de `DELETE` real:
```sql
-- En lugar de DELETE, hacer:
UPDATE global_schedules SET deleted_at = NOW() WHERE id = 'xxx';

-- Las queries siempre filtran:
WHERE deleted_at IS NULL
```

### UNIQUE Constraint
`global_schedules` tiene constraint único:
```
UNIQUE(company_id, job_position_id, day_of_week)
```
Esto previene que un puesto tenga dos turnos el mismo día.

### Caché en Memoria
El `ShiftResolver` cachea resultados por 5 minutos. Si cambias datos directamente en BD, invalida con:
```typescript
resolver.clearCache()
```

---

## ✅ CHECKLIST FINAL

Antes de decir "Listo":

- [ ] Todas las 5 tablas existen en Supabase
- [ ] Todas las columnas son correctas
- [ ] RLS policies están activas
- [ ] 8 índices fueron creados
- [ ] Test queries ejecutan sin error
- [ ] App puede leer desde `/schedules/global-planning/`
- [ ] Sin errores en console del navegador

---

**Si todo está ✅, Gestor360 está LISTO para usar en Supabase.**

---

**Autor:** Claude (Agent SDK)
**Fecha:** 27 de Marzo de 2026
