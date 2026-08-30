-- Fix RPC rpc_mark_attendance_action
-- Problema: el RPC insertaba una fila nueva por cada acción sin setear clock_in,
-- y validaba el estado usando el campo `status` ('on_time'/'late') en vez de clock_out IS NULL.
-- Solución:
--   CLOCK_IN  → INSERT con clock_in=now, validar con clock_out IS NULL
--   CLOCK_OUT → UPDATE la fila abierta (clock_out IS NULL) en vez de insertar
--   START_BREAK / END_BREAK → solo UPDATE employees.current_status

CREATE OR REPLACE FUNCTION rpc_mark_attendance_action(
  p_company_id   UUID,
  p_employee_id  UUID,
  p_action       VARCHAR,
  p_source       attendance_source,
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
  v_employee      RECORD;
  v_executed_by   UUID;
  v_new_log_id    UUID;
  v_open_log_id   UUID;
  v_is_open       BOOLEAN;
  v_emp_status    TEXT;
BEGIN
  v_executed_by := COALESCE(p_executed_by, auth.uid());

  -- Verificar empleado en la empresa
  SELECT id, company_id INTO v_employee
  FROM employees
  WHERE id = p_employee_id AND company_id = p_company_id
  LIMIT 1;

  IF v_employee.id IS NULL THEN
    RETURN QUERY SELECT false, 'Empleado no encontrado en la empresa'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Estado real: registro abierto en attendance_logs + current_status del empleado
  SELECT id INTO v_open_log_id
  FROM attendance_logs
  WHERE employee_id = p_employee_id AND clock_out IS NULL
  LIMIT 1;

  v_is_open := v_open_log_id IS NOT NULL;

  SELECT current_status INTO v_emp_status
  FROM employees WHERE id = p_employee_id;

  -- ── Validaciones de transición ─────────────────────────────────────────────
  CASE p_action
    WHEN 'CLOCK_IN' THEN
      IF v_is_open OR v_emp_status IN ('active', 'on_break') THEN
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
  END CASE;

  -- ── Ejecutar acción ────────────────────────────────────────────────────────
  IF p_action = 'CLOCK_IN' THEN
    -- Insertar nuevo registro con clock_in
    INSERT INTO attendance_logs (
      id, company_id, employee_id,
      clock_in, date,
      status, source_origin, executed_by, notes,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), p_company_id, p_employee_id,
      p_timestamp, p_timestamp::date,
      'on_time', p_source::TEXT, v_executed_by,
      COALESCE(p_notes, 'Entrada registrada desde ' || p_source::TEXT),
      NOW(), NOW()
    )
    RETURNING attendance_logs.id INTO v_new_log_id;

    -- Actualizar estado del empleado
    UPDATE employees SET
      current_status   = 'active',
      last_status_change = p_timestamp
    WHERE id = p_employee_id;

  ELSIF p_action = 'CLOCK_OUT' THEN
    -- Cerrar el registro abierto
    UPDATE attendance_logs SET
      clock_out  = p_timestamp,
      notes      = COALESCE(p_notes, 'Salida registrada desde ' || p_source::TEXT),
      updated_at = NOW()
    WHERE id = v_open_log_id
    RETURNING attendance_logs.id INTO v_new_log_id;

    UPDATE employees SET
      current_status   = 'offline',
      last_status_change = p_timestamp
    WHERE id = p_employee_id;

  ELSIF p_action = 'START_BREAK' THEN
    v_new_log_id := v_open_log_id; -- Reutiliza el log abierto
    UPDATE employees SET
      current_status   = 'on_break',
      last_status_change = p_timestamp
    WHERE id = p_employee_id;

  ELSIF p_action = 'END_BREAK' THEN
    v_new_log_id := v_open_log_id;
    UPDATE employees SET
      current_status   = 'active',
      last_status_change = p_timestamp
    WHERE id = p_employee_id;
  END IF;

  -- Auditoría
  INSERT INTO audit_logs (
    company_id, table_name, action, record_id,
    user_id, performed_by_profile_id, source, details, created_at
  ) VALUES (
    p_company_id, 'attendance_logs', 'MARK_ATTENDANCE', v_new_log_id,
    auth.uid(), v_executed_by, p_source::TEXT,
    jsonb_build_object('action', p_action, 'employee_id', p_employee_id, 'notes', p_notes),
    NOW()
  );

  RETURN QUERY SELECT true, 'Marcación realizada correctamente'::TEXT, v_new_log_id, NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION rpc_mark_attendance_action TO authenticated;
