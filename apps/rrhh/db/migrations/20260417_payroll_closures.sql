-- Módulo Nómina y Cierres
-- Tabla para registrar cierres de período de nómina

CREATE TABLE IF NOT EXISTS public.payroll_closures (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id     uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  status        text DEFAULT 'draft' CHECK (status IN ('draft', 'closed', 'approved')),
  total_employees int DEFAULT 0,
  total_days    int DEFAULT 0,
  total_hours   numeric(10,2) DEFAULT 0,
  total_amount  numeric(12,2) DEFAULT 0,
  notes         text,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  closed_at     timestamptz,
  approved_at   timestamptz
);

-- RLS
ALTER TABLE public.payroll_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_closures_company_isolation" ON public.payroll_closures
  USING (company_id = (
    SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
  ));

CREATE POLICY "payroll_closures_insert" ON public.payroll_closures
  FOR INSERT WITH CHECK (company_id = (
    SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
  ));

CREATE POLICY "payroll_closures_update" ON public.payroll_closures
  FOR UPDATE USING (company_id = (
    SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
  ));
