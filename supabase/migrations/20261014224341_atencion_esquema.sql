-- =============================================================================
-- Módulo Atención (turnos de sala de espera) — esquema + RPC + pg_cron
--
-- Diseño y decisiones del usuario (2026-10-14): docs/plan/13-atencion-turnos.md §4.
-- Requiere el Paso Cero 20261014222454_atencion_paso_cero.
--
-- Aprobada por el usuario el 2026-10-14; probada antes de punta a punta en
-- una transacción revertida (ver docs/status-log/2026-10-14-atencion-esquema.md).
--
-- Resumen:
--   1. core.sucursales + core.usuario_sucursales (compartidas por la empresa).
--   2. Schema atencion (sin exponer a la API: todo por RPC):
--        puestos, pantallas, contadores (catálogos);
--        sesiones_activas (estado actual: 1 por usuario, 1 por puesto);
--        sesiones, turnos, turno_eventos (hechos, particionados por mes).
--   3. Fecha local por sucursal (zona horaria, por defecto America/Managua):
--      numeración diaria y cierre a medianoche.
--   4. RPC public.admin_* (sucursales) y public.atencion_* (operación),
--      security definer + core.has_permission; pantalla pública anónima
--      identificada por el id del dispositivo (patrón del kiosco de RRHH).
--   5. pg_cron: cierre de atenciones/turnos vencidos cada 5 minutos (las RPC
--      además cierran lo vencido antes de operar) y particiones mensuales.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Prechecks
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('core.sucursales') is not null or to_regnamespace('atencion') is not null then
    raise exception 'precheck: core.sucursales o el schema atencion ya existen';
  end if;
  if not exists (select 1 from core.apps where slug = 'atencion') then
    raise exception 'precheck: falta el Paso Cero de Atención';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Sucursales (core)
-- -----------------------------------------------------------------------------
create table core.sucursales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 2 and 80),
  direccion text check (direccion is null or length(direccion) <= 200),
  zona_horaria text not null default 'America/Managua',
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index sucursales_company_nombre_uq on core.sucursales (company_id, lower(btrim(nombre)));

comment on table core.sucursales is
  'Sucursales de la empresa, compartidas por todos los módulos (2026-10-14). zona_horaria define el día local (numeración y cierre a medianoche de Atención).';

create table core.usuario_sucursales (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  sucursal_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, sucursal_id),
  foreign key (sucursal_id, company_id) references core.sucursales (id, company_id) on delete cascade
);
create index usuario_sucursales_sucursal_idx on core.usuario_sucursales (sucursal_id);
create index usuario_sucursales_company_user_idx on core.usuario_sucursales (company_id, user_id);

comment on table core.usuario_sucursales is
  'Sucursales donde trabaja cada usuario (Configuración → Usuarios). El owner puede operar en cualquiera.';

alter table core.sucursales enable row level security;
alter table core.usuario_sucursales enable row level security;
revoke all on core.sucursales, core.usuario_sucursales from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Schema atencion — catálogos y estado
-- -----------------------------------------------------------------------------
create schema atencion;
revoke all on schema atencion from public, anon, authenticated;

create table atencion.puestos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  sucursal_id uuid not null,
  nombre text not null check (length(btrim(nombre)) between 1 and 40),
  orden integer not null default 1,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (sucursal_id, company_id) references core.sucursales (id, company_id) on delete cascade
);
create unique index puestos_sucursal_nombre_uq on atencion.puestos (sucursal_id, lower(btrim(nombre)));
create index puestos_sucursal_orden_idx on atencion.puestos (sucursal_id, orden);

-- El id de la pantalla actúa como credencial del dispositivo (igual que
-- rrhh.kiosko_dispositivos). config: entretenimiento (ej. lista de YouTube, volumen).
create table atencion.pantallas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  sucursal_id uuid not null,
  nombre text not null check (length(btrim(nombre)) between 2 and 60),
  activa boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (sucursal_id, company_id) references core.sucursales (id, company_id) on delete cascade
);
create index pantallas_sucursal_idx on atencion.pantallas (sucursal_id);

-- Último número entregado por sucursal y día local: numeración diaria sin carreras.
create table atencion.contadores (
  sucursal_id uuid not null references core.sucursales(id) on delete cascade,
  fecha_local date not null,
  ultimo_numero integer not null default 0,
  primary key (sucursal_id, fecha_local)
);

-- Estado actual: quién está atendiendo ahora y dónde. Garantiza una sesión
-- abierta por usuario y un usuario por puesto (sesiones es particionada y no
-- puede llevar esos índices únicos).
create table atencion.sesiones_activas (
  sesion_id uuid primary key,
  inicio timestamptz not null,
  company_id uuid not null references core.companies(id) on delete cascade,
  sucursal_id uuid not null references core.sucursales(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('recepcion', 'puesto')),
  puesto_id uuid unique references atencion.puestos(id) on delete cascade,
  fecha_local date not null,
  check ((tipo = 'puesto') = (puesto_id is not null))
);
create index sesiones_activas_sucursal_idx on atencion.sesiones_activas (sucursal_id);

-- -----------------------------------------------------------------------------
-- 3. Tablas de hechos particionadas por mes
-- -----------------------------------------------------------------------------
create table atencion.sesiones (
  id uuid not null default gen_random_uuid(),
  inicio timestamptz not null default now(),
  company_id uuid not null references core.companies(id),
  sucursal_id uuid not null references core.sucursales(id),
  user_id uuid not null references auth.users(id),
  tipo text not null check (tipo in ('recepcion', 'puesto')),
  puesto_id uuid references atencion.puestos(id),
  fecha_local date not null,
  fin timestamptz,
  motivo_cierre text check (motivo_cierre in ('manual', 'medianoche', 'liberado')),
  cerrado_por uuid references auth.users(id),
  primary key (id, inicio)
) partition by range (inicio);

create table atencion.turnos (
  id uuid not null default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  company_id uuid not null references core.companies(id),
  sucursal_id uuid not null references core.sucursales(id),
  fecha_local date not null,
  numero integer not null check (numero > 0),
  cliente_nombre text not null check (length(btrim(cliente_nombre)) between 1 and 120),
  cliente_telefono text check (cliente_telefono is null or length(cliente_telefono) <= 30),
  factura text check (factura is null or length(factura) <= 50),
  estado text not null default 'esperando'
    check (estado in ('esperando', 'llamado', 'atendido', 'ausente', 'anulado', 'expirado')),
  puesto_id uuid references atencion.puestos(id),
  atendido_por uuid references auth.users(id),
  llamado_en timestamptz,
  veces_llamado integer not null default 0,
  fuera_de_orden boolean not null default false,
  finalizado_en timestamptz,
  creado_por uuid references auth.users(id),
  primary key (id, creado_en)
) partition by range (creado_en);

-- turno_id sin FK: la PK de turnos es (id, creado_en) por el particionamiento.
create table atencion.turno_eventos (
  id uuid not null default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  company_id uuid not null references core.companies(id),
  sucursal_id uuid not null references core.sucursales(id),
  turno_id uuid not null,
  tipo text not null check (tipo in ('creado', 'llamado', 'rellamado', 'finalizado', 'ausente', 'anulado', 'devuelto', 'expirado')),
  puesto_id uuid references atencion.puestos(id),
  user_id uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  primary key (id, creado_en)
) partition by range (creado_en);

create or replace function atencion.fn_asegurar_particion_sesiones(p_mes date)
returns void language plpgsql set search_path = atencion, pg_temp as $$
declare
  particion text := 'sesiones_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('atencion.' || particion) is null then
    execute format('create table atencion.%I partition of atencion.sesiones for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on atencion.%I (company_id, inicio)', particion);
    execute format('create index on atencion.%I (sucursal_id, fecha_local)', particion);
    execute format('create index on atencion.%I (user_id, inicio)', particion);
    execute format('alter table atencion.%I enable row level security', particion);
  end if;
end;
$$;

create or replace function atencion.fn_asegurar_particion_turnos(p_mes date)
returns void language plpgsql set search_path = atencion, pg_temp as $$
declare
  particion text := 'turnos_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('atencion.' || particion) is null then
    execute format('create table atencion.%I partition of atencion.turnos for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on atencion.%I (company_id, creado_en)', particion);
    execute format('create index on atencion.%I (sucursal_id, fecha_local, estado, numero)', particion);
    execute format('create index on atencion.%I (puesto_id) where estado = %L', particion, 'llamado');
    execute format('alter table atencion.%I enable row level security', particion);
  end if;
end;
$$;

create or replace function atencion.fn_asegurar_particion_turno_eventos(p_mes date)
returns void language plpgsql set search_path = atencion, pg_temp as $$
declare
  particion text := 'turno_eventos_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('atencion.' || particion) is null then
    execute format('create table atencion.%I partition of atencion.turno_eventos for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on atencion.%I (company_id, creado_en)', particion);
    execute format('create index on atencion.%I (turno_id)', particion);
    execute format('alter table atencion.%I enable row level security', particion);
  end if;
end;
$$;

insert into core.tablas_particionadas (schema_nombre, tabla_nombre, fn_asegurar_particion) values
  ('atencion', 'sesiones', 'atencion.fn_asegurar_particion_sesiones'),
  ('atencion', 'turnos', 'atencion.fn_asegurar_particion_turnos'),
  ('atencion', 'turno_eventos', 'atencion.fn_asegurar_particion_turno_eventos');

select core.fn_asegurar_particiones_futuras(3);

alter table atencion.puestos enable row level security;
alter table atencion.pantallas enable row level security;
alter table atencion.contadores enable row level security;
alter table atencion.sesiones_activas enable row level security;
alter table atencion.sesiones enable row level security;
alter table atencion.turnos enable row level security;
alter table atencion.turno_eventos enable row level security;
revoke all on all tables in schema atencion from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Helpers internos
-- -----------------------------------------------------------------------------
create or replace function atencion.fn_hoy(p_sucursal_id uuid)
returns date language sql stable security definer set search_path = '' as $$
  select (now() at time zone s.zona_horaria)::date from core.sucursales s where s.id = p_sucursal_id;
$$;

-- ¿El usuario puede operar en esa sucursal? (asignada, o owner)
create or replace function atencion.fn_puede_sucursal(p_user_id uuid, p_company_id uuid, p_sucursal_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from core.sucursales s
    where s.id = p_sucursal_id and s.company_id = p_company_id and s.activa
      and (core.fn_es_owner(p_user_id, p_company_id)
           or exists (select 1 from core.usuario_sucursales us
                      where us.user_id = p_user_id and us.sucursal_id = s.id))
  );
$$;

create or replace function atencion.fn_evento(
  p_turno atencion.turnos, p_tipo text, p_user_id uuid, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform atencion.fn_asegurar_particion_turno_eventos(current_date);
  insert into atencion.turno_eventos (company_id, sucursal_id, turno_id, tipo, puesto_id, user_id, metadata)
  values (p_turno.company_id, p_turno.sucursal_id, p_turno.id, p_tipo, p_turno.puesto_id, p_user_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- Cierra una sesión abierta (historial + estado actual). Si era un puesto con
-- un turno llamado sin terminar, ese turno vuelve a la fila (salvo medianoche,
-- donde lo expira fn_cerrar_vencidas).
create or replace function atencion.fn_cerrar_sesion(p_sesion_id uuid, p_motivo text, p_cerrado_por uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_a atencion.sesiones_activas;
  v_t atencion.turnos;
begin
  delete from atencion.sesiones_activas sa where sa.sesion_id = p_sesion_id returning * into v_a;
  if not found then return; end if;

  update atencion.sesiones s
    set fin = now(), motivo_cierre = p_motivo, cerrado_por = p_cerrado_por
    where s.id = v_a.sesion_id and s.inicio = v_a.inicio;

  if v_a.puesto_id is not null and p_motivo <> 'medianoche' then
    for v_t in
      update atencion.turnos t
        set estado = 'esperando', puesto_id = null, atendido_por = null
        where t.puesto_id = v_a.puesto_id and t.estado = 'llamado'
          and t.creado_en >= now() - interval '2 days'
        returning *
    loop
      perform atencion.fn_evento(v_t, 'devuelto', p_cerrado_por, jsonb_build_object('motivo', p_motivo));
    end loop;
  end if;
end;
$$;

-- Cierre a medianoche: sesiones abiertas de un día local anterior y turnos
-- pendientes de días anteriores. Lo llama pg_cron y cada RPC antes de operar.
create or replace function atencion.fn_cerrar_vencidas()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_sesion uuid;
  v_t atencion.turnos;
  n integer := 0;
begin
  for v_sesion in
    select sa.sesion_id from atencion.sesiones_activas sa
    where sa.fecha_local < atencion.fn_hoy(sa.sucursal_id)
  loop
    perform atencion.fn_cerrar_sesion(v_sesion, 'medianoche', null);
    n := n + 1;
  end loop;

  for v_t in
    update atencion.turnos t
      set estado = 'expirado', finalizado_en = now()
      where t.estado in ('esperando', 'llamado')
        and t.creado_en >= now() - interval '7 days'
        and t.fecha_local < atencion.fn_hoy(t.sucursal_id)
      returning *
  loop
    perform atencion.fn_evento(v_t, 'expirado', null);
  end loop;
  return n;
end;
$$;

-- Exige permiso + una sesión abierta del tipo indicado; devuelve la sesión.
create or replace function atencion.fn_exigir_sesion(p_company_id uuid, p_code text, p_tipo text)
returns atencion.sesiones_activas language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_a atencion.sesiones_activas;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, p_code);
  perform atencion.fn_cerrar_vencidas();
  select * into v_a from atencion.sesiones_activas sa
  where sa.user_id = v_uid and sa.company_id = p_company_id and (p_tipo is null or sa.tipo = p_tipo);
  if not found then
    raise exception '%', case p_tipo
      when 'puesto' then 'Iniciá atención en un puesto primero.'
      when 'recepcion' then 'Iniciá atención en recepción primero.'
      else 'Iniciá atención primero.' end;
  end if;
  return v_a;
end;
$$;

-- Turno llamado actualmente en el puesto de la sesión (bloqueado).
create or replace function atencion.fn_turno_actual(p_puesto_id uuid)
returns atencion.turnos language sql security definer set search_path = '' as $$
  select t.* from atencion.turnos t
  where t.puesto_id = p_puesto_id and t.estado = 'llamado' and t.creado_en >= now() - interval '2 days'
  limit 1
  for update;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC — sucursales (Configuración de Nexo)
-- -----------------------------------------------------------------------------
create or replace function public.admin_listar_sucursales(p_company_id uuid)
returns table (id uuid, nombre text, direccion text, zona_horaria text, activa boolean, usuarios integer, puestos integer)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform core.fn_exigir_permiso(p_company_id, 'nexo.administracion.sucursales.ver');
  return query
  select s.id, s.nombre, s.direccion, s.zona_horaria, s.activa,
         (select count(*)::integer from core.usuario_sucursales us where us.sucursal_id = s.id),
         (select count(*)::integer from atencion.puestos p where p.sucursal_id = s.id and p.activo)
  from core.sucursales s where s.company_id = p_company_id
  order by lower(s.nombre);
end;
$$;

create or replace function public.admin_guardar_sucursal(
  p_company_id uuid, p_sucursal_id uuid, p_nombre text, p_direccion text, p_zona_horaria text, p_activa boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_id uuid;
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_tz text := coalesce(nullif(btrim(coalesce(p_zona_horaria, '')), ''), 'America/Managua');
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'nexo.administracion.sucursales.gestionar');
  if length(v_nombre) < 2 or length(v_nombre) > 80 then
    raise exception 'El nombre de la sucursal debe tener entre 2 y 80 caracteres.';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    raise exception 'Zona horaria inválida: %', v_tz;
  end if;

  if p_sucursal_id is null then
    insert into core.sucursales (company_id, nombre, direccion, zona_horaria, activa)
    values (p_company_id, v_nombre, nullif(btrim(coalesce(p_direccion, '')), ''), v_tz, coalesce(p_activa, true))
    returning id into v_id;
  else
    update core.sucursales s
      set nombre = v_nombre, direccion = nullif(btrim(coalesce(p_direccion, '')), ''),
          zona_horaria = v_tz, activa = coalesce(p_activa, s.activa), updated_at = now()
      where s.id = p_sucursal_id and s.company_id = p_company_id
      returning s.id into v_id;
    if v_id is null then raise exception 'Sucursal no encontrada.'; end if;
  end if;

  perform core.fn_auditar(v_uid, p_company_id,
    case when p_sucursal_id is null then 'admin.sucursal.crear' else 'admin.sucursal.editar' end,
    'core.sucursales', v_id::text, jsonb_build_object('nombre', v_nombre, 'activa', coalesce(p_activa, true)));
  return v_id;
exception
  when unique_violation then raise exception 'Ya existe una sucursal con ese nombre.';
end;
$$;

create or replace function public.admin_sucursales_de_usuario(p_company_id uuid, p_user_id uuid)
returns table (sucursal_id uuid, nombre text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform core.fn_exigir_permiso(p_company_id, 'nexo.administracion.usuarios.ver');
  return query
  select s.id, s.nombre from core.usuario_sucursales us
  join core.sucursales s on s.id = us.sucursal_id
  where us.user_id = p_user_id and us.company_id = p_company_id
  order by lower(s.nombre);
end;
$$;

-- Reemplaza las sucursales de un usuario (Configuración → Usuarios).
create or replace function public.admin_asignar_sucursales(p_company_id uuid, p_user_id uuid, p_sucursales uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_ids uuid[];
  v_antes uuid[];
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'nexo.administracion.usuarios.editar');
  perform core.fn_membresia_administrable(v_uid, p_company_id, p_user_id);

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_sucursales, '{}')) x where x is not null;
  if exists (select 1 from unnest(v_ids) x
             where not exists (select 1 from core.sucursales s where s.id = x and s.company_id = p_company_id)) then
    raise exception 'Alguna sucursal no existe en esta empresa.';
  end if;

  select coalesce(array_agg(us.sucursal_id), '{}') into v_antes
  from core.usuario_sucursales us where us.user_id = p_user_id and us.company_id = p_company_id;

  delete from core.usuario_sucursales us
  where us.user_id = p_user_id and us.company_id = p_company_id and us.sucursal_id <> all (v_ids);
  insert into core.usuario_sucursales (user_id, company_id, sucursal_id)
  select p_user_id, p_company_id, x from unnest(v_ids) x
  on conflict do nothing;

  perform core.fn_auditar(v_uid, p_company_id, 'admin.usuario.sucursales', 'auth.users', p_user_id::text,
    jsonb_build_object('antes', to_jsonb(v_antes), 'despues', to_jsonb(v_ids)));
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC — configuración de Atención (puestos y pantallas)
-- -----------------------------------------------------------------------------
create or replace function public.atencion_listar_puestos(p_company_id uuid, p_sucursal_id uuid)
returns table (id uuid, nombre text, orden integer, activo boolean, ocupado_por text, ocupado_desde timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform core.fn_exigir_permiso(p_company_id, 'atencion.ver_modulo');
  perform atencion.fn_cerrar_vencidas();
  return query
  select p.id, p.nombre, p.orden, p.activo,
         coalesce(pf.nombre_completo, u.email::text), sa.inicio
  from atencion.puestos p
  left join atencion.sesiones_activas sa on sa.puesto_id = p.id
  left join auth.users u on u.id = sa.user_id
  left join core.perfiles pf on pf.user_id = sa.user_id
  where p.company_id = p_company_id and p.sucursal_id = p_sucursal_id
  order by p.orden, lower(p.nombre);
end;
$$;

create or replace function public.atencion_guardar_puesto(
  p_company_id uuid, p_puesto_id uuid, p_sucursal_id uuid, p_nombre text, p_orden integer, p_activo boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_id uuid;
  v_nombre text := btrim(coalesce(p_nombre, ''));
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'atencion.configuracion.puesto.gestionar');
  if length(v_nombre) < 1 or length(v_nombre) > 40 then
    raise exception 'El nombre del puesto debe tener entre 1 y 40 caracteres.';
  end if;
  if not exists (select 1 from core.sucursales s where s.id = p_sucursal_id and s.company_id = p_company_id) then
    raise exception 'Sucursal no encontrada.';
  end if;

  if p_puesto_id is null then
    insert into atencion.puestos (company_id, sucursal_id, nombre, orden, activo)
    values (p_company_id, p_sucursal_id, v_nombre, coalesce(p_orden, 1), coalesce(p_activo, true))
    returning id into v_id;
  else
    update atencion.puestos p
      set nombre = v_nombre, orden = coalesce(p_orden, p.orden), activo = coalesce(p_activo, p.activo), updated_at = now()
      where p.id = p_puesto_id and p.company_id = p_company_id and p.sucursal_id = p_sucursal_id
      returning p.id into v_id;
    if v_id is null then raise exception 'Puesto no encontrado.'; end if;
  end if;

  perform core.fn_auditar(v_uid, p_company_id,
    case when p_puesto_id is null then 'admin.atencion.puesto.crear' else 'admin.atencion.puesto.editar' end,
    'atencion.puestos', v_id::text, jsonb_build_object('nombre', v_nombre, 'sucursal_id', p_sucursal_id));
  return v_id;
exception
  when unique_violation then raise exception 'Ya existe un puesto con ese nombre en la sucursal.';
end;
$$;

create or replace function public.atencion_listar_pantallas(p_company_id uuid, p_sucursal_id uuid)
returns table (id uuid, nombre text, activa boolean, config jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform core.fn_exigir_permiso(p_company_id, 'atencion.configuracion.pantalla.gestionar');
  return query
  select pa.id, pa.nombre, pa.activa, pa.config from atencion.pantallas pa
  where pa.company_id = p_company_id and pa.sucursal_id = p_sucursal_id
  order by lower(pa.nombre);
end;
$$;

create or replace function public.atencion_guardar_pantalla(
  p_company_id uuid, p_pantalla_id uuid, p_sucursal_id uuid, p_nombre text, p_activa boolean, p_config jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_id uuid;
  v_nombre text := btrim(coalesce(p_nombre, ''));
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'atencion.configuracion.pantalla.gestionar');
  if length(v_nombre) < 2 or length(v_nombre) > 60 then
    raise exception 'El nombre de la pantalla debe tener entre 2 y 60 caracteres.';
  end if;
  if p_config is not null and jsonb_typeof(p_config) <> 'object' then
    raise exception 'Configuración inválida.';
  end if;
  if not exists (select 1 from core.sucursales s where s.id = p_sucursal_id and s.company_id = p_company_id) then
    raise exception 'Sucursal no encontrada.';
  end if;

  if p_pantalla_id is null then
    insert into atencion.pantallas (company_id, sucursal_id, nombre, activa, config)
    values (p_company_id, p_sucursal_id, v_nombre, coalesce(p_activa, true), coalesce(p_config, '{}'::jsonb))
    returning id into v_id;
  else
    update atencion.pantallas pa
      set nombre = v_nombre, activa = coalesce(p_activa, pa.activa), config = coalesce(p_config, pa.config), updated_at = now()
      where pa.id = p_pantalla_id and pa.company_id = p_company_id and pa.sucursal_id = p_sucursal_id
      returning pa.id into v_id;
    if v_id is null then raise exception 'Pantalla no encontrada.'; end if;
  end if;

  perform core.fn_auditar(v_uid, p_company_id,
    case when p_pantalla_id is null then 'admin.atencion.pantalla.crear' else 'admin.atencion.pantalla.editar' end,
    'atencion.pantallas', v_id::text, jsonb_build_object('nombre', v_nombre, 'sucursal_id', p_sucursal_id));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC — Iniciar / Cerrar atención
-- -----------------------------------------------------------------------------

-- Lo que necesita la pantalla de inicio del módulo: sesión actual, sucursales
-- disponibles y qué puede iniciar el usuario.
create or replace function public.atencion_mi_estado(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_sesion jsonb;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'atencion.ver_modulo');
  perform atencion.fn_cerrar_vencidas();

  select jsonb_build_object(
           'tipo', sa.tipo, 'inicio', sa.inicio,
           'sucursal_id', sa.sucursal_id, 'sucursal', s.nombre,
           'puesto_id', sa.puesto_id, 'puesto', p.nombre)
    into v_sesion
  from atencion.sesiones_activas sa
  join core.sucursales s on s.id = sa.sucursal_id
  left join atencion.puestos p on p.id = sa.puesto_id
  where sa.user_id = v_uid and sa.company_id = p_company_id;

  return jsonb_build_object(
    'sesion', v_sesion,
    'puede_recepcion', core.has_permission(v_uid, p_company_id, 'atencion.recepcion.sesion.iniciar'),
    'puede_puesto', core.has_permission(v_uid, p_company_id, 'atencion.puesto.sesion.iniciar'),
    'sucursales', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre) order by lower(s.nombre))
      from core.sucursales s
      where s.company_id = p_company_id and atencion.fn_puede_sucursal(v_uid, p_company_id, s.id)
    ), '[]'::jsonb)
  );
end;
$$;

-- "Iniciar atención". p_tipo: 'recepcion' | 'puesto' | null (null = el único
-- que permita el rol). p_sucursal_id: null = la única sucursal del usuario.
-- Si ya tiene una atención abierta, la devuelve sin crear otra.
create or replace function public.atencion_iniciar(p_company_id uuid, p_sucursal_id uuid default null, p_tipo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_recep boolean;
  v_puesto boolean;
  v_tipo text := p_tipo;
  v_sucursal uuid := p_sucursal_id;
  v_puesto_id uuid;
  v_sesion_id uuid := gen_random_uuid();
  v_inicio timestamptz := now();
  v_hoy date;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'atencion.ver_modulo');
  perform atencion.fn_cerrar_vencidas();

  if exists (select 1 from atencion.sesiones_activas sa where sa.user_id = v_uid) then
    return public.atencion_mi_estado(p_company_id);
  end if;

  v_recep := core.has_permission(v_uid, p_company_id, 'atencion.recepcion.sesion.iniciar');
  v_puesto := core.has_permission(v_uid, p_company_id, 'atencion.puesto.sesion.iniciar');
  if v_tipo is null then
    if v_recep and v_puesto then raise exception 'Elegí si vas a trabajar en recepción o en un puesto.'; end if;
    v_tipo := case when v_recep then 'recepcion' when v_puesto then 'puesto' end;
  end if;
  if v_tipo is null or v_tipo not in ('recepcion', 'puesto')
     or (v_tipo = 'recepcion' and not v_recep) or (v_tipo = 'puesto' and not v_puesto) then
    raise exception using errcode = '42501', message = 'Tu rol no permite iniciar atención así.';
  end if;

  if v_sucursal is null then
    select s.id into v_sucursal from core.sucursales s
    where s.company_id = p_company_id and atencion.fn_puede_sucursal(v_uid, p_company_id, s.id);
    if (select count(*) from core.sucursales s
        where s.company_id = p_company_id and atencion.fn_puede_sucursal(v_uid, p_company_id, s.id)) <> 1 then
      raise exception 'Elegí la sucursal donde vas a trabajar.';
    end if;
  end if;
  if not atencion.fn_puede_sucursal(v_uid, p_company_id, v_sucursal) then
    raise exception using errcode = '42501', message = 'No tenés asignada esa sucursal.';
  end if;

  if v_tipo = 'puesto' then
    -- Primer puesto libre; SKIP LOCKED evita que dos agentes reciban el mismo.
    select p.id into v_puesto_id from atencion.puestos p
    where p.sucursal_id = v_sucursal and p.activo
      and not exists (select 1 from atencion.sesiones_activas sa where sa.puesto_id = p.id)
    order by p.orden, lower(p.nombre)
    limit 1
    for update skip locked;
    if v_puesto_id is null then raise exception 'No hay puestos libres en esta sucursal.'; end if;
  end if;

  v_hoy := atencion.fn_hoy(v_sucursal);
  insert into atencion.sesiones_activas (sesion_id, inicio, company_id, sucursal_id, user_id, tipo, puesto_id, fecha_local)
  values (v_sesion_id, v_inicio, p_company_id, v_sucursal, v_uid, v_tipo, v_puesto_id, v_hoy);

  perform atencion.fn_asegurar_particion_sesiones(v_inicio::date);
  insert into atencion.sesiones (id, inicio, company_id, sucursal_id, user_id, tipo, puesto_id, fecha_local)
  values (v_sesion_id, v_inicio, p_company_id, v_sucursal, v_uid, v_tipo, v_puesto_id, v_hoy);

  return public.atencion_mi_estado(p_company_id);
exception
  when unique_violation then
    raise exception 'Ese puesto se acaba de ocupar o ya tenés una atención abierta. Intentá de nuevo.';
end;
$$;

-- "Cerrar atención". Con un turno llamado sin terminar, pide resolverlo antes.
create or replace function public.atencion_cerrar(p_company_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_a atencion.sesiones_activas;
begin
  v_a := atencion.fn_exigir_sesion(p_company_id, 'atencion.ver_modulo', null);
  if v_a.puesto_id is not null and exists (
    select 1 from atencion.turnos t
    where t.puesto_id = v_a.puesto_id and t.estado = 'llamado' and t.creado_en >= now() - interval '2 days'
  ) then
    raise exception 'Finalizá o marcá ausente el turno actual antes de cerrar.';
  end if;
  perform atencion.fn_cerrar_sesion(v_a.sesion_id, 'manual', v_a.user_id);
end;
$$;

-- Supervisor: libera el puesto o la recepción de otro usuario.
create or replace function public.atencion_liberar(p_company_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_sesion uuid;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'atencion.configuracion.sesion.liberar');
  select sa.sesion_id into v_sesion from atencion.sesiones_activas sa
  where sa.user_id = p_user_id and sa.company_id = p_company_id;
  if v_sesion is null then raise exception 'Ese usuario no tiene una atención abierta.'; end if;
  perform atencion.fn_cerrar_sesion(v_sesion, 'liberado', v_uid);
  perform core.fn_auditar(v_uid, p_company_id, 'admin.atencion.sesion.liberar', 'auth.users', p_user_id::text, '{}'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC — turnos
-- -----------------------------------------------------------------------------

-- Recepción: registra al cliente y entrega el siguiente número del día.
create or replace function public.atencion_crear_turno(
  p_company_id uuid, p_cliente_nombre text, p_cliente_telefono text default null, p_factura text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_a atencion.sesiones_activas;
  v_nombre text := btrim(coalesce(p_cliente_nombre, ''));
  v_hoy date;
  v_numero integer;
  v_t atencion.turnos;
begin
  v_a := atencion.fn_exigir_sesion(p_company_id, 'atencion.recepcion.turno.crear', 'recepcion');
  if length(v_nombre) < 1 or length(v_nombre) > 120 then raise exception 'Escribí el nombre del cliente.'; end if;
  if length(coalesce(p_cliente_telefono, '')) > 30 then raise exception 'El teléfono no puede superar 30 caracteres.'; end if;
  if length(coalesce(p_factura, '')) > 50 then raise exception 'La factura no puede superar 50 caracteres.'; end if;

  v_hoy := atencion.fn_hoy(v_a.sucursal_id);
  insert into atencion.contadores as c (sucursal_id, fecha_local, ultimo_numero)
  values (v_a.sucursal_id, v_hoy, 1)
  on conflict (sucursal_id, fecha_local) do update set ultimo_numero = c.ultimo_numero + 1
  returning c.ultimo_numero into v_numero;

  perform atencion.fn_asegurar_particion_turnos(current_date);
  insert into atencion.turnos (company_id, sucursal_id, fecha_local, numero, cliente_nombre, cliente_telefono, factura, creado_por)
  values (p_company_id, v_a.sucursal_id, v_hoy, v_numero, v_nombre,
          nullif(btrim(coalesce(p_cliente_telefono, '')), ''), nullif(btrim(coalesce(p_factura, '')), ''), v_a.user_id)
  returning * into v_t;
  perform atencion.fn_evento(v_t, 'creado', v_a.user_id);

  return jsonb_build_object('id', v_t.id, 'numero', v_t.numero, 'fecha', v_t.fecha_local);
end;
$$;

create or replace function public.atencion_cancelar_turno(p_company_id uuid, p_turno_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_t atencion.turnos;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'atencion.recepcion.turno.cancelar');
  update atencion.turnos t set estado = 'anulado', finalizado_en = now()
  where t.id = p_turno_id and t.company_id = p_company_id and t.estado = 'esperando'
    and t.creado_en >= now() - interval '2 days'
    and atencion.fn_puede_sucursal(v_uid, p_company_id, t.sucursal_id)
  returning * into v_t;
  if not found then raise exception 'Solo se pueden anular turnos en espera de tu sucursal.'; end if;
  perform atencion.fn_evento(v_t, 'anulado', v_uid);
end;
$$;

-- Fila del día de la sucursal de la sesión (o la indicada, para supervisores
-- sin sesión). Los datos del cliente solo con atencion.cliente.datos.ver.
create or replace function public.atencion_cola(p_company_id uuid, p_sucursal_id uuid default null)
returns table (
  id uuid, numero integer, estado text, puesto text, llamado_en timestamptz, veces_llamado integer,
  cliente_nombre text, cliente_telefono text, factura text, creado_en timestamptz
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid;
  v_sucursal uuid := p_sucursal_id;
  v_datos boolean;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'atencion.cola.turno.ver');
  perform atencion.fn_cerrar_vencidas();
  if v_sucursal is null then
    select sa.sucursal_id into v_sucursal from atencion.sesiones_activas sa where sa.user_id = v_uid;
  end if;
  if v_sucursal is null or not atencion.fn_puede_sucursal(v_uid, p_company_id, v_sucursal) then
    raise exception 'Elegí una sucursal tuya o iniciá atención.';
  end if;
  v_datos := core.has_permission(v_uid, p_company_id, 'atencion.cliente.datos.ver');

  return query
  select t.id, t.numero, t.estado, p.nombre, t.llamado_en, t.veces_llamado,
         t.cliente_nombre,
         case when v_datos then t.cliente_telefono end,
         case when v_datos then t.factura end,
         t.creado_en
  from atencion.turnos t
  left join atencion.puestos p on p.id = t.puesto_id
  where t.sucursal_id = v_sucursal
    and t.fecha_local = atencion.fn_hoy(v_sucursal)
    and t.creado_en >= now() - interval '2 days'
  order by (t.estado not in ('esperando', 'llamado')), t.numero;
end;
$$;

-- Agente: llama al siguiente de la fila (o a uno específico si p_turno_id,
-- con permiso de fuera de orden). Exige no tener otro turno llamado.
create or replace function public.atencion_llamar(p_company_id uuid, p_turno_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_a atencion.sesiones_activas;
  v_t atencion.turnos;
  v_siguiente integer;
begin
  v_a := atencion.fn_exigir_sesion(p_company_id, 'atencion.puesto.turno.llamar', 'puesto');
  if p_turno_id is not null then
    perform core.fn_exigir_permiso(p_company_id, 'atencion.puesto.turno.llamar_fuera_orden');
  end if;
  if (atencion.fn_turno_actual(v_a.puesto_id)).id is not null then
    raise exception 'Finalizá o marcá ausente el turno actual antes de llamar otro.';
  end if;

  select min(t.numero) into v_siguiente from atencion.turnos t
  where t.sucursal_id = v_a.sucursal_id and t.estado = 'esperando'
    and t.fecha_local = atencion.fn_hoy(v_a.sucursal_id) and t.creado_en >= now() - interval '2 days';

  update atencion.turnos t
    set estado = 'llamado', puesto_id = v_a.puesto_id, atendido_por = v_a.user_id,
        llamado_en = now(), veces_llamado = t.veces_llamado + 1,
        fuera_de_orden = (p_turno_id is not null and t.numero <> v_siguiente)
  where t.id = (
      select t2.id from atencion.turnos t2
      where t2.sucursal_id = v_a.sucursal_id and t2.estado = 'esperando'
        and t2.fecha_local = atencion.fn_hoy(v_a.sucursal_id) and t2.creado_en >= now() - interval '2 days'
        and (p_turno_id is null or t2.id = p_turno_id)
      order by t2.numero
      limit 1
      for update skip locked)
    and t.creado_en >= now() - interval '2 days'
  returning * into v_t;

  if not found then
    raise exception '%', case when p_turno_id is null then 'No hay turnos en espera.' else 'Ese turno ya no está en espera.' end;
  end if;
  perform atencion.fn_evento(v_t, 'llamado', v_a.user_id, jsonb_build_object('fuera_de_orden', v_t.fuera_de_orden));
  return jsonb_build_object('id', v_t.id, 'numero', v_t.numero, 'fuera_de_orden', v_t.fuera_de_orden);
end;
$$;

-- Repite el llamado del turno actual del puesto (la pantalla vuelve a anunciarlo).
create or replace function public.atencion_rellamar(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_a atencion.sesiones_activas;
  v_t atencion.turnos;
begin
  v_a := atencion.fn_exigir_sesion(p_company_id, 'atencion.puesto.turno.llamar', 'puesto');
  v_t := atencion.fn_turno_actual(v_a.puesto_id);
  if v_t.id is null then raise exception 'No tenés un turno llamado.'; end if;
  update atencion.turnos t set llamado_en = now(), veces_llamado = t.veces_llamado + 1
  where t.id = v_t.id and t.creado_en = v_t.creado_en
  returning * into v_t;
  perform atencion.fn_evento(v_t, 'rellamado', v_a.user_id);
  return jsonb_build_object('id', v_t.id, 'numero', v_t.numero, 'veces_llamado', v_t.veces_llamado);
end;
$$;

-- Termina el turno actual del puesto: atendido o ausente.
create or replace function public.atencion_terminar(p_company_id uuid, p_resultado text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_a atencion.sesiones_activas;
  v_t atencion.turnos;
begin
  if p_resultado not in ('atendido', 'ausente') then raise exception 'Resultado inválido.'; end if;
  v_a := atencion.fn_exigir_sesion(p_company_id,
    case when p_resultado = 'atendido' then 'atencion.puesto.turno.finalizar' else 'atencion.puesto.turno.marcar_ausente' end,
    'puesto');
  v_t := atencion.fn_turno_actual(v_a.puesto_id);
  if v_t.id is null then raise exception 'No tenés un turno llamado.'; end if;
  update atencion.turnos t set estado = p_resultado, finalizado_en = now()
  where t.id = v_t.id and t.creado_en = v_t.creado_en
  returning * into v_t;
  perform atencion.fn_evento(v_t, case when p_resultado = 'atendido' then 'finalizado' else 'ausente' end, v_a.user_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPC — pantalla pública (anónima, sin datos personales)
-- -----------------------------------------------------------------------------
create or replace function public.atencion_pantalla_estado(p_pantalla_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_p atencion.pantallas;
  v_sucursal core.sucursales;
  v_hoy date;
begin
  select pa.* into v_p from atencion.pantallas pa where pa.id = p_pantalla_id and pa.activa;
  if not found then return null; end if;
  select s.* into v_sucursal from core.sucursales s where s.id = v_p.sucursal_id and s.activa;
  if not found then return null; end if;
  if not exists (
    select 1 from core.apps a
    join core.company_apps ca on ca.app_id = a.id and ca.company_id = v_p.company_id and ca.enabled
    where a.slug = 'atencion' and a.active
  ) then
    return null;
  end if;

  perform atencion.fn_cerrar_vencidas();
  v_hoy := atencion.fn_hoy(v_sucursal.id);

  return jsonb_build_object(
    'sucursal', v_sucursal.nombre,
    'config', v_p.config,
    'llamados', coalesce((
      select jsonb_agg(jsonb_build_object('numero', t.numero, 'puesto', p.nombre,
                                          'llamado_en', t.llamado_en, 'veces', t.veces_llamado)
                       order by t.llamado_en desc)
      from atencion.turnos t join atencion.puestos p on p.id = t.puesto_id
      where t.sucursal_id = v_sucursal.id and t.estado = 'llamado' and t.fecha_local = v_hoy
        and t.creado_en >= now() - interval '2 days'
    ), '[]'::jsonb),
    'proximos', coalesce((
      select jsonb_agg(x.numero order by x.numero) from (
        select t.numero from atencion.turnos t
        where t.sucursal_id = v_sucursal.id and t.estado = 'esperando' and t.fecha_local = v_hoy
          and t.creado_en >= now() - interval '2 days'
        order by t.numero limit 8) x
    ), '[]'::jsonb),
    'generado_en', now()
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Grants
-- -----------------------------------------------------------------------------
revoke all on all functions in schema atencion from public, anon, authenticated;

revoke all on function
  public.admin_listar_sucursales(uuid),
  public.admin_guardar_sucursal(uuid, uuid, text, text, text, boolean),
  public.admin_sucursales_de_usuario(uuid, uuid),
  public.admin_asignar_sucursales(uuid, uuid, uuid[]),
  public.atencion_listar_puestos(uuid, uuid),
  public.atencion_guardar_puesto(uuid, uuid, uuid, text, integer, boolean),
  public.atencion_listar_pantallas(uuid, uuid),
  public.atencion_guardar_pantalla(uuid, uuid, uuid, text, boolean, jsonb),
  public.atencion_mi_estado(uuid),
  public.atencion_iniciar(uuid, uuid, text),
  public.atencion_cerrar(uuid),
  public.atencion_liberar(uuid, uuid),
  public.atencion_crear_turno(uuid, text, text, text),
  public.atencion_cancelar_turno(uuid, uuid),
  public.atencion_cola(uuid, uuid),
  public.atencion_llamar(uuid, uuid),
  public.atencion_rellamar(uuid),
  public.atencion_terminar(uuid, text),
  public.atencion_pantalla_estado(uuid)
from public, anon;

grant execute on function
  public.admin_listar_sucursales(uuid),
  public.admin_guardar_sucursal(uuid, uuid, text, text, text, boolean),
  public.admin_sucursales_de_usuario(uuid, uuid),
  public.admin_asignar_sucursales(uuid, uuid, uuid[]),
  public.atencion_listar_puestos(uuid, uuid),
  public.atencion_guardar_puesto(uuid, uuid, uuid, text, integer, boolean),
  public.atencion_listar_pantallas(uuid, uuid),
  public.atencion_guardar_pantalla(uuid, uuid, uuid, text, boolean, jsonb),
  public.atencion_mi_estado(uuid),
  public.atencion_iniciar(uuid, uuid, text),
  public.atencion_cerrar(uuid),
  public.atencion_liberar(uuid, uuid),
  public.atencion_crear_turno(uuid, text, text, text),
  public.atencion_cancelar_turno(uuid, uuid),
  public.atencion_cola(uuid, uuid),
  public.atencion_llamar(uuid, uuid),
  public.atencion_rellamar(uuid),
  public.atencion_terminar(uuid, text)
to authenticated;

-- La pantalla pública no inicia sesión: anon, identificada por el id del dispositivo.
grant execute on function public.atencion_pantalla_estado(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 11. pg_cron: cierre de vencidos (cada 5 min, además del cierre "perezoso"
--     de cada RPC) y particiones de los próximos 3 meses (día 1 de cada mes).
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('atencion-cierre-vencidas', '*/5 * * * *', 'select atencion.fn_cerrar_vencidas()');
select cron.schedule('nexo-particiones-futuras', '0 3 1 * *', 'select core.fn_asegurar_particiones_futuras(3)');
