-- Campos financieros por viaje (opcionales en campo, para no bloquear al
-- conductor) y el porcentaje de comisión de cada conductor, base para el
-- módulo de Liquidaciones.
ALTER TABLE public.trips
  ADD COLUMN invoice_number VARCHAR(100),
  -- Sin DEFAULT: NULL significa "no ingresado todavía", nunca se confunde
  -- con un viaje de valor $0.
  ADD COLUMN trip_value NUMERIC(12, 2);

ALTER TABLE public.drivers
  ADD COLUMN commission_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (commission_percentage >= 0 AND commission_percentage <= 100);
