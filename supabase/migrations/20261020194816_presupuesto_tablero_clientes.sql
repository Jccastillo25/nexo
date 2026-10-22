-- =============================================================================
-- App Presupuesto — cuadro de meta configurable y clientes por vendedor
-- (pedido del usuario 2026-10-20). Ver docs/plan/19-presupuesto.md §6.
--
-- "Me gustaría poder elegir a los vendedores a mostrar en el cuadro de meta."
--   * presupuesto.vendedores.en_tablero (default true) y la RPC
--     presupuesto_guardar_tablero, con presupuesto.metas.meta_vendedor.gestionar
--     (gerente y administrador). Es una elección de la empresa: todos los que
--     ven el equipo ven el mismo cuadro. No cambia las metas ni los totales
--     de la empresa (para sacar a alguien de las metas se desactiva en
--     Configuración > Vendedores).
--   * presupuesto_equipo devuelve en_tablero en cada vendedor.
--
-- "Dependiendo el rol y que el usuario tenga el vendedor asignado puede ver su
-- avance personal, sus clientes, cuándo fue la última vez que facturó, qué le
-- facturó a este cliente."
--   * presupuesto_clientes: clientes (por nombre, como vienen de AG Negocio)
--     con facturas, total, total del año y la última factura.
--   * presupuesto_facturas_cliente: lo facturado a un cliente.
--   Alcance, sin permisos nuevos:
--     - con presupuesto.ventas.factura.ver: todos los vendedores (o uno);
--     - solo con presupuesto.ventas.factura_propia.ver: únicamente el
--       vendedor vinculado al usuario (p_vendedor_id se ignora); sin vínculo
--       no devuelve datos.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.presupuesto_equipo(uuid,integer,integer)') is null then
    raise exception 'precheck: falta el esquema de Presupuesto';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'presupuesto' and table_name = 'vendedores' and column_name = 'en_tablero') then
    raise exception 'precheck: en_tablero ya existe';
  end if;
end $$;

alter table presupuesto.vendedores add column en_tablero boolean not null default true;
comment on column presupuesto.vendedores.en_tablero is
  'Se muestra en el cuadro de meta del equipo (Dashboard). Lo elige quien gestiona metas; no cambia metas ni totales.';

-- Equipo: igual que en 20261020184030, con en_tablero en cada vendedor -------
create or replace function public.presupuesto_equipo(p_company_id uuid, p_anio integer, p_mes integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_desde date;
  v_hasta date;
begin
  perform core.fn_exigir_permiso(p_company_id, 'presupuesto.metas.avance_equipo.ver');
  perform presupuesto.fn_validar_periodo(p_anio, p_mes);
  v_desde := make_date(p_anio, p_mes, 1);
  v_hasta := (v_desde + interval '1 month')::date;
  return jsonb_build_object(
    'meta_empresa_usd', (select pm.monto_usd from presupuesto.presupuestos p join presupuesto.presupuesto_meses pm on pm.presupuesto_id = p.id
                         where p.company_id = p_company_id and p.anio = p_anio and pm.mes = p_mes),
    'tipo_cambio', round(presupuesto.fn_tipo_cambio(p_company_id, p_anio, p_mes), 4),
    'vendedores', coalesce((select jsonb_agg(to_jsonb(x) order by x.vendido_usd desc) from (
      select v.id, v.codigo, v.nombre, v.activo, v.en_tablero, (v.user_id is not null) as vinculado,
             mv.monto_usd as meta_usd, mv.origen as meta_origen,
             coalesce(s.usd, 0) as vendido_usd, coalesce(s.cs, 0) as vendido_cs, coalesce(s.n, 0) as facturas
      from presupuesto.vendedores v
      left join presupuesto.metas_vendedor mv on mv.vendedor_id = v.id and mv.anio = p_anio and mv.mes = p_mes
      left join lateral (
        select sum(f.total_usd) as usd, sum(f.total_cs) as cs, count(*) as n from presupuesto.facturas f
        where f.company_id = p_company_id and f.vendedor_id = v.id and not f.anulada
          and f.fecha >= v_desde and f.fecha < v_hasta) s on true
      where v.company_id = p_company_id and (v.activo or mv.id is not null or coalesce(s.n, 0) > 0)) x), '[]'::jsonb),
    'serie_empresa', presupuesto.fn_serie_anual(p_company_id, null, p_anio),
    'ultima_factura', (select max(f.fecha) from presupuesto.facturas f where f.company_id = p_company_id)
  );
end;
$$;

-- Elegir los vendedores del cuadro de meta ----------------------------------
-- p_vendedor_ids: los que se muestran; el resto queda oculto.
create or replace function public.presupuesto_guardar_tablero(p_company_id uuid, p_vendedor_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_ids uuid[] := coalesce(p_vendedor_ids, '{}');
  v_mostrados integer;
  v_ocultos integer;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.metas.meta_vendedor.gestionar');
  if coalesce(array_length(v_ids, 1), 0) > 500 then raise exception 'Demasiados vendedores.'; end if;
  if exists (select 1 from unnest(v_ids) i
             where not exists (select 1 from presupuesto.vendedores v where v.id = i and v.company_id = p_company_id)) then
    raise exception 'Algún vendedor no existe en esta empresa.';
  end if;

  update presupuesto.vendedores v
    set en_tablero = (v.id = any(v_ids)), updated_at = now()
    where v.company_id = p_company_id and v.en_tablero is distinct from (v.id = any(v_ids));

  select count(*) filter (where v.en_tablero), count(*) filter (where not v.en_tablero)
    into v_mostrados, v_ocultos
  from presupuesto.vendedores v where v.company_id = p_company_id;

  perform core.fn_auditar(v_uid, p_company_id, 'presupuesto.tablero.guardar', 'presupuesto.vendedores', null::text,
    jsonb_build_object('mostrados', v_mostrados, 'ocultos', v_ocultos, 'vendedor_ids', to_jsonb(v_ids)));
  return jsonb_build_object('mostrados', v_mostrados, 'ocultos', v_ocultos);
end;
$$;

-- Alcance de las lecturas de clientes ----------------------------------------
-- Devuelve el vendedor al que se limita la consulta (null = todos) y si quien
-- llama ve a todos. Sin factura.ver se limita a su vendedor vinculado; sin
-- vínculo, `vinculado` es false.
create or replace function presupuesto.fn_alcance_facturas(p_company_id uuid, p_vendedor_id uuid,
  out todos boolean, out vendedor_id uuid, out vinculado boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid;
begin
  v_uid := presupuesto.fn_exigir_alguno(p_company_id, array[
    'presupuesto.ventas.factura.ver', 'presupuesto.ventas.factura_propia.ver']);
  todos := core.has_permission(v_uid, p_company_id, 'presupuesto.ventas.factura.ver');
  if todos then
    vendedor_id := p_vendedor_id;
    if vendedor_id is not null and not exists (
      select 1 from presupuesto.vendedores v where v.id = vendedor_id and v.company_id = p_company_id) then
      raise exception 'El vendedor no existe.';
    end if;
    vinculado := true;
  else
    vendedor_id := presupuesto.fn_mi_vendedor(v_uid, p_company_id);
    vinculado := vendedor_id is not null;
  end if;
end;
$$;

-- Clientes con su última factura ---------------------------------------------
-- p_orden: 'reciente' (última factura primero, por defecto), 'monto' (total
-- histórico) o 'nombre'.
create or replace function public.presupuesto_clientes(
  p_company_id uuid, p_vendedor_id uuid default null, p_busqueda text default null,
  p_orden text default 'reciente', p_limite integer default 50, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  a record;
  v_q text := nullif(btrim(coalesce(p_busqueda, '')), '');
  v_orden text := coalesce(nullif(p_orden, ''), 'reciente');
  v_inicio_anio date := date_trunc('year', current_date)::date;
begin
  select * into a from presupuesto.fn_alcance_facturas(p_company_id, p_vendedor_id);
  if v_orden not in ('reciente', 'monto', 'nombre') then raise exception 'Orden inválido.'; end if;
  if v_q is not null and length(v_q) > 100 then raise exception 'La búsqueda es demasiado larga.'; end if;
  if not a.vinculado then
    return jsonb_build_object('vinculado', false, 'alcance', 'propio', 'vendedor_id', null,
      'ultima_factura', null, 'total', 0, 'filas', '[]'::jsonb);
  end if;

  return (
    with base as (
      select coalesce(nullif(btrim(f.cliente), ''), '(Sin cliente)') as cliente,
             f.fecha, f.numero, f.total_usd, f.total_cs, f.vendedor_id
      from presupuesto.facturas f
      where f.company_id = p_company_id and not f.anulada
        and (a.vendedor_id is null or f.vendedor_id = a.vendedor_id)
    ),
    agg as (
      select b.cliente, count(*) as facturas,
             sum(b.total_usd) as total_usd, sum(b.total_cs) as total_cs,
             coalesce(sum(b.total_usd) filter (where b.fecha >= v_inicio_anio), 0) as usd_anio,
             max(b.fecha) as ultima_fecha
      from base b
      where v_q is null or b.cliente ilike '%' || v_q || '%'
      group by b.cliente
    ),
    ultima as (
      select distinct on (b.cliente) b.cliente, b.numero, b.total_usd, b.vendedor_id
      from base b join agg g on g.cliente = b.cliente
      order by b.cliente, b.fecha desc, b.numero desc
    ),
    pagina as (
      select g.*, u.numero as ultimo_numero, u.total_usd as ultimo_usd, u.vendedor_id as ultimo_vendedor_id
      from agg g join ultima u on u.cliente = g.cliente
      order by
        case when v_orden = 'reciente' then g.ultima_fecha end desc nulls last,
        case when v_orden = 'monto' then g.total_usd end desc nulls last,
        g.cliente
      limit least(greatest(coalesce(p_limite, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)
    )
    select jsonb_build_object(
      'vinculado', true,
      'alcance', case when a.todos then 'todos' else 'propio' end,
      'vendedor_id', a.vendedor_id,
      'ultima_factura', (select max(b.fecha) from base b),
      'total', (select count(*) from agg),
      'filas', coalesce((select jsonb_agg(jsonb_build_object(
          'cliente', p.cliente,
          'facturas', p.facturas,
          'total_usd', round(p.total_usd, 2),
          'total_cs', round(p.total_cs, 2),
          'usd_anio', round(p.usd_anio, 2),
          'ultima_fecha', p.ultima_fecha,
          'dias_desde', current_date - p.ultima_fecha,
          'ultimo_numero', p.ultimo_numero,
          'ultimo_usd', round(p.ultimo_usd, 2),
          'ultimo_vendedor', case when a.todos then (
            select jsonb_build_object('id', v.id, 'codigo', v.codigo, 'nombre', v.nombre)
            from presupuesto.vendedores v where v.id = p.ultimo_vendedor_id) end
        ) order by
          case when v_orden = 'reciente' then p.ultima_fecha end desc nulls last,
          case when v_orden = 'monto' then p.total_usd end desc nulls last,
          p.cliente)
        from pagina p), '[]'::jsonb)
    )
  );
end;
$$;

-- Lo facturado a un cliente --------------------------------------------------
create or replace function public.presupuesto_facturas_cliente(
  p_company_id uuid, p_cliente text, p_vendedor_id uuid default null,
  p_limite integer default 50, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  a record;
  v_cliente text := btrim(coalesce(p_cliente, ''));
begin
  select * into a from presupuesto.fn_alcance_facturas(p_company_id, p_vendedor_id);
  if v_cliente = '' or length(v_cliente) > 200 then raise exception 'Cliente inválido.'; end if;
  if not a.vinculado then
    return jsonb_build_object('vinculado', false, 'alcance', 'propio', 'cliente', v_cliente, 'total', 0, 'filas', '[]'::jsonb);
  end if;

  return (
    with base as (
      select f.fecha, f.numero, f.anulada, f.total_usd, f.total_cs, f.vendedor_id
      from presupuesto.facturas f
      where f.company_id = p_company_id
        and coalesce(nullif(btrim(f.cliente), ''), '(Sin cliente)') = v_cliente
        and (a.vendedor_id is null or f.vendedor_id = a.vendedor_id)
    )
    select jsonb_build_object(
      'vinculado', true,
      'alcance', case when a.todos then 'todos' else 'propio' end,
      'cliente', v_cliente,
      'total', (select count(*) from base),
      'facturas', (select count(*) from base where not anulada),
      'anuladas', (select count(*) from base where anulada),
      'total_usd', (select round(coalesce(sum(total_usd), 0), 2) from base where not anulada),
      'total_cs', (select round(coalesce(sum(total_cs), 0), 2) from base where not anulada),
      'primera_fecha', (select min(fecha) from base where not anulada),
      'ultima_fecha', (select max(fecha) from base where not anulada),
      'filas', coalesce((select jsonb_agg(jsonb_build_object(
          'fecha', x.fecha, 'numero', x.numero, 'anulada', x.anulada,
          'total_usd', x.total_usd, 'total_cs', x.total_cs,
          'vendedor', case when a.todos then jsonb_build_object('id', v.id, 'codigo', v.codigo, 'nombre', v.nombre) end
        ) order by x.fecha desc, x.numero desc)
        from (select * from base b order by b.fecha desc, b.numero desc
              limit least(greatest(coalesce(p_limite, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) x
        left join presupuesto.vendedores v on v.id = x.vendedor_id), '[]'::jsonb)
    )
  );
end;
$$;

-- Permisos de ejecución ------------------------------------------------------
revoke all on function presupuesto.fn_alcance_facturas(uuid, uuid) from public, anon, authenticated;
revoke all on function
  public.presupuesto_guardar_tablero(uuid, uuid[]),
  public.presupuesto_clientes(uuid, uuid, text, text, integer, integer),
  public.presupuesto_facturas_cliente(uuid, text, uuid, integer, integer)
from public, anon;
grant execute on function
  public.presupuesto_guardar_tablero(uuid, uuid[]),
  public.presupuesto_clientes(uuid, uuid, text, text, integer, integer),
  public.presupuesto_facturas_cliente(uuid, text, uuid, integer, integer)
to authenticated;

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
  if v_rpc <> 17 or v_anon <> 0 or v_auth <> 17 then
    raise exception 'Poscheque: RPC %, anon %, authenticated % (se esperaban 17, 0, 17)', v_rpc, v_anon, v_auth;
  end if;
  if has_function_privilege('authenticated', 'presupuesto.fn_alcance_facturas(uuid,uuid)', 'execute') then
    raise exception 'Poscheque: el helper de alcance no debe ser ejecutable por authenticated';
  end if;
end $$;
