-- =============================================================================
-- App Presupuesto (fase 1: presupuesto de ventas y metas) — esquema + RPC
--
-- Diseño: docs/plan/19-presupuesto.md. Requiere el Paso Cero
-- 20261020183127_presupuesto_paso_cero (aprobado por el usuario 2026-10-20).
--
-- Es el esquema de Metas de ventas (20261018135152_metas_esquema, plan 15),
-- que se borró con el CRM en 20261020143821, renombrado:
--   schema metas -> presupuesto; public.metas_* -> public.presupuesto_*
--   (metas_presupuesto -> presupuesto_anual, metas_guardar_presupuesto ->
--   presupuesto_guardar_anual); códigos metas.* -> presupuesto.* del Paso
--   Cero; mensajes en "tú". Se agrega public.presupuesto_mis_permisos.
-- La lógica es la misma que ya se probó en remoto el 2026-10-18.
--
-- Resumen:
--   1. Schema presupuesto (sin exponer a la API: todo por RPC public.presupuesto_*):
--        vendedores      catálogo; código de AG Negocio ↔ usuario de Nexo (opcional)
--        facturas        hechos; PARTICIONADA por mes (fecha de la factura)
--        importaciones   log de cada Excel subido; PARTICIONADA por mes
--        presupuestos    venta base + % de crecimiento por año
--        presupuesto_meses  % y monto del presupuesto por mes
--        metas_vendedor  meta mensual por vendedor (sugerida o ajustada)
--   2. Montos de meta en US$; C$ de referencia con el tipo de cambio implícito
--      de las facturas del mes (sum C$ / sum US$).
--   3. Meta sugerida: la meta del mes de la empresa repartida según lo vendido
--      por cada vendedor ACTIVO en los 3 meses anteriores (decisión 2026-10-18,
--      por la rotación de vendedores que muestran los datos reales).
--   4. "Lo propio" = vendedor cuyo user_id es el usuario que llama. Sin
--      vínculo, las RPC propias no devuelven datos.
--   5. Volver a importar el mismo Excel no duplica: la factura se identifica
--      por (empresa, número).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Prechecks
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regnamespace('presupuesto') is not null then
    raise exception 'precheck: el schema presupuesto ya existe';
  end if;
  if (select count(*) from core.permissions_catalog where module_slug = 'presupuesto') <> 9 then
    raise exception 'precheck: falta el Paso Cero de Presupuesto (9 permisos)';
  end if;
end;
$$;

create schema presupuesto;
revoke all on schema presupuesto from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1. Catálogos
-- -----------------------------------------------------------------------------
create table presupuesto.vendedores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  codigo text not null check (length(btrim(codigo)) between 1 and 40),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  user_id uuid references auth.users(id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index vendedores_codigo_uq on presupuesto.vendedores (company_id, lower(codigo));
create unique index vendedores_user_uq on presupuesto.vendedores (company_id, user_id) where user_id is not null;
create index vendedores_user_idx on presupuesto.vendedores (user_id);
comment on table presupuesto.vendedores is
  'Vendedores de AG Negocio (código "001" de "001-Edith Saballo"). Se crean solos al importar facturas; user_id los vincula con su cuenta de Nexo (un usuario = un vendedor por empresa).';

create table presupuesto.presupuestos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  anio integer not null check (anio between 2000 and 2100),
  venta_base_usd numeric(16,2) not null check (venta_base_usd >= 0),
  crecimiento numeric(7,4) not null check (crecimiento > -1 and crecimiento <= 10),
  total_usd numeric(16,2) not null check (total_usd >= 0),
  actualizado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, anio),
  unique (id, company_id)
);
comment on table presupuesto.presupuestos is 'Presupuesto anual de la empresa: total = venta base × (1 + crecimiento). Ej. 2026 = venta 2025 + 32%.';

create table presupuesto.presupuesto_meses (
  company_id uuid not null,
  presupuesto_id uuid not null,
  mes integer not null check (mes between 1 and 12),
  porcentaje numeric(8,6) not null check (porcentaje between 0 and 1),
  monto_usd numeric(16,2) not null check (monto_usd >= 0),
  primary key (presupuesto_id, mes),
  foreign key (presupuesto_id, company_id) references presupuesto.presupuestos (id, company_id) on delete cascade
);
create index presupuesto_meses_company_idx on presupuesto.presupuesto_meses (company_id);

create table presupuesto.metas_vendedor (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  vendedor_id uuid not null,
  anio integer not null check (anio between 2000 and 2100),
  mes integer not null check (mes between 1 and 12),
  monto_usd numeric(16,2) not null check (monto_usd >= 0),
  origen text not null check (origen in ('sugerida', 'ajustada')),
  actualizado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendedor_id, anio, mes),
  foreign key (vendedor_id, company_id) references presupuesto.vendedores (id, company_id) on delete cascade
);
create index metas_vendedor_company_periodo_idx on presupuesto.metas_vendedor (company_id, anio, mes);
comment on table presupuesto.metas_vendedor is 'Meta mensual de cada vendedor en US$. origen=ajustada: la puso el gerente y generar sugeridas no la pisa salvo que se pida.';

-- -----------------------------------------------------------------------------
-- 2. Hechos particionados
-- -----------------------------------------------------------------------------
create table presupuesto.importaciones (
  id uuid not null default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  company_id uuid not null references core.companies(id),
  user_id uuid not null references auth.users(id),
  archivo text check (archivo is null or length(archivo) <= 200),
  filas integer not null default 0,
  nuevas integer not null default 0,
  actualizadas integer not null default 0,
  errores integer not null default 0,
  vendedores_nuevos integer not null default 0,
  fecha_min date,
  fecha_max date,
  primary key (id, creado_en)
) partition by range (creado_en);

create table presupuesto.facturas (
  id uuid not null default gen_random_uuid(),
  fecha date not null,
  company_id uuid not null references core.companies(id),
  numero text not null check (length(btrim(numero)) between 1 and 40),
  vencimiento date,
  cliente text check (cliente is null or length(cliente) <= 200),
  anulada boolean not null default false,
  total_cs numeric(16,2) not null,
  total_usd numeric(16,4) not null,
  vendedor_id uuid not null,
  importacion_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, fecha),
  unique (company_id, numero, fecha),
  foreign key (vendedor_id, company_id) references presupuesto.vendedores (id, company_id)
) partition by range (fecha);
comment on table presupuesto.facturas is
  'Facturas de venta importadas de AG Negocio. Particionada por mes de fecha. La identidad de negocio es (company_id, numero); la importación borra la versión con otra fecha antes de insertar. importacion_id sin FK (la PK de importaciones incluye creado_en).';

create or replace function presupuesto.fn_asegurar_particion_facturas(p_mes date)
returns void language plpgsql set search_path = presupuesto, pg_temp as $$
declare
  particion text := 'facturas_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('presupuesto.' || particion) is null then
    execute format('create table presupuesto.%I partition of presupuesto.facturas for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on presupuesto.%I (company_id, fecha)', particion);
    execute format('create index on presupuesto.%I (vendedor_id, fecha)', particion);
    execute format('create index on presupuesto.%I (company_id, numero)', particion);
    execute format('create index on presupuesto.%I (importacion_id)', particion);
    execute format('alter table presupuesto.%I enable row level security', particion);
  end if;
end;
$$;

create or replace function presupuesto.fn_asegurar_particion_importaciones(p_mes date)
returns void language plpgsql set search_path = presupuesto, pg_temp as $$
declare
  particion text := 'importaciones_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('presupuesto.' || particion) is null then
    execute format('create table presupuesto.%I partition of presupuesto.importaciones for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on presupuesto.%I (company_id, creado_en)', particion);
    execute format('create index on presupuesto.%I (user_id)', particion);
    execute format('alter table presupuesto.%I enable row level security', particion);
  end if;
end;
$$;

insert into core.tablas_particionadas (schema_nombre, tabla_nombre, fn_asegurar_particion) values
  ('presupuesto', 'facturas', 'presupuesto.fn_asegurar_particion_facturas'),
  ('presupuesto', 'importaciones', 'presupuesto.fn_asegurar_particion_importaciones');

-- Histórico: el Excel trae facturas desde 2023-01.
do $$
declare m date := date '2023-01-01';
begin
  while m <= date_trunc('month', now())::date loop
    perform presupuesto.fn_asegurar_particion_facturas(m);
    m := (m + interval '1 month')::date;
  end loop;
end;
$$;
select core.fn_asegurar_particiones_futuras(3);

alter table presupuesto.vendedores enable row level security;
alter table presupuesto.presupuestos enable row level security;
alter table presupuesto.presupuesto_meses enable row level security;
alter table presupuesto.metas_vendedor enable row level security;
alter table presupuesto.importaciones enable row level security;
alter table presupuesto.facturas enable row level security;
revoke all on all tables in schema presupuesto from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Helpers internos
-- -----------------------------------------------------------------------------
-- Vendedor vinculado al usuario (null si no tiene).
create or replace function presupuesto.fn_mi_vendedor(p_user_id uuid, p_company_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select v.id from presupuesto.vendedores v
  where v.company_id = p_company_id and v.user_id = p_user_id;
$$;

-- Exige al menos uno de los permisos.
create or replace function presupuesto.fn_exigir_alguno(p_company_id uuid, p_codes text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  c text;
begin
  if v_uid is not null then
    foreach c in array p_codes loop
      if core.has_permission(v_uid, p_company_id, c) then return v_uid; end if;
    end loop;
  end if;
  raise exception using errcode = '42501',
    message = format('No tienes permiso para esta acción (%s).', array_to_string(p_codes, ' o '));
end;
$$;

-- Tipo de cambio implícito C$/US$ de un mes (facturas no anuladas); si el mes
-- no tiene facturas, el del último mes que tenga.
create or replace function presupuesto.fn_tipo_cambio(p_company_id uuid, p_anio integer, p_mes integer)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select sum(f.total_cs) / nullif(sum(f.total_usd), 0) from presupuesto.facturas f
      where f.company_id = p_company_id and not f.anulada
        and f.fecha >= make_date(p_anio, p_mes, 1)
        and f.fecha < (make_date(p_anio, p_mes, 1) + interval '1 month')::date),
    (select sum(f.total_cs) / nullif(sum(f.total_usd), 0) from presupuesto.facturas f
      where f.company_id = p_company_id and not f.anulada
        and f.fecha >= (select date_trunc('month', max(x.fecha))::date from presupuesto.facturas x
                        where x.company_id = p_company_id and x.fecha < make_date(p_anio, p_mes, 1))
        and f.fecha < make_date(p_anio, p_mes, 1))
  );
$$;

-- Meta sugerida del mes: meta de la empresa × peso de cada vendedor activo en
-- los 3 meses anteriores. Vendedores activos sin ventas en la ventana quedan
-- con 0 (el gerente la ajusta).
create or replace function presupuesto.fn_sugerencias(p_company_id uuid, p_anio integer, p_mes integer)
returns table (vendedor_id uuid, base_usd numeric, peso numeric, sugerida_usd numeric)
language sql stable security definer set search_path = '' as $$
  with meta_mes as (
    select pm.monto_usd from presupuesto.presupuestos p
    join presupuesto.presupuesto_meses pm on pm.presupuesto_id = p.id
    where p.company_id = p_company_id and p.anio = p_anio and pm.mes = p_mes
  ),
  base as (
    select v.id, coalesce(sum(f.total_usd) filter (where not f.anulada), 0) as usd
    from presupuesto.vendedores v
    left join presupuesto.facturas f on f.vendedor_id = v.id and f.company_id = p_company_id
      and f.fecha >= (make_date(p_anio, p_mes, 1) - interval '3 months')::date
      and f.fecha < make_date(p_anio, p_mes, 1)
    where v.company_id = p_company_id and v.activo
    group by v.id
  ),
  tot as (select sum(b.usd) as t from base b)
  select b.id, round(b.usd, 2),
         case when tot.t > 0 then round(b.usd / tot.t, 6) else 0 end,
         case when tot.t > 0 then round((select monto_usd from meta_mes) * b.usd / tot.t, 2) else 0 end
  from base b cross join tot;
$$;

-- Avance de un vendedor en un mes.
create or replace function presupuesto.fn_avance_vendedor(p_company_id uuid, p_vendedor_id uuid, p_anio integer, p_mes integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'meta_usd', (select mv.monto_usd from presupuesto.metas_vendedor mv
                 where mv.vendedor_id = p_vendedor_id and mv.anio = p_anio and mv.mes = p_mes),
    'meta_origen', (select mv.origen from presupuesto.metas_vendedor mv
                 where mv.vendedor_id = p_vendedor_id and mv.anio = p_anio and mv.mes = p_mes),
    'vendido_usd', coalesce(sum(f.total_usd) filter (where not f.anulada), 0),
    'vendido_cs', coalesce(sum(f.total_cs) filter (where not f.anulada), 0),
    'facturas', count(*) filter (where not f.anulada),
    'anuladas', count(*) filter (where f.anulada)
  )
  from presupuesto.facturas f
  where f.company_id = p_company_id and f.vendedor_id = p_vendedor_id
    and f.fecha >= make_date(p_anio, p_mes, 1)
    and f.fecha < (make_date(p_anio, p_mes, 1) + interval '1 month')::date;
$$;

-- Ventas y meta de un vendedor (o de la empresa si p_vendedor_id es null)
-- mes a mes en un año.
create or replace function presupuesto.fn_serie_anual(p_company_id uuid, p_vendedor_id uuid, p_anio integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'mes', m.mes,
    'vendido_usd', coalesce((
      select sum(f.total_usd) from presupuesto.facturas f
      where f.company_id = p_company_id and not f.anulada
        and (p_vendedor_id is null or f.vendedor_id = p_vendedor_id)
        and f.fecha >= make_date(p_anio, m.mes, 1)
        and f.fecha < (make_date(p_anio, m.mes, 1) + interval '1 month')::date), 0),
    'meta_usd', case when p_vendedor_id is null then
        (select pm.monto_usd from presupuesto.presupuestos p join presupuesto.presupuesto_meses pm on pm.presupuesto_id = p.id
         where p.company_id = p_company_id and p.anio = p_anio and pm.mes = m.mes)
      else
        (select mv.monto_usd from presupuesto.metas_vendedor mv
         where mv.vendedor_id = p_vendedor_id and mv.anio = p_anio and mv.mes = m.mes)
      end
  ) order by m.mes), '[]'::jsonb)
  from generate_series(1, 12) as m(mes);
$$;

create or replace function presupuesto.fn_validar_periodo(p_anio integer, p_mes integer)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_anio is null or p_anio not between 2000 and 2100 then raise exception 'Año inválido.'; end if;
  if p_mes is not null and p_mes not between 1 and 12 then raise exception 'Mes inválido.'; end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. RPC de lectura
-- -----------------------------------------------------------------------------
create or replace function public.presupuesto_mi_avance(p_company_id uuid, p_anio integer, p_mes integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_vend presupuesto.vendedores;
  v_av jsonb;
  v_tc numeric;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.metas.avance_propio.ver');
  perform presupuesto.fn_validar_periodo(p_anio, p_mes);
  select * into v_vend from presupuesto.vendedores v where v.company_id = p_company_id and v.user_id = v_uid;
  if not found then
    return jsonb_build_object('vinculado', false);
  end if;
  v_av := presupuesto.fn_avance_vendedor(p_company_id, v_vend.id, p_anio, p_mes);
  v_tc := presupuesto.fn_tipo_cambio(p_company_id, p_anio, p_mes);
  return jsonb_build_object(
    'vinculado', true,
    'vendedor', jsonb_build_object('id', v_vend.id, 'codigo', v_vend.codigo, 'nombre', v_vend.nombre, 'activo', v_vend.activo),
    'avance', v_av,
    'tipo_cambio', round(v_tc, 4),
    'serie', presupuesto.fn_serie_anual(p_company_id, v_vend.id, p_anio),
    'ultima_factura', (select max(f.fecha) from presupuesto.facturas f where f.company_id = p_company_id)
  );
end;
$$;

create or replace function public.presupuesto_mis_facturas(
  p_company_id uuid, p_anio integer, p_mes integer, p_limite integer default 50, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_vend uuid;
  v_desde date;
  v_hasta date;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.ventas.factura_propia.ver');
  perform presupuesto.fn_validar_periodo(p_anio, p_mes);
  v_vend := presupuesto.fn_mi_vendedor(v_uid, p_company_id);
  if v_vend is null then return jsonb_build_object('vinculado', false, 'total', 0, 'filas', '[]'::jsonb); end if;
  v_desde := make_date(p_anio, coalesce(p_mes, 1), 1);
  v_hasta := case when p_mes is null then make_date(p_anio + 1, 1, 1) else (v_desde + interval '1 month')::date end;
  return jsonb_build_object(
    'vinculado', true,
    'total', (select count(*) from presupuesto.facturas f where f.company_id = p_company_id and f.vendedor_id = v_vend
              and f.fecha >= v_desde and f.fecha < v_hasta),
    'filas', coalesce((select jsonb_agg(to_jsonb(x) order by x.fecha desc, x.numero desc) from (
      select f.fecha, f.numero, f.cliente, f.anulada, f.total_cs, f.total_usd
      from presupuesto.facturas f
      where f.company_id = p_company_id and f.vendedor_id = v_vend and f.fecha >= v_desde and f.fecha < v_hasta
      order by f.fecha desc, f.numero desc
      limit least(greatest(coalesce(p_limite, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb)
  );
end;
$$;

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
      select v.id, v.codigo, v.nombre, v.activo, (v.user_id is not null) as vinculado,
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

create or replace function public.presupuesto_facturas(
  p_company_id uuid, p_desde date, p_hasta date, p_vendedor_id uuid default null,
  p_busqueda text default null, p_limite integer default 50, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(btrim(coalesce(p_busqueda, '')), '');
begin
  perform core.fn_exigir_permiso(p_company_id, 'presupuesto.ventas.factura.ver');
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'Rango de fechas inválido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El rango máximo es de 400 días.'; end if;
  return jsonb_build_object(
    'total', (select count(*) from presupuesto.facturas f
              where f.company_id = p_company_id and f.fecha between p_desde and p_hasta
                and (p_vendedor_id is null or f.vendedor_id = p_vendedor_id)
                and (v_q is null or f.numero ilike '%' || v_q || '%' or f.cliente ilike '%' || v_q || '%')),
    'filas', coalesce((select jsonb_agg(to_jsonb(x) order by x.fecha desc, x.numero desc) from (
      select f.fecha, f.numero, f.cliente, f.anulada, f.total_cs, f.total_usd,
             v.id as vendedor_id, v.codigo as vendedor_codigo, v.nombre as vendedor_nombre
      from presupuesto.facturas f join presupuesto.vendedores v on v.id = f.vendedor_id
      where f.company_id = p_company_id and f.fecha between p_desde and p_hasta
        and (p_vendedor_id is null or f.vendedor_id = p_vendedor_id)
        and (v_q is null or f.numero ilike '%' || v_q || '%' or f.cliente ilike '%' || v_q || '%')
      order by f.fecha desc, f.numero desc
      limit least(greatest(coalesce(p_limite, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.presupuesto_vendedores(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform presupuesto.fn_exigir_alguno(p_company_id, array[
    'presupuesto.metas.avance_equipo.ver', 'presupuesto.ventas.factura.ver',
    'presupuesto.metas.meta_vendedor.gestionar', 'presupuesto.configuracion.vendedor.gestionar']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', v.id, 'codigo', v.codigo, 'nombre', v.nombre, 'activo', v.activo, 'user_id', v.user_id,
      'usuario_nombre', coalesce(p.nombre_completo, u.email),
      'ultima_venta', (select max(f.fecha) from presupuesto.facturas f where f.vendedor_id = v.id and f.company_id = p_company_id)
    ) order by v.activo desc, v.codigo)
    from presupuesto.vendedores v
    left join auth.users u on u.id = v.user_id
    left join core.perfiles p on p.user_id = v.user_id
    where v.company_id = p_company_id), '[]'::jsonb);
end;
$$;

-- Usuarios activos de la empresa que se pueden vincular a un vendedor.
create or replace function public.presupuesto_usuarios_vinculables(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform core.fn_exigir_permiso(p_company_id, 'presupuesto.configuracion.vendedor.gestionar');
  return coalesce((select jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'nombre', coalesce(p.nombre_completo, u.email), 'email', u.email,
      'vendedor_id', (select v.id from presupuesto.vendedores v where v.company_id = p_company_id and v.user_id = m.user_id)
    ) order by coalesce(p.nombre_completo, u.email))
    from core.company_memberships m
    join auth.users u on u.id = m.user_id
    left join core.perfiles p on p.user_id = m.user_id
    where m.company_id = p_company_id and m.activo), '[]'::jsonb);
end;
$$;

create or replace function public.presupuesto_anual(p_company_id uuid, p_anio integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_p presupuesto.presupuestos;
  v_base numeric;
begin
  perform presupuesto.fn_exigir_alguno(p_company_id, array[
    'presupuesto.metas.avance_equipo.ver', 'presupuesto.ventas.presupuesto_anual.gestionar', 'presupuesto.metas.meta_vendedor.gestionar']);
  perform presupuesto.fn_validar_periodo(p_anio, null);
  select * into v_p from presupuesto.presupuestos p where p.company_id = p_company_id and p.anio = p_anio;
  select coalesce(sum(f.total_usd) filter (where not f.anulada), 0) into v_base
  from presupuesto.facturas f
  where f.company_id = p_company_id and f.fecha >= make_date(p_anio - 1, 1, 1) and f.fecha < make_date(p_anio, 1, 1);
  return jsonb_build_object(
    'existe', v_p.id is not null,
    'venta_base_usd', v_p.venta_base_usd,
    'crecimiento', v_p.crecimiento,
    'total_usd', v_p.total_usd,
    'actualizado', v_p.updated_at,
    'meses', coalesce((select jsonb_agg(jsonb_build_object('mes', pm.mes, 'porcentaje', pm.porcentaje, 'monto_usd', pm.monto_usd) order by pm.mes)
                       from presupuesto.presupuesto_meses pm where pm.presupuesto_id = v_p.id), '[]'::jsonb),
    -- Sugerencias para llenar el formulario: venta del año anterior y su reparto mensual.
    'sugerido', jsonb_build_object(
      'venta_base_usd', round(v_base, 2),
      'porcentajes', (select jsonb_agg(case when v_base > 0 then round(coalesce((
          select sum(f.total_usd) from presupuesto.facturas f
          where f.company_id = p_company_id and not f.anulada
            and f.fecha >= make_date(p_anio - 1, m.mes, 1)
            and f.fecha < (make_date(p_anio - 1, m.mes, 1) + interval '1 month')::date), 0) / v_base, 6)
          else round(1.0 / 12, 6) end order by m.mes)
        from generate_series(1, 12) as m(mes)))
  );
end;
$$;

create or replace function public.presupuesto_metas_mes(p_company_id uuid, p_anio integer, p_mes integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform core.fn_exigir_permiso(p_company_id, 'presupuesto.metas.meta_vendedor.gestionar');
  perform presupuesto.fn_validar_periodo(p_anio, p_mes);
  return jsonb_build_object(
    'meta_empresa_usd', (select pm.monto_usd from presupuesto.presupuestos p join presupuesto.presupuesto_meses pm on pm.presupuesto_id = p.id
                         where p.company_id = p_company_id and p.anio = p_anio and pm.mes = p_mes),
    'vendedores', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'codigo', v.codigo, 'nombre', v.nombre, 'activo', v.activo,
        'meta_usd', mv.monto_usd, 'meta_origen', mv.origen,
        'base_usd', s.base_usd, 'peso', s.peso, 'sugerida_usd', s.sugerida_usd
      ) order by coalesce(s.sugerida_usd, 0) desc, v.codigo)
      from presupuesto.vendedores v
      left join presupuesto.metas_vendedor mv on mv.vendedor_id = v.id and mv.anio = p_anio and mv.mes = p_mes
      left join presupuesto.fn_sugerencias(p_company_id, p_anio, p_mes) s on s.vendedor_id = v.id
      where v.company_id = p_company_id and (v.activo or mv.id is not null)), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC de escritura
-- -----------------------------------------------------------------------------
-- Importa un lote (máx. 5000) del reporte de facturas de AG Negocio. El cliente
-- parsea el Excel y manda filas:
--   {fila, fecha 'YYYY-MM-DD', vencimiento, numero, cliente, anulada (bool),
--    total_cs, total_usd, vendedor ('001-Edith  Saballo')}
-- Varios lotes del mismo archivo comparten p_importacion_id (el primero lo
-- recibe en la respuesta). p_confirmar=false valida sin escribir nada.
create or replace function public.presupuesto_importar_facturas(
  p_company_id uuid, p_importacion_id uuid, p_archivo text, p_filas jsonb, p_confirmar boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_imp_id uuid := p_importacion_id;
  v_imp_creado timestamptz;
  r jsonb;
  v_fila integer;
  v_fecha date; v_venc date; v_num text; v_cli text; v_anul boolean; v_cs numeric; v_usd numeric;
  v_vend_raw text; v_cod text; v_nom text; v_vend_id uuid;
  v_nuevas integer := 0; v_act integer := 0; v_vend_nuevos integer := 0;
  v_errores jsonb := '[]'::jsonb;
  v_min date; v_max date;
  v_n integer;
  v_existe boolean;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.ventas.factura.importar');
  if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Formato de importación inválido.'; end if;
  if jsonb_array_length(p_filas) > 5000 then raise exception 'Máximo 5000 filas por lote.'; end if;

  if v_imp_id is not null then
    select i.creado_en into v_imp_creado from presupuesto.importaciones i
    where i.id = v_imp_id and i.company_id = p_company_id and i.user_id = v_uid
      and i.creado_en > now() - interval '1 day';
    if not found then raise exception 'La importación indicada no existe o ya venció. Vuelve a subir el archivo.'; end if;
  end if;

  begin
    -- El registro de la importación nace dentro del bloque: en la vista previa
    -- se revierte junto con todo lo demás.
    if v_imp_id is null then
      perform presupuesto.fn_asegurar_particion_importaciones(current_date);
      insert into presupuesto.importaciones (company_id, user_id, archivo)
      values (p_company_id, v_uid, left(p_archivo, 200))
      returning id, creado_en into v_imp_id, v_imp_creado;
    end if;

    for r in select x from jsonb_array_elements(p_filas) x loop
      v_fila := coalesce(nullif(r->>'fila', '')::integer, 0);
      begin
        v_num := btrim(coalesce(r->>'numero', ''));
        if v_num = '' then raise exception 'Falta el número de factura.'; end if;
        if length(v_num) > 40 then raise exception 'Número de factura demasiado largo.'; end if;
        v_fecha := nullif(r->>'fecha', '')::date;
        if v_fecha is null then raise exception 'Falta la fecha.'; end if;
        if v_fecha < date '2000-01-01' or v_fecha > current_date + 31 then raise exception 'Fecha fuera de rango: %.', v_fecha; end if;
        v_venc := nullif(r->>'vencimiento', '')::date;
        v_cli := nullif(left(btrim(coalesce(r->>'cliente', '')), 200), '');
        v_anul := coalesce(nullif(r->>'anulada', '')::boolean, false);
        v_cs := nullif(r->>'total_cs', '')::numeric;
        v_usd := nullif(r->>'total_usd', '')::numeric;
        if v_cs is null or v_usd is null then raise exception 'Faltan los totales C$ o US$.'; end if;

        -- Vendedor: "001-Edith  Saballo" -> código 001, nombre "Edith Saballo".
        v_vend_raw := regexp_replace(btrim(coalesce(r->>'vendedor', '')), '\s+', ' ', 'g');
        if v_vend_raw = '' then raise exception 'Falta el vendedor.'; end if;
        if v_vend_raw ~ '^[^-]+-.+$' then
          v_cod := btrim(split_part(v_vend_raw, '-', 1));
          v_nom := btrim(substr(v_vend_raw, length(split_part(v_vend_raw, '-', 1)) + 2));
        else
          v_cod := v_vend_raw;
          v_nom := v_vend_raw;
        end if;
        v_cod := left(v_cod, 40); v_nom := left(v_nom, 120);

        select v.id into v_vend_id from presupuesto.vendedores v
        where v.company_id = p_company_id and lower(v.codigo) = lower(v_cod);
        if not found then
          insert into presupuesto.vendedores (company_id, codigo, nombre) values (p_company_id, v_cod, v_nom)
          returning id into v_vend_id;
          v_vend_nuevos := v_vend_nuevos + 1;
        end if;

        perform presupuesto.fn_asegurar_particion_facturas(v_fecha);
        -- Misma factura con otra fecha (corrección en AG Negocio): se reemplaza.
        delete from presupuesto.facturas f where f.company_id = p_company_id and f.numero = v_num and f.fecha <> v_fecha;
        get diagnostics v_n = row_count;
        v_existe := exists (select 1 from presupuesto.facturas f
                            where f.company_id = p_company_id and f.numero = v_num and f.fecha = v_fecha);

        insert into presupuesto.facturas as f (fecha, company_id, numero, vencimiento, cliente, anulada, total_cs, total_usd, vendedor_id, importacion_id)
        values (v_fecha, p_company_id, v_num, v_venc, v_cli, v_anul, v_cs, v_usd, v_vend_id, v_imp_id)
        on conflict (company_id, numero, fecha) do update
          set vencimiento = excluded.vencimiento, cliente = excluded.cliente, anulada = excluded.anulada,
              total_cs = excluded.total_cs, total_usd = excluded.total_usd, vendedor_id = excluded.vendedor_id,
              importacion_id = excluded.importacion_id, updated_at = now();
        if v_existe or v_n > 0 then v_act := v_act + 1; else v_nuevas := v_nuevas + 1; end if;

        v_min := least(coalesce(v_min, v_fecha), v_fecha);
        v_max := greatest(coalesce(v_max, v_fecha), v_fecha);
      exception when others then
        if sqlstate = '42501' then raise; end if;
        v_errores := v_errores || jsonb_build_object('fila', v_fila, 'numero', v_num, 'error', sqlerrm);
      end;
    end loop;

    if not coalesce(p_confirmar, false) then
      raise exception using errcode = 'P0001', message = 'nexo:vista_previa';
    end if;
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'nexo:vista_previa' then raise; end if;
    -- Vista previa: todo lo de arriba se revirtió.
    return jsonb_build_object('confirmado', false, 'filas', jsonb_array_length(p_filas),
      'nuevas', v_nuevas, 'actualizadas', v_act, 'vendedores_nuevos', v_vend_nuevos,
      'errores', v_errores, 'fecha_min', v_min, 'fecha_max', v_max);
  end;

  update presupuesto.importaciones i
    set filas = i.filas + jsonb_array_length(p_filas), nuevas = i.nuevas + v_nuevas, actualizadas = i.actualizadas + v_act,
        errores = i.errores + jsonb_array_length(v_errores), vendedores_nuevos = i.vendedores_nuevos + v_vend_nuevos,
        fecha_min = least(i.fecha_min, v_min), fecha_max = greatest(i.fecha_max, v_max)
    where i.id = v_imp_id and i.creado_en = v_imp_creado;

  perform core.fn_auditar(v_uid, p_company_id, 'presupuesto.facturas.importar', 'presupuesto.importaciones', v_imp_id::text,
    jsonb_build_object('archivo', left(p_archivo, 200), 'filas', jsonb_array_length(p_filas), 'nuevas', v_nuevas,
                       'actualizadas', v_act, 'errores', jsonb_array_length(v_errores)));

  return jsonb_build_object('confirmado', true, 'importacion_id', v_imp_id, 'filas', jsonb_array_length(p_filas),
    'nuevas', v_nuevas, 'actualizadas', v_act, 'vendedores_nuevos', v_vend_nuevos,
    'errores', v_errores, 'fecha_min', v_min, 'fecha_max', v_max);
end;
$$;

create or replace function public.presupuesto_guardar_vendedor(
  p_company_id uuid, p_vendedor_id uuid, p_nombre text, p_user_id uuid, p_activo boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_antes presupuesto.vendedores;
  v_desp presupuesto.vendedores;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.configuracion.vendedor.gestionar');
  select * into v_antes from presupuesto.vendedores v where v.id = p_vendedor_id and v.company_id = p_company_id for update;
  if not found then raise exception 'El vendedor no existe.'; end if;
  if p_user_id is not null and not exists (
    select 1 from core.company_memberships m where m.user_id = p_user_id and m.company_id = p_company_id and m.activo
  ) then
    raise exception 'El usuario no pertenece a esta empresa o está inactivo.';
  end if;
  if p_user_id is not null and exists (
    select 1 from presupuesto.vendedores v where v.company_id = p_company_id and v.user_id = p_user_id and v.id <> p_vendedor_id
  ) then
    raise exception 'Ese usuario ya está vinculado a otro vendedor.';
  end if;
  if p_nombre is not null and length(btrim(p_nombre)) not between 1 and 120 then
    raise exception 'El nombre debe tener entre 1 y 120 caracteres.';
  end if;

  update presupuesto.vendedores v
    set nombre = coalesce(nullif(btrim(p_nombre), ''), v.nombre),
        user_id = p_user_id,
        activo = coalesce(p_activo, v.activo),
        updated_at = now()
    where v.id = p_vendedor_id
    returning * into v_desp;

  perform core.fn_auditar(v_uid, p_company_id, 'presupuesto.vendedor.guardar', 'presupuesto.vendedores', p_vendedor_id::text,
    jsonb_build_object('antes', jsonb_build_object('nombre', v_antes.nombre, 'user_id', v_antes.user_id, 'activo', v_antes.activo),
                       'despues', jsonb_build_object('nombre', v_desp.nombre, 'user_id', v_desp.user_id, 'activo', v_desp.activo)));
  return jsonb_build_object('id', v_desp.id, 'nombre', v_desp.nombre, 'user_id', v_desp.user_id, 'activo', v_desp.activo);
end;
$$;

-- p_porcentajes: 12 números (fracciones) que suman 1.
create or replace function public.presupuesto_guardar_anual(
  p_company_id uuid, p_anio integer, p_venta_base_usd numeric, p_crecimiento numeric, p_porcentajes numeric[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_total numeric;
  v_id uuid;
  v_suma numeric;
  i integer;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.ventas.presupuesto_anual.gestionar');
  perform presupuesto.fn_validar_periodo(p_anio, null);
  if p_venta_base_usd is null or p_venta_base_usd < 0 then raise exception 'La venta base debe ser un monto positivo.'; end if;
  if p_crecimiento is null or p_crecimiento <= -1 or p_crecimiento > 10 then raise exception 'El crecimiento debe estar entre -100%% y 1000%%.'; end if;
  if p_porcentajes is null or coalesce(array_length(p_porcentajes, 1), 0) <> 12 then raise exception 'Hacen falta los 12 porcentajes mensuales.'; end if;
  if exists (select 1 from unnest(p_porcentajes) x where x is null or x < 0 or x > 1) then raise exception 'Cada porcentaje mensual debe estar entre 0%% y 100%%.'; end if;
  select sum(x) into v_suma from unnest(p_porcentajes) x;
  if abs(v_suma - 1) > 0.0005 then
    raise exception 'Los porcentajes mensuales suman %, deben sumar 100%%.', round(v_suma * 100, 2) || '%';
  end if;

  v_total := round(p_venta_base_usd * (1 + p_crecimiento), 2);
  insert into presupuesto.presupuestos as p (company_id, anio, venta_base_usd, crecimiento, total_usd, actualizado_por)
  values (p_company_id, p_anio, round(p_venta_base_usd, 2), p_crecimiento, v_total, v_uid)
  on conflict (company_id, anio) do update
    set venta_base_usd = excluded.venta_base_usd, crecimiento = excluded.crecimiento, total_usd = excluded.total_usd,
        actualizado_por = v_uid, updated_at = now()
  returning p.id into v_id;

  delete from presupuesto.presupuesto_meses pm where pm.presupuesto_id = v_id;
  for i in 1..12 loop
    insert into presupuesto.presupuesto_meses (company_id, presupuesto_id, mes, porcentaje, monto_usd)
    values (p_company_id, v_id, i, p_porcentajes[i], round(v_total * p_porcentajes[i], 2));
  end loop;

  perform core.fn_auditar(v_uid, p_company_id, 'presupuesto.anual.guardar', 'presupuesto.presupuestos', v_id::text,
    jsonb_build_object('anio', p_anio, 'venta_base_usd', p_venta_base_usd, 'crecimiento', p_crecimiento, 'total_usd', v_total));
  return public.presupuesto_anual(p_company_id, p_anio);
end;
$$;

-- Escribe la meta sugerida de cada vendedor activo. Las ajustadas a mano se
-- conservan salvo p_reemplazar_ajustadas.
create or replace function public.presupuesto_generar_sugeridas(
  p_company_id uuid, p_anio integer, p_mes integer, p_reemplazar_ajustadas boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_n integer;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.metas.meta_vendedor.gestionar');
  perform presupuesto.fn_validar_periodo(p_anio, p_mes);
  if not exists (select 1 from presupuesto.presupuestos p join presupuesto.presupuesto_meses pm on pm.presupuesto_id = p.id
                 where p.company_id = p_company_id and p.anio = p_anio and pm.mes = p_mes) then
    raise exception 'Primero define el presupuesto de %.', p_anio;
  end if;

  insert into presupuesto.metas_vendedor as mv (company_id, vendedor_id, anio, mes, monto_usd, origen, actualizado_por)
  select p_company_id, s.vendedor_id, p_anio, p_mes, s.sugerida_usd, 'sugerida', v_uid
  from presupuesto.fn_sugerencias(p_company_id, p_anio, p_mes) s
  on conflict (vendedor_id, anio, mes) do update
    set monto_usd = excluded.monto_usd, origen = 'sugerida', actualizado_por = v_uid, updated_at = now()
    where mv.origen = 'sugerida' or coalesce(p_reemplazar_ajustadas, false);
  get diagnostics v_n = row_count;

  perform core.fn_auditar(v_uid, p_company_id, 'presupuesto.metas.generar_sugeridas', 'presupuesto.metas_vendedor', p_anio || '-' || lpad(p_mes::text, 2, '0'),
    jsonb_build_object('anio', p_anio, 'mes', p_mes, 'escritas', v_n, 'reemplazar_ajustadas', coalesce(p_reemplazar_ajustadas, false)));
  return public.presupuesto_metas_mes(p_company_id, p_anio, p_mes);
end;
$$;

create or replace function public.presupuesto_ajustar_meta(
  p_company_id uuid, p_vendedor_id uuid, p_anio integer, p_mes integer, p_monto_usd numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_antes numeric;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.metas.meta_vendedor.gestionar');
  perform presupuesto.fn_validar_periodo(p_anio, p_mes);
  if p_monto_usd is null or p_monto_usd < 0 or p_monto_usd > 1e12 then raise exception 'La meta debe ser un monto positivo.'; end if;
  if not exists (select 1 from presupuesto.vendedores v where v.id = p_vendedor_id and v.company_id = p_company_id) then
    raise exception 'El vendedor no existe.';
  end if;
  select mv.monto_usd into v_antes from presupuesto.metas_vendedor mv where mv.vendedor_id = p_vendedor_id and mv.anio = p_anio and mv.mes = p_mes;

  insert into presupuesto.metas_vendedor as mv (company_id, vendedor_id, anio, mes, monto_usd, origen, actualizado_por)
  values (p_company_id, p_vendedor_id, p_anio, p_mes, round(p_monto_usd, 2), 'ajustada', v_uid)
  on conflict (vendedor_id, anio, mes) do update
    set monto_usd = excluded.monto_usd, origen = 'ajustada', actualizado_por = v_uid, updated_at = now();

  perform core.fn_auditar(v_uid, p_company_id, 'presupuesto.meta.ajustar', 'presupuesto.metas_vendedor', p_vendedor_id::text,
    jsonb_build_object('anio', p_anio, 'mes', p_mes, 'antes', v_antes, 'despues', round(p_monto_usd, 2)));
  return jsonb_build_object('vendedor_id', p_vendedor_id, 'anio', p_anio, 'mes', p_mes, 'monto_usd', round(p_monto_usd, 2), 'origen', 'ajustada');
end;
$$;

-- Códigos presupuesto.* que tiene el usuario (para ocultar o deshabilitar en
-- la interfaz en una sola llamada). Igual que la que tenía el CRM. Ocultar no
-- protege: cada RPC vuelve a exigir su permiso.
create or replace function public.presupuesto_mis_permisos(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.ver_modulo');
  return coalesce((select jsonb_agg(pc.code order by pc.code) from core.permissions_catalog pc
                   where pc.module_slug = 'presupuesto' and core.has_permission(v_uid, p_company_id, pc.code)), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Permisos de ejecución
-- -----------------------------------------------------------------------------
revoke all on all functions in schema presupuesto from public, anon, authenticated;

revoke all on function
  public.presupuesto_mis_permisos(uuid),
  public.presupuesto_mi_avance(uuid, integer, integer),
  public.presupuesto_mis_facturas(uuid, integer, integer, integer, integer),
  public.presupuesto_equipo(uuid, integer, integer),
  public.presupuesto_facturas(uuid, date, date, uuid, text, integer, integer),
  public.presupuesto_vendedores(uuid),
  public.presupuesto_usuarios_vinculables(uuid),
  public.presupuesto_anual(uuid, integer),
  public.presupuesto_metas_mes(uuid, integer, integer),
  public.presupuesto_importar_facturas(uuid, uuid, text, jsonb, boolean),
  public.presupuesto_guardar_vendedor(uuid, uuid, text, uuid, boolean),
  public.presupuesto_guardar_anual(uuid, integer, numeric, numeric, numeric[]),
  public.presupuesto_generar_sugeridas(uuid, integer, integer, boolean),
  public.presupuesto_ajustar_meta(uuid, uuid, integer, integer, numeric)
from public, anon;

grant execute on function
  public.presupuesto_mis_permisos(uuid),
  public.presupuesto_mi_avance(uuid, integer, integer),
  public.presupuesto_mis_facturas(uuid, integer, integer, integer, integer),
  public.presupuesto_equipo(uuid, integer, integer),
  public.presupuesto_facturas(uuid, date, date, uuid, text, integer, integer),
  public.presupuesto_vendedores(uuid),
  public.presupuesto_usuarios_vinculables(uuid),
  public.presupuesto_anual(uuid, integer),
  public.presupuesto_metas_mes(uuid, integer, integer),
  public.presupuesto_importar_facturas(uuid, uuid, text, jsonb, boolean),
  public.presupuesto_guardar_vendedor(uuid, uuid, text, uuid, boolean),
  public.presupuesto_guardar_anual(uuid, integer, numeric, numeric, numeric[]),
  public.presupuesto_generar_sugeridas(uuid, integer, integer, boolean),
  public.presupuesto_ajustar_meta(uuid, uuid, integer, integer, numeric)
to authenticated;

comment on schema presupuesto is
  'App Presupuesto (docs/plan/19-presupuesto.md). Cerrado a la API: todo por RPC public.presupuesto_*.';

-- -----------------------------------------------------------------------------
-- 7. Poscheque
-- -----------------------------------------------------------------------------
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
  if v_rpc <> 14 or v_anon <> 0 or v_auth <> 14 then
    raise exception 'Poscheque: RPC %, anon %, authenticated % (se esperaban 14, 0, 14)', v_rpc, v_anon, v_auth;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'presupuesto' and has_function_privilege('authenticated', p.oid, 'execute')) then
    raise exception 'Poscheque: los helpers de presupuesto no deben ser ejecutables por authenticated';
  end if;
  if has_schema_privilege('authenticated', 'presupuesto', 'usage') or has_schema_privilege('anon', 'presupuesto', 'usage') then
    raise exception 'Poscheque: el schema presupuesto debe quedar cerrado a la API';
  end if;
  if (select count(*) from core.tablas_particionadas where schema_nombre = 'presupuesto') <> 2 then
    raise exception 'Poscheque: faltan las tablas particionadas en core.tablas_particionadas';
  end if;
  if to_regclass('presupuesto.facturas_2023_01') is null
     or to_regclass('presupuesto.facturas_' || to_char(now(), 'YYYY_MM')) is null then
    raise exception 'Poscheque: faltan particiones de facturas';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'presupuesto' and c.relkind in ('r', 'p') and not c.relrowsecurity) then
    raise exception 'Poscheque: hay tablas sin RLS';
  end if;
end $$;
