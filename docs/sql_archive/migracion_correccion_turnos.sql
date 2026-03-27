-- ======================================================================
-- MIGRACIÓN: Corregir estructura de turnos
-- Permitir UN turno con múltiples horarios por día de la semana
-- ======================================================================

-- 1. Crear tabla shift_schedules para guardar horarios por día
CREATE TABLE IF NOT EXISTS public.shift_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 6), -- 1=Lunes, 6=Sábado
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    tolerance_in INT DEFAULT 0,
    tolerance_out INT DEFAULT 0,
    break_minutes INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Evitar duplicados (mismo turno + mismo día)
    UNIQUE(shift_id, day_of_week)
);

ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.shift_schedules FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.shift_schedules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.shift_schedules FOR UPDATE USING (auth.role() = 'authenticated');

-- 2. Eliminar el turno "Turno Administrativo - Sábado" (mantener solo "Turno Administrativo")
DELETE FROM shifts WHERE name = 'Turno Administrativo - Sábado';

-- 3. Actualizar "Turno Administrativo" para que aplique a L-V SOLAMENTE (se agregarán sábados vía shift_schedules)
UPDATE shifts
SET days_of_week = ARRAY[1,2,3,4,5]
WHERE name = 'Turno Administrativo';

-- 4. Insertar horarios por día en shift_schedules para "Turno Administrativo"
INSERT INTO shift_schedules (shift_id, day_of_week, start_time, end_time, tolerance_in, tolerance_out, break_minutes)
SELECT
    '9e476662-c300-4775-a4b8-ff300018dd64'::uuid, -- ID del "Turno Administrativo"
    day,
    CASE WHEN day = 6 THEN '08:00'::time ELSE '07:30'::time END, -- 08:00 para sábado, 07:30 para otros
    CASE WHEN day = 6 THEN '15:00'::time ELSE '17:00'::time END, -- 15:00 para sábado, 17:00 para otros
    30, -- tolerance_in
    30, -- tolerance_out
    0   -- break_minutes
FROM (VALUES (1), (2), (3), (4), (5), (6)) AS days(day)
WHERE NOT EXISTS (
    SELECT 1 FROM shift_schedules
    WHERE shift_id = '9e476662-c300-4775-a4b8-ff300018dd64'::uuid
);

-- 5. Verificar configuración final
SELECT
    s.id,
    s.name,
    ss.day_of_week as "día",
    CASE
        WHEN ss.day_of_week = 1 THEN 'Lunes'
        WHEN ss.day_of_week = 2 THEN 'Martes'
        WHEN ss.day_of_week = 3 THEN 'Miércoles'
        WHEN ss.day_of_week = 4 THEN 'Jueves'
        WHEN ss.day_of_week = 5 THEN 'Viernes'
        WHEN ss.day_of_week = 6 THEN 'Sábado'
    END as día_nombre,
    ss.start_time as "hora_entrada",
    ss.end_time as "hora_salida"
FROM shifts s
LEFT JOIN shift_schedules ss ON s.id = ss.shift_id
WHERE s.name = 'Turno Administrativo'
ORDER BY ss.day_of_week;
