-- Archivo: 20260324_fix_rls_recursion.sql
-- Propósito: Eliminar el bucle infinito de RLS causado por consultar `profiles` dentro de `profiles`.

-- 1. Profiles
DROP POLICY IF EXISTS "Users can view their own profile and company members" ON profiles;
CREATE POLICY "Users can view their own profile and company members" ON profiles
FOR SELECT USING (
  auth.uid() = id OR 
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
);

-- 2. Employees
DROP POLICY IF EXISTS "Users can view employees from their company" ON employees;
CREATE POLICY "Users can view employees from their company" ON employees
FOR SELECT USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
);

DROP POLICY IF EXISTS "Managers can insert employees in their company" ON employees;
CREATE POLICY "Managers can insert employees in their company" ON employees
FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
);

DROP POLICY IF EXISTS "Managers can update employees in their company" ON employees;
CREATE POLICY "Managers can update employees in their company" ON employees
FOR UPDATE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
);

-- 3. Companies
DROP POLICY IF EXISTS "Users can view their company" ON companies;
CREATE POLICY "Users can view their company" ON companies
FOR SELECT USING (
  id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
);

-- 4. Contracts
DROP POLICY IF EXISTS "Users can view contracts from their company" ON contracts;
CREATE POLICY "Users can view contracts from their company" ON contracts
FOR SELECT USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
);

DROP POLICY IF EXISTS "Managers can insert contracts in their company" ON contracts;
CREATE POLICY "Managers can insert contracts in their company" ON contracts
FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
);

-- 5. Shift Templates
DROP POLICY IF EXISTS "Users can view shift templates from their company" ON shift_templates;
CREATE POLICY "Users can view shift templates from their company" ON shift_templates
FOR SELECT USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
);

-- 6. Leave Requests
DROP POLICY IF EXISTS "Users can view their own leave requests" ON leave_requests;
CREATE POLICY "Users can view their own leave requests" ON leave_requests
FOR SELECT USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
  )
);

DROP POLICY IF EXISTS "Managers can view company leave requests" ON leave_requests;
CREATE POLICY "Managers can view company leave requests" ON leave_requests
FOR SELECT USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
  )
);

-- 7. Employee Status
DROP POLICY IF EXISTS "Users can view employee status from their company" ON employee_status;
CREATE POLICY "Users can view employee status from their company" ON employee_status
FOR SELECT USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = true)
  )
);
