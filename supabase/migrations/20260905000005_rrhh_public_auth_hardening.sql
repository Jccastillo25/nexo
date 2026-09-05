-- =============================================================================
-- Nexo — endurecimiento final del kiosko y del acceso operativo (RRHH),
-- previo a llevar la rama security/rrhh-audit-hardening a produccion.
--
-- Diseño especificado integramente por el usuario (validado localmente en
-- otra maquina, no accesible desde esta sesion) y reconstruido aqui
-- exactamente segun esa especificacion — no es un diseño propio de esta
-- sesion. Pendiente de la misma validacion local (Docker) que
-- 20260905000001-004 antes de aplicarse a nexo-core; ver
-- docs/SECURITY_VALIDATION_HANDOFF.md.
--
-- Cubre dos problemas reales, distintos:
--   1. El limite de fuerza bruta del kiosko fisico vivia solo en un Map en
--      memoria de una Server Action de Next.js (apps/rrhh/.../kiosco/actions.ts)
--      — se resetea en cada cold start, no se comparte entre instancias
--      serverless, y no protege una llamada RPC directa que se salte la
--      Server Action por completo. Se agrega rrhh.kiosko_rate_limits, un
--      limite persistente en Postgres: 8 PINes fallidos por kiosko en 1
--      minuto -> bloqueo de 5 minutos, sin guardar ningun dato personal.
--   2. rrhh.fn_validar_acceso_operativo (y, por simetria de diseño,
--      rrhh.fn_registrar_marca_kiosko) usaban `raise exception` para
--      rechazar un intento DESPUES de haber hecho un INSERT en
--      rrhh.seguridad_accesos y un UPDATE de intentos_fallidos/pin_bloqueado
--      en el mismo bloque. Una excepcion no atrapada aborta la transaccion
--      completa del statement que la genero — cuando esta funcion se llama
--      como una unica sentencia RPC (el caso real, via PostgREST), la
--      excepcion revierte tambien el INSERT/UPDATE que la precedian. En la
--      practica, el candado de "bloquear al 3er fallo" nunca llegaba a
--      persistir. Se corrige devolviendo NULL/cero filas en vez de
--      levantar excepcion, dejando los efectos (el registro del intento
--      fallido, el incremento del contador) confirmados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. rrhh.kiosko_rate_limits — una fila por kiosko (no es tabla de hechos,
-- no se particiona). Sin PINes, nombres, empleados ni IPs: solo el estado
-- minimo necesario para decidir si un kiosko esta temporalmente bloqueado.
-- -----------------------------------------------------------------------------
create table rrhh.kiosko_rate_limits (
  kiosko_id uuid primary key references rrhh.kiosko_dispositivos(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  intentos_en_ventana smallint not null default 0 check (intentos_en_ventana >= 0),
  bloqueado_hasta timestamptz,
  updated_at timestamptz not null default now()
);

comment on table rrhh.kiosko_rate_limits is
  'Limite de fuerza bruta persistente para el kiosko fisico: 8 PINes invalidos en 1 minuto bloquea el kiosko 5 minutos. Una fila por kiosko, sin datos personales (ni PIN, ni nombre, ni empleado, ni IP). RLS habilitado sin policies -- solo la lee/escribe rrhh.fn_registrar_marca_kiosko (SECURITY DEFINER, corre como su dueño). Reemplaza al Map en memoria de apps/rrhh/src/app/kiosco/actions.ts como defensa autoritativa; ese Map queda como freno temprano por IP a nivel de Server Action, no protege una llamada RPC directa.';

alter table rrhh.kiosko_rate_limits enable row level security;
-- Sin policies a proposito (deny-by-default, mismo criterio que
-- rrhh.seguridad_accesos): ningun cliente necesita leer ni escribir esta
-- tabla directo, solo la funcion SECURITY DEFINER de abajo.

revoke all on table rrhh.kiosko_rate_limits from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. rrhh.fn_registrar_marca_kiosko — mismo return type que desde
-- 20260905000002 (tipo, marcado_en), CREATE OR REPLACE alcanza (no cambia
-- el tipo de retorno esta vez). Reescribe la logica para:
--   - validar formato de PIN (4 digitos) antes de tocar bcrypt;
--   - aplicar el limite persistente de rrhh.kiosko_rate_limits, atomico
--     por kiosko via SELECT ... FOR UPDATE;
--   - rechazar sin RAISE EXCEPTION (asi los UPDATE al contador/bloqueo
--     quedan confirmados) -- un rechazo es RETURN, cero filas;
--   - seguir sin devolver ningun dato personal del empleado.
-- -----------------------------------------------------------------------------
create or replace function rrhh.fn_registrar_marca_kiosko(p_pin text, p_kiosko_id uuid)
returns table (tipo text, marcado_en timestamptz)
language plpgsql
security definer
set search_path = rrhh, extensions, pg_temp
as $$
declare
  v_kiosko rrhh.kiosko_dispositivos%rowtype;
  v_empleado rrhh.empleados%rowtype;
  v_rl rrhh.kiosko_rate_limits%rowtype;
  v_ultimo_tipo text;
  v_tipo text;
  v_ahora timestamptz := now();
  v_marcado_en timestamptz;
begin
  -- Formato de PIN antes que nada: evita gastar un ciclo de bcrypt (y
  -- contar como intento fallido) por una entrada que ni siquiera tiene
  -- forma de PIN.
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return;
  end if;

  select * into v_kiosko from rrhh.kiosko_dispositivos where id = p_kiosko_id;
  if not found or not v_kiosko.activo then
    return;
  end if;

  -- Asegura la fila de rate-limit de este kiosko (idempotente) y la
  -- bloquea para que la decision de contar/no contar este intento sea
  -- atomica frente a llamadas concurrentes del mismo kiosko.
  insert into rrhh.kiosko_rate_limits (kiosko_id) values (p_kiosko_id)
    on conflict (kiosko_id) do nothing;

  select * into v_rl from rrhh.kiosko_rate_limits where kiosko_id = p_kiosko_id for update;

  -- El bloqueo de 5 minutos SIEMPRE prevalece sobre el reinicio de la
  -- ventana de 1 minuto: se chequea primero y, si sigue vigente, se
  -- rechaza de inmediato sin tocar la ventana ni el contador. Nunca se
  -- borra bloqueado_hasta mientras siga en el futuro (fix 2026-09-05:
  -- antes, el reinicio de ventana corria primero y podia cortar un
  -- bloqueo de 5 minutos a los pocos segundos de fijado).
  if v_rl.bloqueado_hasta is not null and v_rl.bloqueado_hasta > v_ahora then
    return;
  end if;

  -- Sin bloqueo vigente: recien aca tiene sentido evaluar si la ventana
  -- de 1 minuto vencio. Si vencio, reinicia contador, ventana, y limpia
  -- cualquier bloqueo ya expirado (bloqueado_hasta null o en el pasado —
  -- nunca uno futuro, eso ya se descarto arriba).
  if v_ahora - v_rl.window_started_at > interval '1 minute' then
    update rrhh.kiosko_rate_limits
      set window_started_at = v_ahora,
          intentos_en_ventana = 0,
          bloqueado_hasta = null,
          updated_at = v_ahora
      where kiosko_id = p_kiosko_id
      returning * into v_rl;
  end if;

  select * into v_empleado
  from rrhh.empleados
  where company_id = v_kiosko.company_id
    and estado = 'activo'
    and pin_hash is not null
    and not pin_bloqueado
    and crypt(p_pin, pin_hash) = pin_hash
  limit 1;

  if not found then
    -- PIN invalido (incluye: no existe, o existe pero pin_bloqueado --
    -- mismo mensaje/comportamiento a proposito, anti-enumeracion). Cuenta
    -- como intento fallido para el rate-limit del kiosko.
    update rrhh.kiosko_rate_limits
      set intentos_en_ventana = intentos_en_ventana + 1,
          bloqueado_hasta = case
            when intentos_en_ventana + 1 >= 8 then v_ahora + interval '5 minutes'
            else bloqueado_hasta
          end,
          updated_at = v_ahora
      where kiosko_id = p_kiosko_id;

    return;
  end if;

  -- PIN correcto: limpia contador y bloqueo tecnico del kiosko antes de
  -- registrar la marca.
  update rrhh.kiosko_rate_limits
    set intentos_en_ventana = 0,
        bloqueado_hasta = null,
        updated_at = v_ahora
    where kiosko_id = p_kiosko_id;

  select am.tipo into v_ultimo_tipo
  from rrhh.asistencia_marcas am
  where am.empleado_id = v_empleado.id
  order by am.marcado_en desc
  limit 1;

  v_tipo := case when v_ultimo_tipo = 'entrada' then 'salida' else 'entrada' end;
  v_marcado_en := v_ahora;

  insert into rrhh.asistencia_marcas (company_id, empleado_id, kiosko_id, tipo, marcado_en, origen)
  values (v_kiosko.company_id, v_empleado.id, p_kiosko_id, v_tipo, v_marcado_en, 'kiosko');

  -- Sin datos personales del empleado en el retorno (sin cambios desde
  -- 20260905000002).
  return query select v_tipo, v_marcado_en;
end;
$$;

comment on function rrhh.fn_registrar_marca_kiosko is
  'Registra entrada/salida desde un kiosko fisico. Auth por PIN+kiosko_id, no por auth.uid(). Rechaza PIN con formato invalido, kiosko inexistente/inactivo, empleado bloqueado, kiosko con rate-limit activo (8 fallos/1min -> 5min de bloqueo, ver rrhh.kiosko_rate_limits) o PIN incorrecto -- todos con el mismo comportamiento generico (sin RAISE EXCEPTION: los UPDATE al contador quedan confirmados). No devuelve datos personales del empleado.';

-- Sin GRANT a nadie sobre la funcion interna: la vuelve a otorgar
-- explicitamente el bloque de revokes/grants mas abajo, junto con
-- fn_validar_acceso_operativo, para que ambas queden documentadas en un
-- solo lugar.

-- -----------------------------------------------------------------------------
-- 3. rrhh.fn_validar_acceso_operativo — mismo return type (uuid), CREATE
-- OR REPLACE alcanza. Corrige el bug de RAISE EXCEPTION post-escritura
-- descrito en la cabecera: un rechazo ahora es `return null`, nunca una
-- excepcion despues de haber insertado en seguridad_accesos o actualizado
-- intentos_fallidos/pin_bloqueado.
-- -----------------------------------------------------------------------------
create or replace function rrhh.fn_validar_acceso_operativo(p_nombre_usuario text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = rrhh, extensions, pg_temp
as $$
declare
  v_empleado rrhh.empleados%rowtype;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return null;
  end if;

  select * into v_empleado
  from rrhh.empleados
  where nombre_usuario = lower(trim(p_nombre_usuario)) and estado = 'activo';

  if not found then
    return null;
  end if;

  if v_empleado.pin_bloqueado then
    return null;
  end if;

  if v_empleado.pin_hash is null or crypt(p_pin, v_empleado.pin_hash) <> v_empleado.pin_hash then
    -- PIN incorrecto de un empleado que SI existe: registra el fallo y
    -- bloquea al 3er intento consecutivo. Sin RAISE despues de esto -- si
    -- se levantara una excepcion aca, este INSERT/UPDATE se revertirian
    -- (ver nota de la cabecera) y el candado nunca persistiria.
    insert into rrhh.seguridad_accesos (company_id, nombre_usuario, empleado_id, exitoso)
    values (v_empleado.company_id, v_empleado.nombre_usuario, v_empleado.id, false);

    update rrhh.empleados
      set intentos_fallidos = intentos_fallidos + 1,
          pin_bloqueado = (intentos_fallidos + 1) >= 3
      where id = v_empleado.id;

    return null;
  end if;

  if v_empleado.user_id is null then
    -- PIN correcto pero sin cuenta de acceso provisionada todavia: no es
    -- un fallo de credencial (no se registra en seguridad_accesos ni se
    -- toca el contador), pero tampoco hay sesion que emitir.
    return null;
  end if;

  -- Autenticacion completa: recien aca se resetea el contador de fallos.
  update rrhh.empleados set intentos_fallidos = 0 where id = v_empleado.id;

  return v_empleado.user_id;
end;
$$;

comment on function rrhh.fn_validar_acceso_operativo is
  'Valida nombre_usuario+PIN de un empleado operativo. Bloquea a los 3 fallos consecutivos (pin_bloqueado). Devuelve NULL para usuario inexistente, PIN incorrecto, cuenta bloqueada o sin user_id provisionado -- mismo comportamiento generico, sin RAISE EXCEPTION (ver nota de la cabecera de esta migracion). Devuelve auth.users.id solo en autenticacion completa.';

-- -----------------------------------------------------------------------------
-- 4. Cierre de privilegios — funciones internas del schema rrhh sin
-- EXECUTE para nadie mas que su dueño (postgres); los wrappers en
-- `public` son el UNICO camino de entrada, y siguen funcionando igual: un
-- wrapper SECURITY DEFINER invoca la funcion interna en su cuerpo SQL con
-- los privilegios de su DUEÑO, no del caller original -- el GRANT/REVOKE
-- de la funcion interna nunca afecto ni afecta esa invocacion (mismo
-- razonamiento ya aplicado a fn_crear_empleado/fn_set_pin_empleado en
-- 20260905000004).
-- -----------------------------------------------------------------------------
revoke execute on function rrhh.fn_registrar_marca_kiosko(text, uuid) from public, anon, authenticated;
revoke execute on function rrhh.fn_validar_acceso_operativo(text, text) from public, anon, authenticated;

-- Wrappers publicos: unico camino anonimo que debe quedar en pie.
-- search_path = rrhh, pg_temp (sin `public`) -- el cuerpo solo llama a la
-- funcion interna, totalmente calificada, no necesita `public` en la ruta.
create or replace function public.registrar_marca_kiosko(p_pin text, p_kiosko_id uuid)
returns table (tipo text, marcado_en timestamptz)
language sql
security definer
set search_path = rrhh, pg_temp
as $$
  select * from rrhh.fn_registrar_marca_kiosko(p_pin, p_kiosko_id);
$$;

comment on function public.registrar_marca_kiosko is
  'Wrapper publico de rrhh.fn_registrar_marca_kiosko. Callable por anon a proposito (el kiosko no tiene sesion) -- limitado a registrar la marca, con rate-limit persistente y sin datos personales (2026-09-05).';

revoke execute on function public.registrar_marca_kiosko(text, uuid) from public;
grant execute on function public.registrar_marca_kiosko(text, uuid) to anon, authenticated;

create or replace function public.validar_acceso_operativo(p_nombre_usuario text, p_pin text)
returns uuid
language sql
security definer
set search_path = rrhh, pg_temp
as $$
  select rrhh.fn_validar_acceso_operativo(p_nombre_usuario, p_pin);
$$;

comment on function public.validar_acceso_operativo is
  'Wrapper publico de rrhh.fn_validar_acceso_operativo. Callable por anon a proposito (el chofer no tiene sesion todavia). Bloqueo a 3 fallos persiste de verdad desde esta migracion (antes se revertia por el RAISE EXCEPTION posterior, ver cabecera).';

revoke execute on function public.validar_acceso_operativo(text, text) from public;
grant execute on function public.validar_acceso_operativo(text, text) to anon, authenticated;
