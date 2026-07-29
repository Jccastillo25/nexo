-- El linter de seguridad de Supabase detectó que auth_company_id()/auth_role()
-- quedaban expuestas como RPC públicas incluso para el rol anon. Solo deben
-- usarse dentro de las políticas RLS por usuarios autenticados.
REVOKE EXECUTE ON FUNCTION public.auth_company_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auth_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_role() TO authenticated;
