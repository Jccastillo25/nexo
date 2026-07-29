-- Faltaba la política SELECT para el bucket company-logos: aunque es
-- público (la URL pública bypasea RLS para lectura anónima), el cliente
-- autenticado la necesita para que el flujo de upsert funcione sin
-- violar row-level security.
CREATE POLICY company_logos_select_own_company ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = public.auth_company_id()::text
  );
