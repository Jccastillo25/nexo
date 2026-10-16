-- =============================================================================
-- P1 (issue #30) — PIN ambiguo: fallo cerrado antes de registrar marcas.
--
-- Especificación aprobada: docs/RRHH_PILOTO_MVP_OPERATIVO.md, ticket **P1** de
-- la tabla de §6 (aprobada el 2026-10-15; publicada en el PR #41, todavía no
-- en `main`). Este archivo implementa SOLO P1: no adelanta P2 (unicidad al
-- activar/regenerar), P3 (vínculo contractual de la marca) ni el resto.
--
-- Brecha real que cierra: desde F1.3 la credencial se busca así
--
--   from rrhh.contrato_credenciales cc
--   join rrhh.contratos c on c.id = cc.contrato_id
--   where c.company_id = v_kiosko.company_id
--     and c.estado = 'activo' and cc.activo and not cc.pin_bloqueado
--     and crypt(p_pin, cc.pin_hash) = cc.pin_hash
--   limit 1
--
-- Nada garantiza todavía que dos credenciales vigentes de la MISMA empresa no
-- compartan el mismo PIN: `fn_activar_contrato`/`fn_regenerar_pin_contrato`
-- generan el PIN aleatorio sin comprobar colisión (eso es P2). Con dos
-- coincidencias, ese `limit 1` marcaba para el contrato que eligiera el plan de
-- ejecución — la asistencia podía quedar atribuida a la otra persona, en
-- silencio y sin ninguna señal. El kiosco no puede prometer unicidad, pero sí
-- puede negarse a inventar la atribución.
--
-- Regla P1: la búsqueda sigue acotada a la empresa del kiosco (aislamiento
-- vigente, sin cambios) y ahora CUENTA las coincidencias antes de elegir:
--
--   * 0 coincidencias  -> camino ya existente (no hay credencial válida):
--                         intento fallido, cero filas, sin marca.
--   * 1 coincidencia   -> comportamiento normal: infiere entrada/salida y
--                         registra la marca del contrato único.
--   * >1 coincidencias -> FALLO CERRADO: no se inserta ninguna marca, no se
--                         devuelve ni se registra identidad alguna, y se emite
--                         una señal técnica SIN PIN (RAISE WARNING al log del
--                         servidor; PostgREST no expone WARNING al llamador).
--
-- Decisión de diseño (deliberada): el caso ambiguo recorre EXACTAMENTE el
-- mismo camino observable que un PIN inválido — cero filas de retorno y el
-- mismo conteo en `rrhh.kiosko_rate_limits`. Un PIN ambiguo no es utilizable,
-- así que no debe comportarse distinto hacia afuera: no existe diferencia
-- observable que sirva de oráculo, y 8 intentos ambiguos seguidos bloquean el
-- kiosco 5 minutos igual que 8 PINes inválidos.
--
-- Alcance: solo el cuerpo de `rrhh.fn_registrar_marca_kiosko`. Misma firma,
-- mismo tipo de retorno, mismo rate-limit, mismo retorno sin datos personales,
-- mismos GRANT/REVOKE. No se modifica ninguna migración histórica.
--
-- Costo asumido: un PIN válido ahora evalúa todas las credenciales vigentes de
-- la empresa en vez de cortar en la primera coincidencia (LIMIT 1). Es el
-- mismo orden de trabajo que ya pagaba un PIN inválido, y es la única forma de
-- detectar la ambigüedad; la unicidad que evita el problema (y permite volver
-- a un camino barato) llega con P2.
-- =============================================================================

create or replace function rrhh.fn_registrar_marca_kiosko(p_pin text, p_kiosko_id uuid)
returns table (tipo text, marcado_en timestamptz)
language plpgsql
security definer
set search_path = rrhh, extensions, pg_temp
as $$
declare
  v_kiosko rrhh.kiosko_dispositivos%rowtype;
  v_rl rrhh.kiosko_rate_limits%rowtype;
  v_empleados uuid[];
  v_coincidencias integer;
  v_empleado_id uuid;
  v_ultimo_tipo text;
  v_tipo text;
  v_ahora timestamptz := now();
  v_marcado_en timestamptz;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return;
  end if;

  select * into v_kiosko from rrhh.kiosko_dispositivos where id = p_kiosko_id;
  if not found or not v_kiosko.activo then
    return;
  end if;

  insert into rrhh.kiosko_rate_limits (kiosko_id) values (p_kiosko_id)
    on conflict (kiosko_id) do nothing;

  select * into v_rl from rrhh.kiosko_rate_limits where kiosko_id = p_kiosko_id for update;

  if v_rl.bloqueado_hasta is not null and v_rl.bloqueado_hasta > v_ahora then
    return;
  end if;

  if v_ahora - v_rl.window_started_at > interval '1 minute' then
    update rrhh.kiosko_rate_limits
      set window_started_at = v_ahora,
          intentos_en_ventana = 0,
          bloqueado_hasta = null,
          updated_at = v_ahora
      where kiosko_id = p_kiosko_id
      returning * into v_rl;
  end if;

  -- P1: se cuentan TODAS las credenciales vigentes que el kiosco puede
  -- alcanzar (empresa del dispositivo) y aceptan este PIN. Sin `limit 1`:
  -- elegir una sola fila es justamente el bug que este ticket cierra.
  select array_agg(c.empleado_id), count(*)
    into v_empleados, v_coincidencias
  from rrhh.contrato_credenciales cc
  join rrhh.contratos c on c.id = cc.contrato_id
  where c.company_id = v_kiosko.company_id
    and c.estado = 'activo'
    and cc.activo = true
    and not cc.pin_bloqueado
    and crypt(p_pin, cc.pin_hash) = cc.pin_hash;

  if v_coincidencias >= 1 then
    v_empleado_id := v_empleados[1];
  elsif v_coincidencias > 1 then
    -- Señal técnica sin PIN: no incluye el valor probado, ni el hash, ni el
    -- empleado, ni el contrato. Solo lo estrictamente necesario para que el
    -- responsable de RRHH pueda detectar y corregir la colisión (P2).
    raise warning
      'rrhh.kiosko: PIN ambiguo rechazado (fallo cerrado) — kiosko_id=%, company_id=%, credenciales_vigentes_coincidentes=%',
      p_kiosko_id, v_kiosko.company_id, v_coincidencias;
  end if;

  if v_empleado_id is null then
    -- Credencial no resoluble: 0 coincidencias (PIN inválido) o varias
    -- (PIN ambiguo). Un solo camino observable para ambos casos.
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

  update rrhh.kiosko_rate_limits
    set intentos_en_ventana = 0,
        bloqueado_hasta = null,
        updated_at = v_ahora
    where kiosko_id = p_kiosko_id;

  select am.tipo into v_ultimo_tipo
  from rrhh.asistencia_marcas am
  where am.empleado_id = v_empleado_id
  order by am.marcado_en desc
  limit 1;

  v_tipo := case when v_ultimo_tipo = 'entrada' then 'salida' else 'entrada' end;
  v_marcado_en := v_ahora;

  insert into rrhh.asistencia_marcas (company_id, empleado_id, kiosko_id, tipo, marcado_en, origen)
  values (v_kiosko.company_id, v_empleado_id, p_kiosko_id, v_tipo, v_marcado_en, 'kiosko');

  return query select v_tipo, v_marcado_en;
end;
$$;

comment on function rrhh.fn_registrar_marca_kiosko is
  'Registra entrada/salida desde un kiosko fisico. Auth por PIN+kiosko_id, no por auth.uid(). Rechaza PIN con formato invalido, kiosko inexistente/inactivo, kiosko con rate-limit activo (8 fallos/1min -> 5min de bloqueo, ver rrhh.kiosko_rate_limits) o PIN incorrecto -- todos con el mismo comportamiento generico (sin RAISE EXCEPTION: los UPDATE al contador quedan confirmados). No devuelve datos personales del empleado. P1 (2026-10-15, migracion 20261015181000): la busqueda pasa de `limit 1` a CONTAR las credenciales vigentes de la empresa del kiosco que aceptan el PIN; con mas de una coincidencia NO inserta marca, no identifica a nadie y emite un RAISE WARNING sin PIN (log del servidor, no visible desde PostgREST), recorriendo el mismo camino observable que un PIN invalido. No evita la colision (eso es P2).';

-- La funcion interna NUNCA se llama directo: el unico camino es el wrapper
-- public.registrar_marca_kiosko (SECURITY DEFINER). Se reafirma el cierre de
-- privilegios de 20260905000005 por si esta migracion se aplica sobre una base
-- donde ese REVOKE hubiera quedado incompleto (idempotente, no cambia el ACL
-- vigente en nexo-core).
revoke execute on function rrhh.fn_registrar_marca_kiosko(text, uuid)
  from public, anon, authenticated;
