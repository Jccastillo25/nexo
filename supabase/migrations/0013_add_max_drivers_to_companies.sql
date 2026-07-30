-- max_users pasa a ser el límite exclusivo de administradores; los
-- conductores tienen su propio límite independiente (max_drivers).
-- Ambos NULL = sin límite.
ALTER TABLE public.companies
  ADD COLUMN max_drivers INT;
