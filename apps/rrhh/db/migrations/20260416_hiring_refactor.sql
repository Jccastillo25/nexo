-- Migration: 20260416_hiring_refactor
-- Drop legacy or unused ruc_number column
ALTER TABLE public.employees DROP COLUMN IF EXISTS ruc_number;

-- Add inss_status and inss_grace_expiry
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS inss_status VARCHAR(20) DEFAULT 'PENDING_GRACE',
ADD COLUMN IF NOT EXISTS inss_grace_expiry DATE;

-- Create Trigger function
CREATE OR REPLACE FUNCTION public.handle_inss_grace_period()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.social_security_id IS NULL OR TRIM(NEW.social_security_id) = '' THEN
    NEW.inss_status := 'PENDING_GRACE';
    NEW.inss_grace_expiry := COALESCE(NEW.hire_date, CURRENT_DATE) + INTERVAL '5 days';
  ELSE
    NEW.inss_status := 'ACTIVE';
    NEW.inss_grace_expiry := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger
DROP TRIGGER IF EXISTS trigger_inss_grace ON public.employees;
CREATE TRIGGER trigger_inss_grace
BEFORE INSERT OR UPDATE OF social_security_id, hire_date ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.handle_inss_grace_period();

-- Backfill existing rows for safety
UPDATE public.employees 
SET 
  inss_status = CASE WHEN social_security_id IS NULL OR TRIM(social_security_id) = '' THEN 'PENDING_GRACE' ELSE 'ACTIVE' END,
  inss_grace_expiry = CASE WHEN social_security_id IS NULL OR TRIM(social_security_id) = '' THEN COALESCE(hire_date, CURRENT_DATE) + INTERVAL '5 days' ELSE NULL END
WHERE inss_status IS NULL OR inss_status = 'PENDING_GRACE';
