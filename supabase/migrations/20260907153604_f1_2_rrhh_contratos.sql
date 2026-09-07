-- =============================================================================
-- F1.2 -- rrhh.contratos + compensacion contractual
-- (docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md secciones 5.2/8.2/8.3;
-- aprobado explicitamente por el usuario, 2026-09-07). Paso Cero ya
-- aplicado en 20260907151643_rrhh_contratos_permission_matrix.
--
-- rrhh.contratos es el Expediente Laboral: puesto, departamento,
-- modalidad, fechas y estado laboral, que F1.1 saco de rrhh.empleados.
-- Un empleado puede tener multiples contratos historicos, pero solo uno
-- activo a la vez (EXCLUDE/unique parcial). Estados: borrador -> activo
-- -> finalizado, sin reabrir. Historico: nunca se borra fisicamente.
--
-- rrhh.contrato_compensacion es 1:1 con el contrato (no con el
-- empleado) -- asi una recontratacion/cambio de salario crea un
-- contrato nuevo en vez de sobreescribir el historico (D-03,
-- docs/IMPLEMENTATION_STATUS.md). Reutiliza los permisos existentes
-- rrhh.expedientes.compensacion.ver/editar (mismo criterio que el
-- fn_crear_empleado original: solo admin tiene .editar hoy, verificado
-- en core.app_role_permissions antes de escribir esta migracion) -- no
-- se crea un permiso nuevo, solo se re-scopea su semantica al contrato.
--
-- Generacion de PIN al activar: DIFERIDA a F1.3 (proxima migracion,
-- create or replace de rrhh.fn_activar_contrato). Esta migracion solo
-- hace la transicion de estado -- correcto y esperado que un contrato
-- activado en F1.2 todavia no genere PIN.
--
-- Verificado despues de aplicar (insercion/borrado de prueba, sin dejar
-- filas reales): trigger bloquea borrador->finalizado directo, bloquea
-- editar puesto/departamento/modalidad/fecha_inicio fuera de borrador,
-- bloquea reabrir un contrato finalizado; el unique index parcial
-- bloquea un segundo contrato activo por empleado; RLS/policies y GRANTs
-- confirmados con pg_policies y has_function_privilege (anon sin acceso
-- en ningun caso; authenticated solo en los wrappers publicos).
-- =============================================================================

create table rrhh.contratos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  empleado_id uuid not null references rrhh.empleados(id) on delete cascade,
  numero_contrato bigint generated always as identity,
  estado text not null default 'borrador' check (estado in ('borrador', 'activo', 'finalizado')),
  puesto text,
  departamento text,
  modalidad_contrato text check (modalidad_contrato in ('nomina_estandar', 'comisionista_destajo')),
  fecha_inicio date,
  fecha_fin_prevista date,
  fecha_fin_real date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  activado_at timestamptz,
  activado_by uuid references auth.users(id),
  finalizado_at timestamptz,
  finalizado_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

comment on table rrhh.contratos is
  'Expediente Laboral (F1.2, 2026-09-07): puesto/departamento/modalidad/fechas/estado laboral, separados de rrhh.empleados (Expediente General, F1.1). Historico completo por empleado -- nunca se borra fisicamente, solo se finaliza.';

-- Un solo contrato activo por empleado a la vez.
create unique index contratos_empleado_activo_unq on rrhh.contratos (empleado_id) where estado = 'activo';
create index contratos_company_id_idx on rrhh.contratos (company_id);
create index contratos_empleado_id_idx on rrhh.contratos (empleado_id);

alter table rrhh.contratos enable row level security;

create policy "contratos: ver con permiso" on rrhh.contratos for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.contratos.ver'));

create policy "contratos: crear borrador con permiso" on rrhh.contratos for insert
  to authenticated
  with check (
    core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.contratos.crear')
    and estado = 'borrador'
  );

-- Editar libre SOLO mientras estado='borrador' -- activar/finalizar son
-- transiciones que solo hacen rrhh.fn_activar_contrato/fn_finalizar_contrato
-- (security definer, bypasan RLS como dueños de la tabla). Sin policy de
-- UPDATE que permita cambiar `estado` directo -- ver el trigger de abajo
-- como segunda capa (defensa en profundidad).
create policy "contratos: editar borrador con permiso" on rrhh.contratos for update
  to authenticated
  using (
    core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.contratos.editar')
    and estado = 'borrador'
  )
  with check (estado = 'borrador');

-- Sin policy de DELETE a proposito (deny by default) -- contratos no se
-- borran fisicamente, ni siquiera con permiso.

grant select, insert, update on rrhh.contratos to authenticated;

-- Trigger de estado -- defensa en profundidad independiente de RLS:
-- valida transiciones (borrador->activo->finalizado, sin reabrir) e
-- inmutabilidad de los datos base del contrato fuera de borrador, sin
-- importar que funcion security definer intente el UPDATE.
create or replace function rrhh.fn_validar_transicion_contrato()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if OLD.estado = 'borrador' and NEW.estado not in ('borrador', 'activo') then
    raise exception 'Transicion de contrato invalida: % -> %', OLD.estado, NEW.estado;
  elsif OLD.estado = 'activo' and NEW.estado not in ('activo', 'finalizado') then
    raise exception 'Transicion de contrato invalida: % -> %', OLD.estado, NEW.estado;
  elsif OLD.estado = 'finalizado' and NEW.estado <> 'finalizado' then
    raise exception 'Un contrato finalizado no puede reabrirse';
  end if;

  if OLD.estado <> 'borrador' then
    if NEW.puesto is distinct from OLD.puesto
       or NEW.departamento is distinct from OLD.departamento
       or NEW.modalidad_contrato is distinct from OLD.modalidad_contrato
       or NEW.fecha_inicio is distinct from OLD.fecha_inicio
       or NEW.empleado_id is distinct from OLD.empleado_id
       or NEW.company_id is distinct from OLD.company_id then
      raise exception 'No se pueden editar los datos base del contrato fuera del estado borrador';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_validar_transicion_contrato
  before update on rrhh.contratos
  for each row execute function rrhh.fn_validar_transicion_contrato();

-- Compensacion contractual: 1:1 con el contrato, no con el empleado (D-03).
create table rrhh.contrato_compensacion (
  contrato_id uuid primary key references rrhh.contratos(id) on delete cascade,
  company_id uuid not null references core.companies(id),
  salario_base numeric not null default 0,
  frecuencia_pago text not null default 'mensual' check (frecuencia_pago in ('mensual', 'quincenal', 'semanal')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table rrhh.contrato_compensacion is
  'Compensacion del contrato (F1.2, 2026-09-07) -- 1:1 con rrhh.contratos, no con rrhh.empleados (D-03): una recontratacion o cambio de salario crea un contrato nuevo, conserva el historico. Reutiliza rrhh.expedientes.compensacion.ver/editar (permisos existentes, re-scopeados semanticamente al contrato).';

create index contrato_compensacion_company_id_idx on rrhh.contrato_compensacion (company_id);

alter table rrhh.contrato_compensacion enable row level security;

create policy "contrato_compensacion: ver con permiso" on rrhh.contrato_compensacion for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.compensacion.ver'));

-- Sin policy de insert/update/delete directo a proposito -- solo se
-- escribe via rrhh.fn_crear_contrato/fn_editar_contrato (security
-- definer), que exigen ademas rrhh.expedientes.compensacion.editar.
grant select on rrhh.contrato_compensacion to authenticated;

-- =============================================================================
-- RPC de ciclo de vida del contrato
-- =============================================================================

create function rrhh.fn_crear_contrato(
  p_company_id uuid,
  p_empleado_id uuid,
  p_puesto text default null,
  p_departamento text default null,
  p_modalidad_contrato text default null,
  p_fecha_inicio date default null,
  p_fecha_fin_prevista date default null,
  p_salario_base numeric default null
)
returns table (contrato_id uuid, numero_contrato bigint)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_contrato_id uuid;
  v_numero_contrato bigint;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.crear') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.crear';
  end if;

  if not exists (select 1 from rrhh.empleados where id = p_empleado_id and company_id = p_company_id) then
    raise exception 'Empleado no encontrado en esta empresa';
  end if;

  insert into rrhh.contratos (
    company_id, empleado_id, puesto, departamento, modalidad_contrato,
    fecha_inicio, fecha_fin_prevista, created_by
  )
  values (
    p_company_id, p_empleado_id, p_puesto, p_departamento, p_modalidad_contrato,
    p_fecha_inicio, p_fecha_fin_prevista, auth.uid()
  )
  returning id, numero_contrato into v_contrato_id, v_numero_contrato;

  if coalesce(p_salario_base, 0) <> 0 then
    if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.compensacion.editar') then
      raise exception 'Permiso denegado: rrhh.expedientes.compensacion.editar (requerido para fijar salario)';
    end if;

    insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base, updated_by)
    values (v_contrato_id, p_company_id, p_salario_base, auth.uid());
  end if;

  return query select v_contrato_id, v_numero_contrato;
end;
$$;

comment on function rrhh.fn_crear_contrato(uuid, uuid, text, text, text, date, date, numeric) is
  'F1.2 (2026-09-07): crea un contrato en estado borrador para un empleado existente. Gateada por rrhh.expedientes.contratos.crear; fijar salario_base exige ademas rrhh.expedientes.compensacion.editar (separacion de funciones, mismo patron que el fn_crear_empleado original).';

create function public.crear_contrato(
  p_company_id uuid,
  p_empleado_id uuid,
  p_puesto text default null,
  p_departamento text default null,
  p_modalidad_contrato text default null,
  p_fecha_inicio date default null,
  p_fecha_fin_prevista date default null,
  p_salario_base numeric default null
)
returns table (contrato_id uuid, numero_contrato bigint)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_crear_contrato(p_company_id, p_empleado_id, p_puesto, p_departamento, p_modalidad_contrato, p_fecha_inicio, p_fecha_fin_prevista, p_salario_base);
$$;

revoke execute on function rrhh.fn_crear_contrato(uuid, uuid, text, text, text, date, date, numeric) from PUBLIC, anon, authenticated;
revoke execute on function public.crear_contrato(uuid, uuid, text, text, text, date, date, numeric) from PUBLIC, anon;
grant execute on function public.crear_contrato(uuid, uuid, text, text, text, date, date, numeric) to authenticated;

create function rrhh.fn_editar_contrato(
  p_contrato_id uuid,
  p_company_id uuid,
  p_puesto text default null,
  p_departamento text default null,
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

  update rrhh.contratos set
    puesto = coalesce(p_puesto, puesto),
    departamento = coalesce(p_departamento, departamento),
    modalidad_contrato = coalesce(p_modalidad_contrato, modalidad_contrato),
    fecha_inicio = coalesce(p_fecha_inicio, fecha_inicio),
    fecha_fin_prevista = coalesce(p_fecha_fin_prevista, fecha_fin_prevista)
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

comment on function rrhh.fn_editar_contrato(uuid, uuid, text, text, text, date, date, numeric) is
  'F1.2 (2026-09-07): edita un contrato SOLO en estado borrador (verificado explicitamente ademas de RLS/trigger). Gateada por rrhh.expedientes.contratos.editar; salario_base exige ademas compensacion.editar.';

create function public.editar_contrato(
  p_contrato_id uuid,
  p_company_id uuid,
  p_puesto text default null,
  p_departamento text default null,
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
  select rrhh.fn_editar_contrato(p_contrato_id, p_company_id, p_puesto, p_departamento, p_modalidad_contrato, p_fecha_inicio, p_fecha_fin_prevista, p_salario_base);
$$;

revoke execute on function rrhh.fn_editar_contrato(uuid, uuid, text, text, text, date, date, numeric) from PUBLIC, anon, authenticated;
revoke execute on function public.editar_contrato(uuid, uuid, text, text, text, date, date, numeric) from PUBLIC, anon;
grant execute on function public.editar_contrato(uuid, uuid, text, text, text, date, date, numeric) to authenticated;

-- fn_activar_contrato: SOLO transicion de estado en F1.2. F1.3 la
-- reemplaza (create or replace) para ademas generar el PIN.
create function rrhh.fn_activar_contrato(
  p_contrato_id uuid,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_estado text;
  v_empleado_id uuid;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.activar') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.activar';
  end if;

  select estado, empleado_id into v_estado, v_empleado_id
  from rrhh.contratos where id = p_contrato_id and company_id = p_company_id;

  if v_estado is null then
    raise exception 'Contrato no encontrado en esta empresa';
  elsif v_estado <> 'borrador' then
    raise exception 'Solo se puede activar un contrato en estado borrador';
  end if;

  if exists (select 1 from rrhh.contratos where empleado_id = v_empleado_id and estado = 'activo') then
    raise exception 'El empleado ya tiene un contrato activo';
  end if;

  update rrhh.contratos
  set estado = 'activo', activado_at = now(), activado_by = auth.uid()
  where id = p_contrato_id and company_id = p_company_id;
end;
$$;

comment on function rrhh.fn_activar_contrato(uuid, uuid) is
  'F1.2 (2026-09-07): activa un contrato borrador -- SOLO transicion de estado por ahora. F1.3 reemplaza esta funcion (create or replace) para ademas generar el PIN de asistencia automaticamente. Gateada por rrhh.expedientes.contratos.activar.';

create function public.activar_contrato(p_contrato_id uuid, p_company_id uuid)
returns void
language sql
security definer
set search_path = rrhh, public
as $$
  select rrhh.fn_activar_contrato(p_contrato_id, p_company_id);
$$;

revoke execute on function rrhh.fn_activar_contrato(uuid, uuid) from PUBLIC, anon, authenticated;
revoke execute on function public.activar_contrato(uuid, uuid) from PUBLIC, anon;
grant execute on function public.activar_contrato(uuid, uuid) to authenticated;

-- fn_finalizar_contrato: SOLO transicion de estado en F1.2. F1.3 la
-- reemplaza (create or replace) para ademas revocar el PIN.
create function rrhh.fn_finalizar_contrato(
  p_contrato_id uuid,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
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
end;
$$;

comment on function rrhh.fn_finalizar_contrato(uuid, uuid) is
  'F1.2 (2026-09-07): finaliza un contrato activo -- SOLO transicion de estado por ahora. F1.3 reemplaza esta funcion (create or replace) para ademas revocar el PIN de asistencia. Gateada por rrhh.expedientes.contratos.finalizar.';

create function public.finalizar_contrato(p_contrato_id uuid, p_company_id uuid)
returns void
language sql
security definer
set search_path = rrhh, public
as $$
  select rrhh.fn_finalizar_contrato(p_contrato_id, p_company_id);
$$;

revoke execute on function rrhh.fn_finalizar_contrato(uuid, uuid) from PUBLIC, anon, authenticated;
revoke execute on function public.finalizar_contrato(uuid, uuid) from PUBLIC, anon;
grant execute on function public.finalizar_contrato(uuid, uuid) to authenticated;
