-- ======================================================================
-- MIGRACIÓN: Implementar Turno de Sábado Diferente (8am-3pm)
-- Proyecto: marcacion-grupo-ct
-- Fecha: 2026-03-26
-- ======================================================================

-- 1. Verificar estructura de tabla shifts
-- SELECT id, name, start_time, end_time, days_of_week FROM shifts LIMIT 10;

-- 2. Crear turno de Lunes a Viernes si no existe
-- (Sin ON CONFLICT porque no hay constraint único)
INSERT INTO shifts (name, start_time, end_time, days_of_week, is_active)
SELECT 'Lunes a Viernes', '08:00', '17:00', ARRAY[1,2,3,4,5], true
WHERE NOT EXISTS (
  SELECT 1 FROM shifts WHERE name = 'Lunes a Viernes'
);

-- 3. Crear turno de Sábado si no existe
INSERT INTO shifts (name, start_time, end_time, days_of_week, is_active)
SELECT 'Sábado', '08:00', '15:00', ARRAY[6], true
WHERE NOT EXISTS (
  SELECT 1 FROM shifts WHERE name = 'Sábado'
);

-- 4. Verificar que ambos turnos existan
SELECT id, name, start_time, end_time, days_of_week, is_active
FROM shifts
WHERE name IN ('Lunes a Viernes', 'Sábado')
ORDER BY name;

-- 5. (OPCIONAL) Si necesitas cambiar un turno existente, descomenta esto:
-- UPDATE shifts
-- SET start_time = '08:00', end_time = '17:00', days_of_week = ARRAY[1,2,3,4,5]
-- WHERE name = 'Lunes a Viernes';
--
-- UPDATE shifts
-- SET start_time = '08:00', end_time = '15:00', days_of_week = ARRAY[6]
-- WHERE name = 'Sábado';
