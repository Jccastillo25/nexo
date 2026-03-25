-- FINAL VERIFICATION - Confirmar que el fix está aplicado correctamente

-- 1. Ver todas las políticas INSERT en employees (debe haber solo 1)
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE tablename = 'employees' AND cmd = 'INSERT';

-- 2. Confirmar que la política correcta existe
SELECT policyname FROM pg_policies
WHERE tablename = 'employees' 
AND policyname = 'Managers can insert employees in their company';

-- 3. Ver la estructura de la tabla employees
\d employees

-- 4. Confirmar que company_memberships tiene datos
SELECT COUNT(*) as membership_count FROM company_memberships;

-- 5. Ver los datos del usuario actual en company_memberships (como authenticated user)
-- (Este query retornará empty cuando se ejecute como admin, pero funcionará en la app)
SELECT user_id, company_id, is_active FROM company_memberships LIMIT 1;
