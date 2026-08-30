-- ============================================================
-- Monitor Module — Production Fixes
-- 1. Realtime habilitado en employees y attendance_logs
-- 2. consolidated_attendance_view: une shift_templates para horas/tardanza correctas
-- 3. RPC: auto-detecta shift_template_id al hacer CLOCK_IN
-- ============================================================

-- ── 1. Habilitar Realtime en tablas críticas ─────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;

-- ── 2. Vista consolidada corregida ──────────────────────────────────────────
DROP VIEW IF EXISTS public.consolidated_attendance_view CASCADE;

CREATE OR REPLACE VIEW public.consolidated_attendance_view AS
SELECT
    e.id                                                          AS employee_id,
    e.first_name || ' ' || e.last_name                           AS full_name,
    e.employee_code,
    e.branch_id,
    al.id                                                         AS log_id,
    COALESCE(al.clock_in::date, al.date, abs.start_date)         AS attendance_date,
    al.clock_in,
    al.clock_out,

    -- Nombre del turno: preferir shift_templates, caer a shifts (sistema legacy)
    COALESCE(st.name, s.name, 'Sin Turno')                       AS shift_name,
    COALESCE(st.start_time::text, s.start_time::text)            AS shift_start,
    COALESCE(st.end_time::text,   s.end_time::text)              AS shift_end,

    -- Minutos de pausa efectivos
    COALESCE(st.lunch_duration, st.break_minutes, s.break_minutes, 0) AS shift_break_minutes,

    -- Tolerancia de entrada
    COALESCE(st.late_entry_tolerance, st.tolerance_in, s.tolerance_in, 0) AS shift_tolerance,

    -- ── Tardanza (minutos) ───────────────────────────────────────────────────
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

    -- ── Horas netas trabajadas ───────────────────────────────────────────────
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

-- Logs de asistencia (un empleado puede tener múltiples registros históricos)
LEFT JOIN attendance_logs al
       ON e.id = al.employee_id

-- Turno del log (sistema nuevo — shift_templates)
LEFT JOIN shift_templates st
       ON al.shift_template_id = st.id

-- Turno legacy del empleado (sistema antiguo — shifts)
LEFT JOIN employee_shifts es
       ON e.id = es.employee_id AND es.is_active = true
LEFT JOIN shifts s
       ON es.shift_id = s.id

-- Ausencias que cubren la fecha del log
LEFT JOIN absence_logs abs
       ON e.id = abs.employee_id
      AND COALESCE(al.clock_in::date, al.date) BETWEEN abs.start_date AND abs.end_date

WHERE e.is_active = true
ORDER BY e.last_name, attendance_date ASC;

-- Dar permisos de lectura
GRANT SELECT ON public.consolidated_attendance_view TO authenticated;

-- ── 3. RPC corregido: detecta shift_template, actualiza status, retorna bien ──
CREATE OR REPLACE FUNCTION rpc_mark_attendance_action(
  p_company_id   UUID,
  p_employee_id  UUID,
  p_action       TEXT,
  p_source       TEXT,
  p_executed_by  UUID DEFAULT NULL,
  p_notes        TEXT DEFAULT NULL,
  p_timestamp    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  success            BOOLEAN,
  message            TEXT,
  attendance_log_id  UUID,
  created_at         TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_executed_by        UUID;
  v_new_log_id         UUID;
  v_open_log_id        UUID;
  v_is_open            BOOLEAN;
  v_emp_status         TEXT;
  v_employee           RECORD;
  v_shift_template_id  UUID;
BEGIN
  v_executed_by := COALESCE(p_executed_by, auth.uid());

  -- Verificar empleado
  SELECT id, company_id INTO v_employee
  FROM employees
  WHERE id = p_employee_id AND company_id = p_company_id LIMIT 1;

  IF v_employee.id IS NULL THEN
    RETURN QUERY SELECT false, 'Empleado no encontrado'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Estado actual
  SELECT current_status INTO v_emp_status FROM employees WHERE id = p_employee_id;

  -- Jornada abierta (sin clock_out)
  SELECT id INTO v_open_log_id
  FROM attendance_logs
  WHERE employee_id = p_employee_id AND clock_out IS NULL
  ORDER BY clock_in DESC LIMIT 1;

  v_is_open := v_open_log_id IS NOT NULL;

  -- Validaciones
  CASE p_action
    WHEN 'CLOCK_IN' THEN
      IF v_is_open OR v_emp_status IN ('active','on_break') THEN
        RETURN QUERY SELECT false, 'El empleado ya tiene una jornada abierta'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
        RETURN;
      END IF;
    WHEN 'CLOCK_OUT' THEN
      IF NOT v_is_open THEN
        RETURN QUERY SELECT false, 'El empleado no tiene jornada abierta'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
        RETURN;
      END IF;
    WHEN 'START_BREAK' THEN
      IF v_emp_status != 'active' THEN
        RETURN QUERY SELECT false, 'El empleado debe estar activo para iniciar descanso'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
        RETURN;
      END IF;
    WHEN 'END_BREAK' THEN
      IF v_emp_status != 'on_break' THEN
        RETURN QUERY SELECT false, 'El empleado no está en descanso'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
        RETURN;
      END IF;
    ELSE
      RETURN QUERY SELECT false, 'Acción no reconocida: ' || p_action, NULL::UUID, NULL::TIMESTAMPTZ;
      RETURN;
  END CASE;

  -- Buscar shift_template activo del empleado (para CLOCK_IN)
  IF p_action = 'CLOCK_IN' THEN
    -- 1. Override específico del empleado
    SELECT shift_template_id INTO v_shift_template_id
    FROM employee_shift_overrides
    WHERE employee_id = p_employee_id AND is_active = true
    LIMIT 1;

    -- 2. Asignación global por posición/sucursal para el día de la semana actual
    IF v_shift_template_id IS NULL THEN
      SELECT gs.shift_template_id INTO v_shift_template_id
      FROM global_schedules gs
      JOIN employees emp ON emp.id = p_employee_id
      WHERE gs.company_id = p_company_id
        AND (gs.branch_id IS NULL OR gs.branch_id = emp.branch_id)
        AND gs.day_of_week = EXTRACT(DOW FROM p_timestamp)::int
        AND gs.is_active = true
      ORDER BY gs.branch_id NULLS LAST
      LIMIT 1;
    END IF;
  END IF;

  -- Ejecutar acción
  IF p_action = 'CLOCK_IN' THEN
    INSERT INTO attendance_logs (
      id, company_id, employee_id,
      clock_in, date,
      status, source_origin, executed_by,
      shift_template_id, notes,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), p_company_id, p_employee_id,
      p_timestamp, p_timestamp::date,
      'on_time', p_source, v_executed_by,
      v_shift_template_id,
      COALESCE(p_notes, 'Entrada registrada desde ' || p_source),
      NOW(), NOW()
    ) RETURNING attendance_logs.id INTO v_new_log_id;

    UPDATE employees SET
      current_status     = 'active',
      last_status_change = p_timestamp
    WHERE id = p_employee_id;

  ELSIF p_action = 'CLOCK_OUT' THEN
    UPDATE attendance_logs SET
      clock_out  = p_timestamp,
      notes      = COALESCE(p_notes, notes, 'Salida registrada desde ' || p_source),
      updated_at = NOW()
    WHERE id = v_open_log_id
    RETURNING attendance_logs.id INTO v_new_log_id;

    UPDATE employees SET
      current_status     = 'offline',
      last_status_change = p_timestamp
    WHERE id = p_employee_id;

  ELSIF p_action = 'START_BREAK' THEN
    v_new_log_id := v_open_log_id;
    UPDATE employees SET
      current_status     = 'on_break',
      last_status_change = p_timestamp
    WHERE id = p_employee_id;

    -- Registrar inicio de descanso en employee_status_logs si existe la tabla
    INSERT INTO employee_status_logs (employee_id, start_time, end_time_scheduled, authorized_by)
    SELECT p_employee_id, p_timestamp,
           p_timestamp + interval '60 minutes',
           v_executed_by
    WHERE EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'employee_status_logs'
    );

  ELSIF p_action = 'END_BREAK' THEN
    v_new_log_id := v_open_log_id;

    -- Cerrar el break log activo
    UPDATE employee_status_logs SET
      end_time_actual = p_timestamp
    WHERE employee_id = p_employee_id AND end_time_actual IS NULL;

    UPDATE employees SET
      current_status     = 'active',
      last_status_change = p_timestamp
    WHERE id = p_employee_id;
  END IF;

  -- Auditoría
  BEGIN
    INSERT INTO audit_logs (
      company_id, table_name, action, record_id,
      user_id, performed_by_profile_id, source, details, created_at
    ) VALUES (
      p_company_id, 'attendance_logs', 'MARK_ATTENDANCE', v_new_log_id,
      auth.uid(), v_executed_by, p_source,
      jsonb_build_object(
        'action', p_action,
        'employee_id', p_employee_id,
        'shift_template_id', v_shift_template_id,
        'notes', p_notes
      ),
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- No fallar si audit_logs tiene restricciones
  END;

  RETURN QUERY SELECT true, 'Marcación realizada correctamente'::TEXT, v_new_log_id, NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION rpc_mark_attendance_action TO authenticated;
