-- ======================================================================
-- MIGRACIÓN: Implementar Turno de Sábado Diferente (8am-3pm)
-- Proyecto: marcacion-grupo-ct
-- Fecha: 2026-03-26
-- Company: Gestor360 (14f093cb-17fc-41d0-b449-65a4c1d22df0)
-- ======================================================================

-- 1. Crear turno de Sábado (08:00 - 15:00) si no existe
INSERT INTO shifts (name, start_time, end_time, days_of_week, is_active, company_id)
SELECT
    'Turno Administrativo - Sábado',
    '08:00'::time,
    '15:00'::time,
    ARRAY[6],
    true,
    '14f093cb-17fc-41d0-b449-65a4c1d22df0'::uuid
WHERE NOT EXISTS (
    SELECT 1 FROM shifts
    WHERE name = 'Turno Administrativo - Sábado'
    AND company_id = '14f093cb-17fc-41d0-b449-65a4c1d22df0'::uuid
);

-- 2. Verificar que ambos turnos existan
SELECT id, name, start_time, end_time, days_of_week, company_id
FROM shifts
WHERE company_id = '14f093cb-17fc-41d0-b449-65a4c1d22df0'::uuid
ORDER BY name;
