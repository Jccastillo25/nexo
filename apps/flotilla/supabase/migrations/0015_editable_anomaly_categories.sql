-- Las categorías de novedad dejan de ser un enum fijo: cada empresa
-- administra su propio catálogo (nombre + si bloquea el viaje o no),
-- mismo patrón que license_categories.
CREATE TABLE public.anomaly_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  blocks_trip BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.anomaly_categories ENABLE ROW LEVEL SECURITY;

-- Lectura para toda la empresa (el conductor debe poder elegir categoría
-- al reportar una novedad); gestión (alta/edición) solo admin.
CREATE POLICY anomaly_categories_select_same_company ON public.anomaly_categories
  FOR SELECT
  USING (company_id = public.auth_company_id());

CREATE POLICY anomaly_categories_insert_admin_only ON public.anomaly_categories
  FOR INSERT
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY anomaly_categories_update_admin_only ON public.anomaly_categories
  FOR UPDATE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin')
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

-- Siembra las 5 categorías originales para cada empresa existente, con la
-- clasificación de bloqueo ya acordada (solo llantas y frenos bloquean).
INSERT INTO public.anomaly_categories (company_id, name, blocks_trip)
SELECT c.id, cat.name, cat.blocks_trip
FROM public.companies c
CROSS JOIN (VALUES
  ('Llantas y pernos', true),
  ('Frenos y fugas', true),
  ('Sujeción de carga (eslingas/toldo)', false),
  ('Luces', false),
  ('Documentos', false)
) AS cat(name, blocks_trip);

-- trip_anomalies pasa de un enum fijo a referenciar el catálogo editable.
ALTER TABLE public.trip_anomalies ADD COLUMN category_id UUID REFERENCES public.anomaly_categories(id);
ALTER TABLE public.trip_anomalies ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE public.trip_anomalies DROP COLUMN category;
DROP TYPE anomaly_category;
