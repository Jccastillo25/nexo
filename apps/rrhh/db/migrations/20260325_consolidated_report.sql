-- Master Query for Professional Attendance reports (v3 - DEFINITIVA + DROP FIX)
-- Fix: Using DROP VIEW to avoid 42P16 error and LEFT JOINs for data safety

DROP VIEW IF EXISTS public.consolidated_attendance_view CASCADE;

CREATE OR REPLACE VIEW public.consolidated_attendance_view AS
SELECT 
    e.id as employee_id,
    e.first_name || ' ' || e.last_name as full_name,
    e.employee_code,
    e.branch_id,
    al.id as log_id,
    COALESCE(al.clock_in::date, al.date, abs.start_date) as attendance_date,
    al.clock_in,
    al.clock_out,
    COALESCE(s.name, 'Sin Turno') as shift_name,
    s.start_time as shift_start,
    s.end_time as shift_end,
    COALESCE(s.break_minutes, 0) as shift_break_minutes,
    COALESCE(s.tolerance_in, 0) as shift_tolerance,
    
    -- Cálculos de servidor con salvaguardas
    CASE 
        WHEN al.clock_in IS NOT NULL AND s.start_time IS NOT NULL AND al.clock_in::time > (s.start_time::time + (COALESCE(s.tolerance_in, 0) || ' minutes')::interval) 
        THEN EXTRACT(EPOCH FROM (al.clock_in::time - s.start_time::time))/60 
        ELSE 0 
    END as late_minutes,
    
    CASE 
        WHEN al.clock_out IS NOT NULL 
        THEN (EXTRACT(EPOCH FROM (al.clock_out - al.clock_in))/3600) - (COALESCE(s.break_minutes, 0) / 60.0)
        ELSE 0 
    END as net_hours,
    
    COALESCE(abs.reason, 'Sin incidencias') as observations,
    
    CASE WHEN al.clock_in IS NOT NULL AND al.clock_out IS NULL THEN true ELSE false END as missing_clock_out

FROM employees e
LEFT JOIN employee_shifts es ON e.id = es.employee_id AND es.is_active = true
LEFT JOIN shifts s ON es.shift_id = s.id
LEFT JOIN attendance_logs al ON e.id = al.employee_id
LEFT JOIN absence_logs abs ON e.id = abs.employee_id AND (COALESCE(al.clock_in::date, al.date) BETWEEN abs.start_date AND abs.end_date)

WHERE e.is_active = true
ORDER BY e.last_name, attendance_date ASC;
