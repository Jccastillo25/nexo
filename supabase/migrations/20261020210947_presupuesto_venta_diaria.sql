-- =============================================================================
-- App Presupuesto — venta diaria del mes para la gráfica de venta acumulada
-- del Dashboard (pedido del usuario 2026-10-20: "dashboard con KPIs
-- importantes y visualmente atractivo"). Ver docs/plan/19-presupuesto.md §6.
--
-- Solo lectura, sin tablas ni permisos nuevos (no aplica Paso Cero). Mismo
-- alcance que presupuesto_indicadores:
--   vista 'propio' -> presupuesto.metas.avance_propio.ver, vendedor vinculado
--   vista 'equipo' -> presupuesto.metas.avance_equipo.ver, toda la empresa
-- Devuelve, por cada día del mes, lo vendido (facturas vigentes) y lo
-- vendido el mismo día del mes del año anterior. Solo montos agregados por
-- día: ningún cliente ni número de factura.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.presupuesto_indicadores(uuid,integer,integer,text)') is null then
    raise exception 'precheck: falta 20261020204854_presupuesto_indicadores';
  end if;
  if to_regprocedure('public.presupuesto_venta_diaria(uuid,integer,integer,text)') is not null then
    raise exception 'precheck: presupuesto_venta_diaria ya existe';
  end if;
end $$;

create or replace function public.presupuesto_venta_diaria(
  p_company_id uuid, p_anio integer, p_mes integer, p_vista text default 'propio'
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_vend uuid;
  v_inicio date;
  v_fin date;
  v_ini_ant date;
  v_fin_ant date;
begin
  perform presupuesto.fn_validar_periodo(p_anio, p_mes);
  if p_mes is null then raise exception 'Mes inválido.'; end if;

  if p_vista = 'equipo' then
    perform core.fn_exigir_permiso(p_company_id, 'presupuesto.metas.avance_equipo.ver');
  elsif p_vista = 'propio' then
    v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.metas.avance_propio.ver');
    v_vend := presupuesto.fn_mi_vendedor(v_uid, p_company_id);
    if v_vend is null then return jsonb_build_object('vinculado', false); end if;
  else
    raise exception 'Vista inválida.';
  end if;

  v_inicio := make_date(p_anio, p_mes, 1);
  v_fin := (v_inicio + interval '1 month' - interval '1 day')::date;
  v_ini_ant := (v_inicio - interval '1 year')::date;
  v_fin_ant := (v_ini_ant + interval '1 month' - interval '1 day')::date;

  return jsonb_build_object(
    'vinculado', true,
    'dias', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'dia', d.dia,
          'habil', extract(isodow from make_date(p_anio, p_mes, d.dia)) <> 7,
          'usd', round(coalesce(a.usd, 0), 2),
          'usd_anterior', round(coalesce(b.usd, 0), 2)
        ) order by d.dia), '[]'::jsonb)
      from generate_series(1, extract(day from v_fin)::integer) as d(dia)
      left join (
        select extract(day from f.fecha)::integer as dia, sum(f.total_usd) as usd
        from presupuesto.facturas f
        where f.company_id = p_company_id and not f.anulada
          and (v_vend is null or f.vendedor_id = v_vend)
          and f.fecha between v_inicio and v_fin
        group by 1
      ) a on a.dia = d.dia
      left join (
        select extract(day from f.fecha)::integer as dia, sum(f.total_usd) as usd
        from presupuesto.facturas f
        where f.company_id = p_company_id and not f.anulada
          and (v_vend is null or f.vendedor_id = v_vend)
          and f.fecha between v_ini_ant and v_fin_ant
        group by 1
      ) b on b.dia = d.dia
    )
  );
end;
$$;

revoke all on function public.presupuesto_venta_diaria(uuid, integer, integer, text) from public, anon;
grant execute on function public.presupuesto_venta_diaria(uuid, integer, integer, text) to authenticated;

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
  if v_rpc <> 19 or v_anon <> 0 or v_auth <> 19 then
    raise exception 'Poscheque: RPC %, anon %, authenticated % (se esperaban 19, 0, 19)', v_rpc, v_anon, v_auth;
  end if;
end $$;
