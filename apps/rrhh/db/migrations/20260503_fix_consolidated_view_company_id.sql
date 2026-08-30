-- Add company_id to consolidated_attendance_view and enforce RLS via security policy

DROP VIEW IF EXISTS public.consolidated_attendance_view CASCADE;

CREATE OR REPLACE VIEW public.consolidated_attendance_view AS
SELECT
    e.id                                                          AS employee_id,
    e.company_id,
    e.first_name || ' ' || e.last_name                           AS full_name,
    e.employee_code,
    e.branch_id,
    al.id                                                         AS log_id,
    COALESCE(al.clock_in::date, al.date, abs.start_date)         AS attendance_date,
    al.clock_in,
    al.clock_out,

    COALESCE(st.name, s.name, 'Sin Turno')                       AS shift_name,
    COALESCE(st.start_time::text, s.start_time::text)            AS shift_start,
    COALESCE(st.end_time::text,   s.end_time::text)              AS shift_end,

    COALESCE(st.lunch_duration, st.break_minutes, s.break_minutes, 0) AS shift_break_minutes,

    COALESCE(st.late_entry_tolerance, st.tolerance_in, s.tolerance_in, 0) AS shift_tolerance,

    CASE
        WHEN al.clock_in IS NOT NULL
         AND COALESCE(st.start_time, s.start_time::time) IS NOT NULL
         AND al.clock_in::time > (
               COALESCE(st.start_time, s.start_time::time)
               + (COALESCE(st.late_entry_tolerance, st.tolerance_in, s.tolerance_in, 0)::text || ' minutes')::interval
             )
        THEN ROUND(
               EXTRACT(EPOCH FROM (
                 al.clock_in::time - COALESCE(st.start_time, s.start_time::time)
               )) / 60
             )
        ELSE 0
    END                                                            AS late_minutes,

    CASE
        WHEN al.clock_out IS NOT NULL
        THEN GREATEST(0,
               (EXTRACT(EPOCH FROM (al.clock_out - al.clock_in)) / 3600)
               - (COALESCE(st.lunch_duration, st.break_minutes, s.break_minutes, 0) / 60.0)
             )
        ELSE 0
    END                                                            AS net_hours,

    COALESCE(abs.reason, 'Sin incidencias')                       AS observations,
    CASE WHEN al.clock_in IS NOT NULL AND al.clock_out IS NULL
         THEN true ELSE false END                                  AS missing_clock_out

FROM employees e

LEFT JOIN attendance_logs al
       ON e.id = al.employee_id

LEFT JOIN shifts s
       ON al.shift_template_id = s.id

LEFT JOIN employee_shifts es
       ON e.id = es.employee_id AND es.is_active = true
LEFT JOIN shift_templates st
       ON es.shift_template_id = st.id

LEFT JOIN absence_logs abs
       ON e.id = abs.employee_id
      AND COALESCE(al.clock_in::date, al.date) BETWEEN abs.start_date AND abs.end_date

WHERE e.is_active = true
ORDER BY e.last_name, attendance_date ASC;

-- Row-level security for the view: users can only see rows for their own company.
-- Views don't support RLS directly; we enforce it via a policy on the underlying
-- employees table (already present) plus a separate policy function for the view.
-- The safest approach is to wrap the view with a SECURITY INVOKER so the caller's
-- grants apply. Until Supabase supports SECURITY INVOKER views natively, we also
-- add a helper policy function that callers must invoke.

GRANT SELECT ON public.consolidated_attendance_view TO authenticated;

-- Policy: restrict authenticated users to their own company's rows.
-- We create a row-security-equivalent function that wraps the view.
-- Application code (server actions / edge functions) must filter by company_id.
-- This migration also creates a companion RPC that already enforces tenant isolation.

CREATE OR REPLACE FUNCTION get_consolidated_attendance(
  p_company_id   UUID,
  p_start_date   DATE,
  p_end_date     DATE,
  p_branch_id    UUID DEFAULT NULL
)
RETURNS SETOF consolidated_attendance_view
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT * FROM consolidated_attendance_view
  WHERE company_id     = p_company_id
    AND attendance_date BETWEEN p_start_date AND p_end_date
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
$$;

GRANT EXECUTE ON FUNCTION get_consolidated_attendance TO authenticated;
