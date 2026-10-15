-- Atención: la búsqueda de factura repetida usa turnos_factura_idx (revisión
-- de Codex en PR #27). El índice es parcial (factura is not null) y
-- fn_factura_normal no es STRICT, así que el planificador no deduce el
-- predicado: sin `t.factura is not null` recorría todas las particiones.
-- Único cambio respecto de 20261015172012: esa condición en la búsqueda.
do $$
begin
  if to_regclass('atencion.turnos_factura_idx') is null then
    raise exception 'precheck: falta atencion.turnos_factura_idx (20261015172012)';
  end if;
end;
$$;

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
      and t.factura is not null  -- habilita el índice parcial turnos_factura_idx
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
