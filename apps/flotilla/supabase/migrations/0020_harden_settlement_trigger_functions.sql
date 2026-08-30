-- Mismo hardening que la 0003: el linter de seguridad marcó
-- prevent_update_on_settled_trip() y attach_loose_records_to_settlement()
-- como RPC SECURITY DEFINER ejecutables por anon/authenticated. Ambas son
-- funciones de trigger (RETURNS TRIGGER) — Postgres ya rechaza invocarlas
-- fuera de un trigger ("trigger functions can only be called as
-- triggers"), pero se revoca el EXECUTE explícito de todas formas: no
-- necesitan ser callables como RPC, solo se disparan solas.
REVOKE EXECUTE ON FUNCTION public.prevent_update_on_settled_trip() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attach_loose_records_to_settlement() FROM PUBLIC, anon, authenticated;
