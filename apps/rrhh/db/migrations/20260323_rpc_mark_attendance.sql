-- PART 3: RPC Function for marking attendance with source tracking
-- This centralizes attendance logic and ensures audit trail

-- Create an enum type for attendance source (if it doesn't exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_source') THEN
    CREATE TYPE attendance_source AS ENUM ('KIOSK', 'MONITOR', 'API', 'IMPORT');
  END IF;
END $$;

-- Create the main RPC function
CREATE OR REPLACE FUNCTION rpc_mark_attendance_action(
  p_company_id UUID,
  p_employee_id UUID,
  p_action VARCHAR, -- 'CLOCK_IN', 'CLOCK_OUT', 'START_BREAK', 'END_BREAK'
  p_source attendance_source,
  p_executed_by UUID DEFAULT NULL, -- NULL = auth.uid(), supervisor ID if marked from Monitor
  p_notes TEXT DEFAULT NULL,
  p_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  attendance_log_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_employee RECORD;
  v_executed_by UUID;
  v_new_log_id UUID;
  v_last_status VARCHAR;
BEGIN
  -- Resolve executed_by (default to current user if not provided)
  v_executed_by := COALESCE(p_executed_by, auth.uid());

  -- Verify employee exists in company
  SELECT id, company_id INTO v_employee
  FROM employees
  WHERE id = p_employee_id AND company_id = p_company_id
  LIMIT 1;

  IF v_employee.id IS NULL THEN
    RETURN QUERY SELECT
      false,
      'Employee not found in company'::TEXT,
      NULL::UUID,
      NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;

  -- Get the last attendance action
  SELECT status INTO v_last_status
  FROM attendance_logs
  WHERE employee_id = p_employee_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Validate state transitions
  CASE p_action
    WHEN 'CLOCK_IN' THEN
      IF v_last_status IN ('CLOCKED_IN', 'ON_BREAK') THEN
        RETURN QUERY SELECT
          false,
          'Employee is already clocked in'::TEXT,
          NULL::UUID,
          NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
      END IF;
    WHEN 'CLOCK_OUT' THEN
      IF v_last_status NOT IN ('CLOCKED_IN', 'ON_BREAK') THEN
        RETURN QUERY SELECT
          false,
          'Employee is not clocked in'::TEXT,
          NULL::UUID,
          NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
      END IF;
    WHEN 'START_BREAK' THEN
      IF v_last_status != 'CLOCKED_IN' THEN
        RETURN QUERY SELECT
          false,
          'Employee must be clocked in to start break'::TEXT,
          NULL::UUID,
          NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
      END IF;
    WHEN 'END_BREAK' THEN
      IF v_last_status != 'ON_BREAK' THEN
        RETURN QUERY SELECT
          false,
          'Employee is not on break'::TEXT,
          NULL::UUID,
          NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
      END IF;
  END CASE;

  -- Create the attendance log
  INSERT INTO attendance_logs (
    id,
    company_id,
    employee_id,
    action,
    status,
    recorded_at,
    recorded_by,
    notes,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_company_id,
    p_employee_id,
    p_action,
    CASE p_action
      WHEN 'CLOCK_IN' THEN 'CLOCKED_IN'
      WHEN 'CLOCK_OUT' THEN 'CLOCKED_OUT'
      WHEN 'START_BREAK' THEN 'ON_BREAK'
      WHEN 'END_BREAK' THEN 'CLOCKED_IN'
    END,
    p_timestamp,
    v_executed_by,
    COALESCE(p_notes, 'Marked from ' || p_source::TEXT),
    NOW(),
    NOW()
  )
  RETURNING attendance_logs.id INTO v_new_log_id;

  -- Log the audit
  INSERT INTO audit_logs (
    company_id,
    table_name,
    action,
    record_id,
    user_id,
    performed_by_profile_id,
    source,
    details,
    created_at
  ) VALUES (
    p_company_id,
    'attendance_logs',
    'MARK_ATTENDANCE',
    v_new_log_id,
    auth.uid(),
    v_executed_by,
    p_source::TEXT,
    jsonb_build_object(
      'action', p_action,
      'employee_id', p_employee_id,
      'executed_by', v_executed_by,
      'notes', p_notes
    ),
    NOW()
  );

  -- Return success
  RETURN QUERY SELECT
    true,
    'Attendance marked successfully'::TEXT,
    v_new_log_id,
    NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION rpc_mark_attendance_action TO authenticated;

-- Create a helper function for supervisors to mark attendance from Monitor
CREATE OR REPLACE FUNCTION rpc_monitor_mark_attendance(
  p_company_id UUID,
  p_employee_id UUID,
  p_action VARCHAR,
  p_supervisor_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  attendance_log_id UUID
) AS $$
BEGIN
  -- Verify supervisor is in the same company
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_supervisor_id
    AND company_id = p_company_id
  ) THEN
    RETURN QUERY SELECT
      false,
      'Supervisor not authorized for this company'::TEXT,
      NULL::UUID;
    RETURN;
  END IF;

  -- Call the main function with MONITOR as source
  RETURN QUERY
  SELECT
    (result).success,
    (result).message,
    (result).attendance_log_id
  FROM (
    SELECT rpc_mark_attendance_action(
      p_company_id,
      p_employee_id,
      p_action,
      'MONITOR'::attendance_source,
      p_supervisor_id,
      p_notes,
      NOW()
    ) as result
  ) sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION rpc_monitor_mark_attendance TO authenticated;

