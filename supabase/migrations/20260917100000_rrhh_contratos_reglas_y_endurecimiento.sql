-- =============================================================================
-- Continuacion del bloque "pre-F1.5" (2026-09-17): reglas de negocio de
-- creacion de contratos + hallazgos de seguridad/integridad detectados al
-- auditar el bloque del 2026-09-16. NO inicia F1.5 (asistencia consolidada).
--
-- Verificacion remota previa (nexo-core, 2026-09-17, execute_sql):
--   rrhh.contratos: 0 filas (0 con puesto_id/departamento_id nulos)
--   rrhh.puestos: 2 filas, 0 sin departamento_id
--   rrhh.empleado_direccion / info_complementaria / cuentas_bancarias: 0 filas
--   rrhh.empleado_beneficiarios / empleado_documentos: 0 filas
-- Todos los NOT NULL/FK compuestas de abajo son seguros hoy sin backfill --
-- cada uno igual queda protegido con una guarda explicita (raise exception
-- si aparece una fila que lo violaria) en vez de asumir que seguira en 0
-- para cuando esta migracion se aplique.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Integridad multiempresa: unique compuesta (id, company_id) en cada tabla
-- que sirve de destino, y FK compuesta en cada tabla que hoy guarda
-- `company_id` por separado del id referenciado -- sin esto, RLS valida el
-- `company_id` que mande el cliente/RPC, no que ese id realmente pertenezca
-- a esa empresa, dejando una via para mezclar datos entre empresas si algun
-- flujo (bug futuro, llamada RPC directa) manda un `company_id` que no
-- corresponde al recurso referenciado.
-- -----------------------------------------------------------------------------
alter table rrhh.empleados add constraint empleados_id_company_unq unique (id, company_id);
alter table rrhh.departamentos add constraint departamentos_id_company_unq unique (id, company_id);
alter table rrhh.puestos add constraint puestos_id_company_unq unique (id, company_id);
alter table rrhh.plantillas_contrato add constraint plantillas_contrato_id_company_unq unique (id, company_id);

alter table rrhh.contratos
  add constraint contratos_empleado_company_fk
  foreign key (empleado_id, company_id) references rrhh.empleados (id, company_id);

alter table rrhh.empleado_direccion
  add constraint empleado_direccion_empleado_company_fk
  foreign key (empleado_id, company_id) references rrhh.empleados (id, company_id);

alter table rrhh.empleado_info_complementaria
  add constraint empleado_info_complementaria_empleado_company_fk
  foreign key (empleado_id, company_id) references rrhh.empleados (id, company_id);

alter table rrhh.empleado_cuentas_bancarias
  add constraint empleado_cuentas_bancarias_empleado_company_fk
  foreign key (empleado_id, company_id) references rrhh.empleados (id, company_id);

alter table rrhh.empleado_beneficiarios
  add constraint empleado_beneficiarios_empleado_company_fk
  foreign key (empleado_id, company_id) references rrhh.empleados (id, company_id);

alter table rrhh.empleado_documentos
  add constraint empleado_documentos_empleado_company_fk
  foreign key (empleado_id, company_id) references rrhh.empleados (id, company_id);

-- Cada puesto pertenece a UN departamento organizacional, del mismo tenant
-- (regla de negocio explicita del usuario, 2026-09-17). departamento_id
-- pasa de opcional a obligatorio -- verificado arriba: 0 puestos sin
-- departamento hoy en remoto.
do $$
begin
  if exists (select 1 from rrhh.puestos where departamento_id is null) then
    raise exception 'Hay puestos sin departamento asignado -- asignalos antes de aplicar esta migracion (rrhh.puestos.departamento_id pasa a NOT NULL)';
  end if;
end $$;

alter table rrhh.puestos alter column departamento_id set not null;

alter table rrhh.puestos
  add constraint puestos_departamento_company_fk
  foreign key (departamento_id, company_id) references rrhh.departamentos (id, company_id);

alter table rrhh.puesto_plantillas
  add constraint puesto_plantillas_puesto_company_fk
  foreign key (puesto_id, company_id) references rrhh.puestos (id, company_id);

alter table rrhh.puesto_plantillas
  add constraint puesto_plantillas_plantilla_company_fk
  foreign key (plantilla_id, company_id) references rrhh.plantillas_contrato (id, company_id);

-- -----------------------------------------------------------------------------
-- 2. Geografia de Nicaragua: un municipio elegido debe pertenecer al
-- departamento elegido -- FK compuesta declarativa (no un trigger) sobre
-- core.geografia_ni_municipios(id, departamento_id), que ya es unico por
-- construccion. El CHECK cierra el hueco de MATCH SIMPLE: una FK compuesta
-- con una sola columna en null no se evalua, asi que sin este CHECK se
-- podria guardar municipio_geo_id con departamento_geo_id en null.
-- -----------------------------------------------------------------------------
alter table core.geografia_ni_municipios
  add constraint geografia_ni_municipios_id_departamento_unq unique (id, departamento_id);

do $$
begin
  if exists (
    select 1 from rrhh.empleado_direccion
    where municipio_geo_id is not null and departamento_geo_id is null
  ) then
    raise exception 'Hay direcciones con municipio pero sin departamento -- corregilas antes de aplicar esta migracion';
  end if;
end $$;

alter table rrhh.empleado_direccion
  add constraint empleado_direccion_municipio_departamento_check
  check (municipio_geo_id is null or departamento_geo_id is not null);

alter table rrhh.empleado_direccion
  add constraint empleado_direccion_municipio_departamento_fk
  foreign key (municipio_geo_id, departamento_geo_id) references core.geografia_ni_municipios (id, departamento_id);

-- -----------------------------------------------------------------------------
-- 3. rrhh.empleado_beneficiarios: la validacion de "suma de porcentajes
-- activos <= 100" (trigger de 20260916170000) lee con SELECT simple antes de
-- escribir -- dos transacciones concurrentes insertando/activando
-- beneficiarios del MISMO empleado pueden leer el mismo total antes de que
-- ninguna haga commit y las dos pasar la validacion, superando 100% en
-- conjunto (TOCTOU clasico). Fix: tomar un lock de fila sobre el empleado
-- antes de sumar -- serializa cualquier trigger concurrente para el mismo
-- empleado_id (la segunda transaccion espera el commit/rollback de la
-- primera y vuelve a sumar sobre datos ya actualizados). No cambia la firma
-- ni el disparador, solo el cuerpo.
-- -----------------------------------------------------------------------------
create or replace function rrhh.fn_validar_porcentaje_beneficiarios()
returns trigger
language plpgsql
set search_path = rrhh, pg_temp
as $$
declare
  v_total numeric;
begin
  perform 1 from rrhh.empleados where id = new.empleado_id for update;

  select coalesce(sum(porcentaje), 0) into v_total
  from rrhh.empleado_beneficiarios
  where empleado_id = new.empleado_id and activo
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if new.activo then
    v_total := v_total + new.porcentaje;
  end if;

  if v_total > 100 then
    raise exception 'La suma de porcentajes de beneficiarios activos no puede superar 100%% (quedaría en %)', v_total;
  end if;

  return new;
end;
$$;

comment on function rrhh.fn_validar_porcentaje_beneficiarios() is
  '2026-09-17: agrega perform ... for update sobre rrhh.empleados antes de sumar -- cierra una condicion de carrera real (dos inserts/updates concurrentes del mismo empleado podian leer el mismo total y superar 100%% en conjunto). Misma regla de negocio que 20260916170000, solo el cuerpo cambia.';

-- -----------------------------------------------------------------------------
-- 4. Storage privado: limite real de tamano y MIME permitidos a nivel de
-- bucket -- hasta ahora storage.buckets.file_size_limit/allowed_mime_types
-- quedaron en su default (sin limite), y la unica validacion real vivia en
-- la Server Action (apps/rrhh/.../documentos-actions.ts). Esto agrega el
-- mismo limite tambien en la capa de infraestructura (defensa en profundidad
-- -- si alguna vez se emite una signed upload URL sin pasar por esa validacion,
-- Storage la rechaza igual).
-- -----------------------------------------------------------------------------
update storage.buckets
set
  file_size_limit = 10485760, -- 10 MB, mismo limite que MAX_BYTES en documentos-actions.ts
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where id = 'rrhh-documentos-privados';

-- -----------------------------------------------------------------------------
-- 5. rrhh.contratos: nueva columna plantilla_contrato_id -- Fase 3
-- (20260916150000) solo devolvia la plantilla predeterminada del puesto
-- como "sugerencia" (plantilla_sugerida_id, dato de UI, nunca guardado).
-- Regla de negocio nueva del usuario (2026-09-17): la plantilla elegida se
-- PERSISTE en el contrato, no alcanza con sugerirla. puesto_id/
-- departamento_id pasan de opcionales a obligatorios (mismo criterio que
-- rrhh.puestos.departamento_id arriba -- verificado 0 filas nulas hoy).
-- -----------------------------------------------------------------------------
alter table rrhh.contratos
  add column plantilla_contrato_id uuid references rrhh.plantillas_contrato (id);

do $$
begin
  if exists (select 1 from rrhh.contratos where puesto_id is null or departamento_id is null) then
    raise exception 'Hay contratos sin puesto_id/departamento_id -- completalos antes de aplicar esta migracion (pasan a NOT NULL)';
  end if;
end $$;

alter table rrhh.contratos alter column puesto_id set not null;
alter table rrhh.contratos alter column departamento_id set not null;
-- plantilla_contrato_id: 0 filas existentes hoy (verificado arriba), se
-- declara NOT NULL directo -- no hay filas que backfillear.
alter table rrhh.contratos alter column plantilla_contrato_id set not null;

alter table rrhh.contratos
  add constraint contratos_puesto_company_fk
  foreign key (puesto_id, company_id) references rrhh.puestos (id, company_id);

alter table rrhh.contratos
  add constraint contratos_departamento_company_fk
  foreign key (departamento_id, company_id) references rrhh.departamentos (id, company_id);

alter table rrhh.contratos
  add constraint contratos_plantilla_company_fk
  foreign key (plantilla_contrato_id, company_id) references rrhh.plantillas_contrato (id, company_id);

comment on column rrhh.contratos.plantilla_contrato_id is
  '2026-09-17: plantilla de contrato PERSISTIDA (obligatoria) -- reemplaza el concepto de "plantilla_sugerida_id" de fn_crear_contrato (20260916150000), que solo era informativo. Debe estar activa y asignada al puesto (rrhh.puesto_plantillas) al momento de crear/editar el contrato -- validado en rrhh.fn_crear_contrato/fn_editar_contrato.';

-- -----------------------------------------------------------------------------
-- 6. rrhh.fn_crear_contrato / public.crear_contrato: reglas nuevas de
-- negocio (2026-09-17):
--   - puesto_id/departamento_id/plantilla_contrato_id pasan a ser
--     OBLIGATORIOS (sin default) -- antes eran opcionales.
--   - SIN parametro de fecha_fin_prevista: un borrador nuevo nunca puede
--     nacer con fecha de fin -- se elimina el parametro por completo (no
--     un default forzado a null) para que sea estructuralmente imposible
--     de mandar, se llame desde la UI o directo por RPC.
--   - valida en servidor (nunca confia en los selects del navegador):
--     mismo tenant para puesto/departamento/plantilla, el puesto pertenece
--     al departamento indicado, la plantilla esta asignada y activa para
--     ese puesto, y el empleado no tiene ya un contrato abierto (antes solo
--     habia un unique index parcial para estado='activo' -- una llamada RPC
--     directa podia crear un SEGUNDO borrador para el mismo empleado sin
--     que nada en la base de datos lo impidiera).
-- -----------------------------------------------------------------------------
drop function if exists rrhh.fn_crear_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric);

create function rrhh.fn_crear_contrato(
  p_company_id uuid,
  p_empleado_id uuid,
  p_puesto_id uuid,
  p_departamento_id uuid,
  p_plantilla_contrato_id uuid,
  p_modalidad_contrato text default null,
  p_fecha_inicio date default null,
  p_salario_base numeric default null
)
returns table (contrato_id uuid, numero_contrato bigint, plantilla_contrato_id uuid)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_contrato_id uuid;
  v_numero_contrato bigint;
  v_puesto_departamento_id uuid;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.crear') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.crear';
  end if;

  if not exists (select 1 from rrhh.empleados where id = p_empleado_id and company_id = p_company_id) then
    raise exception 'Empleado no encontrado en esta empresa';
  end if;

  if exists (
    select 1 from rrhh.contratos
    where empleado_id = p_empleado_id and company_id = p_company_id
      and estado in ('activo', 'borrador')
  ) then
    raise exception 'Este empleado ya tiene un contrato activo o en borrador -- finalizalo antes de crear uno nuevo';
  end if;

  select departamento_id into v_puesto_departamento_id
  from rrhh.puestos
  where id = p_puesto_id and company_id = p_company_id and activo;
  if v_puesto_departamento_id is null then
    raise exception 'Puesto no encontrado, inactivo o de otra empresa';
  end if;

  if not exists (
    select 1 from rrhh.departamentos where id = p_departamento_id and company_id = p_company_id and activo
  ) then
    raise exception 'Departamento no encontrado, inactivo o de otra empresa';
  end if;

  if v_puesto_departamento_id <> p_departamento_id then
    raise exception 'El puesto seleccionado no pertenece al departamento indicado';
  end if;

  if not exists (
    select 1 from rrhh.plantillas_contrato
    where id = p_plantilla_contrato_id and company_id = p_company_id and activo
  ) then
    raise exception 'Plantilla de contrato no encontrada, inactiva o de otra empresa';
  end if;

  if not exists (
    select 1 from rrhh.puesto_plantillas
    where puesto_id = p_puesto_id and plantilla_id = p_plantilla_contrato_id
      and company_id = p_company_id and activo
  ) then
    raise exception 'La plantilla seleccionada no está asignada a este puesto';
  end if;

  insert into rrhh.contratos as c (
    company_id, empleado_id, puesto_id, departamento_id, plantilla_contrato_id,
    modalidad_contrato, fecha_inicio, created_by
  )
  values (
    p_company_id, p_empleado_id, p_puesto_id, p_departamento_id, p_plantilla_contrato_id,
    p_modalidad_contrato, p_fecha_inicio, auth.uid()
  )
  returning c.id, c.numero_contrato into v_contrato_id, v_numero_contrato;

  if coalesce(p_salario_base, 0) <> 0 then
    if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.compensacion.editar') then
      raise exception 'Permiso denegado: rrhh.expedientes.compensacion.editar (requerido para fijar salario)';
    end if;

    insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base, updated_by)
    values (v_contrato_id, p_company_id, p_salario_base, auth.uid());
  end if;

  return query select v_contrato_id, v_numero_contrato, p_plantilla_contrato_id;
end;
$$;

comment on function rrhh.fn_crear_contrato(uuid, uuid, uuid, uuid, uuid, text, date, numeric) is
  '2026-09-17: puesto_id/departamento_id/plantilla_contrato_id obligatorios y validados server-side (mismo tenant, puesto pertenece al departamento, plantilla asignada y activa para el puesto). Sin parametro de fecha_fin_prevista -- un borrador nunca puede nacer con fecha de fin. Rechaza crear un segundo contrato abierto (activo/borrador) para el mismo empleado.';

drop function if exists public.crear_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric);

create function public.crear_contrato(
  p_company_id uuid,
  p_empleado_id uuid,
  p_puesto_id uuid,
  p_departamento_id uuid,
  p_plantilla_contrato_id uuid,
  p_modalidad_contrato text default null,
  p_fecha_inicio date default null,
  p_salario_base numeric default null
)
returns table (contrato_id uuid, numero_contrato bigint, plantilla_contrato_id uuid)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_crear_contrato(
    p_company_id, p_empleado_id, p_puesto_id, p_departamento_id, p_plantilla_contrato_id,
    p_modalidad_contrato, p_fecha_inicio, p_salario_base
  );
$$;

revoke execute on function rrhh.fn_crear_contrato(uuid, uuid, uuid, uuid, uuid, text, date, numeric) from PUBLIC, anon, authenticated;
revoke execute on function public.crear_contrato(uuid, uuid, uuid, uuid, uuid, text, date, numeric) from PUBLIC, anon;
grant execute on function public.crear_contrato(uuid, uuid, uuid, uuid, uuid, text, date, numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. rrhh.fn_editar_contrato / public.editar_contrato: sigue permitiendo
-- edicion parcial (coalesce) de un contrato en borrador -- fecha_fin_prevista
-- SI se puede completar aca (la regla de "no debe existir" es solo al
-- CREAR, ver seccion 6). Cuando puesto/departamento/plantilla cambian
-- (aunque sea uno solo), se revalida la relacion completa contra el estado
-- resultante (no solo el campo que llego), para no poder dejar una
-- combinacion invalida editando de a un campo por vez.
-- -----------------------------------------------------------------------------
drop function if exists rrhh.fn_editar_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric);

create function rrhh.fn_editar_contrato(
  p_contrato_id uuid,
  p_company_id uuid,
  p_puesto_id uuid default null,
  p_departamento_id uuid default null,
  p_plantilla_contrato_id uuid default null,
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
  v_puesto_id uuid;
  v_departamento_id uuid;
  v_plantilla_id uuid;
  v_puesto_departamento_id uuid;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.editar') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.editar';
  end if;

  select estado, puesto_id, departamento_id, plantilla_contrato_id
  into v_estado, v_puesto_id, v_departamento_id, v_plantilla_id
  from rrhh.contratos where id = p_contrato_id and company_id = p_company_id;

  if v_estado is null then
    raise exception 'Contrato no encontrado en esta empresa';
  elsif v_estado <> 'borrador' then
    raise exception 'Solo se puede editar un contrato en estado borrador';
  end if;

  v_puesto_id := coalesce(p_puesto_id, v_puesto_id);
  v_departamento_id := coalesce(p_departamento_id, v_departamento_id);
  v_plantilla_id := coalesce(p_plantilla_contrato_id, v_plantilla_id);

  select departamento_id into v_puesto_departamento_id
  from rrhh.puestos
  where id = v_puesto_id and company_id = p_company_id and activo;
  if v_puesto_departamento_id is null then
    raise exception 'Puesto no encontrado, inactivo o de otra empresa';
  end if;

  if not exists (
    select 1 from rrhh.departamentos where id = v_departamento_id and company_id = p_company_id and activo
  ) then
    raise exception 'Departamento no encontrado, inactivo o de otra empresa';
  end if;

  if v_puesto_departamento_id <> v_departamento_id then
    raise exception 'El puesto seleccionado no pertenece al departamento indicado';
  end if;

  if not exists (
    select 1 from rrhh.plantillas_contrato
    where id = v_plantilla_id and company_id = p_company_id and activo
  ) then
    raise exception 'Plantilla de contrato no encontrada, inactiva o de otra empresa';
  end if;

  if not exists (
    select 1 from rrhh.puesto_plantillas
    where puesto_id = v_puesto_id and plantilla_id = v_plantilla_id
      and company_id = p_company_id and activo
  ) then
    raise exception 'La plantilla seleccionada no está asignada a este puesto';
  end if;

  update rrhh.contratos set
    puesto_id = v_puesto_id,
    departamento_id = v_departamento_id,
    plantilla_contrato_id = v_plantilla_id,
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

comment on function rrhh.fn_editar_contrato(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric) is
  '2026-09-17: agrega plantilla_contrato_id (obligatorio ya en la fila, editable) y revalida puesto/departamento/plantilla contra el estado RESULTANTE (no solo el campo que cambio) en cada edicion. fecha_fin_prevista se sigue pudiendo completar aca -- la restriccion de "no debe existir" es solo al crear (fn_crear_contrato).';

drop function if exists public.editar_contrato(uuid, uuid, uuid, uuid, text, date, date, numeric);

create function public.editar_contrato(
  p_contrato_id uuid,
  p_company_id uuid,
  p_puesto_id uuid default null,
  p_departamento_id uuid default null,
  p_plantilla_contrato_id uuid default null,
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
    p_contrato_id, p_company_id, p_puesto_id, p_departamento_id, p_plantilla_contrato_id,
    p_modalidad_contrato, p_fecha_inicio, p_fecha_fin_prevista, p_salario_base
  );
$$;

revoke execute on function rrhh.fn_editar_contrato(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric) from PUBLIC, anon, authenticated;
revoke execute on function public.editar_contrato(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric) from PUBLIC, anon;
grant execute on function public.editar_contrato(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric) to authenticated;
