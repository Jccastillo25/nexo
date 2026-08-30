-- MIGRATION: 20260324_sync_legacy_records.sql (Fixed)
-- Description: Unifies attendance history by migrating time_records (events) to attendance_logs (sessions)
-- Note: Simplified to only use columns that exist in attendance_logs.

WITH paired_events AS (
    SELECT 
        in_rec.employee_id, 
        in_rec.recorded_at AS clock_in,
        (SELECT out_rec.recorded_at FROM public.time_records out_rec 
         WHERE out_rec.employee_id = in_rec.employee_id AND out_rec.event_type = 'clock_out' 
         AND out_rec.recorded_at > in_rec.recorded_at AND out_rec.recorded_at < (in_rec.recorded_at + interval '18 hours')
         ORDER BY out_rec.recorded_at ASC LIMIT 1) AS clock_out,
        in_rec.tardiness_minutes,
        CASE WHEN in_rec.tardiness_minutes > 0 THEN 'late' ELSE 'on_time' END AS status
    FROM public.time_records in_rec WHERE in_rec.event_type = 'clock_in'
)
INSERT INTO public.attendance_logs (employee_id, clock_in, clock_out, status, source_origin, notes)
SELECT pe.employee_id, pe.clock_in, pe.clock_out, pe.status::text, 'API', 'Migración'
FROM paired_events pe
WHERE NOT EXISTS (
    SELECT 1 FROM public.attendance_logs al 
    WHERE al.employee_id = pe.employee_id 
    AND al.clock_in = pe.clock_in
);
