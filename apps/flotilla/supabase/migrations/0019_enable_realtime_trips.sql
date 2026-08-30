-- Habilita Supabase Realtime sobre trips para las alertas del admin
-- (viaje completado sin trip_value/invoice_number). RLS ya restringe qué
-- filas ve cada suscriptor (misma policy que SELECT normal), Realtime no
-- la bypassea.
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
