-- Módulo de Liquidaciones: agrupa los viajes de un conductor desde su
-- último cierre, aplica comisión/gastos/anticipos, y sella el resultado
-- (inmutable) al aprobarlo.

CREATE TYPE settlement_status AS ENUM ('draft', 'completed');

CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Cifras: NULL hasta que el admin las llena/calcula; total_freight se
  -- recalcula en la UI a partir de los trips vinculados, se persiste acá
  -- recién al sellar (snapshot inmutable del monto liquidado).
  total_freight NUMERIC(12, 2),
  fuel_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  variable_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_advances NUMERIC(12, 2),
  final_payout NUMERIC(12, 2),
  status settlement_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sealed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX settlements_driver_id_idx ON public.settlements (driver_id);

-- Anticipos/viáticos entregados a un conductor. El admin los registra en
-- cualquier momento de la semana; quedan "sueltos" (settlement_id NULL)
-- hasta que el conductor cierra su ciclo y se agrupan en la liquidación,
-- igual que los trips.
CREATE TABLE public.driver_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description VARCHAR(255),
  settlement_id UUID REFERENCES public.settlements(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX driver_advances_driver_id_idx ON public.driver_advances (driver_id);

ALTER TABLE public.trips ADD COLUMN settlement_id UUID REFERENCES public.settlements(id);

-- Consultas del dashboard del conductor y de armado de liquidación filtran
-- por (driver_id, status) y (driver_id, settlement_id) constantemente.
CREATE INDEX trips_driver_id_status_idx ON public.trips (driver_id, status);
CREATE INDEX trips_settlement_id_idx ON public.trips (settlement_id);

-- ---------------------------------------------------------------------
-- Inmutabilidad: una vez que la liquidación que agrupa un viaje queda
-- 'completed' (sellada), ese viaje ya no se puede modificar — ni el admin
-- ni el conductor (aplica sobre cualquier UPDATE, incluida la propia
-- desvinculación de settlement_id).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_update_on_settled_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.settlement_id IS NOT NULL THEN
    IF (SELECT status FROM public.settlements WHERE id = OLD.settlement_id) = 'completed' THEN
      RAISE EXCEPTION 'No se puede modificar un viaje que ya pertenece a una liquidación sellada.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_update_on_settled_trip
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_update_on_settled_trip();

-- ---------------------------------------------------------------------
-- Al crear una liquidación (siempre nace 'draft'), engancha automática-
-- mente todo lo que estaba "suelto" de ese conductor (viajes completados
-- y anticipos sin settlement_id). SECURITY DEFINER porque el conductor
-- puede disparar esto (INSERT propio, ver política más abajo) pero no
-- tiene permiso de UPDATE directo sobre driver_advances — el enganche es
-- un efecto controlado del cierre de ciclo, no un permiso general.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attach_loose_records_to_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.trips
  SET settlement_id = NEW.id
  WHERE driver_id = NEW.driver_id
    AND status = 'completed'
    AND settlement_id IS NULL;

  UPDATE public.driver_advances
  SET settlement_id = NEW.id
  WHERE driver_id = NEW.driver_id
    AND settlement_id IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attach_loose_records_to_settlement
  AFTER INSERT ON public.settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.attach_loose_records_to_settlement();

-- ---------------------------------------------------------------------
-- RLS: settlements. El conductor puede ver e iniciar (en 'draft') las
-- suyas; solo el admin las edita (gastos, sellado).
-- ---------------------------------------------------------------------
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY settlements_select_admin_or_own_driver ON public.settlements
  FOR SELECT
  USING (
    company_id = public.auth_company_id()
    AND (public.auth_role() = 'admin' OR driver_id = auth.uid())
  );

CREATE POLICY settlements_insert_admin_or_own_driver_draft ON public.settlements
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_company_id()
    AND (
      public.auth_role() = 'admin'
      OR (driver_id = auth.uid() AND status = 'draft')
    )
  );

CREATE POLICY settlements_update_admin_only ON public.settlements
  FOR UPDATE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin')
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

-- ---------------------------------------------------------------------
-- RLS: driver_advances. Exclusivo del admin — el conductor no ve ni
-- gestiona sus propios anticipos desde la app (los recibe en efectivo,
-- el admin los registra).
-- ---------------------------------------------------------------------
ALTER TABLE public.driver_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY driver_advances_select_admin_only ON public.driver_advances
  FOR SELECT
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY driver_advances_insert_admin_only ON public.driver_advances
  FOR INSERT
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY driver_advances_update_admin_only ON public.driver_advances
  FOR UPDATE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin')
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');
