-- =============================================================================
-- F1.4 -- Jornadas minimas
-- (docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md F1.4/8.5; aprobado
-- explicitamente por el usuario, 2026-09-07). Paso Cero ya aplicado en
-- 20260907162904/20260907162929.
--
-- Modelo: Empleado -> Contrato -> Asignacion de jornada (rrhh.contrato_
-- jornadas, con historico por vigente_desde/vigente_hasta) -> Jornada
-- (rrhh.jornadas, plantilla reutilizable) -> Dias/horarios/descansos/
-- tolerancias (rrhh.jornada_dias). rrhh.feriados es un catalogo
-- independiente por empresa.
--
-- Estrategia de versionado (definida aqui, sin tabla jornada_versiones
-- extra -- mantiene el modelo minimo de 4 tablas pedido): rrhh.jornada_
-- dias es editable en vivo. La garantia de "no alterar retroactivamente
-- un periodo ya cerrado" la da rrhh.contrato_jornadas (que jornada
-- aplicaba a que contrato en que fecha) + que F1.5, cuando construya el
-- motor de consolidacion, debera snapshotear las reglas del dia (hora/
-- tolerancias/descanso) dentro de rrhh.asistencia_resumen_diario en el
-- momento del calculo -- mismo criterio ya documentado para
-- planilla_detalles (F1.7: "una planilla historica no debe recalcularse
-- con datos actuales"). F1.4 no construye ese motor, pero deja la
-- interfaz lista: contrato_id -> contrato_jornadas vigente en fecha X ->
-- jornada_id -> jornada_dias (rrhh.fn_jornada_vigente_contrato).
--
-- Explicitamente NO implementado en F1.4 (decisiones de negocio sin
-- documentar, ver docs/RRHH_MVP.md "Decisiones pendientes" tras esta
-- migracion): horas semanales/tolerancia/descanso universales, regla de
-- hora extra, pago de feriado, nocturnidad, doble turno, jornada
-- especial, redondeos, turnos que cruzan medianoche. rrhh.jornada_dias
-- modela un unico bloque entrada/salida por dia -- si el negocio real
-- necesita mas de un bloque (ej. horario partido con 2 entradas), es una
-- migracion aparte, no asumida aqui.
--
-- Activacion de contrato: por decision explicita del usuario (2026-09-07),
-- la jornada es OBLIGATORIA -- rrhh.fn_activar_contrato (reemplazada,
-- mismo tipo de retorno, create or replace) ahora exige al menos una fila
-- en rrhh.contrato_jornadas para el contrato antes de activar.
--
-- Verificado despues de aplicar (insercion/RPC/borrado de prueba, sin
-- dejar filas reales): crear jornada -> definir dias -> asignar a
-- contrato borrador -> jornada vigente por fecha -> reasignar con
-- vigencia historica -> solapamiento invalido rechazado (EXCLUDE) ->
-- cross-company rechazado -> activar sin jornada rechazado -> activar
-- con jornada aceptado -> finalizar sin perder historico. Ver
-- docs/IMPLEMENTATION_STATUS.md seccion 0.14 para el detalle completo.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- Trigger generico de updated_at -- mismo criterio que
-- rrhh.fn_validar_transicion_contrato (new.updated_at := now()), sin
-- depender de la extension moddatetime (no instalada en este proyecto).
create or replace function rrhh.fn_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. rrhh.jornadas -- plantilla reutilizable, no particionada (catalogo).
-- -----------------------------------------------------------------------------
create table rrhh.jornadas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) default rrhh.default_company_id(),
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (company_id, nombre)
);

comment on table rrhh.jornadas is
  'F1.4 (2026-09-07): plantilla de jornada reutilizable (ej. "Administrativo 8-17", "Turno Bodega Manana"). No es una jornada universal unica -- una empresa puede tener varias. Se asigna a un contrato via rrhh.contrato_jornadas, nunca directo en rrhh.empleados.';

create index jornadas_company_id_idx on rrhh.jornadas (company_id);

alter table rrhh.jornadas enable row level security;

create policy "jornadas: ver con permiso" on rrhh.jornadas for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.turnos.ver'));

create policy "jornadas: crear con permiso" on rrhh.jornadas for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.turnos.crear'));

create policy "jornadas: editar con permiso" on rrhh.jornadas for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.turnos.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.turnos.editar'));

-- Eliminar fisico permitido (permiso turnos.eliminar); una jornada ya
-- referenciada por rrhh.contrato_jornadas queda protegida por la FK
-- (on delete restrict, default) -- no se puede borrar una jornada con
-- historico real, sin necesidad de un trigger aparte.
create policy "jornadas: eliminar con permiso" on rrhh.jornadas for delete
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.turnos.eliminar'));

grant select, insert, update, delete on rrhh.jornadas to authenticated;

create trigger trg_jornadas_updated_at
  before update on rrhh.jornadas
  for each row execute function rrhh.fn_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 2. rrhh.jornada_dias -- reglas por dia de semana, dentro de una jornada.
-- Un unico bloque entrada/salida por dia (sin turnos nocturnos ni cruce
-- de medianoche -- fuera de alcance de F1.4, ver cabecera). company_id
-- denormalizado desde jornadas para que la policy de RLS no dependa de
-- un join al padre (mismo patron que rrhh.planilla_detalles).
-- -----------------------------------------------------------------------------
create table rrhh.jornada_dias (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid not null references rrhh.jornadas(id) on delete cascade,
  company_id uuid not null references core.companies(id),
  dia_semana smallint not null check (dia_semana between 1 and 7), -- ISO-8601: 1=lunes .. 7=domingo
  laborable boolean not null default true,
  hora_entrada time,
  hora_salida time,
  minutos_descanso integer not null default 0 check (minutos_descanso >= 0),
  tolerancia_entrada_min integer not null default 0 check (tolerancia_entrada_min >= 0),
  tolerancia_salida_min integer not null default 0 check (tolerancia_salida_min >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jornada_id, dia_semana),
  check (
    (laborable and hora_entrada is not null and hora_salida is not null and hora_salida > hora_entrada)
    or (not laborable and hora_entrada is null and hora_salida is null)
  )
);

comment on table rrhh.jornada_dias is
  'F1.4 (2026-09-07): reglas por dia de semana (1=lunes..7=domingo, ISO-8601) de una jornada. Un unico bloque entrada/salida por dia -- horario partido o cruce de medianoche quedan fuera de alcance, ver cabecera de esta migracion.';

create index jornada_dias_company_id_idx on rrhh.jornada_dias (company_id);
create index jornada_dias_jornada_id_idx on rrhh.jornada_dias (jornada_id);

alter table rrhh.jornada_dias enable row level security;

create policy "jornada_dias: ver con permiso" on rrhh.jornada_dias for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.turnos.ver'));

create policy "jornada_dias: crear con permiso" on rrhh.jornada_dias for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.turnos.crear'));

create policy "jornada_dias: editar con permiso" on rrhh.jornada_dias for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.turnos.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.turnos.editar'));

create policy "jornada_dias: eliminar con permiso" on rrhh.jornada_dias for delete
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.turnos.eliminar'));

grant select, insert, update, delete on rrhh.jornada_dias to authenticated;

create trigger trg_jornada_dias_updated_at
  before update on rrhh.jornada_dias
  for each row execute function rrhh.fn_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3. rrhh.contrato_jornadas -- historico de que jornada tuvo cada
-- contrato, por fechas. NUNCA jornada_id directo en rrhh.empleados ni en
-- rrhh.contratos -- cada reasignacion es una fila nueva, la anterior se
-- cierra (vigente_hasta), nunca se sobreescribe. Escritura SOLO via RPC
-- (rrhh.fn_asignar_jornada_contrato) -- sin policy de insert/update/
-- delete para authenticated, mismo criterio que rrhh.contrato_
-- compensacion (la transicion "cerrar la vigencia anterior + abrir la
-- nueva" es atomica y no se puede garantizar con una policy de INSERT
-- simple). El EXCLUDE constraint es la defensa de fondo (bloquea
-- solapamientos incluso si algo escribe fuera del RPC con privilegios de
-- dueno de tabla).
-- -----------------------------------------------------------------------------
create table rrhh.contrato_jornadas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  contrato_id uuid not null references rrhh.contratos(id) on delete cascade,
  jornada_id uuid not null references rrhh.jornadas(id),
  vigente_desde date not null,
  vigente_hasta date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde),
  exclude using gist (
    contrato_id with =,
    daterange(vigente_desde, coalesce(vigente_hasta, 'infinity'::date), '[]') with &&
  )
);

comment on table rrhh.contrato_jornadas is
  'F1.4 (2026-09-07): historico de asignacion de jornada a un contrato, por rango de vigencia (vigente_desde/vigente_hasta null = fila abierta/actual). Reasignar NUNCA sobreescribe una fila -- cierra la vigente y abre una nueva (rrhh.fn_asignar_jornada_contrato). EXCLUDE constraint impide solapamientos de fechas para el mismo contrato_id, incluso fuera del RPC.';

create index contrato_jornadas_company_id_idx on rrhh.contrato_jornadas (company_id);
create index contrato_jornadas_contrato_id_idx on rrhh.contrato_jornadas (contrato_id, vigente_desde);

alter table rrhh.contrato_jornadas enable row level security;

create policy "contrato_jornadas: ver con permiso" on rrhh.contrato_jornadas for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.contratos.ver'));

-- Sin policy de insert/update/delete a proposito -- solo rrhh.fn_asignar_
-- jornada_contrato (security definer) escribe aqui.
grant select on rrhh.contrato_jornadas to authenticated;

-- -----------------------------------------------------------------------------
-- 4. rrhh.feriados -- catalogo por empresa, sin tipo/alcance (no hace
-- falta hoy -- no hay ninguna regla de pago/calculo de feriado definida
-- todavia, ver cabecera). Mismo patron RLS directo que
-- rrhh.parametros_ley (sin RPC, permiso + policy alcanza).
-- -----------------------------------------------------------------------------
create table rrhh.feriados (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) default rrhh.default_company_id(),
  fecha date not null,
  nombre text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (company_id, fecha)
);

comment on table rrhh.feriados is
  'F1.4 (2026-09-07): calendario de feriados/dias no laborables por empresa. Sin columna de tipo/alcance ni de pago -- no hay regla de negocio definida todavia sobre como afecta un feriado al calculo de horas/planilla (decision pendiente, ver docs/RRHH_MVP.md). El motor de F1.5 debe leer esta tabla, nunca hardcodear fechas.';

create index feriados_company_id_idx on rrhh.feriados (company_id);

alter table rrhh.feriados enable row level security;

create policy "feriados: ver con permiso" on rrhh.feriados for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.feriados.ver'));

create policy "feriados: crear con permiso" on rrhh.feriados for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.feriados.crear'));

create policy "feriados: editar con permiso" on rrhh.feriados for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.feriados.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.feriados.editar'));

create policy "feriados: eliminar con permiso" on rrhh.feriados for delete
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.feriados.eliminar'));

grant select, insert, update, delete on rrhh.feriados to authenticated;

-- =============================================================================
-- RPC: asignar/reasignar jornada a un contrato -- unico camino de
-- escritura de rrhh.contrato_jornadas.
-- =============================================================================
create function rrhh.fn_asignar_jornada_contrato(
  p_contrato_id uuid,
  p_company_id uuid,
  p_jornada_id uuid,
  p_vigente_desde date default null
)
returns table (contrato_jornada_id uuid, vigente_desde date)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_estado text;
  v_fecha_inicio date;
  v_jornada_activo boolean;
  v_desde date;
  v_abierta rrhh.contrato_jornadas%rowtype;
  v_nueva_id uuid;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.editar') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.editar';
  end if;

  select estado, fecha_inicio into v_estado, v_fecha_inicio
  from rrhh.contratos where id = p_contrato_id and company_id = p_company_id;

  if v_estado is null then
    raise exception 'Contrato no encontrado en esta empresa';
  elsif v_estado = 'finalizado' then
    raise exception 'No se puede asignar jornada a un contrato finalizado';
  end if;

  select activo into v_jornada_activo
  from rrhh.jornadas where id = p_jornada_id and company_id = p_company_id;

  if v_jornada_activo is null then
    raise exception 'Jornada no encontrada en esta empresa';
  elsif not v_jornada_activo then
    raise exception 'La jornada seleccionada esta inactiva';
  end if;

  v_desde := coalesce(p_vigente_desde, v_fecha_inicio, current_date);

  select * into v_abierta
  from rrhh.contrato_jornadas
  where contrato_id = p_contrato_id and vigente_hasta is null;

  if found then
    if v_abierta.jornada_id = p_jornada_id then
      raise exception 'El contrato ya tiene esa jornada asignada como vigente';
    end if;
    if v_desde <= v_abierta.vigente_desde then
      raise exception 'La nueva vigencia (%) debe ser posterior a la asignacion actual (%)', v_desde, v_abierta.vigente_desde;
    end if;

    update rrhh.contrato_jornadas
    set vigente_hasta = v_desde - 1
    where id = v_abierta.id;
  end if;

  insert into rrhh.contrato_jornadas as cj (company_id, contrato_id, jornada_id, vigente_desde, created_by)
  values (p_company_id, p_contrato_id, p_jornada_id, v_desde, auth.uid())
  returning cj.id into v_nueva_id;

  return query select v_nueva_id, v_desde;
end;
$$;

comment on function rrhh.fn_asignar_jornada_contrato(uuid, uuid, uuid, date) is
  'F1.4 (2026-09-07): unico camino de escritura de rrhh.contrato_jornadas -- cierra la vigencia abierta anterior (si existe) y abre una nueva, atomicamente. Gateada por rrhh.expedientes.contratos.editar (mismo permiso que completar el resto del expediente laboral). Rechaza contrato finalizado, jornada inactiva/de otra empresa, y una nueva vigencia que no sea estrictamente posterior a la actual.';

create function public.asignar_jornada_contrato(
  p_contrato_id uuid,
  p_company_id uuid,
  p_jornada_id uuid,
  p_vigente_desde date default null
)
returns table (contrato_jornada_id uuid, vigente_desde date)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_asignar_jornada_contrato(p_contrato_id, p_company_id, p_jornada_id, p_vigente_desde);
$$;

revoke execute on function rrhh.fn_asignar_jornada_contrato(uuid, uuid, uuid, date) from PUBLIC, anon, authenticated;
revoke execute on function public.asignar_jornada_contrato(uuid, uuid, uuid, date) from PUBLIC, anon;
grant execute on function public.asignar_jornada_contrato(uuid, uuid, uuid, date) to authenticated;

-- =============================================================================
-- RPC de lectura: jornada vigente de un contrato en una fecha dada --
-- interfaz que F1.5 (consolidacion) usara para resolver marca ->
-- contrato_id -> jornada vigente -> hora esperada. No implementa el
-- calculo, solo la resolucion contrato+fecha -> jornada+dia.
-- =============================================================================
create function rrhh.fn_jornada_vigente_contrato(
  p_contrato_id uuid,
  p_company_id uuid,
  p_fecha date default current_date
)
returns table (
  jornada_id uuid,
  jornada_nombre text,
  dia_semana smallint,
  laborable boolean,
  hora_entrada time,
  hora_salida time,
  minutos_descanso integer,
  tolerancia_entrada_min integer,
  tolerancia_salida_min integer
)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_dia_semana smallint;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.ver') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.ver';
  end if;

  if not exists (select 1 from rrhh.contratos where id = p_contrato_id and company_id = p_company_id) then
    raise exception 'Contrato no encontrado en esta empresa';
  end if;

  -- ISO-8601: extract(isodow) devuelve 1=lunes..7=domingo, igual que jornada_dias.dia_semana.
  v_dia_semana := extract(isodow from p_fecha);

  return query
  select j.id, j.nombre, jd.dia_semana, jd.laborable, jd.hora_entrada, jd.hora_salida,
         jd.minutos_descanso, jd.tolerancia_entrada_min, jd.tolerancia_salida_min
  from rrhh.contrato_jornadas cj
  join rrhh.jornadas j on j.id = cj.jornada_id
  join rrhh.jornada_dias jd on jd.jornada_id = j.id and jd.dia_semana = v_dia_semana
  where cj.contrato_id = p_contrato_id
    and cj.vigente_desde <= p_fecha
    and (cj.vigente_hasta is null or cj.vigente_hasta >= p_fecha)
  limit 1;
end;
$$;

comment on function rrhh.fn_jornada_vigente_contrato(uuid, uuid, date) is
  'F1.4 (2026-09-07): resuelve que jornada (y regla del dia) aplicaba a un contrato en una fecha dada -- interfaz de solo lectura para F1.5 (marca -> contrato_id -> jornada vigente -> hora esperada). No implementa consolidacion/calculo. Gateada por rrhh.expedientes.contratos.ver. Sin filas si no hay asignacion vigente esa fecha (contrato sin jornada preparada para ese periodo).';

create function public.jornada_vigente_contrato(
  p_contrato_id uuid,
  p_company_id uuid,
  p_fecha date default current_date
)
returns table (
  jornada_id uuid,
  jornada_nombre text,
  dia_semana smallint,
  laborable boolean,
  hora_entrada time,
  hora_salida time,
  minutos_descanso integer,
  tolerancia_entrada_min integer,
  tolerancia_salida_min integer
)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_jornada_vigente_contrato(p_contrato_id, p_company_id, p_fecha);
$$;

revoke execute on function rrhh.fn_jornada_vigente_contrato(uuid, uuid, date) from PUBLIC, anon, authenticated;
revoke execute on function public.jornada_vigente_contrato(uuid, uuid, date) from PUBLIC, anon;
grant execute on function public.jornada_vigente_contrato(uuid, uuid, date) to authenticated;

-- =============================================================================
-- rrhh.fn_activar_contrato: AHORA exige jornada asignada. Mismo tipo de
-- retorno que F1.3 (table (pin_kiosko text)) -- create or replace
-- alcanza, sin DROP.
-- =============================================================================
create or replace function rrhh.fn_activar_contrato(
  p_contrato_id uuid,
  p_company_id uuid
)
returns table (pin_kiosko text)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_estado text;
  v_empleado_id uuid;
  v_pin text;
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

  -- F1.4 (2026-09-07, decision explicita del usuario): la jornada es
  -- obligatoria para activar -- un contrato activo sin jornada quedaria
  -- inutilizable para asistencia (F1.5) hasta que alguien la complete a
  -- mano. Basta con que exista AL MENOS UNA fila (no necesariamente
  -- vigente hoy -- un contrato puede activarse con fecha de inicio
  -- futura ya con su jornada preparada).
  if not exists (select 1 from rrhh.contrato_jornadas where contrato_id = p_contrato_id) then
    raise exception 'El contrato no tiene una jornada asignada -- complete la jornada antes de activar';
  end if;

  update rrhh.contratos
  set estado = 'activo', activado_at = now(), activado_by = auth.uid()
  where id = p_contrato_id and company_id = p_company_id;

  v_pin := lpad(floor(random() * 10000)::text, 4, '0');

  insert into rrhh.contrato_credenciales (company_id, contrato_id, pin_hash, creado_by)
  values (p_company_id, p_contrato_id, crypt(v_pin, gen_salt('bf')), auth.uid());

  return query select v_pin;
end;
$$;

comment on function rrhh.fn_activar_contrato(uuid, uuid) is
  'F1.4 (2026-09-07): activa un contrato borrador Y genera su PIN de asistencia -- AHORA exige ademas al menos una fila en rrhh.contrato_jornadas (jornada obligatoria, decision explicita del usuario). Reemplaza la version F1.3 (sin ese requisito). Gateada por rrhh.expedientes.contratos.activar.';
