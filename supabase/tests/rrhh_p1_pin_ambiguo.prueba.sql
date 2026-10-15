-- =============================================================================
-- Prueba automática de P1 (issue #30): rechazo del PIN ambiguo, fallo cerrado.
--
-- Se ejecuta sobre un PostgreSQL donde exista el schema `rrhh` con
-- rrhh.fn_registrar_marca_kiosko ya migrada (ver supabase/tests/README.md).
-- Crea sus propias empresas/empleados/contratos/credenciales de prueba con
-- UUIDs fijos y **siempre termina en ROLLBACK**: no persiste nada.
--
-- Requiere `crypt(text, text)` accesible (pgcrypto real, o el sustituto
-- determinista que crea supabase/tests/rrhh_p1_pin_ambiguo_entorno.sql cuando
-- la plataforma no trae pgcrypto). Sin pgcrypto no se puede comparar ningún
-- PIN y la prueba no tiene sentido.
--
-- Cubre, en orden:
--   C1  cero coincidencias (PIN inexistente)          -> sin marca
--   C2  una coincidencia (PIN único)                  -> marca normal
--   C3  secuencia normal en la segunda marca          -> salida
--   C4  dos coincidencias vigentes de la misma empresa-> SIN marca (P1)
--   C5  reintento del mismo PIN ambiguo               -> SIN marca, mismo resultado
--   C6  misma colisión desde un kiosco de otra empresa-> marca para su propia empresa
--   C7  credencial revocada (activo = false)          -> sin marca
--   C8  contrato finalizado                           -> sin marca
--   C9  credencial con pin_bloqueado                  -> sin marca
--   C10 kiosco inactivo                               -> sin marca
--   C11 la función no devuelve columnas de identidad
--   C12 el límite de intentos sigue vigente y falla cerrado durante el bloqueo
--   C13 `anon` no puede llamar la función interna: solo el wrapper público
-- =============================================================================

begin;

create function pg_temp.verificar(p_ok boolean, p_que text)
returns void
language plpgsql
as $$
begin
  if p_ok is not true then
    raise exception 'FALLO P1: %', p_que;
  end if;
  raise notice 'ok: %', p_que;
end
$$;

create function pg_temp.hash_pin(p_pin text)
returns text
language sql
as $$
  select extensions.crypt(p_pin, extensions.gen_salt('bf'));
$$;

-- ---------------------------------------------------------------------------
-- Datos de prueba
-- ---------------------------------------------------------------------------
insert into core.companies (id, nombre) values
  ('a0000000-0000-4000-8000-00000000000a', 'Empresa A (prueba P1)'),
  ('b0000000-0000-4000-8000-00000000000b', 'Empresa B (prueba P1)');

insert into rrhh.kiosko_dispositivos (id, company_id, nombre, activo) values
  ('a1000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-00000000000a', 'Kiosco A activo', true),
  ('b1000000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-00000000000b', 'Kiosco B activo', true),
  ('a2000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-00000000000a', 'Kiosco A inactivo', false);

insert into rrhh.empleados (id, company_id, nombre, apellido, documento_identidad) values
  ('a0000001-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'Ana', 'Uno', 'A-001'),
  ('a0000001-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', 'Beto', 'Dos', 'A-002'),
  ('a0000001-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', 'Carla', 'Tres', 'A-003'),
  ('a0000001-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-00000000000a', 'David', 'Cuatro', 'A-004'),
  ('a0000001-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-00000000000a', 'Elena', 'Cinco', 'A-005'),
  ('a0000001-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-00000000000a', 'Fátima', 'Seis', 'A-006'),
  ('b0000001-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', 'Gloria', 'Siete', 'B-001');

-- f1  Ana     empresa A, activo      -> credencial vigente PIN 1111 (único)
-- f2  Beto    empresa A, activo      -> credencial vigente PIN 2222 \
-- f3  Carla   empresa A, activo      -> credencial vigente PIN 2222 / colisión
-- f4  David   empresa A, activo      -> credencial REVOCADA PIN 4444
-- f5  Elena   empresa A, finalizado  -> credencial vigente PIN 5555
-- f6  Fátima  empresa A, activo      -> credencial BLOQUEADA PIN 6666
-- f7  Gloria  empresa B, activo      -> credencial vigente PIN 2222 (misma cifra, otra empresa)
insert into rrhh.contratos (id, company_id, empleado_id, estado) values
  ('f0000001-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000001', 'activo'),
  ('f0000001-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', 'activo'),
  ('f0000001-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000003', 'activo'),
  ('f0000001-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000004', 'activo'),
  ('f0000001-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000005', 'finalizado'),
  ('f0000001-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000006', 'activo'),
  ('f1000001-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-00000000000b', 'b0000001-0000-4000-8000-000000000001', 'activo');

insert into rrhh.contrato_credenciales
  (company_id, contrato_id, pin_hash, activo, pin_bloqueado, revocado_at) values
  ('a0000000-0000-4000-8000-00000000000a', 'f0000001-0000-4000-8000-000000000001', pg_temp.hash_pin('1111'), true,  false, null),
  ('a0000000-0000-4000-8000-00000000000a', 'f0000001-0000-4000-8000-000000000002', pg_temp.hash_pin('2222'), true,  false, null),
  ('a0000000-0000-4000-8000-00000000000a', 'f0000001-0000-4000-8000-000000000003', pg_temp.hash_pin('2222'), true,  false, null),
  ('a0000000-0000-4000-8000-00000000000a', 'f0000001-0000-4000-8000-000000000004', pg_temp.hash_pin('4444'), false, false, now()),
  ('a0000000-0000-4000-8000-00000000000a', 'f0000001-0000-4000-8000-000000000005', pg_temp.hash_pin('5555'), true,  false, null),
  ('a0000000-0000-4000-8000-00000000000a', 'f0000001-0000-4000-8000-000000000006', pg_temp.hash_pin('6666'), true,  true,  null),
  ('b0000000-0000-4000-8000-00000000000b', 'f1000001-0000-4000-8000-0000000000b1', pg_temp.hash_pin('2222'), true,  false, null);

-- ---------------------------------------------------------------------------
-- C1 — cero coincidencias: mismo camino que siempre (sin marca, cuenta intento)
-- ---------------------------------------------------------------------------
do $$
declare
  v_filas integer;
  v_intentos smallint;
begin
  select count(*) into v_filas
  from public.registrar_marca_kiosko('9999', 'a1000000-0000-4000-8000-0000000000a1');
  perform pg_temp.verificar(v_filas = 0, 'C1: un PIN que no existe devuelve cero filas');
  perform pg_temp.verificar(
    (select count(*) from rrhh.asistencia_marcas) = 0,
    'C1: un PIN que no existe no inserta ninguna marca');

  select intentos_en_ventana into v_intentos
  from rrhh.kiosko_rate_limits
  where kiosko_id = 'a1000000-0000-4000-8000-0000000000a1';
  perform pg_temp.verificar(v_intentos = 1, 'C1: el PIN inexistente cuenta como intento fallido del kiosco');
end
$$;

-- ---------------------------------------------------------------------------
-- C2 y C3 — una coincidencia: comportamiento normal (entrada y luego salida)
-- ---------------------------------------------------------------------------
do $$
declare
  v_filas integer;
  v_tipo text;
begin
  select count(*), max(tipo) into v_filas, v_tipo
  from public.registrar_marca_kiosko('1111', 'a1000000-0000-4000-8000-0000000000a1');
  perform pg_temp.verificar(v_filas = 1 and v_tipo = 'entrada', 'C2: un PIN único marca entrada normalmente');
  perform pg_temp.verificar(
    (select count(*) from rrhh.asistencia_marcas
      where empleado_id = 'a0000001-0000-4000-8000-000000000001') = 1,
    'C2: la marca queda en el empleado dueño del PIN');
  perform pg_temp.verificar(
    (select intentos_en_ventana from rrhh.kiosko_rate_limits
      where kiosko_id = 'a1000000-0000-4000-8000-0000000000a1') = 0,
    'C2: un PIN válido limpia el contador de intentos');
end
$$;

do $$
declare
  v_filas integer;
  v_tipo text;
begin
  select count(*), max(tipo) into v_filas, v_tipo
  from public.registrar_marca_kiosko('1111', 'a1000000-0000-4000-8000-0000000000a1');
  perform pg_temp.verificar(v_filas = 1 and v_tipo = 'salida', 'C3: la segunda marca del PIN único es salida');
end
$$;

-- ---------------------------------------------------------------------------
-- C4 y C5 — dos credenciales vigentes de la misma empresa con el mismo PIN
-- ---------------------------------------------------------------------------
do $$
declare
  v_antes integer;
  v_filas integer;
  v_despues integer;
  v_intentos smallint;
begin
  select count(*) into v_antes from rrhh.asistencia_marcas;

  select count(*) into v_filas
  from public.registrar_marca_kiosko('2222', 'a1000000-0000-4000-8000-0000000000a1');
  perform pg_temp.verificar(v_filas = 0, 'C4: un PIN ambiguo devuelve cero filas (fallo cerrado)');

  select count(*) into v_despues from rrhh.asistencia_marcas;
  perform pg_temp.verificar(v_despues = v_antes, 'C4: un PIN ambiguo no inserta ninguna marca');
  perform pg_temp.verificar(
    (select count(*) from rrhh.asistencia_marcas
      where empleado_id in ('a0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000003')) = 0,
    'C4: ninguna de las dos credenciales en conflicto recibe la marca');

  select intentos_en_ventana into v_intentos
  from rrhh.kiosko_rate_limits
  where kiosko_id = 'a1000000-0000-4000-8000-0000000000a1';
  perform pg_temp.verificar(v_intentos = 1, 'C4: el PIN ambiguo consume el mismo intento que un PIN inválido');

  -- C5: reintento del mismo envío ambiguo -> mismo resultado, ninguna marca
  select count(*) into v_filas
  from public.registrar_marca_kiosko('2222', 'a1000000-0000-4000-8000-0000000000a1');
  perform pg_temp.verificar(v_filas = 0, 'C5: reintentar el PIN ambiguo tampoco devuelve filas');
  perform pg_temp.verificar(
    (select count(*) from rrhh.asistencia_marcas) = v_antes,
    'C5: reintentar el PIN ambiguo tampoco inserta marcas');
end
$$;

-- ---------------------------------------------------------------------------
-- C6 — aislamiento por empresa: la misma cifra es única en la otra empresa
-- ---------------------------------------------------------------------------
do $$
declare
  v_filas integer;
  v_tipo text;
begin
  select count(*), max(tipo) into v_filas, v_tipo
  from public.registrar_marca_kiosko('2222', 'b1000000-0000-4000-8000-0000000000b1');
  perform pg_temp.verificar(v_filas = 1 and v_tipo = 'entrada',
    'C6: en la empresa B el mismo PIN es único y marca normalmente');
  perform pg_temp.verificar(
    (select count(*) from rrhh.asistencia_marcas
      where empleado_id = 'b0000001-0000-4000-8000-000000000001') = 1,
    'C6: la marca de la empresa B queda en su propio empleado');
  perform pg_temp.verificar(
    (select count(*) from rrhh.asistencia_marcas
      where empleado_id in ('a0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000003')) = 0,
    'C6: el kiosco de la empresa B no alcanza credenciales de la empresa A');
end
$$;

-- ---------------------------------------------------------------------------
-- C7 a C10 — solo cuentan las credenciales VIGENTES de un kiosco activo
-- ---------------------------------------------------------------------------
do $$
declare
  v_filas integer;
  v_antes integer;
begin
  select count(*) into v_antes from rrhh.asistencia_marcas;

  select count(*) into v_filas
  from public.registrar_marca_kiosko('4444', 'a1000000-0000-4000-8000-0000000000a1');
  perform pg_temp.verificar(v_filas = 0, 'C7: una credencial revocada no marca');

  select count(*) into v_filas
  from public.registrar_marca_kiosko('5555', 'a1000000-0000-4000-8000-0000000000a1');
  perform pg_temp.verificar(v_filas = 0, 'C8: una credencial de contrato finalizado no marca');

  select count(*) into v_filas
  from public.registrar_marca_kiosko('6666', 'a1000000-0000-4000-8000-0000000000a1');
  perform pg_temp.verificar(v_filas = 0, 'C9: una credencial bloqueada no marca');

  select count(*) into v_filas
  from public.registrar_marca_kiosko('1111', 'a2000000-0000-4000-8000-0000000000a2');
  perform pg_temp.verificar(v_filas = 0, 'C10: un kiosco inactivo no marca');

  perform pg_temp.verificar(
    (select count(*) from rrhh.asistencia_marcas) = v_antes,
    'C7-C10: ninguno de esos cuatro casos inserta marcas');
end
$$;

-- ---------------------------------------------------------------------------
-- C11 — la función no expone ninguna columna de identidad
-- ---------------------------------------------------------------------------
do $$
declare
  v_resultado text;
begin
  select pg_get_function_result('rrhh.fn_registrar_marca_kiosko(text,uuid)'::regprocedure)
    into v_resultado;
  perform pg_temp.verificar(
    position('empleado' in v_resultado) = 0
      and position('nombre' in v_resultado) = 0
      and position('contrato' in v_resultado) = 0
      and position('pin' in v_resultado) = 0,
    'C11: el retorno de la función interna sigue siendo solo (tipo, marcado_en): ' || v_resultado);

  select pg_get_function_result('public.registrar_marca_kiosko(text,uuid)'::regprocedure)
    into v_resultado;
  perform pg_temp.verificar(
    position('empleado' in v_resultado) = 0
      and position('nombre' in v_resultado) = 0
      and position('contrato' in v_resultado) = 0,
    'C11: el wrapper anónimo tampoco expone identidad: ' || v_resultado);
end
$$;

-- ---------------------------------------------------------------------------
-- C12 — el límite de intentos sigue vigente y el bloqueo también falla cerrado
-- ---------------------------------------------------------------------------
do $$
declare
  i integer;
  v_filas integer;
  v_antes integer;
  v_bloqueo timestamptz;
begin
  select count(*) into v_antes from rrhh.asistencia_marcas;

  update rrhh.kiosko_rate_limits
    set intentos_en_ventana = 0, window_started_at = now(), bloqueado_hasta = null
  where kiosko_id = 'a1000000-0000-4000-8000-0000000000a1';

  for i in 1..8 loop
    perform count(*) from public.registrar_marca_kiosko('2222', 'a1000000-0000-4000-8000-0000000000a1');
  end loop;

  select bloqueado_hasta into v_bloqueo
  from rrhh.kiosko_rate_limits
  where kiosko_id = 'a1000000-0000-4000-8000-0000000000a1';
  perform pg_temp.verificar(v_bloqueo is not null and v_bloqueo > now(),
    'C12: 8 intentos ambiguos consecutivos bloquean el kiosco 5 minutos');

  select count(*) into v_filas
  from public.registrar_marca_kiosko('1111', 'a1000000-0000-4000-8000-0000000000a1');
  perform pg_temp.verificar(v_filas = 0, 'C12: durante el bloqueo ni siquiera un PIN válido marca');
  perform pg_temp.verificar(
    (select count(*) from rrhh.asistencia_marcas) = v_antes,
    'C12: durante el bloqueo no se inserta ninguna marca');
end
$$;

-- ---------------------------------------------------------------------------
-- C13 — `anon` no puede llamar la función interna; el wrapper público sí
-- ---------------------------------------------------------------------------
do $$
declare
  v_filas integer;
begin
  -- C12 dejó el kiosco bloqueado a propósito; se limpia para poder comprobar
  -- el camino anónimo normal (la limpieza es parte del andamiaje, no del SUT).
  update rrhh.kiosko_rate_limits
    set intentos_en_ventana = 0, window_started_at = now(), bloqueado_hasta = null
  where kiosko_id = 'a1000000-0000-4000-8000-0000000000a1';

  set local role anon;

  begin
    perform count(*) from rrhh.fn_registrar_marca_kiosko('1111', 'a1000000-0000-4000-8000-0000000000a1');
    raise exception 'FALLO P1: anon pudo llamar la función interna directamente';
  exception
    when insufficient_privilege then
      raise notice 'ok: C13: anon no tiene EXECUTE sobre rrhh.fn_registrar_marca_kiosko';
  end;

  select count(*) into v_filas
  from public.registrar_marca_kiosko('1111', 'a1000000-0000-4000-8000-0000000000a1');
  perform pg_temp.verificar(v_filas = 1, 'C13: el wrapper público sigue siendo el camino anónimo válido');

  reset role;
end
$$;

-- Nada de esto se persiste: la prueba siempre se revierte.
rollback;

do $$ begin raise notice 'P1: todas las comprobaciones pasaron (C1-C13).'; end $$;
