-- Migration: Hybrid Security Model
-- Agrega columnas organizacionales y aplica la restricción de verdad híbrida.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS company_id UUID,
ADD COLUMN IF NOT EXISTS branch_id UUID;

ALTER TABLE public.profiles
ADD CONSTRAINT chk_hybrid_security_entity
CHECK (
  (linked_employee_id IS NOT NULL)
  OR
  (linked_employee_id IS NULL AND company_id IS NOT NULL)
) NOT VALID;
