-- ENTORNO DESECHABLE para PL2b (PGlite en memoria), cargado después de
-- rrhh_planilla_entorno.sql y de la migración PL2a. Agrega lo que leen el Paso
-- Cero de PL2b y la aprobación de liquidaciones, con los nombres verificados en
-- nexo-core el 2026-10-21: plantillas de rol, credenciales de asistencia,
-- columnas de finalización del contrato y rrhh.fn_finalizar_contrato (copia de
-- 20260907154715_f1_3_pin_exclusivamente_contractual.sql:135-168).

create table core.app_roles (
  id uuid primary key default gen_random_uuid(),
  module_slug text not null,
  role_key text not null,
  unique (module_slug, role_key)
);
create table core.app_role_permissions (
  app_role_id uuid not null references core.app_roles(id),
  permission_code text not null references core.permissions_catalog(code),
  primary key (app_role_id, permission_code)
);
insert into core.app_roles (module_slug, role_key)
select 'rrhh', r from unnest(array['admin', 'consulta', 'especialista_planillas', 'gestor_expedientes', 'supervisor_asistencia']) r;
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, pc.code from core.app_roles ar cross join core.permissions_catalog pc
where ar.module_slug = 'rrhh' and ar.role_key = 'admin' and pc.code like 'rrhh.planillas.%';

alter table rrhh.contratos add column finalizado_at timestamptz, add column finalizado_by uuid;
-- En nexo-core core.companies tiene name y tax_id (el entorno base usa nombre).
alter table core.companies add column if not exists name text, add column if not exists tax_id text;
update core.companies set name = nombre;

create table rrhh.contrato_credenciales (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references rrhh.contratos(id),
  activo boolean not null default true,
  revocado_at timestamptz,
  revocado_by uuid
);

create function rrhh.fn_finalizar_contrato(p_contrato_id uuid, p_company_id uuid)
returns void language plpgsql security definer set search_path = rrhh, core, extensions, pg_temp as $$
declare
  v_estado text;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.finalizar') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.finalizar';
  end if;
  select estado into v_estado from rrhh.contratos where id = p_contrato_id and company_id = p_company_id;
  if v_estado is null then
    raise exception 'Contrato no encontrado en esta empresa';
  elsif v_estado <> 'activo' then
    raise exception 'Solo se puede finalizar un contrato activo';
  end if;
  update rrhh.contratos
  set estado = 'finalizado', finalizado_at = now(), finalizado_by = auth.uid(), fecha_fin_real = current_date
  where id = p_contrato_id and company_id = p_company_id;
  update rrhh.contrato_credenciales
  set activo = false, revocado_at = now(), revocado_by = auth.uid()
  where contrato_id = p_contrato_id and activo = true;
end;
$$;
revoke all on function rrhh.fn_finalizar_contrato(uuid, uuid) from public, anon, authenticated;
