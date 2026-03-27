# Gestor360: Arquitectura e Implementación del Sistema de Planificación Global de Turnos

**Fecha:** 27 de Marzo de 2026
**Proyecto:** marcacion-grupo-ct
**Estado:** En Implementación

---

## 📋 Resumen Ejecutivo

Se ha implementado un sistema de **Planificación Global de Turnos** que refactoriza la asignación individual de turnos a una metodología de "Planilla Maestra por Puestos". El sistema implementa una **jerarquía de resolución clara**:

```
Override Individual (máxima prioridad)
         ↓
Turno Global por Puesto
         ↓
Turno por Defecto de Sucursal
         ↓
Sin asignación
```

---

## 🗄️ Diseño de Base de Datos

### Tablas Implementadas

#### 1. **shift_templates** (Definiciones Reutilizables)
```sql
CREATE TABLE shift_templates (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  start_time TIME NOT NULL,    -- 24h format
  end_time TIME NOT NULL,      -- 24h format
  color_code VARCHAR(7) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(company_id, name)
);
```

**Propósito:** Almacena definiciones reutilizables de turnos (Mañana, Tarde, Noche, etc.)
**Índices:** `company_id`, `is_active`

---

#### 2. **global_schedules** (Planilla Maestra)
```sql
CREATE TABLE global_schedules (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  job_position_id UUID NOT NULL,
  shift_template_id UUID NOT NULL,
  day_of_week SMALLINT (0-6),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, job_position_id, day_of_week)
);
```

**Propósito:** Define qué turno corresponde a cada puesto en cada día de la semana
**Clave de Negocio:** Una posición solo puede tener un turno por día
**Indices:**
- `(company_id, job_position_id)` para búsquedas rápidas
- `(company_id, day_of_week)` para reportes por día
- `deleted_at` para soft deletes (auditoría)

---

#### 3. **employee_shift_overrides** (Asignaciones Individuales)
```sql
CREATE TABLE employee_shift_overrides (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  shift_template_id UUID,
  scheduled_date DATE NOT NULL,
  reason VARCHAR(500),
  authorized_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, employee_id, scheduled_date)
);
```

**Propósito:** Sobreescribe asignaciones globales para empleados específicos en fechas puntuales
**Ventaja:** `scheduled_date` permite cambios únicos sin afectar la planilla maestra
**Índices:**
- `(employee_id, scheduled_date)` para búsquedas por empleado
- `(company_id, scheduled_date)` para reportes

---

#### 4. **branch_default_shifts** (Fallback por Sucursal)
```sql
CREATE TABLE branch_default_shifts (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  day_of_week SMALLINT (0-6),
  shift_template_id UUID NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(company_id, branch_id, day_of_week)
);
```

**Propósito:** Define turnos por defecto si un puesto no tiene asignación global
**Caso de Uso:** Tiendas con múltiples sucursales sin estructura de puestos definida

---

#### 5. **shift_change_logs** (Auditoría)
```sql
CREATE TABLE shift_change_logs (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID NOT NULL,
  changed_by UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ
);
```

**Propósito:** Registro de cambios en turnos para cumplimiento normativo

---

## 🎯 Lógica de Resolución (ShiftResolver)

### Flujo de Resolución

Cuando se necesita determinar el turno de un empleado en una fecha:

```typescript
async function resolveShiftForDate(
  employeeId: string,
  scheduledDate: Date,
  companyId: string
): Promise<ShiftResolution>
```

**Pasos:**

1. **NIVEL 1: Override Individual**
   ```sql
   SELECT * FROM employee_shift_overrides
   WHERE employee_id = ?
     AND scheduled_date = ?
     AND deleted_at IS NULL
   ```
   - Si existe → retorna este turno
   - Si no → continúa a nivel 2

2. **NIVEL 2: Turno Global por Puesto**
   ```sql
   SELECT * FROM global_schedules
   WHERE job_position_id = (SELECT job_position_id FROM employees WHERE id = ?)
     AND day_of_week = EXTRACT(DOW FROM ?)
     AND deleted_at IS NULL
   ```
   - Si existe → retorna este turno
   - Si no → continúa a nivel 3

3. **NIVEL 3: Turno por Defecto de Sucursal**
   ```sql
   SELECT * FROM branch_default_shifts
   WHERE branch_id = (SELECT branch_id FROM employees WHERE id = ?)
     AND day_of_week = EXTRACT(DOW FROM ?)
   ```
   - Si existe → retorna este turno
   - Si no → retorna "sin asignación"

### Caché en Memoria

El `ShiftResolver` implementa caché con validez de **5 minutos**:

```typescript
private cache: ResolverCache = {}
private cacheMaxAge = 5 * 60 * 1000

private isCacheValid(key: string): boolean {
  return Date.now() - this.cacheTimestamps[key] < this.cacheMaxAge
}
```

**Ventaja:** Evita N queries redundantes en una sesión
**Invalidación:** Manual con `clearCache()` o `clearEmployeeCache(id)`

---

## 🛠️ Arquitectura de Componentes

### Estructura de Directorios

```
web/app/(admin)/schedules/
├── _hooks/
│   ├── useScheduleGrid.ts         # Orquestación de estado + persistencia
│   └── useShiftResolver.ts        # Integración del resolver en React
├── _components/
│   ├── ScheduleGrid.tsx           # Componente principal (cuadrícula)
│   ├── ShiftCell.tsx              # Celda individual (drop zone)
│   └── ShiftLibrary.tsx           # Panel lateral (drag source)
├── global-planning/
│   └── page.tsx                   # Página que integra todo
└── [archivos existentes]
```

### Relación de Componentes

```
ScheduleGrid (orquestador principal)
├── ShiftLibrary (drag source)
│   └── ShiftPill (draggable)
├── ScheduleGrid body
│   ├── GridHeader (días de semana)
│   ├── PositionRow × N
│   │   └── ShiftCell × 7 (drop zones)
│   └── BulkActionPanel (cuando hay selección)
└── Error Alert
```

---

## ⚛️ Hooks de React

### **useScheduleGrid**

```typescript
const {
  grid,              // Map<"positionId_dayOfWeek" → shiftTemplateId>
  isDirty,          // Boolean
  isSyncing,        // Boolean
  error,            // string | null
  updateCell,       // (posId, dow, shiftId) => Promise<void>
  applyToMultiple,  // (posIds[], dows[], shiftId) => Promise<void>
  revert,           // () => void
  clearError,       // () => void
  reload,           // () => Promise<void>
} = useScheduleGrid(companyId)
```

**Características:**

1. **Optimistic Updates:** La UI se actualiza al instante, la persistencia ocurre en background
2. **Rollback en Error:** Si la petición a BD falla, la UI revierte al estado anterior
3. **Bulk Actions:** Puede aplicar un turno a múltiples posiciones/días en un batch
4. **Batching:** Los upserts se envían en lotes de 500 para no saturar la API

**Ejemplo de Uso:**

```typescript
// Actualización individual
await updateCell('pos_123', 2, 'template_morning')

// Bulk action: asignar "Turno Mañana" a 5 posiciones, lunes y martes
await applyToMultiple(
  ['pos_1', 'pos_2', 'pos_3', 'pos_4', 'pos_5'],
  [1, 2],  // Monday, Tuesday
  'template_morning'
)
```

---

### **useShiftResolver**

```typescript
const {
  resolveShift,        // (employeeId, date) => Promise<ShiftResolution>
  resolveBatch,       // (empIds[], startDate, endDate) => Promise<Map>
  clearCache,         // () => void
  clearEmployeeCache, // (employeeId) => void
  isLoading,          // Boolean
  error,              // string | null
} = useShiftResolver(companyId)
```

**Casos de Uso:**

```typescript
// Resolver un turno
const resolution = await resolveShift('emp_123', new Date('2026-03-30'))
console.log(resolution.source) // 'override' | 'global' | 'branch_default' | 'none'

// Resolver para múltiples empleados en un rango
const results = await resolveBatch(
  ['emp_1', 'emp_2'],
  new Date('2026-03-30'),
  new Date('2026-04-06')
)
```

---

## 🎨 Componentes de UI

### **ScheduleGrid**

Componente principal que orquesta todo. Características:

- Cuadrícula responsiva (Y=puestos, X=días)
- Manejo de drag-and-drop con visual feedback
- Panel de bulk actions cuando hay selección
- Alertas de error con opción de limpiar
- Botón "Deshacer" si hay cambios no guardados

**Props:**

```typescript
interface ScheduleGridProps {
  companyId: string
  positions: { id: string; name: string }[]
  shiftTemplates: {
    id: string
    name: string
    start_time: string
    end_time: string
    color_code: string
  }[]
}
```

---

### **ShiftCell**

Celda individual que soporte:

- **Drop Zone:** Recibe arrastra de turnos
- **Visualización:** Muestra turno asignado con su color
- **Selección:** Ctrl+Click para bulk actions
- **Eliminación:** Botón X para quitar asignación
- **Loading State:** Spinner mientras se persiste

**Características Especiales:**

```typescript
// Ctrl+Click para seleccionar múltiples celdas
const handleClick = (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    onSelect(positionId, dayOfWeek, !isSelected)
  }
}
```

---

### **ShiftLibrary**

Panel lateral con todas las plantillas de turnos:

- **Sticky:** Se mantiene visible al desplazarse
- **Draggable Pills:** Cada turno es arrastreable
- **Visual Feedback:** Muestra opacidad y anillo al arrastrar
- **Sin Plantillas:** Mensaje útil si no hay plantillas

---

## 🔄 Flujo de Cambio: Ejemplo Completo

### Usuario arrastra "Turno Mañana" a celda de Caja, lunes

```
1. handleDrop(posId="caja_1", dow=1, templateId="morning")
   │
   ├─ updateCell("caja_1", 1, "morning")
   │  │
   │  ├─ setState({ grid.set("caja_1_1", "morning") }) [OPTIMISTIC]
   │  │  → UI actualizada al instante ✓
   │  │
   │  └─ persistCellChange("caja_1", 1, "morning")
   │     │
   │     └─ supabase.from('global_schedules').upsert({
   │        company_id: "123",
   │        job_position_id: "caja_1",
   │        day_of_week: 1,
   │        shift_template_id: "morning"
   │      }, { onConflict: "..." })
   │
   └─ Si falla:
      └─ setState({ grid.set("caja_1_1", null) }) [ROLLBACK]
         → Vuelve al estado anterior
         → Muestra error al usuario
```

**Ventajas:**

- UX fluida: no hay espera
- Conflicto de concurrencia resuelto por BD (UNIQUE constraint)
- Auditable: shift_change_logs registra todos los cambios

---

## 🚀 Deployment y Migraciones

### Archivos de Migración

```
web/db/migrations/
└── 20260327_global_schedule_system.sql
    ├── shift_templates
    ├── global_schedules
    ├── employee_shift_overrides
    ├── branch_default_shifts
    ├── shift_change_logs
    └── Políticas de RLS + índices
```

### Pasos de Deployment

1. **Ejecutar migración en Supabase:**
   ```bash
   # En Supabase Dashboard → SQL Editor
   # Copiar contenido de 20260327_global_schedule_system.sql
   ```

2. **Verificar índices:**
   ```bash
   # En Supabase → Database → Indexes
   # Debe haber 8 índices creados (3+3+1+1)
   ```

3. **Probar RLS policies:**
   ```sql
   SELECT * FROM shift_templates;
   SELECT * FROM global_schedules;
   -- Debe retornar datos sin errores
   ```

4. **Deploy de código:**
   ```bash
   git add web/lib/services/shift-resolver.ts
   git add web/app/(admin)/schedules/_hooks/
   git add web/app/(admin)/schedules/_components/
   git add web/app/(admin)/schedules/global-planning/page.tsx
   git commit -m "feat: Global shift planning system (Planilla Maestra)"
   git push origin main
   ```

---

## 🔍 Testing

### Casos de Prueba (Unit)

```typescript
// shift-resolver.test.ts
describe('ShiftResolver', () => {
  describe('Jerarquía de resolución', () => {
    test('Retorna override si existe', async () => {
      const result = await resolver.resolveShiftForDate(empId, date, coId)
      expect(result.source).toBe('override')
    })

    test('Retorna global si no hay override', async () => {
      // [mock override como null]
      const result = await resolver.resolveShiftForDate(empId, date, coId)
      expect(result.source).toBe('global')
    })

    test('Retorna branch_default si no hay override ni global', async () => {
      // [mock override y global como null]
      const result = await resolver.resolveShiftForDate(empId, date, coId)
      expect(result.source).toBe('branch_default')
    })
  })

  describe('Caché', () => {
    test('Retorna resultado cacheado en segunda llamada', async () => {
      const result1 = await resolver.resolveShiftForDate(empId, date, coId)
      const result2 = await resolver.resolveShiftForDate(empId, date, coId)
      // Verificar que queries a BD bajaron de 2 a 0
      expect(queryCount).toBe(1)
    })

    test('Invalida caché después de 5 minutos', async () => {
      // [mock Date.now() + 6 minutos]
      const result = await resolver.resolveShiftForDate(empId, date, coId)
      expect(queryCount).toBe(2) // Nueva query
    })
  })
})
```

### Casos de Prueba (Integration)

```typescript
// useScheduleGrid.integration.test.tsx
describe('useScheduleGrid - Bulk Actions', () => {
  test('Aplica turno a múltiples posiciones/días', async () => {
    const { result } = renderHook(() => useScheduleGrid(companyId))

    await act(async () => {
      await result.current.applyToMultiple(
        ['pos_1', 'pos_2', 'pos_3'],
        [1, 2, 3],
        'morning'
      )
    })

    // Verificar que se crearon 9 registros en BD (3×3)
    const { data } = await supabase
      .from('global_schedules')
      .select('*')
      .eq('shift_template_id', 'morning')

    expect(data).toHaveLength(9)
  })
})
```

---

## 📊 Métricas de Performance

### Cargas Esperadas

| Métrica | Límite | Observación |
|---------|--------|-------------|
| Puestos por empresa | ~200 | Grid responsiva hasta este límite |
| Días por semana | 7 | Fijo |
| Celdas totales | 1,400 | 200 × 7 |
| Tiempo de carga | < 1s | Con índices correctos |
| Bulk action (500 registros) | < 3s | Incluye network + BD |

### Optimizaciones Implementadas

1. **Índices en BD:** Búsquedas O(log n)
2. **Soft deletes:** Evita cascadas lenta
3. **Caché en memoria:** 5 minutos para resolver
4. **Batching:** 500 registros por request
5. **Optimistic updates:** UX fluida

---

## 🚨 Consideraciones Importantes

### ⚠️ Resolución de Conflictos

El UNIQUE constraint en `global_schedules`:

```sql
UNIQUE(company_id, job_position_id, day_of_week)
```

**Previene:** Dos turnos para el mismo puesto en el mismo día
**Comportamiento:** UPSERT automáticamente reemplaza el registro anterior

**Ejemplo:**

```typescript
// Cambiar "Mañana" a "Tarde" para Caja el lunes
await updateCell("caja_1", 1, "afternoon")
// → Automáticamente reemplaza el registro anterior
// → No hay duplicados
```

### ⚠️ Soft Deletes

Ambas tablas con cambios frecuentes usan `deleted_at`:

```sql
-- En lugar de DELETE
UPDATE global_schedules SET deleted_at = NOW() WHERE id = ?

-- Las queries siempre filtran
WHERE deleted_at IS NULL
```

**Ventaja:** Auditoría completa
**Costo:** Más bytes en índices
**Recomendación:** Hacer hard delete anual si auditoría no es mandatoria

### ⚠️ Herencia en Cambios Futuros

Si un empleado tiene un override y luego **cambias el turno global**:

```typescript
// Escenario
employee_id='emp_123', scheduled_date='2026-03-30'
- Override: "Mañana" → "Tarde"
- Global: "Mañana" → "Noche"

// Resultado
resolveShift('emp_123', '2026-03-30')
// → Retorna "Tarde" (el override tiene prioridad)
```

**Esto es correcto:** El override es intencional, protege cambios del usuario.

---

## 📚 Documentación Adicional

- **Database Schema:** Ver `20260327_global_schedule_system.sql`
- **Resolver Logic:** Ver `web/lib/services/shift-resolver.ts`
- **Component API:** Ver JSDoc en componentes

---

## 🎯 Roadmap Futuro

### Fase 2 (Próximas semanas)

- [ ] Supabase RealTime para sincronización multiusuario
- [ ] Validación de conflictos (ej: no dos nocturnos seguidos)
- [ ] Vista de empleado (mostrar turno heredado)
- [ ] Exportar planilla a Excel

### Fase 3 (Próximos meses)

- [ ] GraphQL si crece dominio de datos
- [ ] Pagination si hay >200 puestos
- [ ] Analytics: turnos más usados, cobertura por turno
- [ ] Integraciones con payroll

---

## ✅ Checklist de Implementación

- [x] Migración SQL creada
- [x] Tablas creadas en esquema
- [x] Índices agregados
- [x] RLS policies configuradas
- [x] Resolver service implementado
- [x] Hooks de React creados
- [x] Componentes UI desarrollados
- [x] Página global-planning integrada
- [ ] Migraciones ejecutadas en Supabase
- [ ] Tests unitarios escritos
- [ ] Tests de integración pasados
- [ ] Code review completado
- [ ] Commit realizado

---

**Autor:** Claude (Agent SDK)
**Fecha:** 27 de Marzo de 2026
