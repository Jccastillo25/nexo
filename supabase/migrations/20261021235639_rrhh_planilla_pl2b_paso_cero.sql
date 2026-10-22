-- =============================================================================
-- Paso Cero de PL2b (docs/plan/20-planilla.md §8 y §10): pagar y anular una
-- liquidación tienen permiso propio.
--
-- Aprobación del usuario (2026-10-21): "Dos permisos nuevos, solo admin". Antes
-- de esta migración pagar y anular una liquidación no tenían código (hueco
-- conocido en la skill nexo-planilla-motor, estados-y-permisos.md).
--
-- Solo catálogo y plantilla de rol: no crea tablas ni asigna nada a roles de
-- empresa (core.rol_permisos), igual que 20261021160943.
--
-- Verificado en nexo-core el 2026-10-21 antes de escribirla: 25 códigos
-- rrhh.planillas.*, ninguno de los dos nuevos existe, admin tiene los 25.
--
-- Rollback (antes de uso):
--   delete from core.app_role_permissions where permission_code in
--     ('rrhh.planillas.liquidaciones.pagar', 'rrhh.planillas.liquidaciones.anular');
--   delete from core.permissions_catalog where code in
--     ('rrhh.planillas.liquidaciones.pagar', 'rrhh.planillas.liquidaciones.anular');
-- =============================================================================
do $$
declare
  n integer;
begin
  if exists (select 1 from core.permissions_catalog
             where code in ('rrhh.planillas.liquidaciones.pagar', 'rrhh.planillas.liquidaciones.anular')) then
    raise exception 'precheck: algún permiso nuevo de liquidaciones ya existe';
  end if;
  if (select count(*) from core.permissions_catalog where code like 'rrhh.planillas.%') <> 25 then
    raise exception 'precheck: se esperaban 25 permisos de planillas';
  end if;
  if not exists (select 1 from core.app_roles where module_slug = 'rrhh' and role_key = 'admin') then
    raise exception 'precheck: falta la plantilla admin de rrhh';
  end if;

  insert into core.permissions_catalog (code, module_slug, domain, label, description) values
    ('rrhh.planillas.liquidaciones.pagar', 'rrhh', 'planillas', 'Pagar liquidaciones',
     'Marcar una liquidación aprobada como pagada, por cheque o transferencia.'),
    ('rrhh.planillas.liquidaciones.anular', 'rrhh', 'planillas', 'Anular liquidaciones',
     'Anular una liquidación calculada o aprobada, con motivo. Devuelve el saldo de vacaciones y las cuotas de préstamo. Queda auditado.');

  insert into core.app_role_permissions (app_role_id, permission_code)
  select ar.id, x.code
  from core.app_roles ar
  cross join (values ('rrhh.planillas.liquidaciones.pagar'), ('rrhh.planillas.liquidaciones.anular')) as x(code)
  where ar.module_slug = 'rrhh' and ar.role_key = 'admin';
  get diagnostics n = row_count;
  if n <> 2 then
    raise exception 'postcheck: se esperaban 2 asignaciones (%).', n;
  end if;
  if (select count(*) from core.permissions_catalog where code like 'rrhh.planillas.%') <> 27 then
    raise exception 'postcheck: se esperaban 27 permisos de planillas';
  end if;
end;
$$;
