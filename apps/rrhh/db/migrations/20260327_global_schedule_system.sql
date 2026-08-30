-- MIGRATION: Gestor360 - Sistema de Planificación Global de Turnos
-- Fecha: 2026-03-27
-- Descripción: Implementa la "Planilla Maestra por Puestos" con herencia de turnos

-- ============================================================================
-- 1. TABLA: shift_templates (Definiciones reutilizables de turnos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  color_code VARCHAR(7) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users" ON public.shift_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert/update/delete for authenticated users" ON public.shift_templates
  FOR ALL TO authenticated USING (true);

CREATE INDEX idx_shift_templates_company_id ON public.shift_templates(company_id);
CREATE INDEX idx_shift_templates_is_active ON public.shift_templates(is_active);

-- ============================================================================
-- 2. TABLA: global_schedules (Planilla Maestra: posición × día de semana)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.global_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_position_id UUID NOT NULL REFERENCES public.job_positions(id) ON DELETE CASCADE,
  shift_template_id UUID NOT NULL REFERENCES public.shift_templates(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(company_id, job_position_id, day_of_week)
);

ALTER TABLE public.global_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users" ON public.global_schedules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert/update/delete for authenticated users" ON public.global_schedules
  FOR ALL TO authenticated USING (true);

CREATE INDEX idx_global_schedules_company_position
  ON public.global_schedules(company_id, job_position_id);
CREATE INDEX idx_global_schedules_company_dow
  ON public.global_schedules(company_id, day_of_week);
CREATE INDEX idx_global_schedules_deleted_at
  ON public.global_schedules(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. TABLA: employee_shift_overrides (Asignaciones individuales puntuales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_shift_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_template_id UUID REFERENCES public.shift_templates(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  reason VARCHAR(500),
  authorized_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(company_id, employee_id, scheduled_date)
);

ALTER TABLE public.employee_shift_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users" ON public.employee_shift_overrides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert/update/delete for authenticated users" ON public.employee_shift_overrides
  FOR ALL TO authenticated USING (true);

CREATE INDEX idx_employee_overrides_company_date
  ON public.employee_shift_overrides(company_id, scheduled_date);
CREATE INDEX idx_employee_overrides_employee_date
  ON public.employee_shift_overrides(employee_id, scheduled_date);
CREATE INDEX idx_employee_overrides_deleted_at
  ON public.employee_shift_overrides(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. TABLA: branch_default_shifts (Fallback: turno por defecto por sucursal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.branch_default_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  shift_template_id UUID NOT NULL REFERENCES public.shift_templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, branch_id, day_of_week)
);

ALTER TABLE public.branch_default_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users" ON public.branch_default_shifts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert/update/delete for authenticated users" ON public.branch_default_shifts
  FOR ALL TO authenticated USING (true);

CREATE INDEX idx_branch_default_shifts_company_branch
  ON public.branch_default_shifts(company_id, branch_id);

-- ============================================================================
-- 5. TABLA: shift_change_logs (Auditoría de cambios)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shift_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shift_change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users" ON public.shift_change_logs
  FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_shift_change_logs_company_created
  ON public.shift_change_logs(company_id, created_at);
