-- MIGRATION: 20260324_sync_legacy_records.sql
-- Description: Migrates data from legacy 'time_records' to the new 'attendance_logs' format.

-- 1. Create a CTE to pair clock_in and clock_out events
WITH paired_events AS (
    SELECT 
        in_rec.employee_id,
        in_rec.company_id,
        in_rec.branch_id,
        in_rec.recorded_at AS clock_in,
        (
            SELECT out_rec.recorded_at 
            FROM public.time_records out_rec 
            WHERE out_rec.employee_id = in_rec.employee_id 
              AND out_rec.event_type = 'clock_out' 
              AND out_rec.recorded_at > in_rec.recorded_at
              AND out_rec.recorded_at < (in_rec.recorded_at + interval '18 hours') -- Limit search to same day-ish
            ORDER BY out_rec.recorded_at ASC 
            LIMIT 1
        ) AS clock_out,
        in_rec.tardiness_minutes,
        CASE 
            WHEN in_rec.tardiness_minutes > 0 THEN 'late'
            ELSE 'on_time'
        END AS status
    FROM public.time_records in_rec
    WHERE in_rec.event_type = 'clock_in'
)
-- 2. Insert into attendance_logs only if they don't already exist (prevent duplicates)
INSERT INTO public.attendance_logs (
    employee_id,
    company_id,
    branch_id,
    clock_in,
    clock_out,
    status,
    source_origin,
    notes
)
SELECT 
    pe.employee_id,
    pe.company_id,
    pe.branch_id,
    pe.clock_in,
    pe.clock_out,
    pe.status::text,
    'API' as source_origin,
    'Migración desde time_records' as notes
FROM paired_events pe
WHERE NOT EXISTS (
    SELECT 1 FROM public.attendance_logs al 
    WHERE al.employee_id = pe.employee_id 
      AND al.clock_in = pe.clock_in
);

-- 3. Also handle lone clock_out events that might not have a matching clock_in in our look-ahead
-- (Optional: usually not needed if data is clean, but good for completeness)
-- In this case, we'll assume clock_in is the master record for session creation.
