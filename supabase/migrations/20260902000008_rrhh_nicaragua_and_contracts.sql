-- =============================================================================
-- Nexo — parametros de ley nicaraguense, modalidad de contrato, y
-- credenciales operativas (nombre_usuario + PIN de kiosko) para el modulo
-- movil de choferes, con bloqueo por intentos fallidos.
--
-- Renombrada de "...007_rrhh_nicaragua_and_contracts.sql" (nombre pedido)
-- a "...008_..." porque 20260902000007 ya existe y esta aplicada (fix de
-- search_path/grant de la sesion anterior) — nunca se reescribe una
-- migracion ya aplicada, ver docs/PERMISSIONS.md "Verificacion Remota
-- Obligatoria".
--
-- Probada completa en una transaccion begin/rollback contra nexo-core
-- antes de escribir este archivo (2026-09-02), incluida la logica de
-- generacion de nombre_usuario con el ejemplo real del enunciado
-- ("Julio Cesar Castillo Canales" -> "jccc" + 2 digitos).
--
-- Gap detectado (mismo patron que kioskos en 20260902000006): la matriz
-- aprobada no tenia codigos de permiso para administrar parametros_ley.
-- Se agregan aqui, dentro de esta misma migracion — ver la nota junto al
-- INSERT correspondiente.
-- =============================================================================

-- =============================================================================
-- 1. rrhh.parametros_ley — valores oficiales de ley, versionados en el
-- tiempo (vigente_desde/vigente_hasta). El motor de planillas SIEMPRE lee
-- de aqui, nunca un porcentaje quemado en codigo — y cuando la ley cambie
-- (ocurre por resolucion del INSS/MITRAB), se inserta una fila nueva con
-- vigente_desde = la fecha del cambio y se cierra la anterior
-- (vigente_hasta), en vez de sobreescribir el valor — asi una planilla
-- historica recalculada usa la tasa que estaba vigente en su periodo, no
-- la actual.
-- =============================================================================
create table rrhh.parametros_ley (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) default rrhh.default_company_id(),
  codigo text not null,                                    -- 'inss_laboral', 'inss_patronal', 'inatec', 'techo_inss'
  unidad text not null check (unidad in ('porcentaje', 'monto')),
  valor numeric(12,4) not null,
  vigente_desde date not null default current_date,
  vigente_hasta date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

comment on table rrhh.parametros_ley is
  'Parametros oficiales de ley (INSS/INATEC) que lee el motor de planillas. Versionado por vigente_desde/vigente_hasta — nunca se sobreescribe un valor historico, se cierra y se inserta uno nuevo.';

-- Solo un valor "activo" (vigente_hasta is null) por codigo por empresa a
-- la vez — evita ambiguedad de "cual es el INSS laboral vigente hoy".
create unique index parametros_ley_activo_unico on rrhh.parametros_ley (company_id, codigo) where vigente_hasta is null;
create index on rrhh.parametros_ley (company_id, codigo);

-- Valores sembrados: porcentajes segun el enunciado (INSS Laboral 7%,
-- INSS Patronal 22.5%, INATEC 2%). El techo INSS es un MONTO en cordobas
-- que la ley nicaraguense ajusta periodicamente por resolucion del INSS —
-- 100000.00 aqui es un VALOR DE EJEMPLO, no verificado como el oficial
-- vigente. AJUSTAR antes de usar en calculo de planillas reales: confirmar
-- el monto oficial actual con el usuario o una fuente oficial del INSS
-- antes de dar este dato por bueno.
insert into rrhh.parametros_ley (codigo, unidad, valor) values
  ('inss_laboral', 'porcentaje', 0.07),
  ('inss_patronal', 'porcentaje', 0.225),
  ('inatec', 'porcentaje', 0.02),
  ('techo_inss', 'monto', 100000.00); -- TODO: confirmar monto oficial vigente antes de produccion

-- =============================================================================
-- 2. Modalidad de contrato (en empleado_compensacion, no en empleados —
-- gobierna como se interpreta salario_base/comisiones, es un atributo de
-- compensacion, no de identidad) + credenciales operativas (en empleados).
-- =============================================================================
alter table rrhh.empleado_compensacion
  add column modalidad_contrato text not null default 'nomina_estandar'
    check (modalidad_contrato in ('nomina_estandar', 'comisionista_destajo'));

comment on column rrhh.empleado_compensacion.modalidad_contrato is
  'Como se calcula la compensacion de este empleado: nomina_estandar (salario_base fijo) o comisionista_destajo (variable, el motor de planillas la trata distinto).';

-- Credenciales operativas: nombre_usuario nuevo, PIN reutiliza pin_hash
-- (ya existe desde 20260902000006 para el kiosko fisico) — el enunciado
-- pide "su PIN de 4 digitos DEL KIOSCO para acceder a su modulo movil":
-- es el MISMO PIN, doble proposito, no una columna nueva. Crear una
-- pin_kiosko_hash separada haria que el chofer tuviera 2 PINs
-- potencialmente distintos para la misma credencial fisica — peor
-- seguridad (2 secretos que sincronizar), no mejor.
alter table rrhh.empleados
  add column nombre_usuario text,
  add column pin_bloqueado boolean not null default false,
  add column intentos_fallidos smallint not null default 0,
  -- auth.users.id real del empleado. Nullable: se vincula cuando se
  -- provisiona la cuenta de acceso (ver nota de Next.js al final del
  -- archivo) — no todo empleado necesita loguearse al modulo movil desde
  -- el dia uno de su alta.
  add column user_id uuid references auth.users(id);

-- Tabla vacia hoy (verificado, 2026-09-02) — set not null seguro sin backfill.
alter table rrhh.empleados alter column nombre_usuario set not null;
alter table rrhh.empleados add constraint empleados_company_nombre_usuario_key unique (company_id, nombre_usuario);
alter table rrhh.empleados add constraint empleados_user_id_key unique (user_id);

comment on column rrhh.empleados.pin_hash is
  'Hash bcrypt del PIN de marcacion/login. Doble proposito desde 20260902000008: rrhh.fn_registrar_marca_kiosko (clock-in fisico) Y rrhh.fn_validar_acceso_operativo (login al modulo movil) validan contra el MISMO hash — es el mismo PIN fisico. Se asigna via rrhh.fn_crear_empleado o rrhh.fn_set_pin_empleado, nunca con un UPDATE directo.';
comment on column rrhh.empleados.nombre_usuario is
  'Usuario corto para el modulo movil (iniciales + 2 digitos, autogenerado por rrhh.fn_crear_empleado o editable a mano). Unico por empresa. Se guarda en minusculas.';

-- =============================================================================
-- rrhh.seguridad_accesos — intentos fallidos de PIN por nombre_usuario.
-- Tabla de hechos (un renglon por intento fallido, para siempre) ->
-- particionada por mes desde el dia 1, mismo criterio que audit_log y
-- asistencia_marcas (docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §2.1).
-- =============================================================================
create table rrhh.seguridad_accesos (
  id uuid not null default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  nombre_usuario text not null,
  -- null si el nombre_usuario ni siquiera existe (intento contra un
  -- usuario inexistente) — igual se registra, es señal de reconocimiento/
  -- fuerza bruta de nombres de usuario.
  empleado_id uuid references rrhh.empleados(id),
  exitoso boolean not null default false,
  ip_origen inet,
  intentado_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (id, intentado_en)
) partition by range (intentado_en);

comment on table rrhh.seguridad_accesos is
  'Intentos fallidos de acceso operativo (nombre_usuario + PIN), insertados por rrhh.fn_validar_acceso_operativo. Solo fallidos, segun lo pedido — no es un log de exitos.';

create or replace function rrhh.fn_asegurar_particion_seguridad_accesos(p_mes date)
returns void
language plpgsql
set search_path = rrhh, pg_temp
as $$
declare
  particion text := 'seguridad_accesos_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'rrhh' and c.relname = particion
  ) then
    execute format(
      'create table rrhh.%I partition of rrhh.seguridad_accesos for values from (%L) to (%L)',
      particion, inicio, fin
    );
    execute format('create index on rrhh.%I (company_id, intentado_en)', particion);
    execute format('create index on rrhh.%I (nombre_usuario, intentado_en)', particion);
    -- RLS habilitado en la particion desde su creacion (fix aprendido en
    -- 20260902000003 — no se repite ese error).
    execute format('alter table rrhh.%I enable row level security', particion);
  end if;
end;
$$;

comment on function rrhh.fn_asegurar_particion_seguridad_accesos is
  'Crea la particion mensual de rrhh.seguridad_accesos si no existe, con RLS habilitado desde su creacion.';

insert into core.tablas_particionadas (schema_nombre, tabla_nombre, fn_asegurar_particion)
values ('rrhh', 'seguridad_accesos', 'rrhh.fn_asegurar_particion_seguridad_accesos')
on conflict do nothing;

-- Particiones iniciales (mes actual + 2 adelante) — tambien re-asegura
-- las de audit_log/asistencia_marcas si hiciera falta, idempotente.
select core.fn_asegurar_particiones_futuras(2);

-- =============================================================================
-- Gap detectado durante el diseno: la matriz aprobada (20260902000005) no
-- incluia codigos de permiso para parametros_ley. Se agregan bajo el
-- dominio "planillas" (el motor de planillas es quien los consume) — ver
-- nota en la respuesta al usuario.
-- =============================================================================
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('rrhh.planillas.parametros.ver',    'rrhh', 'planillas', 'Ver parametros de ley',    'Ver los parametros oficiales de ley usados por el motor de planillas (INSS, INATEC).'),
  ('rrhh.planillas.parametros.editar', 'rrhh', 'planillas', 'Editar parametros de ley', 'Actualizar un parametro oficial de ley (crea una nueva version vigente, no sobreescribe la historica).')
on conflict (code) do nothing;

-- admin: ver + editar. especialista_planillas: solo ver (necesita conocer
-- las tasas para entender el calculo, no para cambiar un valor que fija
-- la ley — mismo criterio de separacion de riesgo ya usado en la matriz
-- aprobada, ej. planilla.anular reservado a admin).
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code from core.app_roles ar
cross join unnest(array['rrhh.planillas.parametros.ver', 'rrhh.planillas.parametros.editar']) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'admin'
on conflict do nothing;

insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code from core.app_roles ar
cross join unnest(array['rrhh.planillas.parametros.ver']) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'especialista_planillas'
on conflict do nothing;

-- =============================================================================
-- RLS
-- =============================================================================
alter table rrhh.parametros_ley enable row level security;

create policy "parametros_ley: ver con permiso" on rrhh.parametros_ley
  for select to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.parametros.ver'));
create policy "parametros_ley: crear con permiso" on rrhh.parametros_ley
  for insert to authenticated
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.parametros.editar'));
create policy "parametros_ley: editar con permiso" on rrhh.parametros_ley
  for update to authenticated
  using (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.parametros.editar'))
  with check (core.has_permission(auth.uid(), company_id, 'rrhh.planillas.parametros.editar'));
-- Sin policy de delete: un parametro de ley no se borra, se cierra
-- (vigente_hasta) y se reemplaza por una fila nueva — trazabilidad legal.

alter table rrhh.seguridad_accesos enable row level security;
-- Sin policy para 'authenticated' a proposito (deny-by-default, mismo
-- criterio que core.audit_log): solo rrhh.fn_validar_acceso_operativo
-- (security definer) escribe aqui, y solo service_role lee por ahora. Ver
-- este mismo empleados.editar mas abajo para el camino de desbloqueo.

-- =============================================================================
-- rrhh.fn_validar_acceso_operativo — security definer, PIN + nombre_usuario
-- como credencial (no auth.uid(): el chofer no tiene sesion todavia, esta
-- funcion ES la que decide si la va a tener). Bloqueo estricto a 3
-- fallos consecutivos, con el mismo mensaje de error para "usuario no
-- existe" y "PIN incorrecto" (evita que alguien enumere nombres de
-- usuario validos por diferencia de respuesta).
--
-- Desbloqueo: no hay un RPC dedicado — un usuario con
-- rrhh.expedientes.empleados.editar ya puede hacer
-- `update rrhh.empleados set pin_bloqueado = false, intentos_fallidos = 0
-- where id = ...`, protegido por la policy de UPDATE de empleados que ya
-- existe (20260902000006). No se duplica esa via con una funcion nueva.
-- =============================================================================
create or replace function rrhh.fn_validar_acceso_operativo(p_nombre_usuario text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = rrhh, extensions, pg_temp
as $$
declare
  v_empleado rrhh.empleados%rowtype;
begin
  select * into v_empleado
  from rrhh.empleados
  where nombre_usuario = lower(trim(p_nombre_usuario)) and estado = 'activo';

  if not found then
    raise exception 'Usuario o PIN invalido';
  end if;

  if v_empleado.pin_bloqueado then
    raise exception 'Acceso bloqueado por intentos fallidos. Contacte a un administrador.';
  end if;

  if v_empleado.pin_hash is null or crypt(p_pin, v_empleado.pin_hash) <> v_empleado.pin_hash then
    insert into rrhh.seguridad_accesos (company_id, nombre_usuario, empleado_id, exitoso)
    values (v_empleado.company_id, v_empleado.nombre_usuario, v_empleado.id, false);

    -- Referencia directa a la columna (no a v_empleado.*): Postgres
    -- evalua esto contra el valor actual de la fila bajo el lock del
    -- UPDATE, atomico frente a intentos concurrentes.
    update rrhh.empleados
      set intentos_fallidos = intentos_fallidos + 1,
          pin_bloqueado = (intentos_fallidos + 1) >= 3
      where id = v_empleado.id;

    raise exception 'Usuario o PIN invalido';
  end if;

  update rrhh.empleados set intentos_fallidos = 0 where id = v_empleado.id;

  if v_empleado.user_id is null then
    raise exception 'Empleado sin cuenta de acceso provisionada. Contacte a un administrador.';
  end if;

  return v_empleado.user_id;
end;
$$;

comment on function rrhh.fn_validar_acceso_operativo is
  'Valida nombre_usuario+PIN de un empleado operativo. Bloquea a los 3 fallos consecutivos (pin_bloqueado). Devuelve auth.users.id — ver la nota de emision de sesion en Next.js al final de este archivo.';

create or replace function public.validar_acceso_operativo(p_nombre_usuario text, p_pin text)
returns uuid
language sql
security definer
set search_path = rrhh, public
as $$
  select rrhh.fn_validar_acceso_operativo(p_nombre_usuario, p_pin);
$$;

comment on function public.validar_acceso_operativo is
  'Wrapper publico de rrhh.fn_validar_acceso_operativo. Callable por anon a proposito (el chofer no tiene sesion todavia) — mismo modelo de auth por credencial que public.registrar_marca_kiosko. Mitigacion de fuerza bruta: bloqueo a 3 fallos (dentro de la funcion) + bcrypt en la comparacion; NO incluye rate-limiting por IP/tiempo (fuera de alcance de SQL puro) — recomendado antes de produccion, ver nota junto a registrar_marca_kiosko en 20260902000006.';

grant execute on function public.validar_acceso_operativo(text, text) to anon, authenticated;

-- =============================================================================
-- rrhh.fn_crear_empleado — alta de empleado con autogeneracion de
-- credenciales. Autenticado (a diferencia de la funcion de arriba):
-- requiere rrhh.expedientes.empleados.crear. Si ademas se manda modalidad
-- de contrato o salario, exige tambien
-- rrhh.expedientes.compensacion.editar por separado — sin este chequeo,
-- un gestor_expedientes (que tiene empleados.crear pero NO
-- compensacion.editar en la matriz aprobada) podria fijar el salario
-- inicial de un empleado nuevo coloandose por esta funcion, algo que la
-- matriz aprobada dice explicitamente que no puede hacer. Es la misma
-- separacion de funciones, aplicada tambien en el alta, no solo en la
-- edicion posterior.
-- =============================================================================
create or replace function rrhh.fn_crear_empleado(
  p_company_id uuid,
  p_nombre text,
  p_apellido text,
  p_nombre_usuario text default null,        -- (c) si se manda, se usa tal cual (validado unico) en vez de autogenerar
  p_pin text default null,                   -- (b) si no se manda, se autogenera un PIN de 4 digitos
  p_documento_identidad text default null,
  p_email text default null,
  p_telefono text default null,
  p_puesto text default null,
  p_departamento text default null,
  p_fecha_ingreso date default current_date,
  p_modalidad_contrato text default null,
  p_salario_base numeric default null
)
returns table (empleado_id uuid, nombre_usuario text, pin_kiosko text)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_iniciales text;
  v_nombre_usuario text;
  v_pin text;
  v_empleado_id uuid;
  v_intento int := 0;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.empleados.crear') then
    raise exception 'Permiso denegado: rrhh.expedientes.empleados.crear';
  end if;

  -- (a)/(c): nombre_usuario explicito gana sobre el autogenerado.
  if p_nombre_usuario is not null and length(trim(p_nombre_usuario)) > 0 then
    v_nombre_usuario := lower(trim(p_nombre_usuario));
    if exists (
      select 1 from rrhh.empleados where company_id = p_company_id and nombre_usuario = v_nombre_usuario
    ) then
      raise exception 'El nombre de usuario % ya esta en uso', v_nombre_usuario;
    end if;
  else
    -- Iniciales de cada palabra del nombre completo (nombre + apellido),
    -- ej. "Julio Cesar" + "Castillo Canales" -> "jccc". Probado contra
    -- este ejemplo exacto antes de guardar el archivo.
    select string_agg(left(palabra, 1), '') into v_iniciales
    from regexp_split_to_table(trim(p_nombre || ' ' || p_apellido), '\s+') as palabra
    where palabra <> '';

    if v_iniciales is null or length(v_iniciales) = 0 then
      raise exception 'No se pudo generar un nombre de usuario a partir de "% %"', p_nombre, p_apellido;
    end if;
    v_iniciales := lower(v_iniciales);

    -- + 2 digitos aleatorios, reintenta si colisiona con uno existente en
    -- la empresa (limite de 25 intentos para no loopear para siempre).
    loop
      v_intento := v_intento + 1;
      v_nombre_usuario := v_iniciales || lpad(floor(random() * 100)::text, 2, '0');
      exit when not exists (
        select 1 from rrhh.empleados where company_id = p_company_id and nombre_usuario = v_nombre_usuario
      );
      if v_intento >= 25 then
        raise exception 'No se pudo generar un nombre de usuario unico para % % tras % intentos, especifique uno manualmente', p_nombre, p_apellido, v_intento;
      end if;
    end loop;
  end if;

  -- (b): PIN explicito (validado 4 digitos) o autogenerado.
  if p_pin is not null and length(trim(p_pin)) > 0 then
    if p_pin !~ '^[0-9]{4}$' then
      raise exception 'El PIN debe ser exactamente 4 digitos numericos';
    end if;
    v_pin := p_pin;
  else
    v_pin := lpad(floor(random() * 10000)::text, 4, '0');
  end if;

  insert into rrhh.empleados (
    company_id, nombre, apellido, documento_identidad, email, telefono,
    puesto, departamento, fecha_ingreso, nombre_usuario, pin_hash
  )
  values (
    p_company_id, p_nombre, p_apellido, p_documento_identidad, p_email, p_telefono,
    p_puesto, p_departamento, p_fecha_ingreso, v_nombre_usuario, crypt(v_pin, gen_salt('bf'))
  )
  returning id into v_empleado_id;

  -- Compensacion: solo si se pidio algo distinto del default, y solo si
  -- el llamador tiene el permiso separado (ver nota arriba de la funcion).
  if p_modalidad_contrato is not null or coalesce(p_salario_base, 0) <> 0 then
    if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.compensacion.editar') then
      raise exception 'Permiso denegado: rrhh.expedientes.compensacion.editar (requerido para fijar salario o modalidad de contrato)';
    end if;

    insert into rrhh.empleado_compensacion (empleado_id, company_id, salario_base, modalidad_contrato, updated_by)
    values (
      v_empleado_id, p_company_id, coalesce(p_salario_base, 0),
      coalesce(p_modalidad_contrato, 'nomina_estandar'), auth.uid()
    );
  end if;

  -- pin_kiosko se devuelve en texto plano UNA SOLA VEZ, aqui — es la
  -- unica oportunidad de mostrarlo (igual que un password temporal). No
  -- se puede recuperar despues: solo reasignar via rrhh.fn_set_pin_empleado.
  return query select v_empleado_id, v_nombre_usuario, v_pin;
end;
$$;

comment on function rrhh.fn_crear_empleado is
  'Alta de empleado con autogeneracion de nombre_usuario (iniciales+2 digitos) y PIN (4 digitos) si no se proveen. Devuelve el PIN en texto plano UNA sola vez (no recuperable despues). Gateada por empleados.crear; compensacion.editar aparte si se fija salario/modalidad.';

create or replace function public.crear_empleado(
  p_company_id uuid,
  p_nombre text,
  p_apellido text,
  p_nombre_usuario text default null,
  p_pin text default null,
  p_documento_identidad text default null,
  p_email text default null,
  p_telefono text default null,
  p_puesto text default null,
  p_departamento text default null,
  p_fecha_ingreso date default current_date,
  p_modalidad_contrato text default null,
  p_salario_base numeric default null
)
returns table (empleado_id uuid, nombre_usuario text, pin_kiosko text)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_crear_empleado(
    p_company_id, p_nombre, p_apellido, p_nombre_usuario, p_pin,
    p_documento_identidad, p_email, p_telefono, p_puesto, p_departamento,
    p_fecha_ingreso, p_modalidad_contrato, p_salario_base
  );
$$;

comment on function public.crear_empleado is
  'Wrapper publico de rrhh.fn_crear_empleado. Solo authenticated (revocado de PUBLIC/anon) — a diferencia de validar_acceso_operativo, esta si requiere sesion real y permiso.';

-- Igual que set_pin_empleado (20260902000007): revocar de PUBLIC, no solo
-- de anon, porque Postgres otorga EXECUTE a PUBLIC por defecto al crear
-- la funcion.
revoke execute on function public.crear_empleado(
  uuid, text, text, text, text, text, text, text, text, text, date, text, numeric
) from public;
grant execute on function public.crear_empleado(
  uuid, text, text, text, text, text, text, text, text, text, date, text, numeric
) to authenticated;

-- =============================================================================
-- NOTA PARA EL FRONTEND (Next.js Server Actions) — NO se genera codigo
-- todavia, solo el contrato de como se va a usar esto sin romper
-- auth.users:
--
-- rrhh.fn_validar_acceso_operativo devuelve un auth.users.id real, pero
-- esta migracion NO inserta filas en auth.users (esa tabla la administra
-- GoTrue: password hashing, auth.identities, triggers internos — escribir
-- ahi directo por SQL crudo es fragil entre versiones y va contra la
-- forma soportada de Supabase). Por eso rrhh.empleados.user_id es
-- NULLABLE: un empleado puede existir en rrhh.empleados sin tener todavia
-- una cuenta de auth.users vinculada.
--
-- Flujo esperado (a implementar en Next.js cuando se apruebe):
--   1. Alta del empleado: Server Action llama a rrhh.fn_crear_empleado
--      (RPC), recibe { empleado_id, nombre_usuario, pin_kiosko }.
--   2. Provision de la cuenta de acceso: la MISMA Server Action, con el
--      cliente admin (SUPABASE_SERVICE_ROLE_KEY, nunca en el navegador),
--      llama a supabase.auth.admin.createUser({
--        email: `${nombre_usuario}@kiosko.internal`,  // email dummy, nunca se usa para enviar correo
--        email_confirm: true,
--        password: <aleatorio, descartado, nadie lo necesita>,
--        user_metadata: { empleado_id, nombre_usuario, tipo: "operativo" },
--      }) y guarda el user_id devuelto en rrhh.empleados.user_id (un
--      UPDATE simple, protegido por la policy de empleados.editar ya
--      existente).
--   3. Login del chofer: Server Action recibe { nombre_usuario, pin } del
--      formulario del modulo movil, llama a rrhh.fn_validar_acceso_operativo
--      via RPC (con el cliente anon, no hace falta sesion previa). Si
--      devuelve un uuid, ese ES el user_id real.
--   4. Emitir sesion sin exponer password: con ese user_id, la Server
--      Action usa el cliente admin para generar un magic link
--      (supabase.auth.admin.generateLink({ type: "magiclink", email:
--      `${nombre_usuario}@kiosko.internal` })) y hace exchangeCodeForSession
--      con el token embebido — o, alternativa mas directa, firma un JWT
--      compatible con Supabase Auth (mismo JWT_SECRET del proyecto, claims
--      sub=user_id, role="authenticated", aud="authenticated") y lo setea
--      con supabase.auth.setSession(). Cualquiera de las dos deja al
--      chofer con una sesion real de Supabase Auth — RLS, has_permission,
--      todo el resto de la suite lo ve como un usuario autenticado normal,
--      sin haber tocado auth.users por SQL crudo.
--   5. auth.users nunca se modifica desde esta migracion ni desde
--      rrhh.fn_validar_acceso_operativo — la unica escritura a auth.users
--      en todo este flujo pasa por el Admin SDK oficial (paso 2), nunca
--      por INSERT/UPDATE directo.
-- =============================================================================
