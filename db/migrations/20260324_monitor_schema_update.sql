-- MIGRATION: 20260324_monitor_schema_update.sql
-- Description: Refactor for Monitor Operativo 360 (Hierarchy, Auditing, Realtime)

-- 1. Update job_positions
ALTER TABLE public.job_positions 
ADD COLUMN IF NOT EXISTS icon_name TEXT DEFAULT 'supervisor_account',
ADD COLUMN IF NOT EXISTS can_view_monitor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS supervision_scope TEXT DEFAULT 'DIRECT_ONLY'; -- DIRECT_ONLY | RECURSIVE

-- 2. Refactor attendance_logs (Extensions for Auditing)
-- If attendance_logs doesn't have these columns, add them.
ALTER TABLE public.attendance_logs
ADD COLUMN IF NOT EXISTS source_origin TEXT CHECK (source_origin IN ('KIOSK', 'MONITOR_ADMIN', 'API')),
ADD COLUMN IF NOT EXISTS executed_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS device_metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Update employees for easier Realtime tracking
-- (Assuming these were partially added, ensuring types and defaults)
ALTER TABLE public.employees
ALTER COLUMN current_status SET DEFAULT 'offline',
ALTER COLUMN last_status_change SET DEFAULT NOW();

-- 4. Audit Log Function / Trigger (Omnichannel Sync)
-- This ensures every change in attendance_logs is tracked in audit_logs
CREATE OR REPLACE FUNCTION public.fn_audit_attendance_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (
        company_id,
        table_name,
        action,
        record_id,
        performed_by_profile_id,
        source,
        details
    ) VALUES (
        NEW.company_id,
        'attendance_logs',
        'MARK_ATTENDANCE',
        NEW.id,
        NEW.recorded_by,
        NEW.source,
        jsonb_build_object(
            'action', NEW.action,
            'status', NEW.status,
            'origin', NEW.source_origin,
            'recorded_at', NEW.recorded_at
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_audit_attendance ON public.attendance_logs;
CREATE TRIGGER tr_audit_attendance
AFTER INSERT ON public.attendance_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_attendance_log();

-- 5. Enable Realtime for critical tables
-- Note: This might need to be run in the Supabase SQL Editor manually if publication exists
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
