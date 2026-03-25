-- Migration: 20260325_fix_contracts_rls_update.sql
-- Description: Add missing UPDATE and DELETE policies for the contracts table

-- Add UPDATE policy
DROP POLICY IF EXISTS "Managers can update contracts from their company" ON public.contracts;
CREATE POLICY "Managers can update contracts from their company" ON public.contracts
FOR UPDATE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
);

-- Add DELETE policy
DROP POLICY IF EXISTS "Managers can delete contracts from their company" ON public.contracts;
CREATE POLICY "Managers can delete contracts from their company" ON public.contracts
FOR DELETE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
);

-- Add comment to clarify
COMMENT ON TABLE public.contracts IS 'Employment contracts with company-based RLS for CRUD operations';
