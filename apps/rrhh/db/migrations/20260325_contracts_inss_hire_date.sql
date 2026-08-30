-- Migration: Add INSS and hire_date fields to contracts table
-- Purpose: Move employee-dependent contract information to the contracts table
-- These fields are contract-specific and should not be in the employee profile

ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS social_security_number TEXT,
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS job_position_id UUID REFERENCES public.job_positions(id) ON DELETE SET NULL;


-- Create index for hire_date for better query performance
CREATE INDEX IF NOT EXISTS contracts_hire_date_idx ON public.contracts(hire_date);
CREATE INDEX IF NOT EXISTS contracts_social_security_idx ON public.contracts(social_security_number);
CREATE INDEX IF NOT EXISTS contracts_job_position_idx ON public.contracts(job_position_id);


-- Add comment to clarify column purpose
COMMENT ON COLUMN public.contracts.social_security_number IS 'INSS/Social Security number - contract specific identifier';
COMMENT ON COLUMN public.contracts.hire_date IS 'Employment start date per contract';

