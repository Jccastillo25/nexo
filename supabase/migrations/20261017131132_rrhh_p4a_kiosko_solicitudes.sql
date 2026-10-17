-- P4a: resultados definitivos de envios, particiones mensuales y acceso cerrado.
-- Retencion: igual que marcas, sin borrado automatico. Sin PIN/hash ni identidad.
-- Rollback: solo antes de datos podria retirarse tabla/registro; con historia,
-- conservar resultados y corregir hacia adelante para no romper idempotencia.
create table rrhh.kiosko_solicitudes (
 id uuid not null default gen_random_uuid(),
 solicitud_id uuid not null,
 company_id uuid not null references core.companies(id),
 kiosko_id uuid not null references rrhh.kiosko_dispositivos(id),
 fecha_local date not null,
 resultado text not null check(resultado in ('registrada','rechazada')),
 respuesta jsonb not null,
 creado_en timestamptz not null default clock_timestamp(),
 primary key(id,creado_en)
) partition by range(creado_en);
create index kiosko_solicitudes_empresa_fecha_idx on rrhh.kiosko_solicitudes(company_id,fecha_local);
create index kiosko_solicitudes_kiosko_idx on rrhh.kiosko_solicitudes(kiosko_id);
create index kiosko_solicitudes_token_idx on rrhh.kiosko_solicitudes(solicitud_id,kiosko_id);
create index kiosko_solicitudes_respuesta_idx on rrhh.kiosko_solicitudes using gin(respuesta);
alter table rrhh.kiosko_solicitudes enable row level security;
revoke all on rrhh.kiosko_solicitudes from public,anon,authenticated;

create function rrhh.fn_asegurar_particion_kiosko_solicitudes(p_mes date)
returns void language plpgsql set search_path=rrhh,pg_temp as $$
declare particion text := 'kiosko_solicitudes_'||to_char(p_mes,'YYYY_MM');
 inicio date := date_trunc('month',p_mes); fin date := inicio+interval '1 month';
begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='rrhh' and c.relname=particion) then
  execute format('create table rrhh.%I partition of rrhh.kiosko_solicitudes for values from (%L) to (%L)',particion,inicio,fin);
  execute format('alter table rrhh.%I enable row level security',particion);
  execute format('revoke all on rrhh.%I from public,anon,authenticated',particion);
 end if;
end $$;
revoke execute on function rrhh.fn_asegurar_particion_kiosko_solicitudes(date) from public,anon,authenticated;
insert into core.tablas_particionadas(schema_nombre,tabla_nombre,fn_asegurar_particion)
values('rrhh','kiosko_solicitudes','rrhh.fn_asegurar_particion_kiosko_solicitudes');
do $$ declare i integer; begin
 for i in 0..3 loop
  perform rrhh.fn_asegurar_particion_kiosko_solicitudes((date_trunc('month',now())+make_interval(months=>i))::date);
 end loop;
end $$;
