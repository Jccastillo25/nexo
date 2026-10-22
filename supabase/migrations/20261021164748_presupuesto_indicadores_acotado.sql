-- =============================================================================
-- Presupuesto — indicadores del Dashboard acotados a la ventana que usan
-- (revisión integral 2026-10-20, rendimiento #6; docs/status-log/2026-10-20-revision-integral.md).
--
-- Medido en remoto: public.presupuesto_indicadores tardaba 660 ms de media
-- (máx. 1,3 s). El CTE `f` solo filtraba `fecha <= fin`, así que materializaba
-- toda la historia (desde 2023) y la recorría ~10 veces, con dos ordenamientos
-- completos (`primeras`, `ultimas`).
--
-- Cambio, sin alterar el resultado:
--   * `f` se acota a [v_desde, fin], donde v_desde cubre los 12 meses al corte
--     y el año anterior completo (comparaciones mes/YTD contra el año pasado).
--   * clientes_nuevos: cliente del mes sin ninguna factura previa al mes, con
--     `not exists` contra la tabla y el índice nuevo por cliente normalizado
--     (antes: min(fecha) agrupado sobre toda la historia).
--   * `ultimas` y `ultima` usan la ventana; solo si en la ventana hay menos de
--     8 clientes (o ninguna factura) se completan con la historia anterior,
--     para que "recientes" y "Mi última factura" sigan siendo idénticos.
--   * Índice (company_id, cliente normalizado, fecha) en presupuesto.facturas.
--     La expresión es la misma que usan las RPC de clientes, así que también
--     les sirve.
-- Misma firma, mismos permisos y mismo JSON: se verificó contra la versión
-- anterior en todos los meses con datos antes de aplicar.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.presupuesto_indicadores(uuid,integer,integer,text)') is null then
    raise exception 'precheck: falta 20261020204854_presupuesto_indicadores';
  end if;
end $$;

create index if not exists ix_facturas_company_cliente_norm_fecha
  on presupuesto.facturas (company_id, (coalesce(nullif(btrim(cliente), ''), '(Sin cliente)')), fecha);

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
  v_desde date;
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
  -- Lo más antiguo que se compara: 12 meses al corte o el 1 de enero del año anterior.
  v_desde := least(v_desde_12m, (v_inicio_anio - interval '1 year')::date);

  return (
    with f as (
      select x.fecha, x.numero, x.total_usd, x.vendedor_id,
             coalesce(nullif(btrim(x.cliente), ''), '(Sin cliente)') as cliente,
             presupuesto.fn_cliente_generico(x.cliente) as generico
      from presupuesto.facturas x
      where x.company_id = p_company_id and not x.anulada
        and (v_vend is null or x.vendedor_id = v_vend)
        and x.fecha between v_desde and v_fin
    ),
    -- Historia anterior a la ventana: solo se lee en los casos de respaldo.
    viejas as not materialized (
      select x.fecha, x.numero, x.total_usd, x.vendedor_id,
             coalesce(nullif(btrim(x.cliente), ''), '(Sin cliente)') as cliente,
             presupuesto.fn_cliente_generico(x.cliente) as generico
      from presupuesto.facturas x
      where x.company_id = p_company_id and not x.anulada
        and (v_vend is null or x.vendedor_id = v_vend)
        and x.fecha < v_desde
    ),
    mes as (
      select coalesce(sum(f.total_usd), 0) as usd, count(*) as n,
             coalesce(sum(f.total_usd) filter (where f.generico), 0) as contado_usd,
             count(distinct f.cliente) filter (where not f.generico) as clientes
      from f where f.fecha >= v_inicio
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
      select distinct on (u.cliente) u.cliente, u.fecha, u.numero, u.total_usd, u.vendedor_id
      from (
        select f.cliente, f.fecha, f.numero, f.total_usd, f.vendedor_id from f where not f.generico
        union all
        select v.cliente, v.fecha, v.numero, v.total_usd, v.vendedor_id from viejas v
        where not v.generico
          and (select count(distinct f2.cliente) from f f2 where not f2.generico) < 8
      ) u
      order by u.cliente, u.fecha desc, u.numero desc
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
          'clientes_nuevos', (
            select count(*) from (select distinct f.cliente from f where not f.generico and f.fecha >= v_inicio) nc
            where not exists (
              select 1 from presupuesto.facturas y
              where y.company_id = p_company_id and not y.anulada
                and (v_vend is null or y.vendedor_id = v_vend)
                and coalesce(nullif(btrim(y.cliente), ''), '(Sin cliente)') = nc.cliente
                and y.fecha < v_inicio)))
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
        from (
          select * from (
            select f.fecha, f.numero, f.cliente, f.total_usd from f
            union all
            select v.fecha, v.numero, v.cliente, v.total_usd from viejas v
            where not exists (select 1 from f f3)
          ) z order by z.fecha desc, z.numero desc limit 1) x) end
    )
  );
end;
$$;

revoke all on function public.presupuesto_indicadores(uuid, integer, integer, text) from public, anon;
grant execute on function public.presupuesto_indicadores(uuid, integer, integer, text) to authenticated;

-- Poscheque ------------------------------------------------------------------
do $$
begin
  if has_function_privilege('anon', 'public.presupuesto_indicadores(uuid,integer,integer,text)', 'execute') then
    raise exception 'Poscheque: anon no debe ejecutar presupuesto_indicadores';
  end if;
  if not has_function_privilege('authenticated', 'public.presupuesto_indicadores(uuid,integer,integer,text)', 'execute') then
    raise exception 'Poscheque: authenticated debe ejecutar presupuesto_indicadores';
  end if;
  if to_regclass('presupuesto.ix_facturas_company_cliente_norm_fecha') is null then
    raise exception 'Poscheque: falta el índice por cliente normalizado';
  end if;
end $$;
