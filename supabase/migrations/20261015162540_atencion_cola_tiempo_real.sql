-- Atención: fila en tiempo real (pedido del usuario 2026-10-15: "el panel del
-- puesto no actualiza de manera automática... tiene que ser en tiempo real" +
-- aviso sonoro por cada cliente nuevo).
--
-- Cada alta o cambio de un turno incrementa la versión de la sucursal en
-- public.atencion_cola_senales (una fila por sucursal, sin datos del
-- cliente). El navegador del puesto/recepción escucha esa fila por Supabase
-- Realtime (postgres_changes) y, al recibir el cambio, vuelve a pedir la fila
-- por la RPC con permisos (atencion_cola), que sigue siendo la única fuente
-- de datos. Un WebSocket sigue entregando mensajes con la pestaña en segundo
-- plano, cuando Chrome ya congeló los temporizadores del refresco periódico.
--
-- Por qué no broadcast desde la base (realtime.send): en nexo-core
-- realtime.messages no tiene particiones y realtime.send descarta el error
-- como WARNING (verificado 2026-10-15), así que el aviso se perdería en
-- silencio. Por qué en public: el schema `atencion` no tiene USAGE para la API.
--
-- La tabla es de estado (una fila por sucursal que se actualiza), no de
-- hechos: no se particiona. Sin permisos nuevos: leerla exige
-- atencion.cola.turno.ver y tener la sucursal asignada (o ser owner).
do $$
begin
  if to_regprocedure('atencion.fn_puede_sucursal(uuid, uuid, uuid)') is null then
    raise exception 'precheck: falta atencion.fn_puede_sucursal';
  end if;
  if to_regclass('public.atencion_cola_senales') is not null then
    raise exception 'precheck: public.atencion_cola_senales ya existe';
  end if;
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'precheck: falta la publicación supabase_realtime';
  end if;
end;
$$;

-- 1. Autorización: ¿el usuario de la sesión puede ver la fila de esa sucursal?
--    Puente security definer porque las políticas se evalúan como
--    `authenticated`, que no tiene USAGE en core/atencion.
create or replace function public.atencion_puede_escuchar(p_sucursal_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
begin
  if v_uid is null or p_sucursal_id is null then
    return false;
  end if;
  select s.company_id into v_company from core.sucursales s where s.id = p_sucursal_id;
  if v_company is null then
    return false;
  end if;
  return atencion.fn_puede_sucursal(v_uid, v_company, p_sucursal_id)
     and core.has_permission(v_uid, v_company, 'atencion.cola.turno.ver');
end;
$$;
revoke all on function public.atencion_puede_escuchar(uuid) from public, anon;
grant execute on function public.atencion_puede_escuchar(uuid) to authenticated;

-- 2. Señal por sucursal.
create table public.atencion_cola_senales (
  sucursal_id uuid primary key references core.sucursales(id) on delete cascade,
  version bigint not null default 1,
  cambiado_en timestamptz not null default now()
);
comment on table public.atencion_cola_senales is
  'Atención: versión de la fila por sucursal, para avisar por Realtime. Sin datos del cliente.';

alter table public.atencion_cola_senales enable row level security;
revoke all on public.atencion_cola_senales from anon, authenticated;
grant select on public.atencion_cola_senales to authenticated;

create policy "atencion: ver la señal de su sucursal"
  on public.atencion_cola_senales for select to authenticated
  using (public.atencion_puede_escuchar(sucursal_id));

alter publication supabase_realtime add table public.atencion_cola_senales;

-- 3. Emisor: cada turno creado o modificado sube la versión de su sucursal.
create or replace function atencion.fn_avisar_cambio_turno()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.atencion_cola_senales as s (sucursal_id)
  values (new.sucursal_id)
  on conflict (sucursal_id) do update
    set version = s.version + 1, cambiado_en = now();
  return null;
end;
$$;
revoke all on function atencion.fn_avisar_cambio_turno() from public, anon, authenticated;

create trigger trg_atencion_turnos_avisar
  after insert or update on atencion.turnos
  for each row execute function atencion.fn_avisar_cambio_turno();
