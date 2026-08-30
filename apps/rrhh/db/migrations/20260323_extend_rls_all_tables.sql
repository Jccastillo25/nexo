-- PART 1: Enable RLS on remaining critical tables
-- This script extends Row-Level Security (RLS) to all tables with company_id

-- STEP 1: Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own profile or company members
CREATE POLICY "Users can view their own profile and company members"
ON profiles
FOR SELECT
USING (
  -- Users can view their own profile
  auth.uid() = id
  OR
  -- Users can view profiles of people in their company
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id);

-- STEP 2: Enable RLS on employees table
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employees from their company"
ON employees
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Managers can insert employees in their company"
ON employees
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Managers can update employees in their company"
ON employees
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- STEP 3: Enable RLS on companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company"
ON companies
FOR SELECT
USING (
  id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- STEP 4: Enable RLS on contracts table
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contracts from their company"
ON contracts
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Managers can insert contracts in their company"
ON contracts
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- STEP 5: Enable RLS on shift_templates table
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shift templates from their company"
ON shift_templates
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- STEP 6: Enable RLS on leave_requests table
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own leave requests"
ON leave_requests
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM employees 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Managers can view company leave requests"
ON leave_requests
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM employees 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

-- STEP 7: Enable RLS on employee_status table (if it exists)
ALTER TABLE employee_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employee status from their company"
ON employee_status
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM employees 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

