-- Bucket público para logos de empresa. Público porque el logo se muestra
-- en la UI (sidebar, futuro branding) sin necesidad de URLs firmadas.
-- Convención de ruta: {company_id}/logo.{ext}
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true);

CREATE POLICY company_logos_write_own_admin ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'company-logos'
    AND public.auth_role() = 'admin'
    AND (storage.foldername(name))[1] = public.auth_company_id()::text
  );

CREATE POLICY company_logos_update_own_admin ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'company-logos'
    AND public.auth_role() = 'admin'
    AND (storage.foldername(name))[1] = public.auth_company_id()::text
  );
