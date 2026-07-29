-- Un Super Admin sube logos de empresas donde no tiene fila en public.users
-- (no es "admin" de esa empresa), asi que las policies existentes de
-- company-logos (acotadas por auth_company_id()) no le aplican. Se agrega
-- una policy separada para cualquier carpeta, condicionada a estar en
-- platform_admins.
CREATE POLICY company_logos_platform_admin_all ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'company-logos'
    AND EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );
