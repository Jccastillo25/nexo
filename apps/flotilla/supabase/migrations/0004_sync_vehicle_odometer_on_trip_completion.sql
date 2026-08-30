-- Fase 3: al completar un viaje, actualizar el odómetro del vehículo.
-- SECURITY DEFINER porque quien completa el viaje suele ser el conductor
-- (rol sin permiso de UPDATE sobre vehicles); el trigger corre con
-- privilegios elevados solo para esta escritura puntual y controlada.
CREATE OR REPLACE FUNCTION public.sync_vehicle_odometer_on_trip_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND NEW.end_odometer IS NOT NULL
     AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.vehicles
    SET current_odometer = NEW.end_odometer
    WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_vehicle_odometer
AFTER UPDATE ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.sync_vehicle_odometer_on_trip_completion();

REVOKE EXECUTE ON FUNCTION public.sync_vehicle_odometer_on_trip_completion() FROM PUBLIC, anon, authenticated;
