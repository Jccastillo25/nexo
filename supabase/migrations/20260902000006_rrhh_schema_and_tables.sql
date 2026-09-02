-- =============================================================================
-- Nexo — schema `rrhh`: Expedientes, Asistencia (kiosko), Planillas.
-- Ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §2 (particionamiento),
-- §3.3 (plantilla RLS) y §6 (playbook, Paso Cero). Depende de
-- 20260902000005_rrhh_permissions_and_roles.sql (ya aplicada) para los
-- codigos de permiso que las policies de abajo referencian.
--
-- Probado completo en una transaccion begin/rollback contra nexo-core
-- antes de escribir este archivo (2026-09-02) — sin errores.
-- =============================================================================

create extension if not exists pgcrypto;

create schema if not exists rrhh;

create or replace function rrhh.default_company_id()
returns uuid
language sql
stable
as $$
  select id from core.companies where slug = 'materiales-jcastillo';
$$;

-- -----------------------------------------------------------------------------
-- Expedientes: rrhh.empleados (datos base + PIN de marcacion, nunca en
-- texto plano) y rrhh.empleado_compensacion (salario, tabla SEPARADA a
-- proposito). No es un capricho de normalizacion: compensacion.ver/editar
-- es un codigo de permiso distinto de empleados.ver en la matriz aprobada
-- (docs/planning/ARQUITECTURA_MVP_ESCALABLE.md) — si el salario viviera
-- en la misma fila que el resto del legajo, cualquiera con
-- empleados.ver lo veria tambien, porque RLS filtra filas, no columnas.
-- Separar la tabla es lo que hace que ese permiso separado sea real.
-- -----------------------------------------------------------------------------
create table rrhh.empleados (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) default rrhh.default_company_id(),
  codigo_empleado bigint generated always as identity,
  nombre text not null,
  apellido text not null,
  documento_identidad text,
  email text,
  telefono text,
  puesto text,
  departamento text,
  fecha_ingreso date not null default current_date,
  fecha_baja date,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo', 'baja')),
  pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (codigo_empleado),
  unique (company_id, documento_identidad)
);

comment on table rrhh.empleados is
  'Legajo base de cada empleado. NO incluye salario (ver rrhh.empleado_compensacion, tabla separada a proposito).';
comment on column rrhh.empleados.pin_hash is
  'Hash bcrypt (pgcrypto crypt()/gen_salt(bf)) del PIN de marcacion. Nunca en texto plano. Se asigna via rrhh.fn_set_pin_empleado — jamas con un UPDATE directo desde la app.';

create index on rrhh.empleados (company_id);
create index on rrhh.empleados (company_id) where estado = 'activo';

create table rrhh.empleado_compensacion (
  empleado_id uuid primary key references rrhh.empleados(id) on delete cascade,
  company_id uuid not null references core.companies(id),
  salario_base numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table rrhh.empleado_compensacion is
  'Salario, 1:1 con empleados, en tabla separada para que compensacion.ver/editar sea un permiso realmente distinto de empleados.ver a nivel de RLS.';

create index on rrhh.empleado_compensacion (company_id);

-- -----------------------------------------------------------------------------
-- Asistencia: rrhh.kiosko_dispositivos (terminales fisicas de marcaje) y
-- rrhh.asistencia_marcas (particionada por mes — es la tabla de hechos:
-- un renglon por marca, para siempre, ver §2.1 de la arquitectura).
-- -----------------------------------------------------------------------------
create table rrhh.kiosko_dispositivos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) default rrhh.default_company_id(),
  nombre text not null,
  ubicacion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table rrhh.kiosko_dispositivos is
  'Terminales fisicas de marcaje. El id (uuid aleatorio) actua como credencial del dispositivo frente a rrhh.fn_registrar_marca_kiosko — ver la nota de seguridad junto a esa funcion.';

create index on rrhh.kiosko_dispositivos (company_id);
create index on rrhh.kiosko_dispositivos (company_id) where activo;

create table rrhh.asistencia_marcas (
  id uuid not null default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  empleado_id uuid not null references rrhh.empleados(id),
  kiosko_id uuid references rrhh.kiosko_dispositivos(id),
  tipo text not null check (tipo in ('entrada', 'salida')),
  origen text not null default 'kiosko' check (origen in ('kiosko', 'manual')),
  creado_por uuid references auth.users(id),
  marcado_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (id, marcado_en)
) partition by range (marcado_en);

comment on table rrhh.asistencia_marcas is
  'Marcas de entrada/salida. Particionada por mes desde su creacion (2026-09-02) — tabla de hechos por definicion. origen=kiosko: insertada por rrhh.fn_registrar_marca_kiosko (creado_por queda null, no hay auth.uid()). origen=manual: correccion de un supervisor autenticado (creado_por = su uid).';

-- -----------------------------------------------------------------------------
-- core.fn_asegurar_particiones_futuras (ya existente, ver
-- 20260902000002) es agnostica de schema: basta con registrar esta tabla
-- en core.tablas_particionadas y darle su propia funcion de particion —
-- el cron mensual ya existente la mantiene sola, sin tocar el mecanismo
-- generico. RLS habilitado en la particion desde su creacion (fix
-- aprendido en 20260902000003 — no se repite ese error aca).
-- -----------------------------------------------------------------------------
create or replace function rrhh.fn_asegurar_particion_asistencia_marcas(p_mes date)
returns void
language plpgsql
set search_path = rrhh, pg_temp
as $$
declare
  particion text := 'asistencia_marcas_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'rrhh' and c.relname = particion
  ) then
    execute format(
      'create table rrhh.%I partition of rrhh.asistencia_marcas for values from (%L) to (%L)',
      particion, inicio, fin
    );
    execute format('create index on rrhh.%I (company_id, marcado_en)', particion);
    execute format('create index on rrhh.%I (empleado_id, marcado_en)', particion);
    execute format('alter table rrhh.%I enable row level security', particion);
  end if;
end;
$$;

comment on function rrhh.fn_asegurar_particion_asistencia_marcas is
  'Crea la particion mensual de rrhh.asistencia_marcas para el mes de p_mes si no existe, con RLS habilitado desde su creacion. Llamada por core.fn_asegurar_particiones_futuras via el registro de abajo.';

insert into core.tablas_particionadas (schema_nombre, tabla_nombre, fn_asegurar_particion)
values ('rrhh', 'asistencia_marcas', 'rrhh.fn_asegurar_particion_asistencia_marcas')
on conflict do nothing;

-- Particiones iniciales: mes actual + 2 meses adelante (mismo criterio
-- que audit_log). Tambien re-asegura las de audit_log si hiciera falta —
-- es idempotente, sin efecto sobre lo que ya existe.
select core.fn_asegurar_particiones_futuras(2);

-- -----------------------------------------------------------------------------
-- Planillas: rrhh.planillas (la corrida de nomina) y rrhh.planilla_detalles
-- (movimientos por empleado: salario, horas extra, bonos, deducciones).
-- NO particionadas — crecen una fila por corrida de nomina (mensual/
-- quincenal) y por empleado por corrida, volumen acotado, no son una
-- tabla de hechos de crecimiento libre (ver criterio de §2.1).
-- -----------------------------------------------------------------------------
create table rrhh.planillas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) default rrhh.default_company_id(),
  periodo_inicio date not null,
  periodo_fin date not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'aprobada', 'anulada')),
  total numeric(14,2) not null default 0,
  generada_por uuid references auth.users(id),
  generada_en timestamptz not null default now(),
  aprobada_por uuid references auth.users(id),
  aprobada_en timestamptz,
  anulada_por uuid references auth.users(id),
  anulada_en timestamptz,
  -- FK a contabilidad.asientos pendiente: ese schema todavia no existe
  -- (Fase 2 del ROADMAP). Queda como uuid suelto hasta esa fase — ver
  -- core.fn_aprobar_planilla en docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §5.1.
  asiento_contable_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (periodo_fin >= periodo_inicio)
);

comment on table rrhh.planillas is
  'Corridas de nomina. Transicion borrador->aprobada la hace core.fn_aprobar_planilla (security definer, pendiente de crear cuando exista contabilidad.asientos) — no un UPDATE directo desde la app.';

create index on rrhh.planillas (company_id, periodo_inicio);
create index on rrhh.planillas (company_id, estado);

create table rrhh.planilla_detalles (
  id uuid primary key default gen_random_uuid(),
  planilla_id uuid not null references rrhh.planillas(id) on delete cascade,
  empleado_id uuid not null references rrhh.empleados(id),
  company_id uuid not null references core.companies(id),
  salario_base numeric(12,2) not null default 0,
  horas_extra numeric(8,2) not null default 0,
  bonos numeric(12,2) not null default 0,
  deducciones numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (planilla_id, empleado_id)
);

comment on table rrhh.planilla_detalles is
  'Un renglon por empleado por planilla (movimientos: salario, horas extra, bonos, deducciones). company_id denormalizado desde planillas para que la policy de RLS no dependa de un join al padre.';

create index on rrhh.planilla_detalles (planilla_id);
create index on rrhh.planilla_detalles (empleado_id);

-- =============================================================================
-- Gap detectado durante el diseno de tablas: la matriz aprobada en
-- 20260902000005 no incluia codigos de permiso para administrar
-- kiosko_dispositivos (CRUD de terminales). Se agrega aqui, en la misma
-- migracion que crea la tabla — ver nota en la respuesta al usuario.
-- =============================================================================
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('rrhh.asistencia.kioskos.ver',      'rrhh', 'asistencia', 'Ver kioskos',      'Ver los dispositivos de marcacion registrados.'),
  ('rrhh.asistencia.kioskos.crear',    'rrhh', 'asistencia', 'Crear kioskos',    'Registrar un dispositivo de marcacion nuevo.'),
  ('rrhh.asistencia.kioskos.editar',   'rrhh', 'asistencia', 'Editar kioskos',   'Modificar o activar/desactivar un dispositivo.'),
  ('rrhh.asistencia.kioskos.eliminar', 'rrhh', 'asistencia', 'Eliminar kioskos', 'Eliminar un dispositivo de marcacion.')
on conflict (code) do nothing;

-- admin ya tenia todo rrhh.* via el join por domain en 20260902000005,
-- pero esos 4 codigos no existian todavia en ese momento — se agregan
-- explicitos aqui para admin y para supervisor_asistencia (sin eliminar:
-- dar de baja un dispositivo fisico es una accion de mayor riesgo,
-- reservada a admin, mismo criterio que planilla.anular vs eliminar).
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.asistencia.kioskos.ver',
  'rrhh.asistencia.kioskos.crear',
  'rrhh.asistencia.kioskos.editar',
  'rrhh.asistencia.kioskos.eliminar'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'admin'
on conflict do nothing;

insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.asistencia.kioskos.ver',
  'rrhh.asistencia.kioskos.crear',
  'rrhh.asistencia.kioskos.editar'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'supervisor_asistencia'
on conflict do nothing;

-- =============================================================================
-- RLS — plantilla de docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §3.3
-- aplicada a las 6 tablas, vinculada a los codigos de la matriz aprobada.
-- =============================================================================

alter table rrhh.empleados enable row level security;

create policy "empleados: ver con permiso" on rrhh.empleados
  for select to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.expedientes.empleados.ver'));
create policy "empleados: crear con permiso" on rrhh.empleados
  for insert to authenticated
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.expedientes.empleados.crear'));
create policy "empleados: editar con permiso" on rrhh.empleados
  for update to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.expedientes.empleados.editar'))
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.expedientes.empleados.editar'));
create policy "empleados: eliminar con permiso" on rrhh.empleados
  for delete to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.expedientes.empleados.eliminar'));

alter table rrhh.empleado_compensacion enable row level security;

create policy "compensacion: ver con permiso" on rrhh.empleado_compensacion
  for select to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.expedientes.compensacion.ver'));
create policy "compensacion: crear con permiso" on rrhh.empleado_compensacion
  for insert to authenticated
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.expedientes.compensacion.editar'));
create policy "compensacion: editar con permiso" on rrhh.empleado_compensacion
  for update to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.expedientes.compensacion.editar'))
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.expedientes.compensacion.editar'));
-- Sin policy de delete: no hay codigo de permiso separado para eliminar
-- compensacion en la matriz aprobada — se elimina solo via
-- "on delete cascade" al eliminar el empleado (rrhh.expedientes.empleados.eliminar).

alter table rrhh.kiosko_dispositivos enable row level security;

create policy "kioskos: ver con permiso" on rrhh.kiosko_dispositivos
  for select to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.asistencia.kioskos.ver'));
create policy "kioskos: crear con permiso" on rrhh.kiosko_dispositivos
  for insert to authenticated
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.asistencia.kioskos.crear'));
create policy "kioskos: editar con permiso" on rrhh.kiosko_dispositivos
  for update to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.asistencia.kioskos.editar'))
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.asistencia.kioskos.editar'));
create policy "kioskos: eliminar con permiso" on rrhh.kiosko_dispositivos
  for delete to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.asistencia.kioskos.eliminar'));

alter table rrhh.asistencia_marcas enable row level security;

create policy "marcas: ver con permiso" on rrhh.asistencia_marcas
  for select to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.asistencia.marcas.ver'));
create policy "marcas: crear con permiso" on rrhh.asistencia_marcas
  for insert to authenticated
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.asistencia.marcas.crear'));
create policy "marcas: editar con permiso" on rrhh.asistencia_marcas
  for update to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.asistencia.marcas.editar'))
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.asistencia.marcas.editar'));
create policy "marcas: eliminar con permiso" on rrhh.asistencia_marcas
  for delete to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.asistencia.marcas.eliminar'));
-- Nota: rrhh.fn_registrar_marca_kiosko inserta como security definer
-- (bypassea esta policy de insert como el dueno de la funcion) — el
-- kiosko en si nunca tiene una sesion authenticated ni pasa por aca.

alter table rrhh.planillas enable row level security;

create policy "planillas: ver con permiso" on rrhh.planillas
  for select to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.planilla.ver'));
create policy "planillas: crear con permiso" on rrhh.planillas
  for insert to authenticated
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.planilla.generar'));
create policy "planillas: editar borrador con permiso" on rrhh.planillas
  for update to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.planilla.generar'))
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.planilla.generar'));
-- Sin policy de delete: una planilla se anula (planilla.anular, via una
-- funcion security definer futura), nunca se borra. Las transiciones a
-- aprobada/anulada tambien van por funciones security definer, no por
-- esta policy de update generica (mismo patron que core.fn_aprobar_planilla).

alter table rrhh.planilla_detalles enable row level security;

create policy "detalles: ver con permiso" on rrhh.planilla_detalles
  for select to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.movimientos.ver'));
create policy "detalles: crear con permiso" on rrhh.planilla_detalles
  for insert to authenticated
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.movimientos.crear'));
create policy "detalles: editar con permiso" on rrhh.planilla_detalles
  for update to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.movimientos.crear'))
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.movimientos.crear'));
create policy "detalles: eliminar con permiso" on rrhh.planilla_detalles
  for delete to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.movimientos.eliminar'));

-- =============================================================================
-- rrhh.fn_registrar_marca_kiosko — security definer, PIN + kiosko como
-- credencial (no user_id/RBAC: el dispositivo no tiene sesion
-- authenticated). Valida kiosko activo, busca el empleado por PIN
-- (bcrypt, pgcrypto) dentro de la empresa del kiosko, alterna
-- entrada/salida segun la ultima marca del empleado.
--
-- NOTA DE SEGURIDAD (para el usuario, no una decision unilateral): esta
-- funcion se expone via public.registrar_marca_kiosko con EXECUTE para
-- 'anon' porque un kiosko fisico no inicia sesion de Supabase Auth — el
-- PIN + kiosko_id ES el mecanismo de autenticacion aqui, distinto del
-- resto de la suite (que siempre pasa por core.has_permission +
-- auth.uid()). Efecto secundario: cualquiera con el kiosko_id (uuid de
-- 128 bits, no adivinable por fuerza bruta razonable) podria intentar
-- PINs contra este RPC desde internet si el kiosko_id se filtra. bcrypt
-- ya frena algo por costo de CPU, pero esta migracion NO agrega
-- rate-limiting (fuera de alcance de SQL puro) — recomendado antes de
-- produccion: throttling a nivel de Edge Function/Vercel o una tabla de
-- intentos fallidos con backoff. Documentado tambien en
-- docs/planning/ARQUITECTURA_MVP_ESCALABLE.md como deuda conocida.
-- =============================================================================
create or replace function rrhh.fn_registrar_marca_kiosko(p_pin text, p_kiosko_id uuid)
returns table (empleado_nombre text, tipo text, marcado_en timestamptz)
language plpgsql
security definer
set search_path = rrhh, extensions, pg_temp
as $$
declare
  v_kiosko rrhh.kiosko_dispositivos%rowtype;
  v_empleado rrhh.empleados%rowtype;
  v_ultimo_tipo text;
  v_tipo text;
  v_marcado_en timestamptz := now();
begin
  select * into v_kiosko from rrhh.kiosko_dispositivos where id = p_kiosko_id;
  if not found or not v_kiosko.activo then
    raise exception 'Kiosco invalido o inactivo';
  end if;

  select * into v_empleado
  from rrhh.empleados
  where company_id = v_kiosko.company_id
    and estado = 'activo'
    and pin_hash is not null
    and crypt(p_pin, pin_hash) = pin_hash
  limit 1;

  if not found then
    raise exception 'PIN invalido';
  end if;

  select am.tipo into v_ultimo_tipo
  from rrhh.asistencia_marcas am
  where am.empleado_id = v_empleado.id
  order by am.marcado_en desc
  limit 1;

  v_tipo := case when v_ultimo_tipo = 'entrada' then 'salida' else 'entrada' end;

  insert into rrhh.asistencia_marcas (company_id, empleado_id, kiosko_id, tipo, marcado_en, origen)
  values (v_kiosko.company_id, v_empleado.id, p_kiosko_id, v_tipo, v_marcado_en, 'kiosko');

  return query select (v_empleado.nombre || ' ' || v_empleado.apellido), v_tipo, v_marcado_en;
end;
$$;

comment on function rrhh.fn_registrar_marca_kiosko is
  'Registra entrada/salida desde un kiosko fisico. Auth por PIN+kiosko_id, no por auth.uid() — ver nota de seguridad arriba de esta funcion en la migracion.';

create or replace function public.registrar_marca_kiosko(p_pin text, p_kiosko_id uuid)
returns table (empleado_nombre text, tipo text, marcado_en timestamptz)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_registrar_marca_kiosko(p_pin, p_kiosko_id);
$$;

comment on function public.registrar_marca_kiosko is
  'Wrapper publico de rrhh.fn_registrar_marca_kiosko. Callable por anon a proposito (el kiosko no tiene sesion) — ver nota de seguridad junto a la funcion interna.';

grant execute on function public.registrar_marca_kiosko(text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- rrhh.fn_set_pin_empleado — unico camino permitido para asignar/cambiar
-- un PIN. Gateado por core.has_permission (a diferencia del RPC de
-- arriba, esta si requiere un usuario authenticated con el permiso de
-- editar empleados) y hashea con bcrypt antes de guardar.
-- -----------------------------------------------------------------------------
create or replace function rrhh.fn_set_pin_empleado(p_empleado_id uuid, p_company_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.empleados.editar') then
    raise exception 'Permiso denegado: rrhh.expedientes.empleados.editar';
  end if;

  update rrhh.empleados
    set pin_hash = crypt(p_pin, gen_salt('bf')), updated_at = now()
    where id = p_empleado_id and company_id = p_company_id;

  if not found then
    raise exception 'Empleado % no encontrado en la empresa %', p_empleado_id, p_company_id;
  end if;
end;
$$;

comment on function rrhh.fn_set_pin_empleado is
  'Unico camino para asignar/cambiar el PIN de marcacion — hashea con bcrypt, nunca guarda texto plano. Gateado por rrhh.expedientes.empleados.editar.';

create or replace function public.set_pin_empleado(p_empleado_id uuid, p_company_id uuid, p_pin text)
returns void
language sql
security definer
set search_path = rrhh, public
as $$
  select rrhh.fn_set_pin_empleado(p_empleado_id, p_company_id, p_pin);
$$;

revoke execute on function public.set_pin_empleado(uuid, uuid, text) from anon;
