-- Atención: reactivar "no se presentó" y factura única (aprobado por el
-- usuario 2026-10-15, plan 13 §6.3). Permiso: atencion.cola.turno.reactivar
-- (Paso Cero 20261015165620).
--
-- * en_fila_desde: desde cuándo el turno está en la fila. Al reactivar se pone
--   en ahora, así vuelve AL FINAL (decisión del usuario) conservando su número.
--   La fila, el "siguiente" y los próximos de la pantalla se ordenan por ella;
--   la espera se mide desde ahí.
-- * Factura única por sucursal en toda la historia, comparada sin espacios y en
--   mayúsculas. Anulados y vencidos no la ocupan. Un "no se presentó" de HOY
--   bloquea y ofrece reactivar (detail = 'reactivable:<id>'); uno de un día
--   anterior queda reemplazado por el turno nuevo (decisión del usuario).
-- * Sin DROP de ningún tipo (el conector MCP se cuelga con ellos): "reemplazado"
--   es una columna y no un estado nuevo, y la reactivación se registra con el
--   evento existente 'devuelto' + metadata {"reactivado": true}.
-- * atencion_cola_v3 = v2 + en_fila_desde, reactivaciones, reemplazado. v2 y
--   atencion_cola quedan sin uso en el código; retirarlas aparte.
do $$
begin
  if to_regprocedure('public.atencion_cola_v2(uuid, uuid)') is null then
    raise exception 'precheck: falta atencion_cola_v2 (20261015163957)';
  end if;
  if not exists (select 1 from core.permissions_catalog where code = 'atencion.cola.turno.reactivar') then
    raise exception 'precheck: falta el permiso atencion.cola.turno.reactivar (Paso Cero)';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'atencion' and table_name = 'turnos' and column_name = 'en_fila_desde') then
    raise exception 'precheck: atencion.turnos.en_fila_desde ya existe';
  end if;
  if exists (
    select 1 from atencion.turnos t
    where t.factura is not null and t.estado not in ('anulado', 'expirado')
    group by t.sucursal_id, upper(regexp_replace(t.factura, '\s', '', 'g'))
    having count(*) > 1
  ) then
    raise exception 'precheck: ya hay facturas repetidas; limpiarlas antes de aplicar la regla';
  end if;
end;
$$;

-- 1. Columnas ---------------------------------------------------------------
alter table atencion.turnos
  add column en_fila_desde timestamptz,
  add column reactivaciones integer not null default 0,
  add column reemplazado_en timestamptz,
  add column reemplazado_por uuid;

update atencion.turnos set en_fila_desde = creado_en where en_fila_desde is null;
alter table atencion.turnos alter column en_fila_desde set default now();
alter table atencion.turnos alter column en_fila_desde set not null;

comment on column atencion.turnos.en_fila_desde is
  'Desde cuándo está en la fila: alta o última reactivación. Ordena la fila y mide la espera.';
comment on column atencion.turnos.reemplazado_en is
  'Un "no se presentó" de un día anterior cuya factura se volvió a registrar (turno reemplazado_por).';

-- 2. Factura normalizada -----------------------------------------------------
create or replace function atencion.fn_factura_normal(p_factura text)
returns text language sql immutable set search_path = '' as $$
  select nullif(upper(regexp_replace(coalesce(p_factura, ''), '\s', '', 'g')), '');
$$;
revoke all on function atencion.fn_factura_normal(text) from public, anon, authenticated;

create index turnos_factura_idx on atencion.turnos (sucursal_id, atencion.fn_factura_normal(factura))
  where factura is not null;

-- 3. Alta de turno con factura única -----------------------------------------
create or replace function public.atencion_crear_turno(
  p_company_id uuid, p_cliente_nombre text, p_cliente_telefono text default null, p_factura text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_a atencion.sesiones_activas;
  v_nombre text := btrim(coalesce(p_cliente_nombre, ''));
  v_factura text := nullif(btrim(coalesce(p_factura, '')), '');
  v_norma text := atencion.fn_factura_normal(p_factura);
  v_hoy date;
  v_numero integer;
  v_t atencion.turnos;
  v_previo atencion.turnos;
begin
  v_a := atencion.fn_exigir_sesion(p_company_id, 'atencion.recepcion.turno.crear', 'recepcion');
  if length(v_nombre) < 1 or length(v_nombre) > 120 then raise exception 'Escribí el nombre del cliente.'; end if;
  if length(coalesce(p_cliente_telefono, '')) > 30 then raise exception 'El teléfono no puede superar 30 caracteres.'; end if;
  if length(coalesce(v_factura, '')) > 50 then raise exception 'La factura no puede superar 50 caracteres.'; end if;

  v_hoy := atencion.fn_hoy(v_a.sucursal_id);

  if v_norma is not null then
    -- Dos recepciones con la misma factura a la vez: la segunda espera y ve la primera.
    perform pg_advisory_xact_lock(hashtextextended('atencion.factura:' || v_a.sucursal_id || ':' || v_norma, 0));
    select t.* into v_previo from atencion.turnos t
    where t.sucursal_id = v_a.sucursal_id
      and atencion.fn_factura_normal(t.factura) = v_norma
      and t.estado not in ('anulado', 'expirado')
      and t.reemplazado_en is null
    order by t.creado_en desc
    limit 1;

    if found then
      if v_previo.estado in ('esperando', 'llamado') then
        raise exception 'La factura % ya tiene el turno % %.', v_factura, v_previo.numero,
          case v_previo.estado when 'esperando' then 'en espera' else 'en atención' end;
      elsif v_previo.estado = 'atendido' then
        raise exception 'La factura % ya fue atendida (turno % del %).', v_factura, v_previo.numero,
          to_char(v_previo.fecha_local, 'DD/MM/YYYY');
      elsif v_previo.estado = 'ausente' and v_previo.fecha_local = v_hoy then
        raise exception using
          message = format('La factura %s ya tiene el turno %s de hoy, que no se presentó.', v_factura, v_previo.numero),
          detail = 'reactivable:' || v_previo.id || ':' || v_previo.numero;
      end if;
      -- 'ausente' de un día anterior: se crea el turno nuevo y el viejo queda reemplazado (abajo).
    end if;
  end if;

  insert into atencion.contadores as c (sucursal_id, fecha_local, ultimo_numero)
  values (v_a.sucursal_id, v_hoy, 1)
  on conflict (sucursal_id, fecha_local) do update set ultimo_numero = c.ultimo_numero + 1
  returning c.ultimo_numero into v_numero;

  perform atencion.fn_asegurar_particion_turnos(current_date);
  insert into atencion.turnos (company_id, sucursal_id, fecha_local, numero, cliente_nombre, cliente_telefono, factura, creado_por)
  values (p_company_id, v_a.sucursal_id, v_hoy, v_numero, v_nombre,
          nullif(btrim(coalesce(p_cliente_telefono, '')), ''), v_factura, v_a.user_id)
  returning * into v_t;
  perform atencion.fn_evento(v_t, 'creado', v_a.user_id);

  if v_previo.id is not null and v_previo.estado = 'ausente' then
    update atencion.turnos t set reemplazado_en = now(), reemplazado_por = v_t.id
    where t.id = v_previo.id and t.creado_en = v_previo.creado_en;
  end if;

  return jsonb_build_object('id', v_t.id, 'numero', v_t.numero, 'fecha', v_t.fecha_local);
end;
$$;

-- 4. Reactivar ---------------------------------------------------------------
create or replace function public.atencion_reactivar_turno(p_company_id uuid, p_turno_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_t atencion.turnos;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'atencion.cola.turno.reactivar');
  update atencion.turnos t
    -- clock_timestamp(): hora real, no la del inicio de la transacción.
    set estado = 'esperando', en_fila_desde = clock_timestamp(), reactivaciones = t.reactivaciones + 1,
        puesto_id = null, atendido_por = null, inicio_atencion_en = null, finalizado_en = null
  where t.id = p_turno_id and t.company_id = p_company_id
    and t.estado = 'ausente' and t.reemplazado_en is null
    and t.fecha_local = atencion.fn_hoy(t.sucursal_id)
    and t.creado_en >= now() - interval '2 days'
    and atencion.fn_puede_sucursal(v_uid, p_company_id, t.sucursal_id)
  returning * into v_t;
  if not found then
    raise exception 'Solo se pueden reactivar turnos de hoy que no se presentaron, de tu sucursal.';
  end if;
  perform atencion.fn_evento(v_t, 'devuelto', v_uid, jsonb_build_object('reactivado', true));
  return jsonb_build_object('id', v_t.id, 'numero', v_t.numero);
end;
$$;
revoke all on function public.atencion_reactivar_turno(uuid, uuid) from public, anon;
grant execute on function public.atencion_reactivar_turno(uuid, uuid) to authenticated;

-- 5. Llamar: el siguiente es el que lleva más tiempo en la fila ----------------
create or replace function public.atencion_llamar(p_company_id uuid, p_turno_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_a atencion.sesiones_activas;
  v_t atencion.turnos;
  v_siguiente uuid;
begin
  v_a := atencion.fn_exigir_sesion(p_company_id, 'atencion.puesto.turno.llamar', 'puesto');
  if p_turno_id is not null then
    perform core.fn_exigir_permiso(p_company_id, 'atencion.puesto.turno.llamar_fuera_orden');
  end if;
  if (atencion.fn_turno_actual(v_a.puesto_id)).id is not null then
    raise exception 'Finalizá o marcá ausente el turno actual antes de llamar otro.';
  end if;

  select t.id into v_siguiente from atencion.turnos t
  where t.sucursal_id = v_a.sucursal_id and t.estado = 'esperando'
    and t.fecha_local = atencion.fn_hoy(v_a.sucursal_id) and t.creado_en >= now() - interval '2 days'
  order by t.en_fila_desde, t.numero
  limit 1;

  update atencion.turnos t
    set estado = 'llamado', puesto_id = v_a.puesto_id, atendido_por = v_a.user_id,
        llamado_en = now(), inicio_atencion_en = now(), veces_llamado = t.veces_llamado + 1,
        fuera_de_orden = (p_turno_id is not null and t.id <> v_siguiente)
  where t.id = (
      select t2.id from atencion.turnos t2
      where t2.sucursal_id = v_a.sucursal_id and t2.estado = 'esperando'
        and t2.fecha_local = atencion.fn_hoy(v_a.sucursal_id) and t2.creado_en >= now() - interval '2 days'
        and (p_turno_id is null or t2.id = p_turno_id)
      order by t2.en_fila_desde, t2.numero
      limit 1
      for update skip locked)
    and t.creado_en >= now() - interval '2 days'
  returning * into v_t;

  if not found then
    raise exception '%', case when p_turno_id is null then 'No hay turnos en espera.' else 'Ese turno ya no está en espera.' end;
  end if;
  perform atencion.fn_evento(v_t, 'llamado', v_a.user_id, jsonb_build_object('fuera_de_orden', v_t.fuera_de_orden));
  return jsonb_build_object('id', v_t.id, 'numero', v_t.numero, 'fuera_de_orden', v_t.fuera_de_orden);
end;
$$;

-- 6. Fila con los datos nuevos -------------------------------------------------
create function public.atencion_cola_v3(p_company_id uuid, p_sucursal_id uuid default null)
returns table (
  id uuid, numero integer, estado text, puesto text, llamado_en timestamptz, veces_llamado integer,
  cliente_nombre text, cliente_telefono text, factura text, creado_en timestamptz,
  inicio_atencion_en timestamptz, finalizado_en timestamptz,
  en_fila_desde timestamptz, reactivaciones integer, reemplazado boolean
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid;
  v_sucursal uuid := p_sucursal_id;
  v_datos boolean;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'atencion.cola.turno.ver');
  perform atencion.fn_cerrar_vencidas();
  if v_sucursal is null then
    select sa.sucursal_id into v_sucursal from atencion.sesiones_activas sa where sa.user_id = v_uid;
  end if;
  if v_sucursal is null or not atencion.fn_puede_sucursal(v_uid, p_company_id, v_sucursal) then
    raise exception 'Elegí una sucursal tuya o iniciá atención.';
  end if;
  v_datos := core.has_permission(v_uid, p_company_id, 'atencion.cliente.datos.ver');

  return query
  select t.id, t.numero, t.estado, p.nombre, t.llamado_en, t.veces_llamado,
         t.cliente_nombre,
         case when v_datos then t.cliente_telefono end,
         case when v_datos then t.factura end,
         t.creado_en, t.inicio_atencion_en, t.finalizado_en,
         t.en_fila_desde, t.reactivaciones, t.reemplazado_en is not null
  from atencion.turnos t
  left join atencion.puestos p on p.id = t.puesto_id
  where t.sucursal_id = v_sucursal
    and t.fecha_local = atencion.fn_hoy(v_sucursal)
    and t.creado_en >= now() - interval '2 days'
  order by (t.estado not in ('esperando', 'llamado')), t.en_fila_desde, t.numero;
end;
$$;
revoke all on function public.atencion_cola_v3(uuid, uuid) from public, anon;
grant execute on function public.atencion_cola_v3(uuid, uuid) to authenticated;

-- 7. Pantalla: próximos en orden de fila (resto igual a 20261015161222) -------
create or replace function public.atencion_pantalla_estado(p_pantalla_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_p atencion.pantallas;
  v_sucursal core.sucursales;
  v_hoy date;
  v_cliente boolean;
  v_agente boolean;
  v_puesto boolean;
  v_factura boolean;
begin
  select pa.* into v_p from atencion.pantallas pa where pa.id = p_pantalla_id and pa.activa;
  if not found then return null; end if;
  select s.* into v_sucursal from core.sucursales s where s.id = v_p.sucursal_id and s.activa;
  if not found then return null; end if;
  if not exists (
    select 1 from core.apps a
    join core.company_apps ca on ca.app_id = a.id and ca.company_id = v_p.company_id and ca.enabled
    where a.slug = 'atencion' and a.active
  ) then
    return null;
  end if;

  perform atencion.fn_cerrar_vencidas();
  v_hoy := atencion.fn_hoy(v_sucursal.id);
  v_cliente := atencion.fn_pantalla_campo(v_p.config, 'cliente');
  v_agente := atencion.fn_pantalla_campo(v_p.config, 'agente');
  v_puesto := atencion.fn_pantalla_campo(v_p.config, 'puesto');
  -- Factura: opt-in, sin clave = no.
  v_factura := coalesce((v_p.config->'mostrar'->>'factura')::boolean, false)
            or coalesce((v_p.config->'anunciar'->>'factura')::boolean, false);

  return jsonb_build_object(
    'sucursal', v_sucursal.nombre,
    'config', v_p.config,
    'llamados', coalesce((
      select jsonb_agg(jsonb_build_object('numero', t.numero,
                                          'puesto', case when v_puesto then p.nombre end,
                                          'cliente', case when v_cliente then t.cliente_nombre end,
                                          'agente', case when v_agente then pf.nombre_completo end,
                                          'factura', case when v_factura then t.factura end,
                                          'llamado_en', t.llamado_en, 'veces', t.veces_llamado)
                       order by t.llamado_en desc)
      from atencion.turnos t
      join atencion.puestos p on p.id = t.puesto_id
      left join core.perfiles pf on pf.user_id = t.atendido_por
      where t.sucursal_id = v_sucursal.id and t.estado = 'llamado' and t.fecha_local = v_hoy
        and t.creado_en >= now() - interval '2 days'
    ), '[]'::jsonb),
    'proximos', coalesce((
      select jsonb_agg(x.numero order by x.en_fila_desde, x.numero) from (
        select t.numero, t.en_fila_desde from atencion.turnos t
        where t.sucursal_id = v_sucursal.id and t.estado = 'esperando' and t.fecha_local = v_hoy
          and t.creado_en >= now() - interval '2 days'
        order by t.en_fila_desde, t.numero limit 8) x
    ), '[]'::jsonb),
    'generado_en', now()
  );
end;
$$;

revoke all on function public.atencion_pantalla_estado(uuid) from public;
grant execute on function public.atencion_pantalla_estado(uuid) to anon, authenticated;
