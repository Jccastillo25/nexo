-- ======================================================================
-- VALIDACIÓN: Verificar que los turnos estén correctamente asignados
-- Ejecuta estas queries para confirmar que todo está listo
-- ======================================================================

-- 1. Verificar que ambos turnos existan
SELECT 'PASO 1: Verificar turnos en BD' as paso;
SELECT id, name, start_time, end_time, days_of_week, is_active
FROM shifts
WHERE company_id = '14f093cb-17fc-41d0-b449-65a4c1d22df0'::uuid
ORDER BY name;

-- 2. Verificar asignación de empleados a turnos
SELECT 'PASO 2: Asignación de empleados a turnos' as paso;
SELECT
    e.id,
    e.first_name || ' ' || e.last_name as empleado,
    e.employee_code as pin,
    es.shift_id,
    s.name as turno,
    s.start_time,
    s.end_time,
    s.days_of_week as dias_aplicables,
    es.is_active
FROM employees e
LEFT JOIN employee_shifts es ON e.id = es.employee_id
LEFT JOIN shifts s ON es.shift_id = s.id
WHERE e.company_id = '14f093cb-17fc-41d0-b449-65a4c1d22df0'::uuid
AND e.is_active = true
ORDER BY e.last_name, e.first_name;

-- 3. Verificar que hay al menos un turno por día
SELECT 'PASO 3: Cobertura de turnos por día' as paso;
SELECT
    CASE WHEN array_agg(DISTINCT day) @> ARRAY[1] THEN '✓ Lunes' ELSE '✗ Falta Lunes' END as lunes,
    CASE WHEN array_agg(DISTINCT day) @> ARRAY[2] THEN '✓ Martes' ELSE '✗ Falta Martes' END as martes,
    CASE WHEN array_agg(DISTINCT day) @> ARRAY[3] THEN '✓ Miércoles' ELSE '✗ Falta Miércoles' END as miercoles,
    CASE WHEN array_agg(DISTINCT day) @> ARRAY[4] THEN '✓ Jueves' ELSE '✗ Falta Jueves' END as jueves,
    CASE WHEN array_agg(DISTINCT day) @> ARRAY[5] THEN '✓ Viernes' ELSE '✗ Falta Viernes' END as viernes,
    CASE WHEN array_agg(DISTINCT day) @> ARRAY[6] THEN '✓ Sábado' ELSE '✗ Falta Sábado' END as sabado
FROM (
    SELECT UNNEST(days_of_week) as day
    FROM shifts
    WHERE company_id = '14f093cb-17fc-41d0-b449-65a4c1d22df0'::uuid
    AND is_active = true
) subquery;

-- 4. Información de debug: Día actual del sistema
SELECT 'PASO 4: Información de fecha/hora del servidor' as paso;
SELECT
    CURRENT_DATE as fecha_actual,
    TO_CHAR(CURRENT_DATE, 'Day') as dia_semana_texto,
    EXTRACT(DOW FROM CURRENT_DATE) as dow_javascript,
    CASE
        WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN 6
        ELSE EXTRACT(DOW FROM CURRENT_DATE)::int
    END as dow_sistema_marcacion;
