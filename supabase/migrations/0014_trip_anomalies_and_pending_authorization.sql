-- Gestión por excepción en la inspección diaria: si el conductor reporta
-- una novedad, el viaje queda bloqueado ('pending_authorization') hasta
-- que un admin lo autorice o lo deniegue (panel de autorización: fase
-- posterior). Por ahora solo se modela el estado de bloqueo.
ALTER TYPE trip_status ADD VALUE 'pending_authorization';

CREATE TYPE anomaly_category AS ENUM (
  'tires', 'brakes', 'cargo_securing', 'lights', 'documents'
);

CREATE TABLE public.trip_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  category anomaly_category NOT NULL,
  description TEXT,
  photo_url VARCHAR(512) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Igual patrón que trip_events/trip_inspections: evidencia inmutable,
-- solo SELECT + INSERT (sin UPDATE/DELETE).
ALTER TABLE public.trip_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_anomalies_select_same_company ON public.trip_anomalies
  FOR SELECT
  USING (
    trip_id IN (SELECT id FROM public.trips WHERE company_id = public.auth_company_id())
  );

CREATE POLICY trip_anomalies_insert_own_trip ON public.trip_anomalies
  FOR INSERT
  WITH CHECK (
    trip_id IN (
      SELECT id FROM public.trips
      WHERE company_id = public.auth_company_id()
        AND (driver_id = auth.uid() OR public.auth_role() = 'admin')
    )
  );
