-- =============================================================================
-- App Presupuesto — indicadores del Dashboard (pedido del usuario 2026-10-20).
-- Ver docs/plan/19-presupuesto.md §6.
--
-- "Al iniciar sesión, si tiene asignado su vendedor y acceso a la app, el
-- dashboard debe mostrar su meta personal, sus clientes, su última factura.
-- Analiza los KPIs más importantes para el avance personal y el global."
--
-- Solo lectura, sin tablas ni permisos nuevos (no aplica Paso Cero):
--   * public.presupuesto_indicadores(empresa, año, mes, vista)
--       vista 'propio' -> presupuesto.metas.avance_propio.ver, vendedor vinculado
--       vista 'equipo' -> presupuesto.metas.avance_equipo.ver, toda la empresa
--     Devuelve ritmo del mes (días hábiles lun–sáb hasta el corte), mismo
--     período del año anterior, acumulado del año, clientes del mes / nuevos,
--     concentración en 12 meses, clientes en riesgo y clientes recientes.
--     Nombres de clientes y números de factura solo con permiso de facturas
--     (factura_propia.ver o factura.ver; en 'equipo', factura.ver).
--   * Corte = última factura importada de la empresa (no la fecha de hoy):
--     así un import atrasado no hace ver a todos los clientes "dormidos".
--   * Cliente genérico de contado ("Vario"): no cuenta como cliente; su venta
--     se informa aparte (contado_usd).
-- =============================================================================

do $$
begin
  if to_regprocedure('public.presupuesto_clientes(uuid,uuid,text,text,integer,integer)') is null then
    raise exception 'precheck: falta 20261020194816_presupuesto_tablero_clientes';
  end if;
  if to_regprocedure('public.presupuesto_indicadores(uuid,integer,integer,text)') is not null then
    raise exception 'precheck: presupuesto_indicadores ya existe';
  end if;
end $$;

-- Días hábiles (lunes a sábado) entre dos fechas, ambas incluidas. Sin feriados.
create or replace function presupuesto.fn_dias_habiles(p_desde date, p_hasta date)
returns integer language sql immutable set search_path = '' as $$
  select count(*)::integer
  from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') d
  where extract(isodow from d) <> 7;
$$;

-- Cliente genérico de contado: no se cuenta como cliente.
create or replace function presupuesto.fn_cliente_generico(p_cliente text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(lower(btrim(p_cliente)), '') in ('', 'vario', 'varios', '(sin cliente)');
$$;

create or replace function public.presupuesto_indicadores(
  p_company_id uuid, p_anio integer, p_mes integer, p_vista text default 'propio'
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_vend uuid;
  v_detalle boolean;
  v_inicio date;
  v_fin date;
  v_inicio_anio date;
  v_ultima date;
  v_corte date;
  v_desde_12m date;
begin
  perform presupuesto.fn_validar_periodo(p_anio, p_mes);
  if p_mes is null then raise exception 'Mes inválido.'; end if;

  if p_vista = 'equipo' then
    v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.metas.avance_equipo.ver');
    v_detalle := core.has_permission(v_uid, p_company_id, 'presupuesto.ventas.factura.ver');
  elsif p_vista = 'propio' then
    v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.metas.avance_propio.ver');
    v_vend := presupuesto.fn_mi_vendedor(v_uid, p_company_id);
    if v_vend is null then return jsonb_build_object('vinculado', false); end if;
    v_detalle := core.has_permission(v_uid, p_company_id, 'presupuesto.ventas.factura_propia.ver')
              or core.has_permission(v_uid, p_company_id, 'presupuesto.ventas.factura.ver');
  else
    raise exception 'Vista inválida.';
  end if;

  v_inicio := make_date(p_anio, p_mes, 1);
  v_fin := (v_inicio + interval '1 month' - interval '1 day')::date;
  v_inicio_anio := make_date(p_anio, 1, 1);
  select max(f.fecha) into v_ultima from presupuesto.facturas f where f.company_id = p_company_id;
  v_corte := least(coalesce(v_ultima, v_inicio - 1), v_fin);
  v_desde_12m := (v_corte - interval '1 year')::date + 1;

  return (
    with f as (
      select x.fecha, x.numero, x.total_usd, x.vendedor_id,
             coalesce(nullif(btrim(x.cliente), ''), '(Sin cliente)') as cliente,
             presupuesto.fn_cliente_generico(x.cliente) as generico
      from presupuesto.facturas x
      where x.company_id = p_company_id and not x.anulada
        and (v_vend is null or x.vendedor_id = v_vend)
        and x.fecha <= v_fin
    ),
    mes as (
      select coalesce(sum(f.total_usd), 0) as usd, count(*) as n,
             coalesce(sum(f.total_usd) filter (where f.generico), 0) as contado_usd,
             count(distinct f.cliente) filter (where not f.generico) as clientes
      from f where f.fecha >= v_inicio
    ),
    primeras as (
      select f.cliente, min(f.fecha) as primera from f where not f.generico group by f.cliente
    ),
    c12 as (
      select f.cliente, count(*) as n, sum(f.total_usd) as usd, max(f.fecha) as ultima
      from f where not f.generico and f.fecha between v_desde_12m and v_corte
      group by f.cliente
    ),
    riesgo as (
      select c.* from c12 c where c.n >= 3 and c.ultima <= v_corte - 45
    ),
    ultimas as (
      select distinct on (f.cliente) f.cliente, f.fecha, f.numero, f.total_usd, f.vendedor_id
      from f where not f.generico
      order by f.cliente, f.fecha desc, f.numero desc
    )
    select jsonb_build_object(
      'vinculado', true,
      'vista', p_vista,
      'detalle', v_detalle,
      'corte', case when v_ultima is null then null else v_corte end,
      'dias_habiles_mes', presupuesto.fn_dias_habiles(v_inicio, v_fin),
      'dias_habiles_transcurridos', presupuesto.fn_dias_habiles(v_inicio, v_corte),
      'mes', (select jsonb_build_object(
          'vendido_usd', round(m.usd, 2), 'facturas', m.n, 'contado_usd', round(m.contado_usd, 2),
          'clientes', m.clientes,
          'clientes_nuevos', (select count(*) from primeras p where p.primera >= v_inicio))
        from mes m),
      'meta_mes_usd', case when v_vend is null then
          (select pm.monto_usd from presupuesto.presupuestos p join presupuesto.presupuesto_meses pm on pm.presupuesto_id = p.id
           where p.company_id = p_company_id and p.anio = p_anio and pm.mes = p_mes)
        else
          (select mv.monto_usd from presupuesto.metas_vendedor mv
           where mv.vendedor_id = v_vend and mv.anio = p_anio and mv.mes = p_mes)
        end,
      'anio_anterior', jsonb_build_object(
        'mes_usd', (select round(coalesce(sum(f.total_usd), 0), 2) from f
                    where f.fecha between (v_inicio - interval '1 year')::date and (v_fin - interval '1 year')::date),
        'a_la_fecha_usd', (select round(coalesce(sum(f.total_usd), 0), 2) from f
                    where f.fecha between (v_inicio - interval '1 year')::date and (v_corte - interval '1 year')::date)),
      'ytd', jsonb_build_object(
        'vendido_usd', (select round(coalesce(sum(f.total_usd), 0), 2) from f
                        where f.fecha between v_inicio_anio and v_corte),
        'anterior_usd', (select round(coalesce(sum(f.total_usd), 0), 2) from f
                        where f.fecha between (v_inicio_anio - interval '1 year')::date and (v_corte - interval '1 year')::date),
        'meta_previa_usd', case when v_vend is null then
            (select sum(pm.monto_usd) from presupuesto.presupuestos p join presupuesto.presupuesto_meses pm on pm.presupuesto_id = p.id
             where p.company_id = p_company_id and p.anio = p_anio and pm.mes < p_mes)
          else
            (select sum(mv.monto_usd) from presupuesto.metas_vendedor mv
             where mv.vendedor_id = v_vend and mv.anio = p_anio and mv.mes < p_mes)
          end),
      'clientes_12m', (select jsonb_build_object(
          'clientes', count(*),
          'ventas_usd', round(coalesce(sum(c.usd), 0), 2),
          'top10_usd', round(coalesce((select sum(t.usd) from (select c2.usd from c12 c2 order by c2.usd desc limit 10) t), 0), 2),
          'contado_usd', (select round(coalesce(sum(f.total_usd), 0), 2) from f
                          where f.generico and f.fecha between v_desde_12m and v_corte))
        from c12 c),
      'en_riesgo_total', (select jsonb_build_object('clientes', count(*), 'usd_12m', round(coalesce(sum(r.usd), 0), 2)) from riesgo r),
      'en_riesgo', case when v_detalle then coalesce((select jsonb_agg(jsonb_build_object(
          'cliente', r.cliente, 'ultima_fecha', r.ultima, 'dias', v_corte - r.ultima,
          'facturas_12m', r.n, 'usd_12m', round(r.usd, 2),
          'vendedor', case when v_vend is null then (
            select jsonb_build_object('id', v.id, 'codigo', v.codigo, 'nombre', v.nombre)
            from ultimas u join presupuesto.vendedores v on v.id = u.vendedor_id where u.cliente = r.cliente) end
        ) order by r.usd desc) from (select * from riesgo order by usd desc limit 5) r), '[]'::jsonb) end,
      'recientes', case when v_detalle then coalesce((select jsonb_agg(jsonb_build_object(
          'cliente', u.cliente, 'fecha', u.fecha, 'numero', u.numero, 'total_usd', round(u.total_usd, 2),
          'dias', v_corte - u.fecha,
          'usd_12m', (select round(c.usd, 2) from c12 c where c.cliente = u.cliente)
        ) order by u.fecha desc, u.numero desc)
        from (select * from ultimas order by fecha desc, numero desc limit 8) u), '[]'::jsonb) end,
      'ultima', case when v_detalle then (select jsonb_build_object(
          'fecha', x.fecha, 'numero', x.numero, 'cliente', x.cliente, 'total_usd', round(x.total_usd, 2))
        from (select * from f order by f.fecha desc, f.numero desc limit 1) x) end
    )
  );
end;
$$;

-- Permisos de ejecución ------------------------------------------------------
revoke all on function presupuesto.fn_dias_habiles(date, date) from public, anon, authenticated;
revoke all on function presupuesto.fn_cliente_generico(text) from public, anon, authenticated;
revoke all on function public.presupuesto_indicadores(uuid, integer, integer, text) from public, anon;
grant execute on function public.presupuesto_indicadores(uuid, integer, integer, text) to authenticated;

-- Poscheque ------------------------------------------------------------------
do $$
declare
  v_rpc int;
  v_anon int;
  v_auth int;
begin
  select count(*), count(*) filter (where has_function_privilege('anon', p.oid, 'execute')),
         count(*) filter (where has_function_privilege('authenticated', p.oid, 'execute'))
    into v_rpc, v_anon, v_auth
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'presupuesto\_%';
  if v_rpc <> 18 or v_anon <> 0 or v_auth <> 18 then
    raise exception 'Poscheque: RPC %, anon %, authenticated % (se esperaban 18, 0, 18)', v_rpc, v_anon, v_auth;
  end if;
  if has_function_privilege('authenticated', 'presupuesto.fn_dias_habiles(date,date)', 'execute') then
    raise exception 'Poscheque: los helpers no deben ser ejecutables por authenticated';
  end if;
end $$;
