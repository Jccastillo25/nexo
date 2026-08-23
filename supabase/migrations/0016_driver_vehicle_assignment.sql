-- Vehículo asignado a un conductor, para que el dashboard del conductor
-- pueda saltarse la selección de unidad en el caso común. Sigue siendo
-- editable por el conductor caso a caso desde su dashboard ("Cambiar
-- vehículo"), esto solo define el valor por defecto que asigna el admin.
ALTER TABLE public.drivers
  ADD COLUMN current_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- Sin cambios de RLS: drivers ya está cubierta por drivers_update_admin_only
-- (0012) para la escritura, y drivers_select_same_company_or_self para que
-- el propio conductor pueda leer su vehículo asignado.
