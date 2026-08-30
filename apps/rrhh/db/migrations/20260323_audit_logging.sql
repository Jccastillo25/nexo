-- PART 2: Audit Logging System
-- Tracks all attendance changes, who made them, and the source (KIOSK vs MONITOR)

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  table_name VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, MARK_ATTENDANCE
  record_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source VARCHAR(50), -- 'KIOSK', 'MONITOR', 'API', 'ADMIN'
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'MARK_ATTENDANCE'))
);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs from their company"
ON audit_logs
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- Create indexes for audit queries
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_table_action ON audit_logs(table_name, action);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);

-- Function to log attendance changes
CREATE OR REPLACE FUNCTION log_attendance_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    company_id,
    table_name,
    action,
    record_id,
    performed_by_profile_id,
    details,
    created_at
  ) VALUES (
    NEW.company_id,
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    auth.uid(),
    jsonb_build_object(
      'employee_id', COALESCE(NEW.employee_id, OLD.employee_id),
      'old_data', to_jsonb(OLD),
      'new_data', to_jsonb(NEW)
    ),
    NOW()
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for attendance tables
DROP TRIGGER IF EXISTS audit_attendance_logs ON attendance_logs;
CREATE TRIGGER audit_attendance_logs
AFTER INSERT OR UPDATE OR DELETE ON attendance_logs
FOR EACH ROW
EXECUTE FUNCTION log_attendance_change();

DROP TRIGGER IF EXISTS audit_absence_logs ON absence_logs;
CREATE TRIGGER audit_absence_logs
AFTER INSERT OR UPDATE OR DELETE ON absence_logs
FOR EACH ROW
EXECUTE FUNCTION log_attendance_change();

