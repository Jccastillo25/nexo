-- =============================================================================
-- Nexo — administración de usuarios y roles: esquema + has_permission + RPC
--
-- Diseño y decisiones del usuario (2026-10-14):
--   docs/plan/12-administracion-usuarios-roles.md (secciones 4-6).
-- Requiere el Paso Cero 20261014201119 (9 permisos nexo.administracion.*).
--
-- Revisada y aprobada por el usuario el 2026-10-14; validada antes en una
-- transacción revertida (15 pruebas, ver docs/status-log/2026-10-14-usuarios-roles-esquema.md).
--
-- Resumen:
--   1. core.roles / core.rol_permisos / core.perfiles + rol_id/activo en
--      core.company_memberships (UN rol por usuario y empresa).
--   2. core.has_permission: evalúa el rol de empresa, bloquea usuarios
--      inactivos y permisos de módulos no habilitados para la empresa.
--      Deja de evaluar core.user_app_roles (0 filas, se conserva como
--      plantillas) y el bypass de membresía 'admin' (0 filas).
--   3. RPC public.admin_* (security definer) con reglas anti-escalada y
--      auditoría en core.audit_log. La creación de la cuenta en Supabase
--      Auth la hace una Server Action de apps/nexo con service role y
--      después llama a public.admin_completar_alta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Prechecks — abortan sin cambiar nada si el remoto no es el esperado.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('core.roles') is not null
     or to_regclass('core.rol_permisos') is not null
     or to_regclass('core.perfiles') is not null then
    raise exception 'precheck: core.roles/rol_permisos/perfiles ya existen';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'core' and table_name = 'company_memberships'
      and column_name in ('rol_id', 'activo', 'updated_at')
  ) then
    raise exception 'precheck: core.company_memberships ya tiene rol_id/activo/updated_at';
  end if;
  if exists (select 1 from core.user_app_roles) then
    raise exception 'precheck: core.user_app_roles tiene filas y esta migración deja de evaluarlas';
  end if;
  if exists (select 1 from core.company_memberships where role not in ('owner', 'member')) then
    raise exception 'precheck: hay membresías con rol distinto de owner/member (el bypass admin desaparece)';
  end if;
  if (select count(*) from core.permissions_catalog where code like 'nexo.administracion.%') <> 9 then
    raise exception 'precheck: falta el Paso Cero (nexo.administracion.*)';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------
create table core.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 2 and 80),
  descripcion text check (descripcion is null or length(descripcion) <= 500),
  activo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index roles_company_nombre_uq on core.roles (company_id, lower(btrim(nombre)));

comment on table core.roles is
  'Roles de empresa (decisión 2026-10-14): nombre + apps con acceso (<app>.ver_modulo) + permisos internos. Un rol por usuario vía core.company_memberships.rol_id. Ver docs/plan/12-administracion-usuarios-roles.md.';

create table core.rol_permisos (
  rol_id uuid not null references core.roles(id) on delete cascade,
  permission_code text not null
    references core.permissions_catalog(code) on update cascade on delete cascade,
  primary key (rol_id, permission_code)
);
create index rol_permisos_permission_code_idx on core.rol_permisos (permission_code);

comment on table core.rol_permisos is
  'Permisos de cada rol de empresa. Tener <app>.ver_modulo = acceso a la app.';

create table core.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null check (length(btrim(nombre_completo)) between 2 and 120),
  telefono text check (telefono is null or length(telefono) <= 30),
  cargo text check (cargo is null or length(cargo) <= 80),
  debe_cambiar_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table core.perfiles is
  'Datos de la persona detrás de auth.users (independiente de la empresa). debe_cambiar_password = la contraseña la puso un administrador.';

alter table core.company_memberships
  add column rol_id uuid,
  add column activo boolean not null default true,
  add column updated_at timestamptz not null default now(),
  add constraint company_memberships_rol_misma_empresa_fk
    foreign key (rol_id, company_id) references core.roles (id, company_id) on delete restrict;
create index company_memberships_rol_id_idx on core.company_memberships (rol_id);
create index company_memberships_company_id_idx on core.company_memberships (company_id);

comment on column core.company_memberships.rol_id is
  'Rol de empresa del usuario (uno solo). NULL para el owner, que tiene acceso total.';
comment on column core.company_memberships.activo is
  'false = usuario desactivado: core.has_permission devuelve false para todo. Se conserva rol e historial.';

-- RLS sin policies: authenticated no tiene USAGE sobre el schema core, todo
-- acceso pasa por las RPC security definer de abajo.
alter table core.roles enable row level security;
alter table core.rol_permisos enable row level security;
alter table core.perfiles enable row level security;
revoke all on core.roles, core.rol_permisos, core.perfiles from anon, authenticated;

-- Particiones de core.audit_log: hoy llegan solo hasta 2026-11 y no hay
-- pg_cron instalado. Se crean los próximos meses ahora y core.fn_auditar
-- asegura la del mes en curso antes de cada insert.
select core.fn_asegurar_particiones_futuras(3);

-- -----------------------------------------------------------------------------
-- 2. core.has_permission — misma firma, misma fuente única de verdad.
-- -----------------------------------------------------------------------------
create or replace function core.has_permission(p_user_id uuid, p_company_id uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- 1. sin usuario/empresa o código no registrado -> no
    when p_user_id is null or p_company_id is null then false
    when not exists (select 1 from core.permissions_catalog pc where pc.code = p_code) then false
    -- 2. módulo del permiso inactivo o no habilitado para la empresa -> no (incluso owner)
    when not exists (
      select 1
      from core.permissions_catalog pc
      join core.apps a on a.slug = pc.module_slug and a.active
      join core.company_apps ca on ca.app_id = a.id and ca.company_id = p_company_id and ca.enabled
      where pc.code = p_code
    ) then false
    -- 3. sin membresía activa en la empresa -> no
    when not exists (
      select 1 from core.company_memberships m
      where m.user_id = p_user_id and m.company_id = p_company_id and m.activo
    ) then false
    -- 4. excepción individual explícita -> manda esa fila
    when exists (
      select 1 from core.user_permissions up
      where up.user_id = p_user_id and up.company_id = p_company_id and up.permission_code = p_code
    ) then coalesce((
      select up.granted from core.user_permissions up
      where up.user_id = p_user_id and up.company_id = p_company_id and up.permission_code = p_code
    ), false)
    -- 5. owner -> sí
    when exists (
      select 1 from core.company_memberships m
      where m.user_id = p_user_id and m.company_id = p_company_id and m.role = 'owner'
    ) then true
    -- 6. el rol de empresa del usuario trae el permiso -> sí; si no, no
    else exists (
      select 1
      from core.company_memberships m
      join core.roles r on r.id = m.rol_id and r.company_id = m.company_id and r.activo
      join core.rol_permisos rp on rp.rol_id = r.id and rp.permission_code = p_code
      where m.user_id = p_user_id and m.company_id = p_company_id and m.activo
    )
  end;
$$;

comment on function core.has_permission(uuid, uuid, text) is
  'Fuente única de la norma v3.0 (2026-10-14): código válido + módulo habilitado + membresía activa -> excepción individual -> owner -> rol de empresa. Ver docs/plan/12-administracion-usuarios-roles.md §5.';

-- -----------------------------------------------------------------------------
-- 3. Helpers internos (no expuestos)
-- -----------------------------------------------------------------------------
create or replace function core.fn_es_owner(p_user_id uuid, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from core.company_memberships m
    where m.user_id = p_user_id and m.company_id = p_company_id
      and m.role = 'owner' and m.activo
  );
$$;

create or replace function core.fn_permisos_rol(p_rol_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(rp.permission_code order by rp.permission_code), '{}')
  from core.rol_permisos rp
  where rp.rol_id = p_rol_id;
$$;

-- Anti-escalada: ¿el usuario tiene TODOS estos permisos? (owner: siempre).
create or replace function core.fn_cubre_permisos(p_user_id uuid, p_company_id uuid, p_codes text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select core.fn_es_owner(p_user_id, p_company_id)
      or not exists (
        select 1 from unnest(coalesce(p_codes, '{}')) c
        where not core.has_permission(p_user_id, p_company_id, c)
      );
$$;

-- Exige un permiso al usuario de la sesión y devuelve su id.
create or replace function core.fn_exigir_permiso(p_company_id uuid, p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not core.has_permission(v_uid, p_company_id, p_code) then
    raise exception using
      errcode = '42501',
      message = format('No tenés permiso para esta acción (%s).', p_code);
  end if;
  return v_uid;
end;
$$;

create or replace function core.fn_auditar(
  p_user_id uuid, p_company_id uuid, p_action text,
  p_entity text, p_entity_id text, p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform core.fn_asegurar_particion_audit_log(current_date);
  insert into core.audit_log (user_id, company_id, action, entity, entity_id, metadata)
  values (p_user_id, p_company_id, p_action, p_entity, p_entity_id, p_metadata);
end;
$$;

-- Valida que el llamador pueda administrar a p_user_id y devuelve su membresía
-- bloqueada. Reglas: el objetivo existe en la empresa; solo el owner toca al
-- owner; el llamador tiene todos los permisos del rol actual del objetivo.
create or replace function core.fn_membresia_administrable(p_caller uuid, p_company_id uuid, p_user_id uuid)
returns core.company_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m core.company_memberships;
begin
  select * into v_m from core.company_memberships m
  where m.user_id = p_user_id and m.company_id = p_company_id
  for update;
  if not found then
    raise exception 'El usuario no pertenece a esta empresa.';
  end if;
  if v_m.role = 'owner' and not core.fn_es_owner(p_caller, p_company_id) then
    raise exception using errcode = '42501', message = 'Solo el owner puede modificar al owner.';
  end if;
  if v_m.rol_id is not null
     and not core.fn_cubre_permisos(p_caller, p_company_id, core.fn_permisos_rol(v_m.rol_id)) then
    raise exception using errcode = '42501',
      message = 'No podés administrar a un usuario cuyo rol tiene permisos que vos no tenés.';
  end if;
  return v_m;
end;
$$;

-- Valida un rol asignable por el llamador (de la empresa, activo, sin escalada).
create or replace function core.fn_validar_rol_asignable(p_caller uuid, p_company_id uuid, p_rol_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_rol_id is null then
    raise exception 'Seleccioná un rol.';
  end if;
  if not exists (
    select 1 from core.roles r where r.id = p_rol_id and r.company_id = p_company_id and r.activo
  ) then
    raise exception 'El rol no existe o está inactivo.';
  end if;
  if not core.fn_cubre_permisos(p_caller, p_company_id, core.fn_permisos_rol(p_rol_id)) then
    raise exception using errcode = '42501',
      message = 'No podés asignar un rol con permisos que vos no tenés.';
  end if;
end;
$$;

-- Vincula (o desvincula) el empleado de RRHH de un usuario.
create or replace function core.fn_vincular_empleado(p_company_id uuid, p_user_id uuid, p_empleado_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual uuid;
  v_ocupado uuid;
begin
  select e.id into v_actual from rrhh.empleados e
  where e.user_id = p_user_id and e.company_id = p_company_id;

  if v_actual is not distinct from p_empleado_id then
    return jsonb_build_object('empleado_antes', v_actual, 'empleado_despues', p_empleado_id);
  end if;

  if p_empleado_id is not null then
    select e.user_id into v_ocupado from rrhh.empleados e
    where e.id = p_empleado_id and e.company_id = p_company_id
    for update;
    if not found then
      raise exception 'El empleado no existe en esta empresa.';
    end if;
    if v_ocupado is not null then
      raise exception 'Ese empleado ya está vinculado a otro usuario.';
    end if;
  end if;

  if v_actual is not null then
    update rrhh.empleados set user_id = null where id = v_actual;
  end if;
  if p_empleado_id is not null then
    update rrhh.empleados set user_id = p_user_id where id = p_empleado_id;
  end if;

  return jsonb_build_object('empleado_antes', v_actual, 'empleado_despues', p_empleado_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. RPC de lectura
-- -----------------------------------------------------------------------------
create or replace function public.admin_listar_usuarios(p_company_id uuid)
returns table (
  user_id uuid, email text, nombre_completo text, telefono text, cargo text,
  rol_id uuid, rol_nombre text, es_owner boolean, activo boolean,
  empleado_id uuid, empleado_nombre text, debe_cambiar_password boolean,
  ultimo_ingreso timestamptz, creado_en timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform core.fn_exigir_permiso(p_company_id, 'nexo.administracion.usuarios.ver');
  return query
  select m.user_id, u.email::text, p.nombre_completo, p.telefono, p.cargo,
         m.rol_id, r.nombre, (m.role = 'owner'), m.activo,
         e.id, nullif(btrim(coalesce(e.nombre, '') || ' ' || coalesce(e.apellido, '')), ''),
         coalesce(p.debe_cambiar_password, false), u.last_sign_in_at, m.created_at
  from core.company_memberships m
  join auth.users u on u.id = m.user_id
  left join core.perfiles p on p.user_id = m.user_id
  left join core.roles r on r.id = m.rol_id
  left join rrhh.empleados e on e.user_id = m.user_id and e.company_id = m.company_id
  where m.company_id = p_company_id
  order by lower(coalesce(p.nombre_completo, u.email::text));
end;
$$;

create or replace function public.admin_listar_roles(p_company_id uuid)
returns table (
  id uuid, nombre text, descripcion text, activo boolean,
  usuarios integer, permisos text[], actualizado_en timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform core.fn_exigir_permiso(p_company_id, 'nexo.administracion.roles.ver');
  return query
  select r.id, r.nombre, r.descripcion, r.activo,
         (select count(*)::integer from core.company_memberships m where m.rol_id = r.id),
         core.fn_permisos_rol(r.id), r.updated_at
  from core.roles r
  where r.company_id = p_company_id
  order by lower(r.nombre);
end;
$$;

-- Catálogo para el editor de roles: solo apps activas y habilitadas para la empresa.
create or replace function public.admin_catalogo_permisos(p_company_id uuid)
returns table (
  module_slug text, app_nombre text, domain text, code text, label text, description text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform core.fn_exigir_permiso(p_company_id, 'nexo.administracion.roles.ver');
  return query
  select pc.module_slug, a.name, pc.domain, pc.code, pc.label, pc.description
  from core.permissions_catalog pc
  join core.apps a on a.slug = pc.module_slug and a.active
  join core.company_apps ca on ca.app_id = a.id and ca.company_id = p_company_id and ca.enabled
  order by a.name, (pc.domain <> 'acceso'), pc.domain, pc.code;
end;
$$;

-- Plantillas: los roles predefinidos por módulo (core.app_roles) para
-- "Cargar plantilla" en el editor. Solo lectura.
create or replace function public.admin_plantillas_rol(p_company_id uuid)
returns table (module_slug text, role_key text, label text, description text, permisos text[])
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform core.fn_exigir_permiso(p_company_id, 'nexo.administracion.roles.ver');
  return query
  select ar.module_slug, ar.role_key, ar.label, ar.description,
         coalesce((select array_agg(arp.permission_code order by arp.permission_code)
                   from core.app_role_permissions arp where arp.app_role_id = ar.id), '{}')
  from core.app_roles ar
  join core.apps a on a.slug = ar.module_slug and a.active
  join core.company_apps ca on ca.app_id = a.id and ca.company_id = p_company_id and ca.enabled
  order by ar.module_slug, ar.label;
end;
$$;

create or replace function public.admin_buscar_empleados(p_company_id uuid, p_texto text)
returns table (id uuid, nombre_completo text, documento_identidad text, vinculado_a uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_texto text := '%' || replace(replace(replace(btrim(coalesce(p_texto, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if v_uid is null
     or not (core.has_permission(v_uid, p_company_id, 'nexo.administracion.usuarios.crear')
          or core.has_permission(v_uid, p_company_id, 'nexo.administracion.usuarios.editar')) then
    raise exception using errcode = '42501', message = 'No tenés permiso para buscar empleados.';
  end if;
  return query
  select e.id, btrim(coalesce(e.nombre, '') || ' ' || coalesce(e.apellido, '')),
         e.documento_identidad, e.user_id
  from rrhh.empleados e
  where e.company_id = p_company_id
    and (coalesce(e.nombre, '') || ' ' || coalesce(e.apellido, '') || ' ' || coalesce(e.documento_identidad, ''))
        ilike v_texto
  order by e.nombre, e.apellido
  limit 20;
end;
$$;

create or replace function public.admin_listar_auditoria(
  p_company_id uuid, p_limite integer default 100, p_antes timestamptz default null
)
returns table (
  id uuid, creado_en timestamptz, actor_id uuid, actor_email text,
  accion text, entidad text, entidad_id text, detalle jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform core.fn_exigir_permiso(p_company_id, 'nexo.administracion.auditoria.ver');
  return query
  select al.id, al.created_at, al.user_id, u.email::text, al.action, al.entity, al.entity_id, al.metadata
  from core.audit_log al
  left join auth.users u on u.id = al.user_id
  where al.company_id = p_company_id
    and al.action like 'admin.%'
    and (p_antes is null or al.created_at < p_antes)
  order by al.created_at desc
  limit least(greatest(coalesce(p_limite, 100), 1), 500);
end;
$$;

-- Perfil propio (cualquier usuario autenticado): para el aviso de
-- "cambiá tu contraseña" en el primer ingreso.
create or replace function public.mi_perfil()
returns table (nombre_completo text, debe_cambiar_password boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.nombre_completo, p.debe_cambiar_password
  from core.perfiles p
  where p.user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC de escritura
-- -----------------------------------------------------------------------------
create or replace function public.admin_guardar_rol(
  p_company_id uuid, p_rol_id uuid, p_nombre text, p_descripcion text, p_permisos text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_descripcion text := nullif(btrim(coalesce(p_descripcion, '')), '');
  v_permisos text[];
  v_invalidos text[];
  v_antes text[] := '{}';
  v_id uuid;
begin
  v_uid := core.fn_exigir_permiso(
    p_company_id,
    case when p_rol_id is null then 'nexo.administracion.roles.crear'
         else 'nexo.administracion.roles.editar' end
  );

  if length(v_nombre) < 2 or length(v_nombre) > 80 then
    raise exception 'El nombre del rol debe tener entre 2 y 80 caracteres.';
  end if;

  select coalesce(array_agg(distinct c order by c), '{}') into v_permisos
  from unnest(coalesce(p_permisos, '{}')) c
  where c is not null;

  select coalesce(array_agg(c order by c), '{}') into v_invalidos
  from unnest(v_permisos) c
  where not exists (
    select 1
    from core.permissions_catalog pc
    join core.apps a on a.slug = pc.module_slug and a.active
    join core.company_apps ca on ca.app_id = a.id and ca.company_id = p_company_id and ca.enabled
    where pc.code = c
  );
  if cardinality(v_invalidos) > 0 then
    raise exception 'Permisos inválidos o de apps no habilitadas: %', array_to_string(v_invalidos, ', ');
  end if;

  if not core.fn_cubre_permisos(v_uid, p_company_id, v_permisos) then
    raise exception using errcode = '42501', message = 'No podés otorgar permisos que vos no tenés.';
  end if;

  if p_rol_id is not null then
    perform 1 from core.roles r where r.id = p_rol_id and r.company_id = p_company_id for update;
    if not found then
      raise exception 'Rol no encontrado.';
    end if;
    if not core.fn_es_owner(v_uid, p_company_id) and exists (
      select 1 from core.company_memberships m
      where m.user_id = v_uid and m.company_id = p_company_id and m.rol_id = p_rol_id
    ) then
      raise exception using errcode = '42501', message = 'No podés editar el rol que tenés asignado.';
    end if;
    v_antes := core.fn_permisos_rol(p_rol_id);
    if not core.fn_cubre_permisos(v_uid, p_company_id, v_antes) then
      raise exception using errcode = '42501',
        message = 'No podés editar un rol que tiene permisos que vos no tenés.';
    end if;
    update core.roles
      set nombre = v_nombre, descripcion = v_descripcion, updated_at = now()
      where id = p_rol_id;
    v_id := p_rol_id;
  else
    insert into core.roles (company_id, nombre, descripcion, created_by)
    values (p_company_id, v_nombre, v_descripcion, v_uid)
    returning id into v_id;
  end if;

  delete from core.rol_permisos rp
  where rp.rol_id = v_id and rp.permission_code <> all (v_permisos);
  insert into core.rol_permisos (rol_id, permission_code)
  select v_id, c from unnest(v_permisos) c
  on conflict do nothing;

  perform core.fn_auditar(
    v_uid, p_company_id,
    case when p_rol_id is null then 'admin.rol.crear' else 'admin.rol.editar' end,
    'core.roles', v_id::text,
    jsonb_build_object(
      'nombre', v_nombre,
      'agregados', to_jsonb(array(select unnest(v_permisos) except select unnest(v_antes))),
      'quitados', to_jsonb(array(select unnest(v_antes) except select unnest(v_permisos)))
    )
  );
  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe un rol con ese nombre.';
end;
$$;

create or replace function public.admin_eliminar_rol(p_company_id uuid, p_rol_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_nombre text;
  v_permisos text[];
  v_usuarios integer;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'nexo.administracion.roles.eliminar');

  select r.nombre into v_nombre from core.roles r
  where r.id = p_rol_id and r.company_id = p_company_id
  for update;
  if not found then
    raise exception 'Rol no encontrado.';
  end if;

  select count(*) into v_usuarios from core.company_memberships m where m.rol_id = p_rol_id;
  if v_usuarios > 0 then
    raise exception 'No se puede eliminar: % usuario(s) tienen este rol.', v_usuarios;
  end if;

  v_permisos := core.fn_permisos_rol(p_rol_id);
  if not core.fn_cubre_permisos(v_uid, p_company_id, v_permisos) then
    raise exception using errcode = '42501',
      message = 'No podés eliminar un rol que tiene permisos que vos no tenés.';
  end if;

  delete from core.roles where id = p_rol_id;

  perform core.fn_auditar(v_uid, p_company_id, 'admin.rol.eliminar', 'core.roles', p_rol_id::text,
    jsonb_build_object('nombre', v_nombre, 'permisos', to_jsonb(v_permisos)));
end;
$$;

-- Paso 2 del alta: la Server Action ya creó la cuenta en Supabase Auth
-- (auth.admin.createUser con service role) y llama a esta RPC con la sesión
-- del administrador. Si esto falla, la Server Action borra la cuenta recién creada.
create or replace function public.admin_completar_alta(
  p_company_id uuid, p_user_id uuid,
  p_nombre_completo text, p_telefono text, p_cargo text,
  p_rol_id uuid, p_empleado_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_nombre text := btrim(coalesce(p_nombre_completo, ''));
  v_vinculo jsonb;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'nexo.administracion.usuarios.crear');

  -- Solo cuentas recién creadas: impide "adoptar" una cuenta existente ajena.
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.created_at > now() - interval '15 minutes'
  ) then
    raise exception 'La cuenta no existe o no es un alta reciente.';
  end if;
  if exists (
    select 1 from core.company_memberships m
    where m.user_id = p_user_id and m.company_id = p_company_id
  ) then
    raise exception 'El usuario ya pertenece a esta empresa.';
  end if;
  if length(v_nombre) < 2 or length(v_nombre) > 120 then
    raise exception 'El nombre completo debe tener entre 2 y 120 caracteres.';
  end if;

  perform core.fn_validar_rol_asignable(v_uid, p_company_id, p_rol_id);

  insert into core.perfiles (user_id, nombre_completo, telefono, cargo, debe_cambiar_password)
  values (p_user_id, v_nombre, nullif(btrim(coalesce(p_telefono, '')), ''),
          nullif(btrim(coalesce(p_cargo, '')), ''), true)
  on conflict (user_id) do update
    set nombre_completo = excluded.nombre_completo,
        telefono = excluded.telefono,
        cargo = excluded.cargo,
        debe_cambiar_password = true,
        updated_at = now();

  insert into core.company_memberships (user_id, company_id, role, rol_id, activo)
  values (p_user_id, p_company_id, 'member', p_rol_id, true);

  v_vinculo := core.fn_vincular_empleado(p_company_id, p_user_id, p_empleado_id);

  perform core.fn_auditar(v_uid, p_company_id, 'admin.usuario.crear', 'auth.users', p_user_id::text,
    jsonb_build_object('nombre', v_nombre, 'rol_id', p_rol_id) || v_vinculo);
end;
$$;

create or replace function public.admin_editar_usuario(
  p_company_id uuid, p_user_id uuid,
  p_nombre_completo text, p_telefono text, p_cargo text,
  p_rol_id uuid, p_empleado_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_m core.company_memberships;
  v_nombre text := btrim(coalesce(p_nombre_completo, ''));
  v_vinculo jsonb;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'nexo.administracion.usuarios.editar');
  v_m := core.fn_membresia_administrable(v_uid, p_company_id, p_user_id);

  if length(v_nombre) < 2 or length(v_nombre) > 120 then
    raise exception 'El nombre completo debe tener entre 2 y 120 caracteres.';
  end if;

  if p_rol_id is distinct from v_m.rol_id then
    if p_user_id = v_uid then
      raise exception using errcode = '42501', message = 'No podés cambiar tu propio rol.';
    end if;
    if v_m.role = 'owner' then
      raise exception 'El owner no lleva rol: tiene acceso total.';
    end if;
    perform core.fn_validar_rol_asignable(v_uid, p_company_id, p_rol_id);
    update core.company_memberships
      set rol_id = p_rol_id, updated_at = now()
      where user_id = p_user_id and company_id = p_company_id;
  end if;

  insert into core.perfiles (user_id, nombre_completo, telefono, cargo)
  values (p_user_id, v_nombre, nullif(btrim(coalesce(p_telefono, '')), ''),
          nullif(btrim(coalesce(p_cargo, '')), ''))
  on conflict (user_id) do update
    set nombre_completo = excluded.nombre_completo,
        telefono = excluded.telefono,
        cargo = excluded.cargo,
        updated_at = now();

  v_vinculo := core.fn_vincular_empleado(p_company_id, p_user_id, p_empleado_id);

  perform core.fn_auditar(v_uid, p_company_id, 'admin.usuario.editar', 'auth.users', p_user_id::text,
    jsonb_build_object('nombre', v_nombre, 'rol_antes', v_m.rol_id, 'rol_despues', coalesce(p_rol_id, v_m.rol_id))
    || v_vinculo);
end;
$$;

-- La Server Action además bloquea/desbloquea el inicio de sesión en Supabase
-- Auth (ban_duration) con service role, después de que esta RPC confirme.
create or replace function public.admin_cambiar_estado_usuario(
  p_company_id uuid, p_user_id uuid, p_activo boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_m core.company_memberships;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'nexo.administracion.usuarios.desactivar');
  if p_activo is null then
    raise exception 'Estado inválido.';
  end if;
  if p_user_id = v_uid then
    raise exception using errcode = '42501', message = 'No podés cambiar tu propio estado.';
  end if;
  v_m := core.fn_membresia_administrable(v_uid, p_company_id, p_user_id);
  if v_m.role = 'owner' then
    raise exception using errcode = '42501', message = 'El owner no se puede desactivar.';
  end if;

  update core.company_memberships
    set activo = p_activo, updated_at = now()
    where user_id = p_user_id and company_id = p_company_id;

  perform core.fn_auditar(v_uid, p_company_id,
    case when p_activo then 'admin.usuario.reactivar' else 'admin.usuario.desactivar' end,
    'auth.users', p_user_id::text, jsonb_build_object('activo', p_activo));
end;
$$;

-- La Server Action cambia la contraseña en Supabase Auth (service role) y
-- registra aquí que es temporal.
create or replace function public.admin_marcar_password_temporal(p_company_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'nexo.administracion.usuarios.editar');
  if p_user_id = v_uid then
    raise exception using errcode = '42501',
      message = 'Tu propia contraseña se cambia desde tu perfil, no desde administración.';
  end if;
  perform core.fn_membresia_administrable(v_uid, p_company_id, p_user_id);

  update core.perfiles
    set debe_cambiar_password = true, updated_at = now()
    where user_id = p_user_id;
  if not found then
    raise exception 'El usuario no tiene perfil; editá sus datos primero.';
  end if;

  perform core.fn_auditar(v_uid, p_company_id, 'admin.usuario.password_restablecida',
    'auth.users', p_user_id::text, '{}'::jsonb);
end;
$$;

-- El usuario confirma que ya cambió su contraseña (después de
-- supabase.auth.updateUser en el cliente).
create or replace function public.confirmar_cambio_password()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sesión requerida.';
  end if;
  update core.perfiles
    set debe_cambiar_password = false, updated_at = now()
    where user_id = auth.uid();
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Grants: helpers internos cerrados; RPC solo para authenticated.
-- -----------------------------------------------------------------------------
revoke all on function
  core.fn_es_owner(uuid, uuid),
  core.fn_permisos_rol(uuid),
  core.fn_cubre_permisos(uuid, uuid, text[]),
  core.fn_exigir_permiso(uuid, text),
  core.fn_auditar(uuid, uuid, text, text, text, jsonb),
  core.fn_membresia_administrable(uuid, uuid, uuid),
  core.fn_validar_rol_asignable(uuid, uuid, uuid),
  core.fn_vincular_empleado(uuid, uuid, uuid)
from public, anon, authenticated;

revoke all on function
  public.admin_listar_usuarios(uuid),
  public.admin_listar_roles(uuid),
  public.admin_catalogo_permisos(uuid),
  public.admin_plantillas_rol(uuid),
  public.admin_buscar_empleados(uuid, text),
  public.admin_listar_auditoria(uuid, integer, timestamptz),
  public.mi_perfil(),
  public.admin_guardar_rol(uuid, uuid, text, text, text[]),
  public.admin_eliminar_rol(uuid, uuid),
  public.admin_completar_alta(uuid, uuid, text, text, text, uuid, uuid),
  public.admin_editar_usuario(uuid, uuid, text, text, text, uuid, uuid),
  public.admin_cambiar_estado_usuario(uuid, uuid, boolean),
  public.admin_marcar_password_temporal(uuid, uuid),
  public.confirmar_cambio_password()
from public, anon;

grant execute on function
  public.admin_listar_usuarios(uuid),
  public.admin_listar_roles(uuid),
  public.admin_catalogo_permisos(uuid),
  public.admin_plantillas_rol(uuid),
  public.admin_buscar_empleados(uuid, text),
  public.admin_listar_auditoria(uuid, integer, timestamptz),
  public.mi_perfil(),
  public.admin_guardar_rol(uuid, uuid, text, text, text[]),
  public.admin_eliminar_rol(uuid, uuid),
  public.admin_completar_alta(uuid, uuid, text, text, text, uuid, uuid),
  public.admin_editar_usuario(uuid, uuid, text, text, text, uuid, uuid),
  public.admin_cambiar_estado_usuario(uuid, uuid, boolean),
  public.admin_marcar_password_temporal(uuid, uuid),
  public.confirmar_cambio_password()
to authenticated;
