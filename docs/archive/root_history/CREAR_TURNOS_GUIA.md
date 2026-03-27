# Guía: Crear Turnos en Gestor360

## Resumen Rápido

Un **turno** es una plantilla reutilizable que define cuándo trabaja alguien (ej: 7:30 AM - 5:00 PM). Después de crear un turno, lo asignas a posiciones y días en la Planilla Maestra.

## Opción 1: Vía SQL (Recomendado para Setup Inicial)

Si necesitas crear varios turnos de una vez, ejecuta estas queries en Supabase:

### 1. Obtén tu `company_id`

En Supabase, ejecuta:
```sql
SELECT id, name FROM public.companies LIMIT 5;
```

Copia el `id` de tu compañía.

### 2. Inserta los turnos

```sql
INSERT INTO public.shift_templates (company_id, name, start_time, end_time, color_code, is_active)
VALUES
  ('{TU_COMPANY_ID}', 'Administrativo', '07:30:00', '17:00:00', '#3B82F6', true),
  ('{TU_COMPANY_ID}', 'Turno Tarde', '13:00:00', '21:00:00', '#F59E0B', true),
  ('{TU_COMPANY_ID}', 'Turno Noche', '21:00:00', '05:00:00', '#8B5CF6', true),
  ('{TU_COMPANY_ID}', 'Sábado', '08:00:00', '14:00:00', '#10B981', true);
```

**Reemplaza `{TU_COMPANY_ID}` con el ID real de tu compañía.**

#### Colores disponibles:
- `#3B82F6` - Azul (Administrativo)
- `#F59E0B` - Ámbar (Tarde)
- `#8B5CF6` - Púrpura (Noche)
- `#10B981` - Verde (Fin de semana)
- `#EF4444` - Rojo (Especial)
- `#6366F1` - Índigo (Otra)

### 3. Verifica que se crearon

```sql
SELECT id, name, start_time, end_time, color_code
FROM public.shift_templates
WHERE company_id = '{TU_COMPANY_ID}'
ORDER BY name;
```

Deberías ver algo como:
```
id                                   | name           | start_time | end_time | color_code
-------------------------------------+----------------+------------+----------+-----------
123e4567-e89b-12d3-a456-426614174000 | Administrativo | 07:30:00   | 17:00:00 | #3B82F6
...
```

## Opción 2: Vía API (Para Automatizar)

Si quieres crear turnos desde una aplicación, usa esta petición:

```bash
# POST /api/shift-templates
curl -X POST https://tu-instancia.vercel.app/api/shift-templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {TU_JWT_TOKEN}" \
  -d '{
    "company_id": "{TU_COMPANY_ID}",
    "name": "Administrativo",
    "start_time": "07:30",
    "end_time": "17:00",
    "color_code": "#3B82F6"
  }'
```

**Nota:** Este endpoint aún no existe. Ver "Próximos Pasos" al final.

## Opción 3: Vía Dashboard (Próximamente)

Se planea agregar un formulario en `/schedules/` para crear turnos directamente en la UI. Por ahora, usa SQL.

---

## Paso 2: Asignar Turnos a la Planilla Maestra

Después de crear los turnos, debes asignarlos a **posiciones × días de semana**.

### Estructura de la Planilla Maestra

La tabla `global_schedules` vincula:
- **Puesto** (ej: Cajero, Vendedor)
- **Día de semana** (0=Domingo, 1=Lunes, ..., 6=Sábado)
- **Turno** (ID del template creado arriba)

### Ejemplo: Asignar "Administrativo" a todos los Lunes

#### 1. Obtén el `job_position_id`

```sql
SELECT id, name FROM public.job_positions WHERE company_id = '{TU_COMPANY_ID}' LIMIT 10;
```

#### 2. Obtén el `shift_template_id`

```sql
SELECT id FROM public.shift_templates WHERE name = 'Administrativo' AND company_id = '{TU_COMPANY_ID}';
```

#### 3. Inserta en `global_schedules`

```sql
INSERT INTO public.global_schedules (company_id, job_position_id, shift_template_id, day_of_week)
VALUES
  ('{TU_COMPANY_ID}', '{JOB_POSITION_ID}', '{SHIFT_TEMPLATE_ID}', 1); -- Lunes
```

**Parámetros:**
- `day_of_week = 0` → Domingo
- `day_of_week = 1` → Lunes
- `day_of_week = 2` → Martes
- `day_of_week = 3` → Miércoles
- `day_of_week = 4` → Jueves
- `day_of_week = 5` → Viernes
- `day_of_week = 6` → Sábado

### Ejemplo Completo: Semana de Trabajo

```sql
-- Asignar "Administrativo" de Lunes a Viernes para Cajero
INSERT INTO public.global_schedules (company_id, job_position_id, shift_template_id, day_of_week)
VALUES
  ('{TU_COMPANY_ID}', '{CAJERO_ID}', '{ADMIN_SHIFT_ID}', 1),  -- Lunes
  ('{TU_COMPANY_ID}', '{CAJERO_ID}', '{ADMIN_SHIFT_ID}', 2),  -- Martes
  ('{TU_COMPANY_ID}', '{CAJERO_ID}', '{ADMIN_SHIFT_ID}', 3),  -- Miércoles
  ('{TU_COMPANY_ID}', '{CAJERO_ID}', '{ADMIN_SHIFT_ID}', 4),  -- Jueves
  ('{TU_COMPANY_ID}', '{CAJERO_ID}', '{ADMIN_SHIFT_ID}', 5);  -- Viernes

-- Asignar "Sábado" solo para sábados
INSERT INTO public.global_schedules (company_id, job_position_id, shift_template_id, day_of_week)
VALUES
  ('{TU_COMPANY_ID}', '{CAJERO_ID}', '{SABADO_SHIFT_ID}', 6);  -- Sábado

-- Domingo no trabaja (sin entrada)
```

---

## Paso 3: Usar la Planilla en la Interfaz

Una vez que hayas asignado turnos en la Planilla Maestra, los empleados verán sus turnos automáticamente en:

1. **Perfil de empleado** → Muestra el turno asignado
2. **Reportes** → Puedes ver todos los turnos de la semana
3. **Cambios puntuales** → Si necesitas asignar un turno diferente un día específico

### Cómo ver los turnos en la interfaz

1. Navega a `/schedules/global-planning/`
2. Verás una cuadrícula con:
   - **Columnas:** Días de la semana (Lun, Mar, Mié, etc.)
   - **Filas:** Puestos (Cajero, Vendedor, etc.)
   - **Celdas:** Turnos asignados (color codificados)

---

## Jerarquía de Asignación

El sistema resuelve turnos en este orden (primero que coincida gana):

1. **Override Individual** (máxima prioridad)
   - Cambio puntual para un empleado en una fecha
   - Tabla: `employee_shift_overrides`
   - Ejemplo: "Juan trabaja Sábado en lugar de Lunes"

2. **Planilla Maestra (Global)**
   - Turno asignado a su puesto en ese día de semana
   - Tabla: `global_schedules`

3. **Turno por Defecto de Sucursal**
   - Fallback si el puesto no tiene turno asignado
   - Tabla: `branch_default_shifts`

4. **Sin asignación**
   - El empleado no tiene turno ese día

---

## Validaciones Importantes

### ✅ Turnos válidos:
- Horario: Formato HH:MM (24 horas)
- Ejemplo: "07:30" (7:30 AM), "21:00" (9:00 PM)
- Color: Formato hexadecimal (#RRGGBB)

### ❌ Evita:
- Nombres duplicados (mismo nombre en misma compañía)
- Horarios sin sentido (ej: fin_time < start_time)
- Espacios en blanco antes/después del nombre

---

## Troubleshooting

### "Cannot insert multiple rows with same company_id, job_position_id, day_of_week"

**Problema:** Ya existe esa asignación.

**Solución:**
```sql
-- Primero elimina la anterior
DELETE FROM public.global_schedules
WHERE company_id = '{TU_COMPANY_ID}'
  AND job_position_id = '{JOB_POSITION_ID}'
  AND day_of_week = 1;

-- Luego inserta la nueva
INSERT INTO public.global_schedules (...)
VALUES (...);
```

### "Foreign key constraint violation"

**Problema:** El `job_position_id` o `shift_template_id` no existen.

**Solución:**
```sql
-- Verifica que el puesto exista
SELECT id FROM public.job_positions WHERE id = '{JOB_POSITION_ID}';

-- Verifica que el turno exista
SELECT id FROM public.shift_templates WHERE id = '{SHIFT_TEMPLATE_ID}';
```

---

## Próximos Pasos

**Implementar UI para crear/editar turnos:**
- [ ] Formulario en `/schedules/new/` para crear shift_templates
- [ ] Botón "Editar" en la Planilla Maestra para cambiar turnos
- [ ] Validación en tiempo real de conflictos
- [ ] Endpoint POST `/api/shift-templates` para crear vía API

**En el roadmap:**
- [ ] Importar turnos desde Excel
- [ ] Plantillas predefinidas (retail, restaurante, fábrica)
- [ ] Historial de cambios de turnos

---

## Ayuda Rápida

**¿Necesitas un template de turnos para tu sector?**

### Retail (Tienda)
```sql
INSERT INTO public.shift_templates (company_id, name, start_time, end_time, color_code, is_active)
VALUES
  ('{COMPANY_ID}', 'Apertura', '08:00:00', '14:00:00', '#3B82F6', true),
  ('{COMPANY_ID}', 'Cierre', '14:00:00', '21:00:00', '#F59E0B', true),
  ('{COMPANY_ID}', 'Completo', '08:00:00', '21:00:00', '#10B981', true);
```

### Restaurante
```sql
INSERT INTO public.shift_templates (company_id, name, start_time, end_time, color_code, is_active)
VALUES
  ('{COMPANY_ID}', 'Almuerzo', '11:00:00', '15:00:00', '#3B82F6', true),
  ('{COMPANY_ID}', 'Cena', '18:00:00', '23:00:00', '#F59E0B', true),
  ('{COMPANY_ID}', 'Jornada Completa', '11:00:00', '23:00:00', '#8B5CF6', true);
```

### Fábrica
```sql
INSERT INTO public.shift_templates (company_id, name, start_time, end_time, color_code, is_active)
VALUES
  ('{COMPANY_ID}', 'Turno 1', '06:00:00', '14:00:00', '#3B82F6', true),
  ('{COMPANY_ID}', 'Turno 2', '14:00:00', '22:00:00', '#F59E0B', true),
  ('{COMPANY_ID}', 'Turno 3', '22:00:00', '06:00:00', '#8B5CF6', true);
```

---

**¿Preguntas?** Revisa SUPABASE_SETUP_CHECKLIST.md para el setup inicial.
