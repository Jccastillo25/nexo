-- =============================================================================
-- Fase 3 del bloque "pre-F1.5" (docs/status-log/2026-09-16-rrhh-pre-f1-5.md):
-- catalogos de Contratacion -- departamentos organizacionales, puestos,
-- plantillas de contrato -- y la migracion de rrhh.contratos desde
-- puesto/departamento de texto libre hacia estos catalogos. Paso Cero ya
-- aplicado en 20260916140000_rrhh_catalogos_contratacion_permisos.sql.
--
-- IMPORTANTE -- no confundir "departamento organizacional" (esta
-- migracion: Ventas, Operaciones, Bodega -- unidad de la empresa) con
-- "departamento geografico de Nicaragua" (Fase 5, catalogo aparte en
-- core.geografia_ni_departamentos para la direccion del empleado). Mismo
-- nombre en espanol, dos conceptos y dos tablas completamente distintos.
--
-- Todas catalogo/expediente acotado, ninguna particionada (regla de
-- CLAUDE.md: solo hechos de crecimiento ilimitado se particionan). Sin
-- DELETE fisico expuesto -- se activa/desactiva (activo boolean), mismo
-- criterio que rrhh.empleados/rrhh.contratos. Reutiliza
-- rrhh.fn_touch_updated_at() (ya existe desde 20260907163244).
--
-- Verificacion remota previa (nexo-core, 2026-09-16): 0 filas en
-- rrhh.contratos -- el backfill de la seccion 5 es no-op hoy en
-- produccion, pero se escribe generico (no se asume que seguira en 0).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. rrhh.departamentos -- catalogo organizacional, no particionado.
-- -----------------------------------------------------------------------------
create table rrhh.departamentos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) default rrhh.default_company_id(),
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table rrhh.departamentos is
  'Fase 3 (2026-09-16): departamento ORGANIZACIONAL de la empresa (ej. Ventas, Operaciones) -- no confundir con departamento geografico de Nicaragua (core.geografia_ni_departamentos, Fase 5). Referenciado por rrhh.puestos.';

create index departamentos_company_id_idx on rrhh.departamentos (company_id);

-- Unicidad case-insensitive por empresa -- una expresion (lower(nombre))
-- no puede ir en un table constraint UNIQUE, solo en un indice.
create unique index departamentos_company_nombre_unq on rrhh.departamentos (company_id, lower(nombre));

alter table rrhh.departamentos enable row level security;

create policy "departamentos: ver con permiso" on rrhh.departamentos for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.departamentos.ver'));

create policy "departamentos: crear con permiso" on rrhh.departamentos for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.departamentos.crear'));

create policy "departamentos: editar con permiso" on rrhh.departamentos for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.departamentos.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.departamentos.editar'));

grant select, insert, update on rrhh.departamentos to authenticated;

create trigger trg_departamentos_updated_at
  before update on rrhh.departamentos
  for each row execute function rrhh.fn_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 2. rrhh.puestos -- catalogo, no particionado. 1 puesto : 1 departamento
-- organizacional (departamento_id nullable -- un puesto puede existir sin
-- departamento asignado todavia).
-- -----------------------------------------------------------------------------
create table rrhh.puestos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) default rrhh.default_company_id(),
  departamento_id uuid references rrhh.departamentos(id),
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table rrhh.puestos is
  'Fase 3 (2026-09-16): catalogo de puestos de trabajo. departamento_id es el departamento ORGANIZACIONAL (rrhh.departamentos), nullable. Reemplaza el texto libre rrhh.contratos.puesto -- ver seccion 5 de esta migracion para el backfill.';

create index puestos_company_id_idx on rrhh.puestos (company_id);
create index puestos_departamento_id_idx on rrhh.puestos (departamento_id);
create unique index puestos_company_nombre_unq on rrhh.puestos (company_id, lower(nombre));

alter table rrhh.puestos enable row level security;

create policy "puestos: ver con permiso" on rrhh.puestos for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.puestos.ver'));

create policy "puestos: crear con permiso" on rrhh.puestos for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.puestos.crear'));

create policy "puestos: editar con permiso" on rrhh.puestos for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.puestos.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.puestos.editar'));

grant select, insert, update on rrhh.puestos to authenticated;

create trigger trg_puestos_updated_at
  before update on rrhh.puestos
  for each row execute function rrhh.fn_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3. rrhh.plantillas_contrato -- catalogo. storage_path se completa en
-- Fase 4 (bucket privado) -- nullable hasta entonces para no acoplar la
-- Fase 3 (solo catalogo) a la Fase 4 (Storage).
-- -----------------------------------------------------------------------------
create table rrhh.plantillas_contrato (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) default rrhh.default_company_id(),
  nombre text not null,
  descripcion text,
  storage_path text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table rrhh.plantillas_contrato is
  'Fase 3 (2026-09-16): catalogo de plantillas de contrato por puesto. storage_path (bucket privado rrhh-documentos-privados) se completa en Fase 4 -- una plantilla sin archivo todavia es valida (catalogo creado antes de subir el documento).';

create index plantillas_contrato_company_id_idx on rrhh.plantillas_contrato (company_id);
create unique index plantillas_contrato_company_nombre_unq on rrhh.plantillas_contrato (company_id, lower(nombre));

alter table rrhh.plantillas_contrato enable row level security;

create policy "plantillas_contrato: ver con permiso" on rrhh.plantillas_contrato for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.plantillas.ver'));

create policy "plantillas_contrato: crear con permiso" on rrhh.plantillas_contrato for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.plantillas.crear'));

create policy "plantillas_contrato: editar con permiso" on rrhh.plantillas_contrato for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.plantillas.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.plantillas.editar'));

grant select, insert, update on rrhh.plantillas_contrato to authenticated;

create trigger trg_plantillas_contrato_updated_at
  before update on rrhh.plantillas_contrato
  for each row execute function rrhh.fn_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 4. rrhh.puesto_plantillas -- relacion puesto<->plantilla, con a lo sumo
-- una predeterminada activa por puesto (unique index parcial). Gateada
-- por los mismos permisos que plantillas (es parte de administrar el
-- catalogo de plantillas, no un recurso propio).
-- -----------------------------------------------------------------------------
create table rrhh.puesto_plantillas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) default rrhh.default_company_id(),
  puesto_id uuid not null references rrhh.puestos(id) on delete cascade,
  plantilla_id uuid not null references rrhh.plantillas_contrato(id) on delete cascade,
  predeterminada boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (puesto_id, plantilla_id)
);

comment on table rrhh.puesto_plantillas is
  'Fase 3 (2026-09-16): que plantilla(s) de contrato aplican a que puesto. A lo sumo una predeterminada activa por puesto (puesto_plantillas_predeterminada_unq) -- se sugiere (no se fuerza) al crear un contrato para ese puesto.';

create index puesto_plantillas_company_id_idx on rrhh.puesto_plantillas (company_id);
create index puesto_plantillas_puesto_id_idx on rrhh.puesto_plantillas (puesto_id);

create unique index puesto_plantillas_predeterminada_unq
  on rrhh.puesto_plantillas (puesto_id)
  where predeterminada and activo;

alter table rrhh.puesto_plantillas enable row level security;

create policy "puesto_plantillas: ver con permiso" on rrhh.puesto_plantillas for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.plantillas.ver'));

create policy "puesto_plantillas: crear con permiso" on rrhh.puesto_plantillas for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.plantillas.editar'));

create policy "puesto_plantillas: editar con permiso" on rrhh.puesto_plantillas for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.plantillas.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.plantillas.editar'));

create policy "puesto_plantillas: eliminar con permiso" on rrhh.puesto_plantillas for delete
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.plantillas.editar'));

grant select, insert, update, delete on rrhh.puesto_plantillas to authenticated;

-- -----------------------------------------------------------------------------
-- 5. rrhh.contratos: agrega puesto_id/departamento_id (nullable), hace
-- backfill de texto libre existente hacia los catalogos nuevos, y deja
-- puesto/departamento (texto) comentadas como deprecadas -- NO se
-- eliminan en esta migracion (mismo criterio que las columnas laborales
-- deprecadas de rrhh.empleados en F1.1, pendiente de limpieza posterior).
-- -----------------------------------------------------------------------------
alter table rrhh.contratos
  add column puesto_id uuid references rrhh.puestos(id),
  add column departamento_id uuid references rrhh.departamentos(id);

-- Backfill: crea en el catalogo cualquier valor de texto libre que ya
-- exista en produccion/staging (no-op hoy: 0 filas en rrhh.contratos en
-- nexo-core al 2026-09-16) y despues enlaza cada contrato por nombre
-- (case-insensitive). No sobreescribe nada -- si un contrato ya tenia
-- puesto/departamento en null, sigue en null.
insert into rrhh.departamentos (company_id, nombre)
select distinct c.company_id, trim(c.departamento)
from rrhh.contratos c
where c.departamento is not null and trim(c.departamento) <> ''
on conflict (company_id, lower(nombre)) do nothing;

insert into rrhh.puestos (company_id, nombre)
select distinct c.company_id, trim(c.puesto)
from rrhh.contratos c
where c.puesto is not null and trim(c.puesto) <> ''
on conflict (company_id, lower(nombre)) do nothing;

update rrhh.contratos c
set departamento_id = d.id
from rrhh.departamentos d
where d.company_id = c.company_id
  and c.departamento is not null
  and lower(d.nombre) = lower(trim(c.departamento));

update rrhh.contratos c
set puesto_id = p.id
from rrhh.puestos p
where p.company_id = c.company_id
  and c.puesto is not null
  and lower(p.nombre) = lower(trim(c.puesto));

comment on column rrhh.contratos.puesto is
  '@deprecated Fase 3 (2026-09-16) -- usar puesto_id (rrhh.puestos). Se conserva sin eliminar (columna real con datos historicos, pendiente de una migracion de limpieza posterior), pero rrhh.fn_crear_contrato/fn_editar_contrato ya no la escriben.';

comment on column rrhh.contratos.departamento is
  '@deprecated Fase 3 (2026-09-16) -- usar departamento_id (rrhh.departamentos, organizacional -- no geografico). Se conserva sin eliminar, pendiente de limpieza posterior.';

-- -----------------------------------------------------------------------------
-- 6. rrhh.fn_crear_contrato / rrhh.fn_editar_contrato: pasan a recibir
-- puesto_id/departamento_id en vez de texto libre. Se sugiere (nunca se
-- fuerza) la plantilla predeterminada del puesto -- fn_crear_contrato la
-- devuelve como dato informativo, no la asigna a nada todavia (asignar un
-- documento de plantilla a un contrato concreto es un flujo de Fase 4/5,
-- fuera de alcance de esta migracion).
-- -----------------------------------------------------------------------------
-- create or replace no alcanza aca: cambia el tipo de dos parametros
-- (text -> uuid), y Postgres identifica una funcion por nombre+tipos de
-- argumento -- sin el drop explicito quedarian DOS funciones
-- sobrecargadas (la vieja basada en texto libre y esta), no un reemplazo.
drop function if exists rrhh.fn_crear_contrato(uuid, uuid, text, text, text, date, date, numeric);

create function rrhh.fn_crear_contrato(
  p_company_id uuid,
  p_empleado_id uuid,
  p_puesto_id uuid default null,
  p_departamento_id uuid default null,
  p_modalidad_contrato text default null,
  p_fecha_inicio date default null,
  p_fecha_fin_prevista date default null,
  p_salario_base numeric default null
)
returns table (contrato_id uuid, numero_contrato bigint, plantilla_sugerida_id uuid)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_contrato_id uuid;
  v_numero_contrato bigint;
  v_plantilla_sugerida uuid;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.crear') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.crear';
  end if;

  if not exists (select 1 from rrhh.empleados where id = p_empleado_id and company_id = p_company_id) then
    raise exception 'Empleado no encontrado en esta empresa';
  end if;

  if p_puesto_id is not null and not exists (
    select 1 from rrhh.puestos where id = p_puesto_id and company_id = p_company_id
  ) then
    raise exception 'Puesto no encontrado en esta empresa';
  end if;

  if p_departamento_id is not null and not exists (
    select 1 from rrhh.departamentos where id = p_departamento_id and company_id = p_company_id
  ) then
    raise exception 'Departamento no encontrado en esta empresa';
  end if;

  insert into rrhh.contratos as c (
    company_id, empleado_id, puesto_id, departamento_id, modalidad_contrato,
    fecha_inicio, fecha_fin_prevista, created_by
  )
  values (
    p_company_id, p_empleado_id, p_puesto_id, p_departamento_id, p_modalidad_contrato,
    p_fecha_inicio, p_fecha_fin_prevista, auth.uid()
  )
  returning c.id, c.numero_contrato into v_contrato_id, v_numero_contrato;

  -- Mismo criterio que la version anterior (texto libre): sin salario
  -- provisto (o en 0), no se crea fila de compensacion todavia -- y
  -- fijar un salario real exige el permiso separado de dato sensible
  -- rrhh.expedientes.compensacion.editar, aunque quien crea el contrato
  -- ya tenga contratos.crear.
  if coalesce(p_salario_base, 0) <> 0 then
    if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.compensacion.editar') then
      raise exception 'Permiso denegado: rrhh.expedientes.compensacion.editar (requerido para fijar salario)';
    end if;

    insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base, updated_by)
    values (v_contrato_id, p_company_id, p_salario_base, auth.uid());
  end if;

  if p_puesto_id is not null then
    select pp.plantilla_id into v_plantilla_sugerida
    from rrhh.puesto_plantillas pp
    where pp.puesto_id = p_puesto_id and pp.predeterminada and pp.activo
    limit 1;
  end if;

  return query select v_contrato_id, v_numero_contrato, v_plantilla_sugerida;
end;
$$;

comment on function rrhh.fn_crear_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric) is
  'Fase 3 (2026-09-16): crea un contrato en borrador -- puesto_id/departamento_id reemplazan el texto libre anterior. Devuelve plantilla_sugerida_id (la predeterminada activa del puesto, si existe) como dato informativo -- no asigna ningun documento todavia.';

drop function if exists public.crear_contrato(uuid, uuid, text, text, text, date, date, numeric);

create function public.crear_contrato(
  p_company_id uuid,
  p_empleado_id uuid,
  p_puesto_id uuid default null,
  p_departamento_id uuid default null,
  p_modalidad_contrato text default null,
  p_fecha_inicio date default null,
  p_fecha_fin_prevista date default null,
  p_salario_base numeric default null
)
returns table (contrato_id uuid, numero_contrato bigint, plantilla_sugerida_id uuid)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_crear_contrato(
    p_company_id, p_empleado_id, p_puesto_id, p_departamento_id, p_modalidad_contrato,
    p_fecha_inicio, p_fecha_fin_prevista, p_salario_base
  );
$$;

revoke execute on function rrhh.fn_crear_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric) from PUBLIC, anon, authenticated;
revoke execute on function public.crear_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric) from PUBLIC, anon;
grant execute on function public.crear_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric) to authenticated;

drop function if exists rrhh.fn_editar_contrato(uuid, uuid, text, text, text, date, date, numeric);

create function rrhh.fn_editar_contrato(
  p_contrato_id uuid,
  p_company_id uuid,
  p_puesto_id uuid default null,
  p_departamento_id uuid default null,
  p_modalidad_contrato text default null,
  p_fecha_inicio date default null,
  p_fecha_fin_prevista date default null,
  p_salario_base numeric default null
)
returns void
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_estado text;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.editar') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.editar';
  end if;

  select estado into v_estado from rrhh.contratos where id = p_contrato_id and company_id = p_company_id;
  if v_estado is null then
    raise exception 'Contrato no encontrado en esta empresa';
  elsif v_estado <> 'borrador' then
    raise exception 'Solo se puede editar un contrato en estado borrador';
  end if;

  if p_puesto_id is not null and not exists (
    select 1 from rrhh.puestos where id = p_puesto_id and company_id = p_company_id
  ) then
    raise exception 'Puesto no encontrado en esta empresa';
  end if;

  if p_departamento_id is not null and not exists (
    select 1 from rrhh.departamentos where id = p_departamento_id and company_id = p_company_id
  ) then
    raise exception 'Departamento no encontrado en esta empresa';
  end if;

  -- Mismo criterio que la version de texto libre: parametro omitido
  -- (null) conserva el valor actual, no lo borra -- editar_contrato
  -- permite mandar solo los campos que cambian.
  update rrhh.contratos set
    puesto_id = coalesce(p_puesto_id, puesto_id),
    departamento_id = coalesce(p_departamento_id, departamento_id),
    modalidad_contrato = coalesce(p_modalidad_contrato, modalidad_contrato),
    fecha_inicio = coalesce(p_fecha_inicio, fecha_inicio),
    fecha_fin_prevista = coalesce(p_fecha_fin_prevista, fecha_fin_prevista),
    updated_at = now()
  where id = p_contrato_id and company_id = p_company_id;

  if p_salario_base is not null then
    if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.compensacion.editar') then
      raise exception 'Permiso denegado: rrhh.expedientes.compensacion.editar';
    end if;

    insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base, updated_by)
    values (p_contrato_id, p_company_id, p_salario_base, auth.uid())
    on conflict (contrato_id) do update set
      salario_base = excluded.salario_base,
      updated_by = excluded.updated_by,
      updated_at = now();
  end if;
end;
$$;

comment on function rrhh.fn_editar_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric) is
  'Fase 3 (2026-09-16): edita un contrato en borrador -- puesto_id/departamento_id reemplazan el texto libre anterior.';

drop function if exists public.editar_contrato(uuid, uuid, text, text, text, date, date, numeric);

create function public.editar_contrato(
  p_contrato_id uuid,
  p_company_id uuid,
  p_puesto_id uuid default null,
  p_departamento_id uuid default null,
  p_modalidad_contrato text default null,
  p_fecha_inicio date default null,
  p_fecha_fin_prevista date default null,
  p_salario_base numeric default null
)
returns void
language sql
security definer
set search_path = rrhh, public
as $$
  select rrhh.fn_editar_contrato(
    p_contrato_id, p_company_id, p_puesto_id, p_departamento_id, p_modalidad_contrato,
    p_fecha_inicio, p_fecha_fin_prevista, p_salario_base
  );
$$;

revoke execute on function rrhh.fn_editar_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric) from PUBLIC, anon, authenticated;
revoke execute on function public.editar_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric) from PUBLIC, anon;
grant execute on function public.editar_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric) to authenticated;
