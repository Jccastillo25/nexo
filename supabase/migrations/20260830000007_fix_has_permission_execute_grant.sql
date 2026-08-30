-- La migracion anterior revoco EXECUTE de `anon` directamente, pero Postgres
-- otorga EXECUTE a PUBLIC por defecto en toda funcion nueva, y `anon`
-- hereda de PUBLIC. Sin revocar de PUBLIC primero, el revoke anterior no
-- alcanzaba (advisor lo siguio marcando). Se corrige aqui.
revoke execute on function public.has_permission(uuid, text) from public;
grant execute on function public.has_permission(uuid, text) to authenticated;
