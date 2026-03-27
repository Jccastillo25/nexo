# 🔧 Corrección: Estructura de Turnos

## Problema Identificado

❌ **Estructura anterior (INCORRECTA):**
- "Turno Administrativo" (L-V) - Turno separado
- "Turno Administrativo - Sábado" - Otro turno separado

✅ **Estructura correcta:**
- **UN SOLO** "Turno Administrativo" con horarios diferentes por día

---

## Solución Implementada

### 1. Nueva Tabla: `shift_schedules`

Permite guardar **múltiples horarios por día dentro de un mismo turno**:

```sql
CREATE TABLE shift_schedules (
    id UUID PRIMARY KEY,
    shift_id UUID,  -- Referencia al turno
    day_of_week INT,  -- 1=Lunes, ..., 6=Sábado
    start_time TIME,  -- Hora entrada para ese día
    end_time TIME,    -- Hora salida para ese día
    tolerance_in INT,
    tolerance_out INT,
    ...
)
```

### 2. Configuración Final

**Turno Administrativo** (UN SOLO turno):
| Día | Entrada | Salida | Tolerancia |
|-----|---------|--------|-----------|
| Lunes | 07:30 | 17:00 | 30 min |
| Martes | 07:30 | 17:00 | 30 min |
| Miércoles | 07:30 | 17:00 | 30 min |
| Jueves | 07:30 | 17:00 | 30 min |
| Viernes | 07:30 | 17:00 | 30 min |
| **Sábado** | **08:00** | **15:00** | **30 min** |

---

## Pasos para Implementar

### Paso 1: Ejecutar SQL en Supabase

Copia todo el contenido de `migracion_correccion_turnos.sql` y ejecuta en Supabase SQL Editor:

```sql
-- 1. Crear tabla shift_schedules
CREATE TABLE IF NOT EXISTS public.shift_schedules (...)

-- 2. Eliminar turno "Turno Administrativo - Sábado"
DELETE FROM shifts WHERE name = 'Turno Administrativo - Sábado';

-- 3. Actualizar "Turno Administrativo"
UPDATE shifts SET days_of_week = ARRAY[1,2,3,4,5] WHERE ...

-- 4. Insertar horarios por día
INSERT INTO shift_schedules (shift_id, day_of_week, ...)

-- 5. Verificar configuración
SELECT ... FROM shifts s LEFT JOIN shift_schedules ss ...
```

### Paso 2: Actualizar código en `kiosk.ts`

✅ **Ya hecho:** La función `getTodayShift()` ahora:
1. Obtiene el ID del turno del empleado
2. Busca en `shift_schedules` el horario para el día actual
3. Si no encuentra, usa fallback a `shifts`

**Cambios:**
- Línea 224-287: Nueva función `getTodayShift()` optimizada
- Línea 311: Llamada a `getTodayShift()` en `processKioskEvent()`

### Paso 3: Commit y Deploy

```bash
git add web/app/actions/kiosk.ts
git commit -m "fix: Usar shift_schedules para horarios por día dentro de un turno

- Nueva función getTodayShift() consulta shift_schedules primero
- Un solo turno 'Turno Administrativo' con múltiples horarios por día
- Sábado: 08:00-15:00, L-V: 07:30-17:00
- Elimina turnos duplicados (Turno Administrativo - Sábado)"

git push origin main
npm run build
```

---

## Lógica de Funcionamiento

### Clock In - Lunes

```
1. Empleado hace Clock In
2. Sistema detecta: dayOfWeek = 1 (Lunes)
3. Consulta: SELECT * FROM shift_schedules WHERE shift_id = '9e47...' AND day_of_week = 1
4. Obtiene: start_time = 07:30, tolerance_in = 30
5. Calcula atraso desde 07:30
6. ✅ Funciona correctamente
```

### Clock In - Sábado

```
1. Empleado hace Clock In
2. Sistema detecta: dayOfWeek = 6 (Sábado)
3. Consulta: SELECT * FROM shift_schedules WHERE shift_id = '9e47...' AND day_of_week = 6
4. Obtiene: start_time = 08:00, tolerance_in = 30
5. Calcula atraso desde 08:00
6. ✅ Funciona correctamente (DIFERENTE de L-V)
```

---

## Beneficios

✅ **Un solo turno** - No duplicados
✅ **Escalable** - Fácil agregar más días o turnos
✅ **Flexible** - Cada día puede tener horarios diferentes
✅ **Limpio** - Estructura de BD correcta
✅ **Sin cambios en UI** - El código maneja automáticamente

---

## Rollback (Si hay problemas)

```sql
-- Revertir a estructura anterior (mantener dos turnos)
DROP TABLE IF EXISTS public.shift_schedules;

-- Recrear turno de sábado
INSERT INTO shifts (name, start_time, end_time, days_of_week, company_id)
VALUES ('Turno Administrativo - Sábado', '08:00', '15:00', ARRAY[6], '14f093cb-17fc-41d0-b449-65a4c1d22df0');
```

---

## Estado

| Tarea | Status |
|-------|--------|
| Crear tabla shift_schedules | ✅ SQL Listo |
| Eliminar turno duplicado | ✅ SQL Listo |
| Actualizar getTodayShift() | ✅ Código actualizado |
| Ejecutar SQL en Supabase | ⏳ **PRÓXIMO PASO** |
| Commit y Deploy | ⏳ Después de SQL |

---

**Próximo paso:** Ejecuta el SQL en Supabase desde `migracion_correccion_turnos.sql`
