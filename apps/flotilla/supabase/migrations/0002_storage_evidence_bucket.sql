-- Bucket privado para fotos de evidencia (odómetro, accesorios dañados).
-- Convención de ruta: {company_id}/{trip_id}/{filename}
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', false);

-- Lectura: solo miembros de la misma empresa (primer segmento de la ruta = company_id).
CREATE POLICY evidence_select_same_company ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'evidence'
    AND (storage.foldername(name))[1] = public.auth_company_id()::text
  );

-- Subida: solo miembros de la misma empresa, dentro de su propia carpeta.
CREATE POLICY evidence_insert_same_company ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'evidence'
    AND (storage.foldername(name))[1] = public.auth_company_id()::text
  );
