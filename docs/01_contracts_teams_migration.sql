-- SQL migration to add 'contracts' and 'team_id' to employees

-- 1. Create contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_type text, -- e.g., 'Indefinido', 'Temporal', 'Servicios'
  salary_amount numeric(12, 2),
  currency text DEFAULT 'NIO',
  start_date date,
  end_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS contracts_employee_id_idx ON public.contracts(employee_id);

-- 2. Add team_id to employees (optional groups feature)
-- We will create a teams table first
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add the column to employees if it doesn't exist
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
