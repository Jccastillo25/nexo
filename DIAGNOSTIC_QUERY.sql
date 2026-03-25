-- DIAGNÓSTICO: ¿Por qué no se crea el empleado?
-- Ejecuta esta consulta en el SQL Editor de Supabase

-- 1. Ver tu user_id actual
SELECT
  auth.users.id as user_id,
  auth.users.email
FROM auth.users
WHERE email = (SELECT email FROM auth.users WHERE email = (SELECT auth.jwt() ->> 'email'))
LIMIT 1;

-- 2. Ver si existe registro en company_memberships para tu usuario
-- Reemplaza 'tu-user-id-aqui' con el user_id del paso anterior
SELECT
  id,
  user_id,
  company_id,
  is_active,
  created_at
FROM company_memberships
WHERE user_id = 'tu-user-id-aqui'
ORDER BY created_at DESC;

-- 3. Ver todas las empresas
SELECT
  id,
  display_name,
  is_active,
  created_at
FROM companies
LIMIT 10;

-- 4. Ver si hay empleados creados recientemente
SELECT
  id,
  first_name,
  last_name,
  employee_code,
  company_id,
  created_at
FROM employees
ORDER BY created_at DESC
LIMIT 5;

-- 5. Verificar políticas RLS en tabla employees
-- Ir a: Database > Policies > employees
-- Verificar que todas las políticas sean correctas

-- 6. Ver políticas RLS en company_memberships
-- Ir a: Database > Policies > company_memberships
-- Verificar que se pueda hacer SELECT
