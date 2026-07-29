-- El REVOKE a nivel de columna de la migración anterior no tuvo efecto:
-- authenticated/anon tenían UPDATE a nivel de TABLA (relacl), y un REVOKE
-- de columna no anula un GRANT de tabla ya existente en Postgres. Hay que
-- revocar la tabla completa y re-otorgar solo las columnas permitidas.
REVOKE UPDATE ON public.companies FROM authenticated, anon;

GRANT UPDATE (name, ruc, address, phone, email, logo_url)
  ON public.companies TO authenticated;
